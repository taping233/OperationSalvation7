/* ============================================================
 * agent.policy.js —— 内置决策策略（随机 / 贪心）
 *
 * 策略只读 observe() 的 JSON（不碰运行时），因此浏览器与 Node 无头批量
 * 共用同一份实现。贪心不是强度追求，是统计基线：决策稳定、有区分度、
 * 不空转。LLM 适配器（agent.llm）走同一 decide(obs) 契约。
 * ============================================================ */

import { Random } from '../core/random.js';
import { resolveWeights } from './agent.weights.js';
import { slamSkillFor } from '../battle/bag/battle.slam-skill.js';   // 2026-10-02 老板：背包技能五职业分化，费用单源取值

const TARGET_KEY = /攻击|伤害|造成|消灭|击|刺|斩/;
const PREFER_LABEL = /(开始|出发|继续|确认|完成|获取|带走|进入|领取|修复|治疗|休息|入库|整理|留下|收下|全部收下)/;
const AVOID_LABEL = /(放弃|离开对局|返回主菜单|退出|删除|清空)/;
// 弹层「收口」动作：在同一弹层停留过久时优先点它，防止商店/背包等可选页无限流连
const TERMINATORS = new Set([
  'closeShop', 'closeBag', 'chestSkip', 'evtNext', 'pickupGo', 'lastLampFinish', 'helpBack',
  'nsBack', 'rcBack', 'fireDone', 'depBack', 'backShop',
]);

// ---------- 随机策略：合法动作里等概率（冒烟/对照用；随机源走 Random 服务） ----------
function randomPolicy(seed) {
  const roll = seed || (() => Random.random('gameplay'));
  return (obs) => {
    const acts = obs.actions || [];
    if (!acts.length) return { type: 'sys', name: 'noop' };
    return acts[Math.floor(roll() * acts.length)];
  };
}

// v2 商店扫货用：从标签解析标价（「购买「射线枪」，2 币」→ 2）
const priceOf = (label) => {
  const m = String(label || '').match(/(\d+)\s*币/);
  return m ? +m[1] : 99;
};

// 事件选项期望分：按 label+detail 的收益/风险词与数值排序（低血时回复权重大）
// W（09-26 扩展）：词权重与低血档从字面量抽入 W.event，缺省=DEFAULT 逐值相等
const eventScore = (label, hpRatio, W) => {
  const w = W?.event || { gainScore: 15, lossScore: -18, upgradeScore: 12, quitScore: -25, lowHpRatio: 0.6 };
  const s = String(label || '');
  let score = 0;
  // 数值收益：+N 金币/生命/卡
  for (const m of s.matchAll(/\+(\d+)/g)) score += +m[1] * (/[生命血]/.test(s) && hpRatio < w.lowHpRatio ? 4 : 1);
  // 数值风险：-N（扣血最疼）
  for (const m of s.matchAll(/-(\d+)/g)) score -= +m[1] * (/[生命血]/.test(s) ? (hpRatio < w.lowHpRatio ? 6 : 3) : 0.5);
  if (/回复|恢复|治疗|回血/.test(s)) score += hpRatio < w.lowHpRatio ? 40 : 8;
  if (/获得|得到|金币|卡牌|抽.{0,2}牌|免费|复制/.test(s)) score += w.gainScore;
  if (/失去|扣除|丢弃|减少|随机|可能|概率|赌/.test(s)) score += w.lossScore;
  if (/生命上限|升级|强化/.test(s)) score += w.upgradeScore;
  if (/离开|离开事件|放弃/.test(s)) score += w.quitScore;
  return score;
};

const RARITY_ORDER = { '普通': 0, '常见': 0, '稀有': 1, '史诗': 2, '传说': 3, '职业': 4 };
// 进卡组的类型（丢卡腾格时最后保留）；道具/资源/事件/生物等先丢
const DECK_TYPES = new Set(['招式', '装备', '能力']);
const rarityRank = (r) => RARITY_ORDER[r] ?? 1;

// 策略 v2（数据驱动改版，2026-09-26）：基于 45 局 v1 基线（均层2.0、73% 死于层2、
// 战斗胜率 72% 仍全灭）——死因是续航与推进节奏，不是单场战术。三处升级：
//   ① 地图：血线门控（hp<65% 不进层门、<70% 优先火堆）、同层收图再进、血低少打硬仗
//   ② 战斗：0费节奏 → 单卡斩杀 → 护甲挡伤 → 性价比出牌
//   ③ 商店：按标价升序花光局内币（币不带出局）
function strategicPolicy(options = {}) {
  return greedyPolicy({ ...options, strategic: true });
}

