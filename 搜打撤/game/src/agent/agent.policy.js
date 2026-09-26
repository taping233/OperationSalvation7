/* ============================================================
 * agent.policy.js —— 内置决策策略（随机 / 贪心）
 *
 * 策略只读 observe() 的 JSON（不碰运行时），因此浏览器与 Node 无头批量
 * 共用同一份实现。贪心不是强度追求，是统计基线：决策稳定、有区分度、
 * 不空转。LLM 适配器（agent.llm）走同一 decide(obs) 契约。
 * ============================================================ */

import { Random } from '../core/random.js';

const TARGET_KEY = /攻击|伤害|造成|消灭|击|刺|斩/;
const PREFER_LABEL = /(开始|出发|继续|确认|完成|获取|带走|进入|领取|修复|治疗|休息|入库|整理|留下)/;
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
const eventScore = (label, hpRatio) => {
  const s = String(label || '');
  let score = 0;
  // 数值收益：+N 金币/生命/卡
  for (const m of s.matchAll(/\+(\d+)/g)) score += +m[1] * (/[生命血]/.test(s) && hpRatio < 0.6 ? 4 : 1);
  // 数值风险：-N（扣血最疼）
  for (const m of s.matchAll(/-(\d+)/g)) score -= +m[1] * (/[生命血]/.test(s) ? (hpRatio < 0.6 ? 6 : 3) : 0.5);
  if (/回复|恢复|治疗|回血/.test(s)) score += hpRatio < 0.6 ? 40 : 8;
  if (/获得|得到|金币|卡牌|抽.{0,2}牌|免费|复制/.test(s)) score += 15;
  if (/失去|扣除|丢弃|减少|随机|可能|概率|赌/.test(s)) score -= 18;
  if (/生命上限|升级|强化/.test(s)) score += 12;
  if (/离开|离开事件|放弃/.test(s)) score -= 25;
  return score;
};

