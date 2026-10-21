

/** Instance-owned state and host services are captured explicitly. */
/** @typedef {Pick<import('../core/battle.core-ports.types.js').ResolutionPorts, 'getPlayerStatus' | 'log' | 'esc' | 'drawCards' | 'countDrawnSpells' | 'findCard' | 'onHandConsumed'> & {combat: ReturnType<typeof import('../core/combat.factory.js').createCombatRuntime>}} M1Ports */
export function createM1Domain(context) {
const instanceRuntime = context.runtime;

/* ============================================================
 * effect-steps.m1.js —— M 批契约扩展执行件（M1，2026-09-27）
 *
 * 承接结构化 onPlay 的三个 M 批新语义，注册点在 battle.resolution.js 的
 * 结构化 op 循环（schema/capability 已同步放行，规则数据口径见
 * docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md）：
 *
 *   cleanse            净化（清除自身全部诅咒，combat.purify 与文本路径同源）
 *   draw.untilHandN    抽牌直到手牌达到 N 张（法力补给式）
 *   draw.handOps       抽牌前置手牌操作（金蝉脱壳「消耗所有手牌，抽 3 张」式）
 *
 * 依赖经 deps 显式传入（与 createBattleResolution 的端口风格一致）；
 * 牌区运行态按属地直读 battle.runtime.piles（battle.exec-play.js 同一导入
 * 先例——本文件不在架构守卫的纯模块清单内，与 exec-play 同属结算侧）。
 * ============================================================ */

/**
 * cleanse：净化自身——清除玩家身上全部诅咒（叠层与计时全部归零）。
 * 底层 combat.purify 与文本路径 buff.purify（effect-steps.recovery.js）同源，
 * 日志文案逐字对齐（有诅咒逐名列名 / 无诅咒「干干净净」），前置卡名与
 * 结构化 curse 分支同款口径。
 * @param {import('../core/battle.core-ports.types.js').CoreCard} card 打出的卡（仅用于日志名）
 * @param {{ target?: string }} operation 结构化 cleanse op
 * @param {M1Ports} deps { combat, getPlayerStatus, log, esc }
 * @returns {boolean} 是否产生了结算
 */
function resolveCleanseOperation(card, operation, deps) {
  if (operation.target !== 'self') return false;
  const pstat = deps.getPlayerStatus();
  if (!pstat) return false;
  const cleared = deps.combat.purify(pstat);
  const name = `<b>${deps.esc(card.name)}</b>`;
  if (cleared.length) {
    deps.log(`[[icon:sparkles]] ${name}：净化清除了身上的 ${cleared.map(k => deps.combat.CURSE_META[k].name).join('、')}`, 'ok');
  } else {
    deps.log(`[[icon:sparkles]] ${name}：净化——身上没有诅咒，干干净净`, 'ok');
  }
  return true;
}

/**
 * draw.untilHandN：抽牌直到手牌达到 N 张。
 * 两种战斗都逐张 drawCards(1)，在牌库空、手牌上限或无入手进度时停止。
 * @param {import('../core/battle.core-ports.types.js').CoreCard} card 打出的卡
 * @param {{ untilHandN: number }} operation 结构化 draw op
 * @param {M1Ports} deps { drawCards, countDrawnSpells, log, esc }
 * @returns {number} 本次抽牌入手的法术数增量（供 perSpellHeal 折算基数累计）
 */
function resolveDrawUntilHandN(card, operation, deps) {
  const target = operation.untilHandN;
  const name = `<b>${deps.esc(card.name)}</b>`;
  let spellsGained = 0;
  {
    let drawn = 0, withoutHandProgress = 0;
    let traversableUids = new Set([...instanceRuntime.drawPile, ...instanceRuntime.discard]);
    const activeGame = instanceRuntime.G?.battleActive ? instanceRuntime.G : null;
    const battleEnded = () => activeGame &&
      (instanceRuntime.G !== activeGame || !activeGame.battleActive || !instanceRuntime.foes.some(foe => !foe.dead));
    while (instanceRuntime.hand.length < target) {
      if (battleEnded()) break;
      const handBefore = instanceRuntime.hand.length;
      const got = deps.drawCards(1);
      if (!got) break;   // 牌库已空（或手牌达到上限），截停防死循环
      drawn += got;
      // drawCards(1) 每次替换 lastDrawnUids；逐次累计本次入手法术，不读前次抽牌记录。
      if (typeof deps.countDrawnSpells === 'function') spellsGained += deps.countDrawnSpells();
      if (battleEnded()) break;
      if (instanceRuntime.hand.length > handBefore) {
        withoutHandProgress = 0;
        traversableUids = new Set([...instanceRuntime.drawPile, ...instanceRuntime.discard]);
      }
      else {
        withoutHandProgress += got;
        // 完整遍历本轮可洗回牌堆仍无入手进度时停止，避免只有自动牌时无限洗回。
        // 新 UID 扩大遍历范围；消耗/移出不会缩短已开始的遍历，普通入手后重新计数。
        for (const uid of [...instanceRuntime.drawPile, ...instanceRuntime.discard]) traversableUids.add(uid);
        if (withoutHandProgress >= traversableUids.size) break;
      }
    }
    deps.log(drawn > 0
      ? `[[icon:cards]] ${name}：抽了 ${drawn} 张牌（直到手牌有 ${target} 张，当前 ${instanceRuntime.hand.length} 张）`
      : `[[icon:cards]] ${name}：无牌可抽（目标手牌 ${target} 张，当前 ${instanceRuntime.hand.length} 张）`, 'sys');
  }
  return spellsGained;
}

/**
 * draw.handOps：抽牌前置手牌操作，按数组序逐条执行（先手牌操作，后主抽牌——
 * 金蝉脱壳「消耗所有手牌，抽 3 张」的卡面语序即结算序）。
 *   consumeHand 消耗（consumed 堆，BOSS 战进墓地——与 engine 侧 dumpHand 端口同款语义）
 *   dumpHand    弃置（BOSS 战进弃牌堆参与洗回；普通战无弃牌循环，降级为消耗并注明）
 * capability 门只放行这两个 entry op，其余由守卫拒绝（不静默跳过）。
 * @param {import('../core/battle.core-ports.types.js').CoreCard} card 打出的卡
 * @param {Array<{ op: string }>} handOps 结构化 handOps 数组
 * @param {M1Ports} deps { findCard, log, esc }
 * @returns {Generator<import('../core/battle.core-ports.types.js').EffectYield, void>}
 */
function* resolveDrawHandOps(card, handOps, deps) {
  const name = `<b>${deps.esc(card.name)}</b>`;
  for (const entry of handOps) {
    if (entry?.op !== 'consumeHand' && entry?.op !== 'dumpHand') continue;   // 双保险：capability 门已拦
    const uids = instanceRuntime.hand.slice();
    instanceRuntime.set$hand([]);
    const dumping = entry.op === 'dumpHand' && instanceRuntime.mode === 'boss';
    for (const uid of uids) {
      if (dumping) {
        instanceRuntime.discard.push(uid);
      } else {
        instanceRuntime.consumed.push(uid);
        if (instanceRuntime.mode === 'boss') instanceRuntime.grave.push(uid);
      }
      const o = deps.findCard(uid);
      instanceRuntime.cardAnims.push({ kind: 'dump', uid, name: o ? o.card.name : '' });
      if (!dumping && o) yield* (deps.onHandConsumed?.(o.card, uid) || []);
    }
    if (entry.op === 'consumeHand') {
      deps.log(`[[icon:flask]] ${name}：消耗了所有手牌（${uids.length} 张）`, 'sys');
    } else if (dumping) {
      deps.log(`[[icon:recycle]] ${name}：弃置了所有手牌（${uids.length} 张，进弃牌堆）`, 'sys');
    } else {
      deps.log(`[[icon:flask]] ${name}：普通战斗没有弃牌堆，改为消耗所有手牌（${uids.length} 张）`, 'sys');
    }
  }
}
return { resolveCleanseOperation, resolveDrawUntilHandN, resolveDrawHandOps };
}