// ---------- 贪心策略（v1 基线 / strategic=v2 数据驱动改版） ----------
function greedyPolicy({ resetSlots = false, preferNest = false, strategic = false, extractHpRatio = 0.35 } = {}) {
  // 权重向量（09-26 架构升级）：工厂级解析一次——evolve 个体经 globalThis 注入，
  // 每局 factory 调用时取最新；v1 对照组恒拿 DEFAULT（冻结语义）
  const W = resolveWeights();
  const tried = new Set();   // 本回合打过且无效果的出牌（防引擎静默拒绝导致死循环）
  const fledNodes = new Set();   // v3：战斗中撤退过的格子（地图低血不回头挑战，血线恢复解锁）
  const doorUsed = new Set();    // 09-26：穿过的环间门（门对跳死锁修复，见浮层 goDoor 处）
  const recentUi = [];       // 最近执行过的 ui 动作键（跨面板 LRU，防 openHelp↔helpBack 之类互翻）
  // 上限必须 ≥ 最大单页动作数（研究所备战页 23 个）：否则早期键被挤出后又变「新鲜」，
  // 轮番取消已选项把 nestGo 永远饿死
  const RECENT_MAX = 60;
  let lastTurn = -1;

  // —— strategic(v2) 战斗微操辅助 ——
  const armorGainOf = (card) => {
    const d = card?.desc || '';
    const m = d.match(/获得\s*(\d+)\s*点护甲/) || d.match(/\+(\d+)\s*甲/) || d.match(/(\d+)\s*点护甲/);
    return m ? +m[1] : 0;
  };
  // intentDamage 对齐引擎 intent 形状（09-26 修根因①）：
  // 引擎 calculateEnemyIntent 返回 {kind, icon, label, damage, hits, bleedBonus}——
  // damage=null 表示蓄力/非攻击轮，damage=atk+bleed、hits=多段（frenzy/orc 两段）。
  // 旧实现读 it.type||it.kind 再判 !=='attack'：引擎的 kind 是 'strike'/'general' 等
  // 行为名，永远 ≠'attack' → 恒返回 0 → incoming/danger 全为 0 →
  //   flee 逃生线（danger>=hp）、护甲挡伤门（incoming>armor）、威胁喝药线三处保命逻辑全失效
  //   （实测 flee 0/120 局触发，死亡全来自战斗 97 局）
  const intentDamage = (f) => {
    const it = f.intent || {};
    if (it.damage == null) return 0;           // 蓄力轮（damage:null）无攻击
    const hits = Math.max(1, Number(it.hits) || 1);
    return (Number(it.damage) || 0) * hits;
  };

  const battleTurn = (obs) => {
    const b = obs.battle;
    if (!b) return;
    if (b.turn !== lastTurn) { lastTurn = b.turn; tried.clear(); }
  };

  const decideBattle = (obs) => {
    const b = obs.battle;
    battleTurn(obs);
    const acts = (obs.actions || []).filter(a => a.type === 'battle');
    const find = (name, match) => acts.find(a => a.name === name && (!match || match(a)));
    // 零动作=瞬态而非停局（快 settle 会撞见挂载空档）：回 noop 等待，由 waitLimit 收口
    if (!acts.length) return { type: 'sys', name: 'noop' };
    // 胜利/败北结算窗口：场上全灭或己方空血时引擎收尾异步跑，出牌/结束回合都会被拒——
    // 回 noop 等待（runner 对 noop 不计熔断），等结算页浮出再继续
    if (b.foes.length && b.foes.every(f => f.dead)) return { type: 'sys', name: 'noop' };
    if (b.player && b.player.hp <= 0) return { type: 'sys', name: 'noop' };

    if (b.deckSelection) {
      if (strategic && b.deckSelection.cards?.length) {
        // v3 编组按稀有度降序占坑（职业>传说>史诗>稀有>普通），选满才确认
        // 09-26 扩展：加克制维度 W.deck.counterWeight（默认 0=排序与纯稀有度逐位一致）——
        // counterScore 特征：多敌 AOE 卡加分、高血编组大伤卡加分（boss 19 战 3 胜的
        // 选牌盲区：现在选牌根本不看敌方编组特征，ES 可通过 counterWeight 打开）
        if ((b.deckSelection.selected || []).length >= (b.deckSelection.need ?? 0)) {
          return find('confirmDeck') || null;
        }
        const cw = W.deck.counterWeight;
        // 09-27 根因修复：cards 的 entry 是 {uid, card} 结构（card 才是完整卡对象）——
        // 旧代码直接读 entry.rarity/desc/dmg 全是 undefined → 稀有度排序自 v3 起从未
        // 生效（恒等序=按背包原序选卡）、克制特征恒 0。统一解包后两维度才真正激活
        const cardOf = (e) => e.card || e;
        const counterScore = (c) => {
          if (!cw) return 0;
          const foes = (b.foes || []).filter(f => !f.dead);
          const bossInfo = b.deckSelection?.boss || {};
          const foeHp = foes.reduce((sum, f) => sum + (f.hp ?? 0), 0) + (foes.length ? 0 : (bossInfo.maxHp || 0));
          const foeAtk = foes.reduce((m, f) => Math.max(m, f.atk ?? 0), 0) || (bossInfo.atk || 0);
          const txt = `${c.name || ''}${c.desc || ''}`;
          let s = 0;
          // 敌方血厚 → 直伤/毒系卡优先；敌方攻高 → 护甲/回复卡优先；多敌 → AOE 优先
          if (foeHp >= 60 && /斩|击|刺|箭|射线|弹|炎|火|毒|裂/.test(txt)) s += 2;
          if (foeAtk >= 8 && /甲|盾|护|回复|治疗|药|汲取/.test(txt)) s += 2;
          if (foes.length > 1 && /全体|所有敌人|每个敌/.test(c.desc || '')) s += 2;
          return s;
        };
        const order = b.deckSelection.cards.slice()
          .sort((x, y) => {
            const cx = cardOf(x), cy = cardOf(y);
            return (rarityRank(cy.rarity) + counterScore(cy) * cw) - (rarityRank(cx.rarity) + counterScore(cx) * cw);
          });
        for (const entry of order) {
          if (tried.has(`d:${entry.uid}`)) continue;
          const act = acts.find(a => a.name === 'selectDeckCard' && a.args?.[0] === entry.uid);
          if (act) { tried.add(`d:${entry.uid}`); return act; }
        }
        return find('confirmDeck') || null;
      }
      const pick = find('selectDeckCard', a => !tried.has(a.id));
      if (pick) { tried.add(pick.id); return pick; }
      return find('confirmDeck') || find('cancelDeck') || null;
    }
    if (b.pendingTarget) {
      const living = b.foes.filter(f => !f.dead);
      const weakest = living.slice().sort((x, y) => (x.hp ?? 0) - (y.hp ?? 0))[0];
      // 每个目标只试一次：引擎静默拒打（费用/上限/禁打）时别原地踏步，试完就收手
      const candidates = acts.filter(a => a.name === 'playCard');
      const fresh = candidates.find(a => !tried.has(`pt:${JSON.stringify(a.args)}`));
      if (fresh) {
        tried.add(`pt:${JSON.stringify(fresh.args)}`);
        const aimed = weakest && candidates.find(a => a.args?.[1] === weakest.i);
        return aimed && !tried.has(`pt:${JSON.stringify(aimed.args)}`) ? (tried.add(`pt:${JSON.stringify(aimed.args)}`), aimed) : fresh;
      }
      return find('cancelPendingTarget') || null;
    }
    if (b.infusing) return find('playDirect') || find('cancelInfusion') || null;
    if (b.choosing) return find('pickChoice') || acts[0];
    if (b.discovering) {
      // v3 发现三选一：按稀有度降序、同稀有度选低费
      if (strategic && b.discovering.options?.length) {
        const order = b.discovering.options.map((o, i) => ({ o, i }))
          .sort((x, y) => (rarityRank(y.o.rarity) - rarityRank(x.o.rarity))
            || ((x.o.cost ?? 99) - (y.o.cost ?? 99)));
        for (const { i } of order) {
          if (tried.has(`disc:${i}`)) continue;
          const act = acts.find(a => a.name === 'pickDiscover' && a.args?.[0] === i);
          if (act) { tried.add(`disc:${i}`); return act; }
        }
      }
      return find('pickDiscover') || acts[0];
    }
    // 挂起态回填（砸击/双镖/道具选目标）：不回出口会卡在选目标页——挑最弱敌，两版共用
    if (b.slamPending || b.dartPending || b.pendingItem) {
      const living = b.foes.filter(f => !f.dead);
      const weakest = living.slice().sort((x, y) => (x.hp ?? 0) - (y.hp ?? 0))[0];
      const hit = b.pendingItem
        // useItem args = [uid, side]
        ? acts.find(a => a.name === 'useItem' && (weakest == null || a.args?.[1] === weakest.i))
        : acts.find(a => a.name === (b.slamPending ? 'resolveSlam' : 'resolveDart')
            && (weakest == null || a.args?.[0] === weakest.i));
      if (hit) return hit;
      return acts.find(a => a.name === 'cancelInteraction') || null;
    }
    if (b.handSelecting) {
      // 非强制选择可跳过（快）；强制选择 skip 会被引擎拒绝，必须真选牌凑够
      if (b.handSelecting.mandatory !== true) return find('skipHandSelect') || acts[0];
      // v3 支付/献祭选牌：先付最便宜的（低费>高费），心疼程度最小化
      if (strategic && b.hand?.length) {
        const byCost = b.hand.slice().sort((x, y) => (x.cost ?? 0) - (y.cost ?? 0));
        for (const c of byCost) {
          if (tried.has(`hs:${c.uid}`)) continue;
          const act = acts.find(a => a.name === 'pickHandSelect' && a.args?.[0] === c.uid);
          if (act) { tried.add(`hs:${c.uid}`); return act; }
        }
        return find('skipHandSelect') || acts[0];
      }
      const picks = acts.filter(a => a.name === 'pickHandSelect');
      const fresh = picks.find(a => !tried.has(`hs:${a.args?.[0]}`));
      if (fresh) { tried.add(`hs:${fresh.args?.[0]}`); return fresh; }
      return find('skipHandSelect') || null;
    }

    // 残血/受致命威胁先喝药（v3：威胁线=预估受击 ≥ 60% 当前血，比 50% 血线更早保命）
    // 注意：血线判断在公共路径（v1 也走）——W 只许 strategic 消费（设计约束③：ES 调 W
    // 不得污染冻结对照组），v1 恒用字面量 0.5
    const potionHpLine = strategic ? W.battle.potionHpLine : 0.5;
    let potionOk = b.player && b.player.maxHp && b.player.hp / b.player.maxHp < potionHpLine;
    if (!potionOk && strategic && b.player) {
      const inc = b.foes.filter(f => !f.dead).reduce((s, f) => s + intentDamage(f), 0);
      potionOk = inc - (b.player.armor ?? 0) >= (b.player.hp ?? 0) * W.battle.potionThreatRatio;
    }
    if (potionOk) {
      const potion = find('usePotion');
      if (potion && !tried.has(potion.id)) { tried.add(potion.id); return potion; }
      // R3 新操作点：快速栏没药时用背包回复类道具（半血以下的第二补给线）
      const healItem = (b.ownItems || []).find(o => /(回复\s*\d|恢复|治疗|回血|生命\s*\d)/.test(`${o.desc || ''}`));
      if (healItem) {
        const k = `it:${healItem.uid}`;
        if (!tried.has(k)) {
          const a = acts.find(x => x.name === 'useItem' && x.args?.[0] === healItem.uid);
          if (a) { tried.add(k); return a; }
          tried.add(k);
        }
      }
    }
    if (strategic) return tacticalFight(obs, acts, find);

    const living = b.foes.filter(f => !f.dead);
    const weakest = living.slice().sort((x, y) => (x.hp ?? 0) - (y.hp ?? 0))[0];
    const hand = b.hand || [];
    const plays = acts.filter(a => a.name === 'playCard' && a.args?.length === 2);
    for (const card of hand) {
      const key = `t${b.turn}:${card.uid}`;
      if (tried.has(key)) continue;
      const target = TARGET_KEY.test(card.desc || '') || card.dmg != null ? weakest?.i : undefined;
      const action = plays.find(a => a.args[0] === card.uid && (target === undefined || a.args[1] === target))
        || plays.find(a => a.args[0] === card.uid);
      if (action) { tried.add(key); return action; }
    }
    return find('endTurn') || null;
  };

  // v2 战斗微操（数据：v1 死因=续航崩而非单场战术——72% 胜率仍全灭）：
  // 优先级 = 0费节奏 → 单卡斩杀（减受击频次）→ 护甲挡伤 → 性价比出牌 → 结束回合
  const tacticalFight = (obs, acts, find) => {
    const b = obs.battle;
    const hand = b.hand || [];
    const e = b.energy ?? 0;
    const atk = b.player?.atk ?? 0;
    const armor = b.player?.armor ?? 0;
    const hp = b.player?.hp ?? 0;
    const living = b.foes.filter(f => !f.dead);
    if (!living.length) return { type: 'sys', name: 'noop' };
    const byHp = living.slice().sort((x, y) => (x.hp ?? 0) - (y.hp ?? 0));
    const plays = acts.filter(a => a.name === 'playCard' && a.args?.length === 2);
    const single = acts.filter(a => a.name === 'playCard' && a.args?.length === 1);
    const key = (uid) => `t${b.turn}:${uid}`;
    const incoming = living.reduce((s, f) => s + intentDamage(f), 0);
    const danger = incoming - armor;
    const tryPlay = (card, foeI) => {
      if (tried.has(key(card.uid))) return null;
      const a = foeI != null
        ? (plays.find(x => x.args[0] === card.uid && x.args[1] === foeI) || single.find(x => x.args[0] === card.uid))
        : (single.find(x => x.args[0] === card.uid) || plays.find(x => x.args[0] === card.uid));
      if (a) { tried.add(key(card.uid)); return a; }
      return null;
    };

    // 1) 0 费牌白给节奏（毒药：0 费+中毒+抽牌）
    for (const c of hand) {
      if ((c.cost ?? 1) === 0) { const a = tryPlay(c); if (a) return a; }
    }
    // 1.5) 装备主动技能：本回合未 used 的主动装备先试一次（被拒会进 tried 不再试）
    for (const eq of b.equipped || []) {
      if (eq.uid && !eq.passive && !eq.used) {
        const k = `eq:${eq.uid}`;
        if (!tried.has(k)) {
          const a = acts.find(x => x.name === 'useEquipSkill' && x.args?.[0] === eq.uid);
          if (a) { tried.add(k); return a; }
          tried.add(k);
        }
      }
    }
    // 2) 单卡斩杀：打最弱且能杀死的敌人（敌人数量比总血更重要）
    for (const foe of byHp) {
      for (const c of hand) {
        if ((c.cost ?? 1) > e) continue;
        if (atk + (c.dmg ?? 0) >= foe.hp) { const a = tryPlay(c, foe.i); if (a) return a; }
      }
    }
    // v3 逃生线：致死级威胁 + 护甲救不回 + 本回合击杀预算不足 → 撤退
    // （flee=判负撤出战斗：丢节奏不丢卡，远好过死亡结算把带入卡全丢）
    if (hp > 0 && danger >= hp) {
      let armorGain = 0;
      for (const c of hand) { if ((c.cost ?? 1) <= e) armorGain = Math.max(armorGain, armorGainOf(c)); }
      const armorCanSave = armor + armorGain >= incoming;
      let budget = 0, eLeft = e;
      const atkCards = hand
        .filter(c => (c.cost ?? 1) <= e && (TARGET_KEY.test(c.desc || '') || c.dmg != null))
        .sort((x, y) => (atk + (y.dmg ?? 0)) / Math.max(1, y.cost ?? 1) - (atk + (x.dmg ?? 0)) / Math.max(1, x.cost ?? 1));
      for (const c of atkCards) { const cost = c.cost ?? 1; if (cost <= eLeft) { budget += atk + (c.dmg ?? 0); eLeft -= cost; } }
      const dangerHp = living.filter(f => intentDamage(f) > 0).reduce((s, f) => s + (f.hp ?? 0), 0);
      if (!armorCanSave && dangerHp > budget) {
        const nodeKey = obs.run ? `${(obs.run.layer ?? 1) - 1}:${obs.run.node ?? 0}` : '';
        // 决死规则（09-26 修根因⑤）：同格只逃一次。逃过再回=地图侧已 0 分让位、
        // 且资源通常耗尽——再逃就陷入「打→逃→绕→再打」无限环（层3死锁实录：
        // extraction 被 boss 锁、boss 战必逃、逃出无药可补，no-progress 弃局 0 分）。
        // 数据上 death(2分) > abandon(0分)：二次面对同格必死之战，选择战到底。
        // 血线恢复后回头重打是新格（fledNodes 语义不变），此规则只拦「同格连逃」。
        if (!(nodeKey && fledNodes.has(nodeKey))) {
          // 记住逃过的格子：地图侧低血不再回头挑战（血线恢复后解锁）
          if (nodeKey) fledNodes.add(nodeKey);
          const fleeAct = find('flee');
          if (fleeAct) return fleeAct;
        }
      }
    }
    // 3) 护甲挡伤：R3 放宽——任何溢出伤害都考虑上甲；0 费甲无脑赚，
    // 1 费需挡 ≥3 点、2 费需挡 ≥7 点才值得花能量
    if (incoming > armor) {
      let best = null, bestGain = -1;
      for (const c of hand) {
        const cost = c.cost ?? 1;
        if (cost > e) continue;
        const gain = armorGainOf(c);
        if (gain <= 0) continue;
        if (cost === 1 && incoming - armor <= W.battle.armorGate1) continue;
        if (cost >= 2 && incoming - armor <= W.battle.armorGate2) continue;
        if (gain > bestGain) { best = c; bestGain = gain; }
      }
      if (best) { const a = tryPlay(best); if (a) return a; }
    }
    // 4) 常规出牌：性价比（攻效/费用）最高；v3 多敌时 AOE 卡加权（W.battle.aoeMultiplier）
    const aoeBonus = (c) => (living.length > W.battle.aoeMinFoes && /全体|所有敌人|每个敌/.test(c.desc || '')) ? W.battle.aoeMultiplier : 1;
    const eff = (c) => (atk + (c.dmg ?? 0)) * aoeBonus(c) / Math.max(1, c.cost ?? 1);
    const ordered = hand.slice().sort((x, y) => eff(y) - eff(x));
    for (const c of ordered) {
      if ((c.cost ?? 1) > e) continue;
      const targeted = TARGET_KEY.test(c.desc || '') || c.dmg != null;
      const a = targeted ? tryPlay(c, byHp[0].i) : tryPlay(c);
      if (a) return a;
    }
    // 4.5) 背包技能：按职业 1-2 费不吃手牌（2026-10-02 老板五职业分化，费用单源
    // battle.slam-skill.js；obs.run.class=职业 rulesetId）——手牌打空/卡手时的硬通货（省卡策略）；
    // 能量门=min(职业技能费用, slamMinEnergy 权重上限)，未知职业兜底=战士口径
    const slamCost = slamSkillFor(obs.run?.class || null).cost;
    if (e >= Math.min(slamCost, W.battle.slamMinEnergy) && !tried.has('slam') && acts.some(x => x.name === 'bagSlam')) {
      const slam = acts.find(x => x.name === 'bagSlam');
      tried.add('slam');
      return slam;
    }
    // 5) 收尾
    return find('endTurn') || null;
  };

  let lastNode = null;    // 上一次所在格（防 A↔B 二周期：刚离开的格子不再作为首选）
  let prevNode = null;
  let nodeSet = null;     // strategic 滞环检测：本次出行踩过的格子集合
  let stallSteps = 0;     // 连续踩旧格子的地图决策次数（>10 判定滞环）
  let lastDecisionNode = null;
  let backToPrevStreak = 0;   // 连续「首选=回刚离开的格」次数（A→B→A 连发判拉锯）
  const decideMap = (obs) => {
    const moves = (obs.actions || []).filter(a => a.type === 'move');
    // 背包满先开包腾格（09-26 断链修复①）：满包让所有宝箱/事件奖励作废，
    // 开包-丢卡-关包三步无游戏时间代价（地图步不消耗回合），优先于一切走位
    if (strategic) {
      const ob = (obs.actions || []).find(a => a.type === 'sys' && a.name === 'openBackpack');
      if (ob) return ob;
    }
    if (!moves.length) return (obs.actions || [])[0] || null;
    const hpRatio = obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1;
    const curIdx = obs.run?.node ?? 0;
    const curLi = (obs.run?.layer ?? 1) - 1;
    if (lastNode != null && curIdx !== lastNode) { prevNode = lastNode; lastNode = curIdx; }
    else if (lastNode == null) lastNode = curIdx;
    // strategic 滞环检测（回走放开后的兜底）：每次地图决策若踩的还是旧格子就累计，
    // 踩到新格子清零——振荡 0↔3 那类死循环在 12 步内会被强制推进打断
    if (strategic) {
      const here = `${curLi}:${curIdx}`;
      if (here === lastDecisionNode) stallSteps += 1;
      else if (!nodeSet) { nodeSet = new Set([here]); lastDecisionNode = here; }
      else if (nodeSet.has(here)) { stallSteps += 1; lastDecisionNode = here; }
      else { nodeSet.add(here); stallSteps = 0; lastDecisionNode = here; }
    }
    // R13 滞环出口梯度（09-26 seed77054 复现归因）：出口 door 的唯一入桥是已访格时，
    // 桥走 seen 保底 2-5 分，环内格 4.5-7.5 分永远压着它——stallSteps>10 的既有解锁
    // （door seen 豁免/forceProgress）全都够不着「不邻接当前位」的门，54/70/92 三局在
    // 4-6 节点环转到 no-progress。滞环时对本层从出口做反向 BFS（出口=door/未锁撤离点），
    // 按离门距离给候选梯度加成，把 agent 拉回桥→站上邻门格→进门破环。
    // 只在滞环时构建与生效（正常局行为不变）；同层限定（回浅层门横跳教训走 crossBack 照旧）
    let exitDist = null;
    let exitMax = 0;
    if (strategic && stallSteps > 10) {
      try {
        const lay = globalThis.window?.SDT?.game?.layerData?.[curLi]?.logical;
        if (lay) {
          const pred = (lay.map(() => []));
          const targets = [];
          let lockedExit = false;   // 本层撤离被 boss 锁（R14a 破局路径判据）
          for (let i = 0; i < lay.length; i++) {
            const ty = lay[i]?.def?.type;
            if (ty === 'extraction' && !(obs.run?.bossKilled ?? false)) lockedExit = true;
            if (ty === 'door' || ty === 'emergencyExit'
              || (ty === 'extraction' && (obs.run?.bossKilled ?? false))) targets.push(i);
            for (const [tl, ti] of lay[i]?.next || []) {
              if (tl === curLi && ti != null) pred[ti].push(i);   // 同层反向边
            }
          }
          const dist = new Map(targets.map(i => [i, 0]));
          const queue = [...targets];
          // R14a：撤离被 boss 锁时，破局路径=打 boss（92 复现：extraction -100 不进
          // 目标集 → 梯度失效 → L4 环 277 步 no-progress）。boss 格纳入目标，
          // 打赢后锁解除、targets 自然切回 extraction
          if (lockedExit && !obs.run?.bossKilled) {
            for (let i = 0; i < lay.length; i++) {
              if (lay[i]?.def?.type === 'boss' && !dist.has(i)) { dist.set(i, 0); queue.push(i); }
            }
          }
          while (queue.length) {
            const u = queue.shift();
            for (const p of pred[u]) {
              if (!dist.has(p)) { dist.set(p, dist.get(u) + 1); queue.push(p); }
            }
          }
          if (dist.size) {
            exitDist = dist;
            exitMax = Math.max(...dist.values());
          }
        }
      } catch { exitDist = null; }   // 梯度是救济层，构建失败退回原行为
    }
    // R24 残血导航（09-27 原则修复②，全流程审计：残血 5 游走 60 步不会朝火堆走——
    // 近视贪心只看邻格，没有「回血/撤离」的长程目标）。hp 不健康时对本层从
    // 火堆/紧急撤离点做反向 BFS（同 exitDist 机制），梯度把策略拉向回血/撤离方向。
    // 不要求滞环——残血滚动正是「顺路思维」在正常行走时造成的
    let retreatDist = null;
    let retreatMax = 0;
    if (strategic && hpRatio < W.gate.retreatHp) {
      try {
        const lay = globalThis.window?.SDT?.game?.layerData?.[curLi]?.logical;
        if (lay) {
          const pred = lay.map(() => []);
          const targets = [];
          for (let i = 0; i < lay.length; i++) {
            const ty = lay[i]?.def?.type;
            if (ty === 'fire' || ty === 'emergencyExit'
              || (ty === 'extraction' && (obs.run?.bossKilled ?? false))) targets.push(i);
            for (const [tl, ti] of lay[i]?.next || []) {
              if (tl === curLi && ti != null) pred[ti].push(i);
            }
          }
          const dist = new Map(targets.map(i => [i, 0]));
          const queue = [...targets];
          while (queue.length) {
            const u = queue.shift();
            for (const p of pred[u]) {
              if (!dist.has(p)) { dist.set(p, dist.get(u) + 1); queue.push(p); }
            }
          }
          if (dist.size) {
            retreatDist = dist;
            retreatMax = Math.max(...dist.values());
          }
        }
      } catch { retreatDist = null; }
    }
    // ctx：2步前瞻时以「候选自身位置」为视角（curIdx/curLi/prevNode 替换），其余状态
    // （hp/stalled/fled/nodeSet）是全局的照用。null=当前站位（原语义，bit 级等价）
    const score = (a, ctx = null) => {
      const cIdx = ctx ? ctx.curIdx : curIdx;
      const cLi = ctx ? ctx.curLi : curLi;
      const cPrev = ctx ? ctx.prevNode : prevNode;
      // 滞环状态：lookahead 的邻居视角强制 stallForLook=false（09-26 γ实验根因）——
      // stall 解锁（doorStall/forceProgress/crossBack 放行）是「本地此刻无路」的救济，
      // 被 2 步外的邻居借走后，回浅层门在 value 里虚高（scdbg 实录 score=2 → value=17.8），
      // 把策略吸进门回环（γ=0.5/0.2 各 8-9 例 alt2 弃局）。本地打分不受影响。
      // 拉锯确认后当轮禁选「回刚离开的格」（09-26 alt2 弃局根因）：
      // 血线把门压到 -32 时，已访格保底 2 分稳赢——A→B→A 连发确认后必须强制二选一破舞
      if (strategic && banPrev && a.li === cLi && a.idx === cPrev) return W.geo.ban;
      // 滞环状态（score 内统一声明：门禁解除/跨层放行/强推三处共用）
      const stalled = strategic && stallSteps > 10 && (ctx ? ctx.stallForLook !== false : true);
      // R13 出口梯度在此计算（seen 提前返回之前！）——出桥是 seen 格，加成若挂 base 链
      // 尾会被 407 行的 seen 短路吃掉（首版实测梯度全灭）。seen 返回与 base 返回两处统一 +exitGrad
      let exitGrad = 0;
      if (stalled && exitDist && a.li === curLi) {
        const d = exitDist.get(a.idx);
        if (d != null && Number.isFinite(d)) exitGrad = (exitMax - d + 1) * 6;
      }
      // R24 残血导航梯度：离本层火堆/紧急撤离越近加成越高（×10 强于 exitGrad——
      // 残血时回血优先级高于出层），压过战斗格与已访格的分数，把路线拉向回血点
      let retreatGrad = 0;
      if (retreatDist && a.li === curLi) {
        const d = retreatDist.get(a.idx);
        if (d != null && Number.isFinite(d)) retreatGrad = (retreatMax - d + 1) * 10;
      }
      // 已结算节点几乎零分：防在两个已清节点间来回横跳；前进方向给推进分。
      // 「本次出行站过的格子」也算见过——空格子（无 def）引擎永不写 visited，
      // 不并入会让 forceProgress 把它当无限新格反复推（09-26 实测两格舞）
      const seen = a.visited || (strategic && !!nodeSet && nodeSet.has(`${a.li}:${a.idx}`));
      // 逃离过的格子（含 boss/任意类型）血线恢复前压到 0 分（09-26 修根因②）：
      // fledNodes 检查原写在下方 base 分支里，但已访格在 seen 行提前返回根本够不着——
      // flee 修好 intentDamage 后实测 12/40 局「逃→绕回→再打→再逃」no-progress 弃局
      // （boss seen fwd=5 分稳赢其它 seen 格 2 分，永远绕回）。0 分让位给任意其它候选。
      // 滞环时解锁（09-26 修根因④）：0 分墙在唯一通路穿 fleeing 格时反成死锁——
      // scdbg 实录 seed77004 血 14% 无药：门只邻节点9（fled=0），在 4→5→6→7→8
      // 已访格绕到 no-progress。stallSteps>10=本地证据「已无其它进展」，此时让位给推进。
      if (strategic && hpRatio < 0.7 && fledNodes.has(`${a.li}:${a.idx}`) && !stalled) return 0;
      // 穿过的门降为 seen 级分（09-26 门对跳死锁修复）：goDoor 传送成功但门格 visited
      // 永不落盘（踩上即弹浮层传送走）——门格在新层视角恒「未访」拿门高分，γ 前瞻再把
      // 门对面的未访格分拉进 value，L1门↔L2入口反复横跳（seed88100 实录 123 步弃局）。
      // 降为 seen 级并断 γ（见 value()）——破对跳同时保留回程可达（低血回 L1 火堆/撤离
      // 是合法生存路线，-1000 级硬 ban 会把清图后的回撤路堵死）
      if (strategic && doorUsed.has(`${a.li}:${a.idx}`)) return W.geo.seen + (a.idx > cIdx ? W.geo.seenFwd : 0);
      const t = (a.label || '').match(/（(\w+)）/)?.[1] || '';
      // seen 提前返回只对「层出口」破例（09-26 修根因③·二版）：
      // 一版让滞环时所有 seen 落完整打分——已清火堆/商店/宝箱因此拿到 85-95 分压过
      // 未访格（实测 13 分），造出 3→6→7→6 已清节点死循环（scdbg 探针抓到）。
      // 只给 door/extraction 解锁分：门 -40 在血线<75% 时低于 seen 保底 2 分，
      // 整层踏完后永远进不去 → 60 步无新格 no-progress（R2 实测 17/40 的真正根因）。
      const isExit = t === 'door' || t === 'extraction' || t === 'emergencyExit';
      if (seen && !(stalled && strategic && isExit)) {
        // strategic 读 W（可进化）；v1 对照保持字面量冻结
        return (strategic
          ? W.geo.seen + (a.idx > cIdx ? W.geo.seenFwd : 0)
          : 2 + (a.idx > cIdx ? 3 : 0)) + exitGrad;   // R13：seen 出口也要吃到梯度
      }
      let base = W.base.def;
      if (strategic) {
        // v2 血线门控（数据：v1 均 12 行动冲到层2 无回复死亡）：
        // 门按血量放行、火堆提前找、血不健康少打硬仗——滞环时门禁解除（死墙优先于血线）
        // R2 深层续航调参（R1 基线：87% 死、死亡主力层3×42/层1×18——带伤进硬层是主因）
        // 09-26 起分档与阈值全部读 W（见 agent.weights.js），DEFAULT 与原字面量逐值相等
        if (t === 'fire') base = hpRatio < W.gate.fire ? W.base.fireHi : W.base.fireLo;
        // v3：背包满时宝箱降分（收不进奖励白跑一趟）
        else if (t === 'chest') {
          base = ((obs.run?.used ?? 0) >= (obs.run?.bagCap ?? 99)) ? W.base.chestFull : W.base.chestOk;
          // R18 攒卡优先（09-27 startCards 埋点：29% 场次开战卡<3 张——紧急撤离献 3 卡
          // 的门槛卡死撤离选项）：卡不足时宝箱提分提前攒卡，保住 L3 撤离赎卡能力
          if (strategic && (obs.run?.ownedCards || []).length < 3) base = W.base.chestLowCards;
        }
        else if (t === 'event') base = W.base.event;
        else if (t === 'shop') base = hpRatio < W.gate.fire ? W.base.shopHi : W.base.shopLo;   // 低血商店=买药续航（2 币回 6 血固定位）
        // v3：撤退过的格子血线恢复前不回头（flee 保命后防原地重蹈）
        else if (t === 'battle') {
          // R16 极低血规避（09-27 埋点解剖：败场 55% 战后 hp≤5、round 中位 1——残血
          // 进场被一波带走）：hp ≤ battleCritical 时战斗格 0 分让位给任何替代路径；
          // 无替代时 ranked[0] 仍保留被迫作战，不掐撤离路线
          // R17 连续作战疲劳压分已试并毙（09-27：fought≥4 且 hp<50% 时战斗 -25 →
          // 撤离 39% vs 46%、弃局 9% 爆——地图侧避战引发绕路连锁，残血滚动的改善
          // 要在战斗内解决（喝药/护甲时机），地图侧别再试）
          base = hpRatio <= W.gate.battleCritical ? W.base.battleCritical
            : hpRatio >= W.gate.fire ? W.base.battleHi : hpRatio >= W.gate.battleMid ? W.base.battleMid : W.base.battleLo;
          if (hpRatio < W.gate.fled && fledNodes.has(`${a.li}:${a.idx}`)) base = W.base.battleFled;
        }
        else if (t === 'boss') base = hpRatio > W.gate.boss ? W.base.bossHi : W.base.bossLo;
        // R2：撤离点阈值 0.4→0.5（半血就该考虑离场，别带伤硬拼）
        // 终局撤离点被首脑锁时（bossKilled=false）判 -100（09-26 修根因⑥）：
        // 引擎对该节点只回「击败第四层首脑后才能撤离」+stayHere，move 成功但节点
        // 永不 visited——95 分勾着反复撞门被拒（scdbg 实录 seed77022 死循环到
        // no-progress）。锁着的门不是候选，让位给 boss/altar（唯一解锁路径）。
        else if (t === 'extraction' || t === 'emergencyExit') {
          base = hpRatio < W.gate.extract ? W.base.extractHi : W.base.extractLo;
          if (t === 'extraction' && !obs.run?.bossKilled) base = W.base.extractLocked;
        }
        else if (t === 'door') {
          // 滞环解锁只给「同层/前进」的门（修根因③的原意=破本层死墙进下一层）；
          // 回浅层门（a.li<cLi）永远吃 crossBack 惩罚——09-26 γ实验：放行它会
          // 造成本层↔下层门横跳（scdbg 实录 cur=1:0 连续4次选回浅层门79分）
          const doorStallOk = stalled && a.li >= cLi;
          base = hpRatio >= W.gate.fire ? W.base.doorHi : doorStallOk ? W.base.doorStall
            : hpRatio >= W.gate.battleMid ? W.base.doorMid : W.base.doorLow;
          // 扫图偏好：本层还有未收的宝箱/事件先收完再进层（攒卡组厚度）
          if (base > 0 && hasUnexplored) base -= W.gate.doorUnexplored;
        }
      } else if (hpRatio < 0.5 && t === 'fire') base = 100;
      else if (t === 'chest') base = 60;
      else if (t === 'event') base = 50;
      else if (t === 'shop') base = 45;
      else if (t === 'battle' && hpRatio > 0.4) base = 40;
      else if (t === 'boss') base = hpRatio > 0.7 ? 55 : 10;
      else if (t === 'extraction' || t === 'emergencyExit') base = hpRatio < extractHpRatio ? 90 : 20;
      else if (t === 'door') base = 30;
      // v1 对照组冻结：几何权重用字面量，不随 W 变化（否则 evolve 会污染基线）
      const fwdLit = (a.idx > cIdx ? 8 : 0) + (a.li > cLi ? 8 : 0);
      const backLit = (cPrev != null && a.li === cLi && a.idx === cPrev) ? 25 : 0;
      if (!strategic) {
        // v1 基线保持原语义：同层低格位 -12、回更浅层 -40（冻结作对照）
        const backward = (a.idx < cIdx ? 12 : 0) + (a.li < cLi ? 40 : 0);
        return base + fwdLit - backward - backLit;
      }
      // strategic：几何权重读 W（可进化）
      const fwd = (a.idx > cIdx ? W.geo.fwdIdx : 0) + (a.li > cLi ? W.geo.fwdLayer : 0);
      // 反振荡三规则（09-26 迭代）：
      // ①「刚离开的格子」永远 -25（防 A↔B 立即回退，任何情况不解除）
      const backtrack = (cPrev != null && a.li === cLi && a.idx === cPrev) ? W.geo.backtrack : 0;
      // v2：同层回走合法（绕路拿资源、回药铺——老板 09-26「回走是合法战术」）；
      // ② 回更浅层仅在滞环时放行（防跨层门回环），平时 -40；③ 滞环时未访非回退格 +45 强推
      // 回浅层恒罚（09-26）：滞环放行曾被实测造成门横跳；滞环出路=同层未访(forceProgress)+前进门
      const crossBack = a.li < cLi ? W.geo.crossBack : 0;
      const forceProgress = stalled && !a.visited && !(a.li === cLi && a.idx === cPrev) ? W.geo.forceProgress : 0;
      return base + fwd - backtrack - crossBack + forceProgress + exitGrad + retreatGrad;
    };
    // v2 扫图判定：候选里还有未访的宝箱/事件（同层）
    const hasUnexplored = strategic && moves.some(m =>
      !m.visited && m.li === curLi && /（(chest|event)）/.test(m.label || ''));
    // alt2 弃局根因修复（09-26）：血线把前进项（门 -32）压到已访保底分 2 之下时，
    // A↔B 拉锯被「回走 2 分稳赢」锁死、stallSteps>10 永远轮不到解锁，被 8 步 alt2 熔断判弃。
    // 判据：本轮首选仍是「回刚离开的格」→ 上轮也是 → A→B→A 连发确认，当轮禁选 prevNode
    // 强制落另一侧（单次回走是合法战术，只罚连发）
    const isBack = (a) => a.li === curLi && a.idx === prevNode;
    let banPrev = false;
    // 2步前瞻价值（09-26 架构升级②）：value(a) = score(a) + γ·max邻居score（以 a 为站位视角）
    // ——把「贪心单步」换成 depth-2 rollout：单步高分但两步内是死胡同的候选会被
    // 「单步略低但两步内有火堆/宝箱/出口」的候选压过。γ=W.geo.lookahead（默认0.5，
    // γ=0 严格退化为原贪心——消融开关）
    const gamma = strategic ? W.geo.lookahead : 0;
    const value = (a, ctx = null) => {
      const self = score(a, ctx);
      if (!(gamma > 0) || !Array.isArray(a.next) || !a.next.length) return self;
      // 穿过的门断 γ（09-26 门对跳修复）：门自身 seen 低分仍会被门对面未访格的
      // 高分通过 γ·max 拉成全场最高——穿过过的门不再吃前瞻加成，只值自身分
      if (strategic && doorUsed.has(`${a.li}:${a.idx}`)) return self;
      // 低血门断 γ（09-27 R18）：hp ≤ geo.doorNoLookHp 时所有门不吃前瞻——
      // doorLow -150 被门对面未访格拉分抵消=残血深进 L4 全灭 22/22 的真机制；
      // 断 γ 后门回归真实风险分，低血策略转向火堆/紧急撤离（本层或已过层）。
      // 门格识别用 label 的（door）类型后缀（label 文本如「通往第2层（door）」不含门字）
      if (strategic && /（door）/.test(a.label || '') && hpRatio <= W.geo.doorNoLookHp) return self;
      // 邻居视角：stallForLook=false → 邻居一律按常态打分（不继承本地滞环解锁）
      const at = { curIdx: a.idx, curLi: a.li, prevNode: ctx ? ctx.curIdx : curIdx, stallForLook: false };
      let best = -Infinity;
      for (const nb of a.next) {
        const s = score(nb, at);
        if (s > best) best = s;
      }
      return self + gamma * (best === -Infinity ? 0 : best);
    };
    // 单次全量排序，三处消费共享（09-27 冗余审计）：value 依赖 banPrev（score 内
    // W.geo.ban），但走到兜底时 banPrev 必已复位（forced 命中即 return，未命中已复位），
    // 与首查同语境可缓存；banPrev 强推分支仍按 banPrev=true 现算——缓存序不与其逐值
    // 等价（γ 前瞻邻居视角 at.prevNode=curIdx，addEdge 双向存边→每个候选 next 都含
    // 当前格，禁选会改非回退候选的相对序）
    const ranked = moves.slice().sort((x, y) => value(y) - value(x));
    if (strategic && prevNode != null) {
      const first = ranked[0];
      if (first && isBack(first)) {
        backToPrevStreak += 1;
        if (backToPrevStreak >= 2) banPrev = true;
      } else backToPrevStreak = 0;
      if (banPrev) {
        const forced = moves.slice().sort((x, y) => value(y) - value(x))
          .find(m => !isBack(m));
        if (forced) return forced;
        banPrev = false;   // 候选只剩 prevNode：无从破舞，放行交给上层熔断收口
      }
    }
    if (globalThis.__scdbg && ranked.length) {
      // 全图结构 dump（死锁归因用）：本层所有节点 type + visited + 邻接出边
      try {
        const G = globalThis.window?.SDT?.game;
        const lay = G?.layerData?.[curLi]?.logical || [];
        console.log('[scdbg-map]', `L${curLi}`,
          lay.map((n, i) => `${i}:${n?.def?.type || '-'}${G.visited?.[`${curLi},${i}`] ? 'v' : ''}${(n?.next || []).length ? `>{${n.next.map(x => x[1]).join(',')}}` : ''}`).join(' '));
      } catch { /* dump 失败不影响决策 */ }
      console.log('[scdbg]', `cur=${curLi}:${curIdx} hp=${(hpRatio * 100).toFixed(0)}% stalled=${stallSteps > 10} prev=${prevNode} streak=${backToPrevStreak} ban=${banPrev ? 1 : 0} |`,
        ranked.map(m => `${m.id}=${value(m).toFixed(1)}(${score(m).toFixed(0)})${m.visited ? 'v' : ''}${fledNodes.has(`${m.li}:${m.idx}`) ? 'F' : ''}[${m.label}]`).join(' '));
    }
    return ranked[0];
  };

  let overlaySteps = 0;
  let countPhase = '';
  return (obs) => {
    const acts = obs.actions || [];
    // 零动作=瞬态而非停局：回 noop 等待（autoRun 的 waitLimit 兜底收口）
    if (!acts.length) return { type: 'sys', name: 'noop' };
    if (obs.phase === 'title') return acts.find(a => a.name === 'startGame') || acts[0];
    if (obs.phase === 'battle') return decideBattle(obs);
    if (obs.phase === 'map') return decideMap(obs);

    // 同一弹层停留计数：超过预算就点「收口」动作离开（商店买几手就走）
    if (obs.phase !== countPhase) { countPhase = obs.phase; overlaySteps = 0; }
    overlaySteps += 1;

    // 弹层通用（事件/商店/宝箱/火堆/撤离整理/结算）：优先推进语义，回避弃局语义。
    // pick 只选「最近没点过」的动作（LRU 跨面板记忆，只回看不复点）；
    // 全部试过时按 LRU 顺序复用最旧的一个，不死锁。
    // 同页面内绕开上次被引擎拒绝的动作（obs.lastFailed，换页自动失效）
    const fail = obs.lastFailed;
    const usable = (a) => !fail || a.id !== fail.id || JSON.stringify(a.params || {}) !== JSON.stringify(fail.params || {});
    const ui = acts.filter(a => a.type === 'ui' && usable(a));
    // 瞬态等待页根治（09-26）：面板只剩 meta 关闭键（closeOverlay/openHelp/helpBack）=
    // 页面渲染未就绪或必选流程——点关闭必被拒且会自旋熔断，直接回 noop 慢等渲染到位。
    // 例外（09-26 死锁修复③·战斗残留页）：战斗结束 ovBody 残留战斗 DOM + overlay 未关
    // → phase 误判 overlay 且动作面只剩 closeOverlay，noop 死等到 wait-limit（实测
    // V 底 29/40 局）。识别特征 = ovBody 内有 .sts-topbar（战斗渲染残留）：点一次
    // closeOverlay 即脱困回地图；必选流程页 closeOverlay 被拒 → 失败记忆防连点，
    // 回退 noop 等待原语义
    if (!ui.some(a => !/^(openHelp|helpBack|closeOverlay)$/.test(a.name))) {
      const co = ui.find(a => a.name === 'closeOverlay');
      const battleResidue = (() => {
        try {
          const body = document.getElementById('ovBody');
          return !!(body && body.querySelector('.sts-topbar'));
        } catch { return false; }
      })();
      if (co && battleResidue) return co;
      return { type: 'sys', name: 'noop' };
    }
    // 背包满腾格（09-26 断链修复①）：discardCard 是 sys 动作不在 ui 链里——满包按
    // 稀有度升序丢最低值卡（同稀有度先丢非卡组类型），丢到不满立即关包回地图。
    // 只丢可丢的（bagActions 已滤 safe/stored/初始牌，usable 再滤本步失败键）
    const discards = acts.filter(a => a.type === 'sys' && a.name === 'discardCard' && usable(a));
    if (strategic && discards.length) {
      const own = new Map((obs.run?.ownedCards || []).map(o => [o.name, o]));
      const discardKey = (a) => {
        const o = own.get(a.args?.[0]) || {};
        return [rarityRank(o.rarity), DECK_TYPES.has(o.type) ? 1 : 0];
      };
      const sorted = discards.slice().sort((x, y) => {
        const [rx, dx] = discardKey(x);
        const [ry, dy] = discardKey(y);
        return rx - ry || dx - dy;
      });
      return sorted[0];
    }
    // 丢完（已不满）且背包页还开着 → 立即关包回地图（不走 TERMINATORS 的 8 步慢收口）
    if (strategic && !((obs.run?.used ?? 0) >= (obs.run?.bagCap ?? 99))) {
      const closeBagBtn = ui.find(a => a.name === 'closeBag');
      if (closeBagBtn) return closeBagBtn;
    }
    const keyOf = (a) => `${a.id}:${JSON.stringify(a.params || {})}`;
    const hpRatio = obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1;
    // v3 经济留币：三层起且血不健康——保留 10 币作紧急撤离保证金，不再扫光
    // （09-26 扩展：三参入 W.shop；消费点全在 strategic 分支，v1 不受影响）
    const reserve = (obs.run?.layer ?? 1) >= W.shop.reserveLayer && hpRatio < W.shop.reserveHpRatio ? W.shop.reserveCoins : 0;
    const affordable = (label) => priceOf(label) <= Math.max(0, (obs.run?.coins ?? 0) - reserve);
    // v3 货架类型加权：同价优先回复（低血时权重更高）与伤害卡
    const typeBonus = (label) => {
      if (/(药|治疗|回复|生命)/.test(label)) return hpRatio < W.shop.healHpRatio ? W.shop.healScoreHi : W.shop.healScoreLo;
      if (/(攻击|伤害|射线|箭|斩|击)/.test(label)) return W.shop.attackScore;
      return 0;
    };
    const freshPick = (list) => {
      const chosen = list.find(a => !recentUi.includes(keyOf(a))) || null;
      if (chosen) {
        recentUi.push(keyOf(chosen));
        if (recentUi.length > RECENT_MAX) recentUi.shift();
      }
      return chosen;
    };
    const isMeta = (a) => /^(openHelp|helpBack|closeOverlay)$/.test(a.name);
    const lruPick = (list) => {
      if (!list.length) return null;
      const chosen = list.slice()
        .sort((x, y) => recentUi.indexOf(keyOf(x)) - recentUi.indexOf(keyOf(y)))[0];
      recentUi.push(keyOf(chosen));
      if (recentUi.length > RECENT_MAX) recentUi.shift();
      return chosen;
    };
    // 卡牌特写是盲巷：先关再继续（关闭机制本身是动作面里的 czClose）
    const zoomClose = ui.find(a => a.name === 'czClose');
    if (zoomClose) return zoomClose;
    // 宝箱选卡优先（09-27 全流程审计：三选一宝箱的选卡按钮 chestPick 在 DOM 中排
    // 在跳过按钮之后，freshPick 永远先点 chestSkip——实测 77004 一局 10 个宝箱全被
    // 跳过，卡牌资源全弃→卡组薄→砸击 9 次。选卡是收益动作，优先于跳过）
    const chestPick = ui.find(a => a.name === 'chestPick' && usable(a));
    if (chestPick) return chestPick;
    // 跳过的宝箱记入 nodeSet（09-27 盲区修复）：引擎对「跳过宝箱」不写 visited——
    // 格子地图上仍是 chest（策略打分 chestOk 60 分），AI 会白走回头路再跳一次。
    // 跳过时把当前格计入 nodeSet（seen 判定同源），此后按已清格 2 分处理
    if (ui.some(a => a.name === 'chestSkip') && obs.run?.layer != null && obs.run?.node != null) {
      (nodeSet ||= new Set()).add(`${obs.run.layer - 1}:${obs.run.node}`);
    }
    // 祭坛死锁修复（09-26）：背包卡<3 时引擎的 altarOn3 点了只写警告日志不开面板
    // （按钮无 disabled），策略看到的面不变 → LRU 反复连点直到 spin 熔断（实测
    // 77074 L3 祭坛 7 连点弃局）。卡不足时直接离开祭坛回地图；弃 3 激活的收益留给
    // 卡充足的局。碎片兑换同理（碎片数字段不在 runBrief，无法判 ≥2，一并走离开）
    if (strategic && ui.some(a => a.name === 'altarOn3' || a.name === 'altarFragHero')
      && (obs.run?.ownedCards || []).length < 3) {
      const leave = ui.find(a => a.name === 'altarLeave');
      if (leave && usable(leave)) return leave;
    }
    const stashList = ui.filter(a => a.name === 'exAll' || a.name === 'exSmart' || a.name === 'exFinish');
    const preferredList = ui.filter(a => !isMeta(a) && PREFER_LABEL.test(a.label || '') && !AVOID_LABEL.test(a.label || ''));
    const safeList = ui.filter(a => !isMeta(a) && !AVOID_LABEL.test(a.label || '') && !/^newSlot$/.test(a.name));
    const metaList = ui.filter(isMeta);
    const chosen = freshPick(stashList)
      // 档位页：resetSlots（批量/测试档）优先开新档/覆写旧档；默认只续档，绝不清档
      || (resetSlots ? freshPick(ui.filter(a => a.name === 'newSlot' || a.name === 'overwriteSlot')) : null)
      // 基地页：--mode nest / preferNest 时优先进研究所
      || (preferNest && obs.phase === 'hub' ? freshPick(ui.filter(a => a.name === 'nestDeploy')) : null)
      || freshPick(ui.filter(a => a.name === 'enterSlot'))
      // v3 整备带卡：狗先上阵 → 按仓库卡价值降序带入 → 留 2 空位收战利品（实测满包吞奖励）
      || (strategic && ui.some(a => a.name === 'pickAdd')
        ? (() => {
            const pet = freshPick(ui.filter(a => a.name === 'depPet'));
            if (pet) return pet;
            const budget = Math.max(1, (obs.run?.bagCap ?? 99) - W.shop.deployReserve);
            if ((obs.run?.deck ?? 0) < budget) {
              const rank = new Map((obs.run?.stash || []).map(s => [s.name, rarityRank(s.rarity)]));
              const ordered = ui.filter(a => a.name === 'pickAdd')
                .sort((x, y) => (rank.get(y.params?.name) ?? 0) - (rank.get(x.params?.name) ?? 0));
              const p = freshPick(ordered);
              if (p) return p;
            }
            return ui.find(a => a.name === 'confirmDeploy') || null;
          })()
        : null)
      // v2 低血买药：商店里的回复类道具优先（2 币回 6 血固定位，卡名含药/治疗/生命）
      || (strategic && hpRatio < W.shop.healHpRatio
        ? freshPick(ui.filter(a => (a.name === 'buyCard' || a.name === 'buySha')
            && affordable(a.label) && priceOf(a.label) <= 4
            && /(药|治疗|回复|生命|血)/.test(a.label || '')))
        : null)
      // v2 商店扫货：局内币不带走——按标价升序（同价优先伤害/回复类）
      || (strategic ? freshPick(ui
        .filter(a => (a.name === 'buyCard' || a.name === 'buySha') && affordable(a.label))
        .sort((x, y) => priceOf(x.label) - priceOf(y.label) || typeBonus(y.label) - typeBonus(x.label))) : null)
      // v2 背包满腾格：商店收购台 → 按稀有度升序卖最低值卡（换币再买，腾格收奖励）。
      // 只有真存在可售卡才进收购台（09-26 断链修复②：普通卡进收购台是空面板，
      // 实测 openSell 开10次卖出0张）——无可售时交给野外丢卡链路
      || (strategic && obs.run && (obs.run?.used ?? 0) >= (obs.run?.bagCap || 99)
        && (obs.run.ownedCards || []).some(o => o.sellable)
        ? (freshPick(ui.filter(a => a.name === 'openSell'))
          || freshPick(ui.filter(a => a.name === 'sellCard').sort((x, y) => {
            const own = new Map((obs.run.ownedCards || []).map(o => [o.uid, o.card?.rarity]));
            return rarityRank(own.get(x.params?.uid)) - rarityRank(own.get(y.params?.uid));
          })))
        : null)
      // v2 事件按文案期望分选（收益/风险/回复权衡——低血回复优先）
      || (strategic && ui.some(a => a.name === 'evtChoice')
        ? freshPick(ui.filter(a => a.name === 'evtChoice')
            .sort((x, y) => eventScore(y.label, obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1, W)
              - eventScore(x.label, obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1, W)))
        : null)
      // 同弹层停留超预算 → 收口动作优先（商店/背包不流连）
      || (overlaySteps > 8 ? ui.find(a => TERMINATORS.has(a.name)) : null)
      || freshPick(preferredList)
      || freshPick(safeList)
      // 复用最久没点的「实动作」优先于 meta（关闭类）：宁可重试真按钮，不拿关闭空转。
      // 兜底复用也必须记账（lruPick）——否则同一键被连续选中触发熔断
      || lruPick(ui.filter(a => !isMeta(a)))
      || freshPick(metaList)
      || lruPick(ui);
    // 全部被排除/无可用动作 = 页面瞬态：回 noop 等渲染（失败动作被绕开后不再原地打转）
    if (!chosen) return { type: 'sys', name: 'noop' };
    // 穿门记忆（09-26 死锁根因②·门对跳）：goDoor 传送成功但门格 visited 永不落盘
    // （踩上即弹浮层传送走），门格在新层视角恒「未访」高分，γ 前瞻再把门对面的未访格
    // 分拉进 value——实测 -182 分的回浅层门照样被选（seed88100 L1门↔L2入口 123 步
    // alt2-cycle）。goDoor 时把门格计入 doorUsed（score 里 ban -1000，滞环解锁留出路）
    if (chosen && chosen.name === 'goDoor' && obs.run?.layer != null && obs.run?.node != null) {
      doorUsed.add(`${obs.run.layer - 1}:${obs.run.node}`);
    }
    return chosen;
  };
}

export { greedyPolicy, randomPolicy, strategicPolicy };
