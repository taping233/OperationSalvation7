/* battle.selection-flow.js —— 战斗内选牌、抉择与发现队列。
 * 弹层状态来自 battle.runtime.js；引擎只注入卡牌执行与战斗收尾操作。 */
const SDT = window.SDT;
import { G, foes, hand, drawPile, consumed, cardAnims, handSelecting, choosing, discovering, discoverQueue, zeroFeeUntil, turn, delayed, pdef, cardOverrides, set$handSelecting, set$choosing, set$discovering, set$hand } from './battle.runtime.js';
import { esc } from '../core/shared.js';
import { Random } from '../core/random.js';
import { splitEffectClauses as splitClauses } from './battle.effects.js';
import { throwIfActionCancelled } from './battle.staged-playback.js';

export function createBattleSelectionFlow({
  session, requestBattleRender, findCard, addTempCard, queueBattleAction,
  runStagedSteps, applyTextEffects, queueCardExecution, fireConsumeTriggers,
  fireCatGift, swapCardCosts, sweepDead, finish,
}) {
  const { handSelectQueue, choiceQueue } = session;
  const alive = () => foes.filter(foe => !foe.dead);

  function randomDiscoverCard(pred, rarity, otherCls) {
    // 2026-09-08：限制卡池（pred）优先——限定池只排除 生物/事件/衍生，
    // 职业/棱彩/传说特例卡按池子规则可被指定获取；无 pred 走通用随机池
    // （isRandomObtainable：排除 初始/职业/能力卡/生物/棱彩/unrandom）。
    // 2026-09-09 留言 #7：对局（战斗）内的发现/随机获取一律不出现资源卡——
    // 资源（木材/钱币/钥匙类）只在地图侧宝箱、商店、事件产出。
    // 2026-09-10 撤离测试：BOSS 战道具不可打出（"道具卡只能在普通战斗中使用"），
    // 发现池却在 BOSS 战掉道具卡，入手即死牌（刀剑形态还会复制它）。
    // 2026-09-13 留言：通用随机发现池不出现道具（战斗内道具入口只剩药水栏/背包）。
    // pred 指定池（药水魔法「发现药水」/迷之匣「发现招式」等）不受此限——专属发现按卡面效果走。
    const typeBan = (t => t === '道具');
    let pool;
    if (pred) {
      pool = SDT.Cards.all().filter(c => c.rarity !== '衍生' && !['生物', '事件', '资源'].includes(c.type) && pred(c));
    } else {
      pool = SDT.Cards.all().filter(c =>
        c.rarity !== '衍生' && c.type !== '资源' && !typeBan(c.type) && SDT.Cards.isRandomObtainable(c) &&
        (!rarity || c.rarity === rarity) &&
        (!otherCls || (c.cls && c.cls !== G.myClass)) ||
        (otherCls && c.rarity === '职业' && c.cls && c.cls !== G.myClass));
    }
    if (!pool.length) return null;
    return pool[Math.floor(Random.random('battle') * pool.length)];
  }

  // —— 手牌选卡（2026-09-06 #24/#25）：「选择 N 张手牌中的 X 施放/消耗」通用执行 ——
  // 「杀/初始攻击」按卡名匹配（2026-09-09 定版：效果文本统一写作「初始攻击」，卡池无「杀」类型）
  function matchHandSelectKey(card, key) {
    if (!key || key === '牌') return true;
    if (key === '杀' || key === '初始攻击') return /^(杀|初始攻击)$/.test(card.name || '');
    return card.type === key;
  }
  function processHandSelect() {
    if (handSelecting || !handSelectQueue.length) return;
    const job = handSelectQueue.shift();
    // 空池预检：手牌中没有符合条件的卡时直接跳过（防「选择手牌」弹窗死锁，2026-09-09）
    const matched = hand.filter(uid => { const o = findCard(uid); return o && matchHandSelectKey(o.card, job.type); }).length;
    if (!matched) {
      G.log(`[[icon:cards]] 手牌中没有${job.type ? `「${esc(job.type)}」` : ''}卡牌可选，该效果跳过`, 'warn');
      processHandSelect();
      return;
    }
    set$handSelecting({
      n: Math.min(job.n || 1, matched), type: job.type || null, act: job.act || 'play',
      thenText: job.thenText || '', target: job.target || null, srcCard: job.srcCard || null,
      mandatory: !!job.mandatory, onDone: job.onDone || null,
    });
    requestBattleRender();
  }
  function skipHandSelect() {
    if (!handSelecting) return;
    if (handSelecting.mandatory) { SDT.Sound.sfx('deny'); return; }
    set$handSelecting(null);
    G.log('[[icon:cards]] 跳过手牌选择，该效果未结算', 'warn');
    processHandSelect();
    requestBattleRender();
  }
  function finishHandSelectionEffect(card, text, target) {
    if (text) {
      queueBattleAction(async signal => {
        await runStagedSteps(applyTextEffects.steps(card, text, target, {}), signal);
        throwIfActionCancelled(signal);
        sweepDead();
        if (!alive().length) { finish(true); return; }
        processHandSelect();
        requestBattleRender();
      }, '选牌后续效果');
      return;
    }
    if (!alive().length) { finish(true); return; }
    processHandSelect();
    requestBattleRender();
  }
  function pickHandSelect(uid) {
    if (!handSelecting) return;
    const entry = findCard(uid);
    if (!entry) return;
    if (handSelecting.act === 'payment') {
      const selectedUids = handSelecting.selectedUids || [];
      const excludedUids = handSelecting.excludedUids || [];
      if (!hand.includes(uid) || excludedUids.includes(uid) || selectedUids.includes(uid) ||
          !matchHandSelectKey(entry.card, handSelecting.type)) return;
      const nextSelected = [...selectedUids, uid];
      const remaining = Math.max(0, (+handSelecting.n || 1) - 1);
      if (remaining > 0) {
        set$handSelecting({ ...handSelecting, n: remaining, selectedUids: nextSelected });
        requestBattleRender();
        return;
      }
      const { uid: cardUid, card, fuelUids, target, freeCost, onResolved } = handSelecting.payment || {};
      const payment = nextSelected;
      const valid = card && hand.includes(cardUid) && payment.length ===
        card.rules?.battle?.requirements?.find(rule => rule.kind === 'handCards')?.count &&
        payment.every(paymentUid => {
          const current = findCard(paymentUid);
          return hand.includes(paymentUid) && !excludedUids.includes(paymentUid) && current &&
            matchHandSelectKey(current.card, handSelecting.type);
        });
      set$handSelecting(null);
      if (!valid) {
        G.log(`[[icon:cross]] 【${esc(card?.name || '卡牌')}】手牌支付未凑齐，未消耗手牌或能量`, 'warn');
        requestBattleRender();
        return;
      }
      queueCardExecution(cardUid, card, fuelUids || [], target || null, !!freeCost, true, payment, onResolved);
      return;
    }
    if (handSelecting.act === 'play') {
      set$handSelecting(null);
      queueCardExecution(uid, entry.card, [], alive()[0] || null, true);   // 选卡施放：不扣费
      return;
    }
    if (handSelecting.act === 'copy') {
      // 深红丝袋：复制选中的手牌（原牌保留，复制件为战斗内临时卡）
      addTempCard({ ...entry.card });
      G.log(`[[icon:cards]] 复制了手牌中的【<b>${esc(entry.card.name)}</b>】（置入手牌，原牌保留）`, 'loot');
      handSelecting.n -= 1;
      if (handSelecting.n > 0) { requestBattleRender(); return; }
      const doneJob = handSelecting;
      set$handSelecting(null);
      finishHandSelectionEffect(entry.card, doneJob.thenText, null);
      return;
    }
    if (handSelecting.act === 'zero') {
      // 自然法杖：选中的卡下回合变为 0 费（2026-09-09 C10）
      zeroFeeUntil.set(uid, turn + 1);
      G.log(`[[icon:bolt]] 【${esc(entry.card.name)}】下回合打出时变为 <b>0</b> 费`, 'sys');
      set$handSelecting(null);
      processHandSelect();
      requestBattleRender();
      return;
    }
    set$hand(hand.filter(h => h !== uid));
    consumed.push(uid);
    cardAnims.push({ kind: 'burn', uid, name: entry.card.name });
    G.log(`[[icon:flask]] 消耗了手牌中的【<b>${esc(entry.card.name)}</b>】`, 'sys');
    // Q2 老板定向：手选消耗也算「消耗该牌时」触发
    fireConsumeTriggers(entry.card, null);
    if (!G?.battleActive) return;
    handSelecting.n -= 1;
    if (handSelecting.n > 0) { requestBattleRender(); return; }
    const job = handSelecting;
    set$handSelecting(null);
    if (typeof job.onDone === 'function') job.onDone();
    if (!G?.battleActive) return;
    finishHandSelectionEffect(job.srcCard || entry.card, job.thenText, job.target || null);
  }
  // —— 抉择面板（2026-09-08 人工 N 选一）：复用发现面板的弹层交互 ——
  function processChoice() {
    if (choosing || !choiceQueue.length) return;
    const job = choiceQueue.shift();
    set$choosing({ cardName: job.cardName || '？', options: (job.options || []).slice(), secondDoor: !!job.secondDoor });
    requestBattleRender();
  }
  function pickChoice(i) {
    if (!choosing) return;
    const job = choosing;
    set$choosing(null);
    const text = job.options[+i] || '';
    G.log(`[[icon:question]] <b>抉择</b>（【${esc(job.cardName)}】）：你选择了「${esc(text)}」`, 'sys');
    // 选项若指名一张生物/门类卡（如 末日浩劫之门 / 天国之门）：
    // 把它的「回合开始时」效果注册为每回合重复的持续效果（门是场面物件）
    const quoted = text.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
    const ref = quoted && SDT.Cards.all().find(c => c.name === quoted[1]);
    if (ref && ref.type === '生物') {
      const parts = splitClauses(String(ref.desc || ''));
      if (parts.turnStart.length) {
        parts.turnStart.forEach(it => {
          // 天国之门类「随机获取一项祝福」：把括号里的候选词池拼进注册文本，供回合结算识别
          let text = it.text;
          const paren = String(ref.desc || '').match(/（[^）]*从这些中随机[^）]*）/);
          if (paren && /随机获取一项祝福/.test(text)) text += paren[0];
          delayed.push({ text, cardName: ref.name, repeat: true });
        });
        G.log(`[[icon:hourglass]] <b>${esc(ref.name)}</b> 展开：${esc(parts.turnStart.map(it => it.text).join('；'))}（每回合开始生效）`, 'sys');
      } else {
        G.log(`[[icon:question]] 【${esc(ref.name)}】没有可展开的回合开始效果（占位）`, 'dim');
      }
      completeChoice();
      return;
    }
    queueBattleAction(async signal => {
      await runStagedSteps(applyTextEffects.steps({ name: job.cardName }, text, alive()[0] || null, {}), signal);
      throwIfActionCancelled(signal);
      completeChoice();
    }, '抉择效果');

    function completeChoice() {
      // 花开两面：「两回合后，开启未选择的那扇门」（2026-09-09 C8 补实装）
      if (job.secondDoor && job.options.length === 2) {
        const otherText = job.options[+i === 0 ? 1 : 0];
        const q2 = otherText.match(/[‘“「]([^\s，。；‘’“”「」]+)[’”」]/);
        const ref2 = q2 && SDT.Cards.all().find(c => c.name === q2[1]);
        if (ref2 && ref2.type === '生物') {
          const parts2 = splitClauses(String(ref2.desc || ''));
          parts2.turnStart.forEach(it => delayed.push({ text: it.text, cardName: ref2.name, repeat: true, notBeforeTurn: turn + 2 }));
          if (parts2.turnStart.length) G.log(`[[icon:hourglass]] <b>两回合后</b>：未选择的【${esc(ref2.name)}】也将展开`, 'sys');
        }
      }
      sweepDead();
      if (!alive().length) { finish(true); return; }
      processChoice();
      processDiscoverQueue();
      requestBattleRender();
    }
  }
  function processDiscoverQueue() {
    if (discovering || !discoverQueue.length) return;
    const job = discoverQueue.shift();
    const options = [];
    const taken = new Set();
    const names = new Set();   // 同名不同版（如「流血药水」道具/道具两张）算重复（2026-09-13 老板口径）
    // 旧任务格式兼容：rarity / otherCls 换算成谓词
    const legacyPred = job.rarity ? (c => c.rarity === job.rarity)
      : job.otherCls ? (c => c.rarity === '职业' && c.cls && c.cls !== G.myClass)
      : null;
    const structuredPool = job.pool;
    const structuredPred = structuredPool?.kind === 'moves'
      ? card => card.type === '武术' && (structuredPool.cost === undefined || (+card.cost || 0) === structuredPool.cost)
      : null;
    if (structuredPool && !structuredPred) {
      G.log(`[[icon:cross]] 无法发现：不支持的结构化卡池「${esc(structuredPool.kind || '未知')}」`, 'warn');
      return;
    }
    const pred = job.pred || structuredPred || legacyPred;
    // 显式候选（探宝·牌库底）：三张就是给定的真实卡牌，不走随机池
    if (job.explicit && job.explicit.length) {
      set$discovering({ options: job.explicit.slice(0, 3), n: job.n, rarity: job.rarity, pred: job.pred, act: job.act || null,
        priceArmor: !!job.priceArmor, pouchUid: job.pouchUid || null, consumeTempAtTurn: !!job.consumeTempAtTurn, tempUids: job.tempUids || [],
        swapPair: job.swapPair || null, deckBottom: !!job.deckBottom, deckBottomUids: job.explicitUids || [],
        zeroCost: !!job.zeroCost, decayEachTurn: !!job.decayEachTurn,
        costDecayPerTurn: job.costDecayPerTurn, sourceCardId: job.sourceCardId || null, pool: structuredPool || null });
      requestBattleRender();
      return;
    }
    // 2026-09-09 留言 #9：三张候选不得重复——抽到已选中的就重抽，
    // 池子不足三张时有多少展示多少（原实现撞重直接跳过，经常只剩一两张可选）
    // 2026-09-13 老板口径：同一个选择面板内不许重复——同名不同版也一并重抽
    const clash = (c) => !!c && (taken.has(c.id) || names.has(c.name));
    for (let i = 0; i < 3 && options.length < 3; i++) {
      let c = randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);
      let guard = 0;
      while (clash(c) && guard++ < 40) {
        c = randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);
      }
      if (c && !clash(c)) { taken.add(c.id); names.add(c.name); options.push(c); }
    }
    if (!options.length) { G.log('（没有符合条件的卡牌可发现）', 'dim'); return; }
    set$discovering({ options, n: job.n, rarity: job.rarity, pred: job.pred, act: job.act || null,
      priceArmor: !!job.priceArmor, pouchUid: job.pouchUid || null, consumeTempAtTurn: !!job.consumeTempAtTurn, tempUids: job.tempUids || [],
      swapPair: job.swapPair || null, zeroCost: !!job.zeroCost, decayEachTurn: !!job.decayEachTurn,
      costDecayPerTurn: job.costDecayPerTurn, sourceCardId: job.sourceCardId || null, pool: structuredPool || null });
    requestBattleRender();
  }

  function pickDiscover(i) {
    if (!discovering) return;
    const card = discovering.options[+i];
    if (!card) return;
    const { n, rarity, pred, act, options, priceArmor, pouchUid, consumeTempAtTurn, tempUids, swapPair,
      deckBottom, deckBottomUids, zeroCost, decayEachTurn, costDecayPerTurn, sourceCardId, pool } = discovering;
    set$discovering(null);
    // 探宝·牌库底：未选中的候选按原顺序放回牌库底（数组头部 = 底）
    if (deckBottom && deckBottomUids.length) {
      const pickedUid = deckBottomUids[+i] != null ? deckBottomUids[+i] : null;
      const rest = deckBottomUids.filter(u => u !== pickedUid);
      if (rest.length) drawPile.unshift(...rest);
    }
    if (act !== 'pouch') fireCatGift(card);   // 阿猫的礼物：从发现面板选中即触发（锦囊内旧牌不重触发）
    // 「直接施放 / 直接释放」类发现：选中即免费打出（2026-09-11 实机老板反馈修复：
    // 此前多敌场景会先置入手牌等玩家再拖选目标——与卡面「并直接释放」矛盾，且拖拽流程
    // 极易断裂成「卡躺在手牌像没释放」。现一律立即结算：默认首个存活敌人，群体卡自动覆盖全体）
    if (act === 'play' || act === 'potion') {
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（免费用 · 战斗内临时卡，战后消散）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
    } else if (act === 'playKeep') {
      // 永恒绽放：施放 1 张，其余两张入手
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（战斗内临时卡，战后消散）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
      options.filter(o => o.id !== card.id).forEach(o => {
        addTempCard(o);
        G.log(`[[icon:cards]] 其余的【<b>${esc(o.name)}</b>】置入手牌`, 'loot');
      });
    } else if (act === 'pouch') {
      // 法师锦囊：从锦囊里选 1 张施放（从锦囊移除，其余留存）
      const pouchEntry = pouchUid && findCard(pouchUid);
      if (pouchEntry && Array.isArray(pouchEntry.card._pouch)) {
        const pi = pouchEntry.card._pouch.findIndex(c => c.id === card.id);
        if (pi >= 0) pouchEntry.card._pouch.splice(pi, 1);
      }
      const uid = addTempCard(card);
      G.log(`[[icon:question]] <b>法师锦囊</b>：施放其中的【<b>${esc(card.name)}</b>】（锦囊余 ${pouchEntry && Array.isArray(pouchEntry.card._pouch) ? pouchEntry.card._pouch.length : 0} 张）`, 'loot');
      queueCardExecution(uid, findCard(uid).card, [], alive()[0] || null, true);
    } else if (act === 'dup') {
      // 二刀流（2026-09-10 需求）：「发现一张武术卡并额外获得1张复制」——本体+复制共 2 张入手
      addTempCard(card);
      addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并额外获得 1 张复制（×2 置入手牌 · 战斗内临时卡，战后消散）`, 'loot');
    } else {
      const uid = addTempCard(card);
      G.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
      // 挖宝：「获得等同于其价格的护甲」按发现卡售价折算（2026-09-09 补实装）
      if (priceArmor) {
        const price = SDT.Cards.sellPrice(card);
        pdef.armor += price;
        G.log(`[[icon:plate]] <b>挖宝</b>：【${esc(card.name)}】价格 ${price} → 获得 ${price} 点护甲（当前 ${pdef.armor}）`, 'sys');
      }
      // 江湖救急：置入的临时卡在回合开始时消耗（C9）
      if (consumeTempAtTurn) tempUids.push(uid);
      // 迷之匣：发现的招式记入待换费对（两张到齐后交换费用）
      if (swapPair) swapPair.push(uid);
      // 第十二批（2026-09-23）：魔法新发现「使其变为0费」/ 高端研发「回合开始时使其-1费」
      if (zeroCost) {
        cardOverrides.set(uid, { ...card, cost: 0, _baseCost: card.cost });
        G.log(`[[icon:bolt]] 发现：【<b>${esc(card.name)}</b>】费用变为 0`, 'loot');
      }
      if (costDecayPerTurn > 0) {
        delayed.push({ special: 'ruleCostDecay', uid, sourceCardId, amount: costDecayPerTurn });
        G.log(`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -${costDecayPerTurn}`, 'sys');
      } else if (decayEachTurn) {
        delayed.push({ special: 'costDecay', uid });
        G.log(`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -1`, 'sys');
      }
    }
    sweepDead();
    if (!alive().length) { finish(true); return; }
    if (n > 1) discoverQueue.unshift({ n: n - 1, rarity, pred, act, priceArmor, pouchUid, consumeTempAtTurn, tempUids, swapPair, zeroCost, decayEachTurn,
      costDecayPerTurn, sourceCardId, pool });
    else if (consumeTempAtTurn && tempUids.length) {
      delayed.push({ special: 'consumeTemps', uids: [...tempUids], cardName: '江湖救急' });
      G.log(`[[icon:hourglass]] <b>江湖救急</b>：置入的 ${tempUids.length} 张临时卡将在下个回合开始时消耗`, 'sys');
    } else if (swapPair && swapPair.length >= 2) {
      swapCardCosts(swapPair[0], swapPair[1]);   // 迷之匣：两张发现完毕，交换费用
    }
    // （2026-09-23 lint 批次：此处原有一份与上方 2461 行重复的「江湖救急」else-if——设计者 v0.53.3
    // 快照插入迷之匣分支时留下的复制残tail，永不执行，已删；行为零变化）
    processDiscoverQueue();
    requestBattleRender();
  }

  return {
    randomDiscoverCard, matchHandSelectKey, processHandSelect, skipHandSelect, pickHandSelect,
    processChoice, pickChoice, processDiscoverQueue, pickDiscover,
  };
}
