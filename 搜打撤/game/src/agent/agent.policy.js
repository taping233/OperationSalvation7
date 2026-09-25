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
    if (!acts.length) return null;
    return acts[Math.floor(roll() * acts.length)];
  };
}

// ---------- 贪心策略 ----------
function greedyPolicy({ resetSlots = false, preferNest = false, extractHpRatio = 0.35 } = {}) {
  const tried = new Set();   // 本回合打过且无效果的出牌（防引擎静默拒绝导致死循环）
  const recentUi = [];       // 最近执行过的 ui 动作键（跨面板 LRU，防 openHelp↔helpBack 之类互翻）
  // 上限必须 ≥ 最大单页动作数（研究所备战页 23 个）：否则早期键被挤出后又变「新鲜」，
  // 轮番取消已选项把 nestGo 永远饿死
  const RECENT_MAX = 60;
  let lastTurn = -1;

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
    if (!acts.length) return null;
    // 胜利/败北结算窗口：场上全灭或己方空血时引擎收尾异步跑，出牌/结束回合都会被拒——
    // 回 noop 等待（runner 对 noop 不计熔断），等结算页浮出再继续
    if (b.foes.length && b.foes.every(f => f.dead)) return { type: 'sys', name: 'noop' };
    if (b.player && b.player.hp <= 0) return { type: 'sys', name: 'noop' };

    if (b.deckSelection) {
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
    if (b.choosing || b.discovering) return find('pickChoice') || find('pickDiscover') || acts[0];
    if (b.handSelecting) {
      // 非强制选择可跳过（快）；强制选择 skip 会被引擎拒绝，必须真选牌凑够
      if (b.handSelecting.mandatory !== true) return find('skipHandSelect') || acts[0];
      const picks = acts.filter(a => a.name === 'pickHandSelect');
      const fresh = picks.find(a => !tried.has(`hs:${a.args?.[0]}`));
      if (fresh) { tried.add(`hs:${fresh.args?.[0]}`); return fresh; }
      return find('skipHandSelect') || null;
    }

    // 残血有药先喝
    if (b.player && b.player.maxHp && b.player.hp / b.player.maxHp < 0.5) {
      const potion = find('usePotion');
      if (potion && !tried.has(potion.id)) { tried.add(potion.id); return potion; }
    }
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

  let lastNode = null;    // 上一次所在格（防 A↔B 二周期：刚离开的格子不再作为首选）
  let prevNode = null;
  const decideMap = (obs) => {
    const moves = (obs.actions || []).filter(a => a.type === 'move');
    if (!moves.length) return (obs.actions || [])[0] || null;
    const hpRatio = obs.run?.maxHp ? (obs.run.hp ?? 0) / obs.run.maxHp : 1;
    const curIdx = obs.run?.node ?? 0;
    const curLi = (obs.run?.layer ?? 1) - 1;
    if (lastNode != null && curIdx !== lastNode) { prevNode = lastNode; lastNode = curIdx; }
    else if (lastNode == null) lastNode = curIdx;
    const score = (a) => {
      // 已结算节点几乎零分：防在两个已清节点间来回横跳；前进方向给推进分
      if (a.visited) return 2 + (a.idx > curIdx ? 3 : 0);
      const t = (a.label || '').match(/（(\w+)）/)?.[1] || '';
      let base = 15;
      if (hpRatio < 0.5 && t === 'fire') base = 100;
      else if (t === 'chest') base = 60;
      else if (t === 'event') base = 50;
      else if (t === 'shop') base = 45;
      else if (t === 'battle' && hpRatio > 0.4) base = 40;
      else if (t === 'boss') base = hpRatio > 0.7 ? 55 : 10;
      else if (t === 'extraction' || t === 'emergencyExit') base = hpRatio < extractHpRatio ? 90 : 20;
      else if (t === 'door') base = 30;
      // 回走重罚：同层低格位 -12；回更浅层 -40（跨层门回环比 visited 前进分还高会死转）
      const backward = (a.idx < curIdx ? 12 : 0) + (a.li < curLi ? 40 : 0);
      // 刚离开的格子（含 entrance 等永不标 visited 的格）额外压分，杜绝 0↔1 二周期
      const backtrack = (prevNode != null && a.li === curLi && a.idx === prevNode) ? 25 : 0;
      return base + (a.idx > curIdx ? 8 : 0) + (a.li > curLi ? 8 : 0) - backward - backtrack;
    };
    return moves.slice().sort((x, y) => score(y) - score(x))[0];
  };

  let overlaySteps = 0;
  let countPhase = '';
  return (obs) => {
    const acts = obs.actions || [];
    if (!acts.length) return null;
    if (obs.phase === 'title') return acts.find(a => a.name === 'startGame') || acts[0];
    if (obs.phase === 'battle') return decideBattle(obs);
    if (obs.phase === 'map') return decideMap(obs);

    // 同一弹层停留计数：超过预算就点「收口」动作离开（商店买几手就走）
    if (obs.phase !== countPhase) { countPhase = obs.phase; overlaySteps = 0; }
    overlaySteps += 1;

    // 弹层通用（事件/商店/宝箱/火堆/撤离整理/结算）：优先推进语义，回避弃局语义。
    // pick 只选「最近没点过」的动作（LRU 跨面板记忆，只回看不复点）；
    // 全部试过时按 LRU 顺序复用最旧的一个，不死锁。
    const ui = acts.filter(a => a.type === 'ui');
    const keyOf = (a) => `${a.id}:${JSON.stringify(a.params || {})}`;
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
      // 同弹层停留超预算 → 收口动作优先（商店/背包不流连）
      || (overlaySteps > 8 ? ui.find(a => TERMINATORS.has(a.name)) : null)
      || freshPick(preferredList)
      || freshPick(safeList)
      // 复用最久没点的「实动作」优先于 meta（关闭类）：宁可重试真按钮，不拿关闭空转。
      // 兜底复用也必须记账（lruPick）——否则同一键被连续选中触发熔断
      || lruPick(ui.filter(a => !isMeta(a)))
      || freshPick(metaList)
      || lruPick(ui)
      || acts[0];
    return chosen;
  };
}

export { greedyPolicy, randomPolicy };