const RARITY_ORDER = { '普通': 0, '常见': 0, '稀有': 1, '史诗': 2, '传说': 3, '职业': 4 };
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
  const tried = new Set();   // 本回合打过且无效果的出牌（防引擎静默拒绝导致死循环）
  const fledNodes = new Set();   // v3：战斗中撤退过的格子（地图低血不回头挑战，血线恢复解锁）
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
  const intentDamage = (f) => {
    const it = f.intent || {};
    const t = it.type || it.kind;
    if (t && t !== 'attack') return 0;
    return Number(it.value ?? it.dmg ?? it.amount ?? f.atk ?? 0) || 0;
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
        if ((b.deckSelection.selected || []).length >= (b.deckSelection.need ?? 0)) {
          return find('confirmDeck') || null;
        }
        const order = b.deckSelection.cards.slice()
          .sort((x, y) => rarityRank(y.rarity) - rarityRank(x.rarity));
        for (const card of order) {
          if (tried.has(`d:${card.uid}`)) continue;
          const act = acts.find(a => a.name === 'selectDeckCard' && a.args?.[0] === card.uid);
          if (act) { tried.add(`d:${card.uid}`); return act; }
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
    let potionOk = b.player && b.player.maxHp && b.player.hp / b.player.maxHp < 0.5;
    if (!potionOk && strategic && b.player) {
      const inc = b.foes.filter(f => !f.dead).reduce((s, f) => s + intentDamage(f), 0);
      potionOk = inc - (b.player.armor ?? 0) >= (b.player.hp ?? 0) * 0.6;
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
        // 记住逃过的格子：地图侧低血不再回头挑战（血线恢复后解锁）
        if (obs.run) fledNodes.add(`${(obs.run.layer ?? 1) - 1}:${obs.run.node ?? 0}`);
        const fleeAct = find('flee');
        if (fleeAct) return fleeAct;
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
        if (cost === 1 && incoming - armor <= 2) continue;
        if (cost >= 2 && incoming - armor <= 6) continue;
        if (gain > bestGain) { best = c; bestGain = gain; }
      }
      if (best) { const a = tryPlay(best); if (a) return a; }
    }
    // 4) 常规出牌：性价比（攻效/费用）最高；v3 多敌时 AOE 卡加权 1.7×
    const aoeBonus = (c) => (living.length > 1 && /全体|所有敌人|每个敌/.test(c.desc || '')) ? 1.7 : 1;
    const eff = (c) => (atk + (c.dmg ?? 0)) * aoeBonus(c) / Math.max(1, c.cost ?? 1);
    const ordered = hand.slice().sort((x, y) => eff(y) - eff(x));
    for (const c of ordered) {
      if ((c.cost ?? 1) > e) continue;
      const targeted = TARGET_KEY.test(c.desc || '') || c.dmg != null;
      const a = targeted ? tryPlay(c, byHp[0].i) : tryPlay(c);
      if (a) return a;
    }
    // 4.5) 背包砸击：2 费 4 固定伤不吃手牌——手牌打空/卡手时的硬通货（省卡策略）
    if (e >= 2 && !tried.has('slam') && acts.some(x => x.name === 'bagSlam')) {
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
  const decideMap = (obs) => {
    const moves = (obs.actions || []).filter(a => a.type === 'move');
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
    const score = (a) => {
      // 滞环状态（score 内统一声明：门禁解除/跨层放行/强推三处共用）
      const stalled = strategic && stallSteps > 10;
      // 已结算节点几乎零分：防在两个已清节点间来回横跳；前进方向给推进分。
      // 「本次出行站过的格子」也算见过——空格子（无 def）引擎永不写 visited，
      // 不并入会让 forceProgress 把它当无限新格反复推（09-26 实测两格舞）
      const seen = a.visited || (strategic && !!nodeSet && nodeSet.has(`${a.li}:${a.idx}`));
      if (seen) return 2 + (a.idx > curIdx ? 3 : 0);
      const t = (a.label || '').match(/（(\w+)）/)?.[1] || '';
      let base = 15;
      if (strategic) {
        // v2 血线门控（数据：v1 均 12 行动冲到层2 无回复死亡）：
        // 门按血量放行、火堆提前找、血不健康少打硬仗——滞环时门禁解除（死墙优先于血线）
        // R2 深层续航调参（R1 基线：87% 死、死亡主力层3×42/层1×18——带伤进硬层是主因）
        if (t === 'fire') base = hpRatio < 0.75 ? 95 : 45;
        // v3：背包满时宝箱降分（收不进奖励白跑一趟）
        else if (t === 'chest') base = ((obs.run?.deck ?? 0) >= (obs.run?.bagCap ?? 99)) ? 12 : 60;
        else if (t === 'event') base = 50;
        else if (t === 'shop') base = hpRatio < 0.75 ? 85 : 45;   // 低血商店=买药续航（2 币回 6 血固定位）
        // v3：撤退过的格子血线恢复前不回头（flee 保命后防原地重蹈）
        else if (t === 'battle') {
          base = hpRatio >= 0.75 ? 40 : hpRatio >= 0.45 ? 15 : 5;
          if (hpRatio < 0.7 && fledNodes.has(`${a.li}:${a.idx}`)) base = 6;
        }
        else if (t === 'boss') base = hpRatio > 0.75 ? 55 : 5;
        // R2：撤离点阈值 0.4→0.5（半血就该考虑离场，别带伤硬拼）
        else if (t === 'extraction' || t === 'emergencyExit') base = hpRatio < 0.5 ? 95 : 20;
        else if (t === 'door') {
          base = hpRatio >= 0.75 ? 30 : stalled ? 26 : hpRatio >= 0.45 ? -40 : -150;
          // 扫图偏好：本层还有未收的宝箱/事件先收完再进层（攒卡组厚度）
          if (base > 0 && hasUnexplored) base -= 15;
        }
      } else if (hpRatio < 0.5 && t === 'fire') base = 100;
      else if (t === 'chest') base = 60;
      else if (t === 'event') base = 50;
      else if (t === 'shop') base = 45;
      else if (t === 'battle' && hpRatio > 0.4) base = 40;
      else if (t === 'boss') base = hpRatio > 0.7 ? 55 : 10;
      else if (t === 'extraction' || t === 'emergencyExit') base = hpRatio < extractHpRatio ? 90 : 20;
      else if (t === 'door') base = 30;
      const fwd = (a.idx > curIdx ? 8 : 0) + (a.li > curLi ? 8 : 0);
      // 反振荡三规则（09-26 迭代）：
      // ①「刚离开的格子」永远 -25（防 A↔B 立即回退，任何情况不解除）
      const backtrack = (prevNode != null && a.li === curLi && a.idx === prevNode) ? 25 : 0;
      if (!strategic) {
        // v1 基线保持原语义：同层低格位 -12、回更浅层 -40（冻结作对照）
        const backward = (a.idx < curIdx ? 12 : 0) + (a.li < curLi ? 40 : 0);
        return base + fwd - backward - backtrack;
      }
      // v2：同层回走合法（绕路拿资源、回药铺——老板 09-26「回走是合法战术」）；
      // ② 回更浅层仅在滞环时放行（防跨层门回环），平时 -40；③ 滞环时未访非回退格 +45 强推
      const crossBack = a.li < curLi ? (stalled ? 0 : 40) : 0;
      const forceProgress = stalled && !a.visited && !(a.li === curLi && a.idx === prevNode) ? 45 : 0;
      return base + fwd - backtrack - crossBack + forceProgress;
    };
    // v2 扫图判定：候选里还有未访的宝箱/事件（同层）
    const hasUnexplored = strategic && moves.some(m =>
      !m.visited && m.li === curLi && /（(chest|event)）/.test(m.label || ''));
    return moves.slice().sort((x, y) => score(y) - score(x))[0];
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
    // 页面渲染未就绪或必选流程——点关闭必被拒且会自旋熔断，直接回 noop 慢等渲染到位
    if (!ui.some(a => !/^(openHelp|helpBack|closeOverlay)$/.test(a.name))) {
      return { type: 'sys', name: 'noop' };
    }
    const keyOf = (a) => `${a.id}:${JSON.stringify(a.params || {})}`;
    const hpRatio = obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1;
    // v3 经济留币：三层起且血不健康——保留 10 币作紧急撤离保证金，不再扫光
    const reserve = (obs.run?.layer ?? 1) >= 3 && hpRatio < 0.6 ? 10 : 0;
    const affordable = (label) => priceOf(label) <= Math.max(0, (obs.run?.coins ?? 0) - reserve);
    // v3 货架类型加权：同价优先回复（低血时权重更高）与伤害卡
    const typeBonus = (label) => {
      if (/(药|治疗|回复|生命)/.test(label)) return hpRatio < 0.7 ? 5 : 1;
      if (/(攻击|伤害|射线|箭|斩|击)/.test(label)) return 2;
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
            const budget = Math.max(1, (obs.run?.bagCap ?? 99) - 2);
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
      || (strategic && hpRatio < 0.7
        ? freshPick(ui.filter(a => (a.name === 'buyCard' || a.name === 'buySha')
            && affordable(a.label) && priceOf(a.label) <= 4
            && /(药|治疗|回复|生命|血)/.test(a.label || '')))
        : null)
      // v2 商店扫货：局内币不带走——按标价升序（同价优先伤害/回复类）
      || (strategic ? freshPick(ui
        .filter(a => (a.name === 'buyCard' || a.name === 'buySha') && affordable(a.label))
        .sort((x, y) => priceOf(x.label) - priceOf(y.label) || typeBonus(y.label) - typeBonus(x.label))) : null)
      // v2 背包满腾格：商店收购台 → 按稀有度升序卖最低值卡（换币再买，腾格收奖励）
      || (strategic && obs.run && (obs.run.ownedCards || []).length >= (obs.run.bagCap || 99)
        ? (freshPick(ui.filter(a => a.name === 'openSell'))
          || freshPick(ui.filter(a => a.name === 'sellCard').sort((x, y) => {
            const own = new Map((obs.run.ownedCards || []).map(o => [o.uid, o.card?.rarity]));
            return rarityRank(own.get(x.params?.uid)) - rarityRank(own.get(y.params?.uid));
          })))
        : null)
      // v2 事件按文案期望分选（收益/风险/回复权衡——低血回复优先）
      || (strategic && ui.some(a => a.name === 'evtChoice')
        ? freshPick(ui.filter(a => a.name === 'evtChoice')
            .sort((x, y) => eventScore(y.label, obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1)
              - eventScore(x.label, obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1)))
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
    return chosen;
  };
}

export { greedyPolicy, randomPolicy, strategicPolicy };
