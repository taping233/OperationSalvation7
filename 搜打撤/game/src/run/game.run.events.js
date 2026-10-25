import { esc, escAttr } from '../core/shared.js';
import { eventEncounterText } from '../core/event-encounter-text.js';
import { Random } from '../core/random.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';

import { EVENT_SCENE_META } from './game.run.data.js';
import { bindNodeEvent, nodeEventAt } from './node-reward-state.js';
import { createSignalPuzzleState, mountEventSignalPuzzle } from '../ui/event-signal-puzzle.js';
import { recodeEligibleCards, recodeSourceMatches, recodeSourceSnapshot } from './event-recode-candidates.js';
import { showEventRecodeResult } from '../ui/event-recode-result.js';
import { settleEventCommand } from './event-commands.js';
import { createEventLifecycle } from './event-lifecycle.js';
import { createEventBranchChoiceController } from './event-branch-choice.js';
import { discardInventoryCard } from '../hub/bag-inventory-commands.js';

// Owns one event lifecycle: deterministic draw, page ownership, pending choices,
// reward handoff and save retry. The flow assembly supplies runtime services.
export function createRunEventController(ports) {
const {
  game, UI, dom, MAP, getCards, sound, serializeReward, eventCommands, createDice,
  saveGame, pick, weighted, scaledEnemy,
  nodeOpt, enterNode, consumeCurrentCell, cancelLegacyChainMove,
  grantEventCard, openFixedRewardsOnCell, openChestsOnCell, openPocketRestore,
  setBagReturnHook, bagSlots, setCardPageOpen, startBattle,
  eventNarrative,
  eventOptionHTML,
} = ports;
const lifecycle = ports.lifecycle || createEventLifecycle(ports);
const { eventSettling, captureEventContext, eventPageBinding, eventNodeShell, closeEventFlow,
  eventCardChoiceController, resumeEventCardChoice } = lifecycle;
const branchChoices = createEventBranchChoiceController({ ...ports, nodeEventAt,
  captureEventContext, captureEventPresentation, eventPageBinding, eventNodeShell, closeEventFlow,
  drawEventCards, finishEventRoll, transformCandidates });
// Loaded event continuations use this presentation ownership probe.
function captureEventPresentation({ allowClosing = false } = {}) {
  const body = UI.el?.ovBody, root = body?.firstElementChild, overlay = UI.el?.overlay;
  const revision = UI._overlayRevision;
  const closing = () => overlay?.hidden || overlay?.dataset?.uiClosing || overlay?.classList?.contains('closing');
  const mayClear = allowClosing && (closing() || root?.matches?.('.flow-transition'));
  return () => !body || (UI.el?.ovBody === body && UI.el?.overlay === overlay
    && body.isConnected && overlay?.isConnected
    && (body.firstElementChild === root || (mayClear && !body.firstElementChild))
    && (UI._overlayRevision === revision || (mayClear && overlay.hidden && !body.firstElementChild && UI._overlayRevision === revision + 1))
    && (mayClear || !closing()));
}
// ---------- 事件卡（第六批桌游事件：只能经事件格触发，背包记录触发历史） ----------
// 事件卡池 = 卡牌库中类型「事件」的卡；卡牌库无事件卡时退回旧随机事件表。
// 导出供开发者节点测试面板（game.run.js devJumpNode）直接进事件页，玩法口径与事件格一致。
async function runEventDeck(current = lifecycle.beginRequest()) {
  if (!current || !current()) return;
  if (resumeEventCardChoice()) return;
  const previous = nodeEventAt(game);
  // 已消费的旧档沿 visited 判定；仍有骰子选择的节点继续原流程。
  if (previous?.settled || game.visited?.[`${game.layerIdx},${game.trackPos}`] && !Number.isInteger(previous?.actionChoice)) {
    await closeEventFlow();
    return;
  }
  if (!await enterNode('event', () => true)) return;
  if (!current()) return;
  const bound = nodeEventAt(game);
  // 系列见闻事件已移除，所有未绑定的事件格直接抽取普通事件卡。
  if (!current()) return;
  const deck = getCards().all().filter(c => c.type === '事件');
  if (bound) {
    const savedCard = deck.find(card => card.id === bound.eventId);
    if (!savedCard) { renderUnavailableNodeEvent(current); return; }
    return triggerEventCard(savedCard, current);
  }
  if (!deck.length) {
    const ev = weighted(MAP.randomEvents);
    if (ev.coins) { UI.log(`【事件】${ev.text}`, 'sys'); eventCommands.gainCoins(ev.coins[0] + Math.floor(Random.random('event') * (ev.coins[1] - ev.coins[0] + 1))); }
    else if (ev.item) { UI.log(`【事件】${ev.text}`, 'sys'); game.addItem(pick(MAP.chestTable)); }
    else UI.log(`【事件】${ev.text}`, 'dim');
    // 旧随机表没有事件页收尾点：不补 finishInstant 会把格子永久卡在 moving（迭代评审 09-20 C-P2，
    // 设置页「清空卡牌库」后踩事件格必现）
    consumeCurrentCell();
    if (game.chainMove) cancelLegacyChainMove();
    await closeEventFlow();
    return;
  }
  const card = pick(deck);
  bindNodeEvent(game, card.id);
  const waitingPage = captureEventPresentation({ allowClosing:true });
  // 保存失败仍保留本局已抽事件；结算前的检查点会再次保存。
  await saveRunCheckpoint(saveGame);
  if (!current() || !waitingPage()) return false;
  return triggerEventCard(card, current);
}

function renderUnavailableNodeEvent(current) {
  if (!current()) return;
  game.state = 'modal';
  eventNodeShell({ tone:'event', icon:'[[icon:notes]]', title:'此处事件暂不可用',
    sub:'这个节点的事件记录已保留，当前卡库暂时无法显示；不会重新抽取事件。',
    body:nodeOpt('eventUnavailableLeave', '返回地图', '保留原事件，稍后可重新进入') });
  const active = eventPageBinding('eventUnavailableLeave', current);
  setBagReturnHook(() => renderUnavailableNodeEvent(current));
  UI.act('eventUnavailableLeave', () => { if (active()) closeEventFlow(); });
  UI.refresh(game);
}

// 把库里的卡发给玩家（同名堆未满并入现有格；堆满或新卡需要空格——叠放上限见 game.session #7；
// 珍珠盒扩出来的格子只收资源卡——canAcceptCard 统一判定，Q5 老板定向）
async function triggerEventCard(card, current) {
  const encounter = eventEncounterText(card.id, game.characterId || game.myClass);
  if (encounter.name) card = { ...card, name: encounter.name };
  game.eventLog = game.eventLog || [];
  game.eventLog.push({ name: card.name, desc: card.desc || '', turn: game.turn });
  // 封顶：eventLog 随对局只增不减，而每次落盘都会全量 JSON.stringify——
  // 长局会让每次 persistSave 的同步序列化越来越慢。留 200 条足够回溯。
  if (game.eventLog.length > 200) game.eventLog = game.eventLog.slice(-200);
  UI.log(`[[icon:dice]] 触发事件【<b>${esc(card.name)}</b>】${card.desc ? '· ' + esc(card.desc) : ''}`, 'sys');
  // 主界面大字揭晓：展示事件卡卡面与描述，点击任意处后结算
  game.state = 'modal';
  setCardPageOpen(false);
  sound('scene');
  const ownsLoadingPage = captureEventPresentation({ allowClosing:true });
  // ink 运行时异常兜底（迭代评审 09-20 C-P2）：此前 await 抛错会永久卡 modal（事件页永不渲染、仅按 B 可解）
  let narrative = null;
  try { narrative = await eventNarrative(card.id); }
  catch (e) { console.error('[event] ink 叙事运行异常，回落默认结算：', e); }
  // 转场退出可以自然清空旧画面；另一个页面或探索已接管时不投影迟到叙事。
  if (!current() || game.state !== 'modal' || !ownsLoadingPage()) return;
  const choices = eventChoiceSpec(card, narrative);
  const resumedChoice = nodeEventAt(game)?.actionChoice;
  if (Number.isInteger(resumedChoice) && choices?.[resumedChoice]?.rolls) {
    const record = nodeEventAt(game);
    eventSettling.add(record);
    try { choices[resumedChoice].run(); }
    finally { eventSettling.delete(record); }
    return;
  }
  // 2026-09-10 留言 #18：没有专属图的事件此前全部回落到祭坛图（等于所有事件共用 1 张背景）。
  // 改为从 3 张事件场景图中随机轮换（scene-event-custom-a/b/c，见 css/scenes.css）。
  const GENERIC_EVENT_BGS = ['scene-event-custom-a', 'scene-event-custom-b', 'scene-event-custom-c'];
  const genericBg = GENERIC_EVENT_BGS[Math.floor(Random.random('scene') * GENERIC_EVENT_BGS.length)];
  const sceneMeta = EVENT_SCENE_META[card.id] || ['event-custom', 'scene-event-custom', genericBg];
  // 杀戮尖塔式事件页：整屏事件背景，右侧毛玻璃面板放标题、叙事与选项条
  const optionHTML = () => choices
    ? choices.map((o, i) => eventOptionHTML(o, i, game)).join('')
    : `<button class="evt-opt ok" data-act="evtNext"><b>${card.id === 'cmtn7qttxqo4' ? '接受整备并离开' : '获取并离开'}</b></button>`;
  // 事件页渲染收敛为可重入闭包（迭代评审 09-20 C-P1 来源恢复协议）：背包盖开再关后经
  // bag-return-hook 重放本闭包恢复事件页——选项进度由外层 evtSettled 保全，不再吞结算；
  // 每次渲染都重新登记钩子（被消费后再次开背包仍有保护），结算时显式清空
  let evtSettled = false;   // 防连点：事件选项二次触发会重复发奖（2026-09-13 实测连点3次入包2张）
  let selectedChoice = null, pageRevision = 0;
  const signalPuzzle = card.id === 'tt6-systemsupply'
    ? createSignalPuzzleState(`${game.mapSeed ?? game.seed ?? ''}|${card.id}|${game.layerIdx},${game.trackPos}`) : null;
  const renderEventPage = (noticeText = '') => {
    if (evtSettled || !current()) return;
    const revision = ++pageRevision;
    game.state = 'modal';
    setBagReturnHook(() => renderEventPage());
    eventNodeShell({
      tone: 'event', asset: sceneMeta[2], icon: '[[icon:dice]]', title: card.name,
      sub: esc(encounter.intro || (narrative && narrative.intro) || card.desc || '神秘事件发生了……'),
      body: optionHTML(),
      foot:'<button class="ov-btn" data-act="evtReturn">返回地图</button><button class="ov-btn" data-act="evtBag">整理背包</button><p class="reward-notice" data-event-capacity role="status"></p>',
    });
    const active = eventPageBinding(choices ? 'evtChoice' : 'evtNext', current);
    const choiceCurrent = () => !evtSettled && current() && pageRevision === revision;
    if (signalPuzzle) mountEventSignalPuzzle(UI.el?.ovBody?.firstElementChild, signalPuzzle, () => choiceCurrent() && active());
    const executeChoice = async index => {
      if (!choiceCurrent()) return false;
      const choice = choices?.[index];
      if (!choice) return false;
      selectedChoice = index;
      if (choice.canRun && !choice.canRun()) {
        renderEventPage(choice.unavailable || '当前放不下，奖励与选择已保留。');
        sound('deny');
        return false;
      }
      const record = nodeEventAt(game);
      if (!record || record.settled || eventSettling.has(record)) return false;
      evtSettled = true;
      if (choice.rolls) {
        const hadChoice = Object.prototype.hasOwnProperty.call(record, 'actionChoice');
        const previousChoice = record.actionChoice;
        record.actionChoice = index;
        eventSettling.add(record);
        try {
          if (!await saveRunCheckpoint(saveGame)) {
            if (hadChoice) record.actionChoice = previousChoice;
            else delete record.actionChoice;
            evtSettled = false;
            if (active()) renderEventPage('未能保存选择，请重试。');
            return false;
          }
          if (!active() || pageRevision !== revision || nodeEventAt(game) !== record) return false;
          setBagReturnHook(null);
          UI.hideOverlay();
          await choice.run();
          return true;
        } finally { eventSettling.delete(record); }
      }
      setBagReturnHook(null);
      const completed = await settleEventAction(() => {
        if (choice.claim && !choice.claim()) return false;
        UI.hideOverlay();
        return choice.run();
      }, record, !choice.deferConsume);
      if (!completed) {
        evtSettled = false;
        renderEventPage('奖励与选择已保留，请重试。');
        return false;
      }
      if (choice.capacityCard && choice.claim) {
        try { UI.showCardReward(choice.capacityCard); }
        catch (error) { console.warn('[event] 卡牌已领取，演出未完成', error); }
      }
      if (game.hp <= 0 || game.terminalPending || game.state === 'done' || game.state === 'terminalPending') return true;
      return true;
    };
    UI.act('evtChoice', (d) => {
      if (!choices || evtSettled || !active()) return;
      const index = Number(d.i), choice = choices[index];
      if (!choice) return;
      selectedChoice = index;
      if (choice.capacityCard && !game.canReceiveCard(choice.capacityCard)) {
        setBagReturnHook(null);
        bagSlots.organizeReward({ card:choice.capacityCard, current:choiceCurrent,
          onReturn:() => { if (choiceCurrent()) renderEventPage(); },
          onClaim:() => executeChoice(index),
          onFullBag:() => { if (choiceCurrent()) { renderEventPage(); bagSlots.showBackpack(); } },
        });
        return;
      }
      executeChoice(index);
    });
    UI.act('evtNext', async () => {
      if (choices || evtSettled || !active()) return;
      evtSettled = true;
      setBagReturnHook(null);
      const body = UI.el?.ovBody, source = body?.firstElementChild, overlayRevision = UI._overlayRevision;
      if (!await settleEventAction(() => { UI.hideOverlay(); applyEventEffect(card); })) {
        evtSettled = false;
        if (current() && pageRevision === revision && UI.el?.ovBody === body
          && (!body?.firstElementChild || body.firstElementChild === source)
          && (UI._overlayRevision === overlayRevision || UI._overlayRevision === overlayRevision + 1)) {
          renderEventPage('本次事件尚未完成，请重试。');
        }
        return false;
      }
      return true;
    });
    UI.act('evtBag', () => {
      if (evtSettled || !active()) return;
      const selected = UI.el?.ovBody?.querySelector('.evt-opt.is-selected[data-i]');
      selectedChoice = selected ? Number(selected.dataset.i) : null;
      bagSlots.showBackpack();
    });
    UI.act('evtReturn', () => { if (!evtSettled && active()) closeEventFlow(); });
    UI.refresh(game);
    const notice = UI.el?.ovBody?.querySelector('[data-event-capacity]');
    if (notice) notice.textContent = noticeText;
    if (choices?.length > 1 && Number.isInteger(selectedChoice)) {
      const option = UI.el?.ovBody?.querySelector(`[data-act="evtChoice"][data-i="${selectedChoice}"]`);
      if (!option?.classList.contains('is-selected')) option?.click();
      option?.focus({ preventScroll:true });
    }
  };
  renderEventPage();
}

function eventPool(types) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return getCards().all().filter(c => wanted.has(c.type) && getCards().isRandomObtainable(c));
}

// 这里只保留本事件节点的预留与承接事实，不回滚已经发放的资源或奖励快照。
async function settleEventAction(run, record = nodeEventAt(game), consume = true) {
  const hpBefore = game.hp, maxHpBefore = game.maxHp, fragmentsBefore = game.fragments || 0;
  const current = captureEventContext(), cellKey = `${game.layerIdx},${game.trackPos}`;
  const accepted = settleEventCommand({ state:game, record, settling:eventSettling, run, consume,
    consumeCell:consumeCurrentCell, serializeReward:state => serializeReward(state) });
  if (!accepted) return false;
  eventSettling.add(record);
  try {
    if (game.hp <= 0 || game.terminalPending || game.state === 'done' || game.state === 'terminalPending') return true;
    if (game.state !== 'modal') {
      if (game.chainMove) cancelLegacyChainMove();
      await closeEventFlow();
      if (current() && game.state === 'idle' && game.hp > hpBefore) {
        const host = dom.getElementById('viewport');
        ports.playOutcomeFeedback?.(host,{kind:'heal',surface:host,hpBefore,hpAfter:game.hp,maxHp:game.maxHp,
          source:getCards().all().find(card=>card.id===record.eventId)?.name || '事件治疗',
          extra:[game.maxHp > maxHpBefore ? `生命上限 +${game.maxHp-maxHpBefore}` : '',
            (game.fragments || 0) > fragmentsBefore ? `员工通行证A碎片 +${game.fragments-fragmentsBefore}` : ''].filter(Boolean).join(' · '),
          isCurrent:()=>current() && game.state==='idle' && `${game.layerIdx},${game.trackPos}`===cellKey});
      }
    }
    else if (!await saveRunCheckpoint(saveGame)) {
      UI.log('事件结算已保留在当前对局，尚未保存成功；离开前请重试保存。', 'warn');
      const notice = UI.el?.ovBody?.querySelector('.reward-notice');
      if (notice) notice.textContent = '本局结算已保留，尚未保存成功；离开前请重试保存。';
    }
    return true;
  } finally { eventSettling.delete(record); }
}

function eventDice(title, key, outcomes, done, sides, beforeRoll) {
  const owner = nodeEventAt(game);
  const current = captureEventContext();
  const openingCurrent = captureEventPresentation({ allowClosing:true });
  return createDice({ UI, save:saveGame,
    show:spec => { game.state = 'modal'; eventNodeShell({ tone:'event', asset:EVENT_SCENE_META[owner.eventId]?.[2], icon:'[[icon:dice]]', ...spec }); UI.refresh(game); },
    bind:act => eventPageBinding(act, current), onLeave:closeEventFlow, setReturn:setBagReturnHook,
  }).open({ owner, key, title, outcomes, done, sides, beforeRoll, current, openingCurrent });
}

function finishEventRoll(run) {
  return settleEventAction(() => {
    setBagReturnHook(null);
    UI.hideOverlay();
    return run();
  });
}

// Each card uses a numbered die with exactly one face per eligible card.
// Frozen candidate IDs and completed dice are reused on reentry, including partial sequences.
function drawEventCards(title, key, pools, done, unique = true) {
  const owner = nodeEventAt(game), drawn = [];
  const next = index => {
    if (index >= pools.length) return done(drawn);
    const pool = (typeof pools[index] === 'function' ? pools[index]() : pools[index])
      .filter(c => c && (!unique || !drawn.some(other => other.id === c.id || other.name === c.name)));
    const outcomes = pool.map(c => ({label:c.name,value:c.id}));
    if (!outcomes.length && !owner.dice?.[`${key}:${index}`]) {
      UI.log('没有符合条件的卡牌，事件与已投结果已保留。', 'warn'); closeEventFlow(); return;
    }
    return eventDice(`${title} · 第 ${index + 1}/${pools.length} 张`, `${key}:${index}`, outcomes, id => {
      const card = getCards().all().find(c => c.id === id);
      if (!card) { UI.log('本次骰子对应卡牌暂不可用，结果已保留。','warn'); closeEventFlow(); return; }
      drawn[index] = card;
      return next(index + 1);
    });
  };
  return next(0);
}

function spendEventCoins(amount, reason, receipt) {
  if (!eventCommands.spendCoins(amount, receipt)) {
    sound('deny');
    UI.log(`[[icon:coin]] 币不足：「${esc(reason)}」需要 ${amount} 币（现有 ${game.coins || 0}）`, 'warn');
    return false;
  }
  sound('coin');
  UI.log(`[[icon:coin]] ${esc(reason)}：-${amount} 币（剩余 ${game.coins}）`, 'coin');
  return true;
}

function claimEventCard(card) { return eventCommands.claimCard(card); }

function transformCandidates(card) {
  if (!card || !['武术', '法术', '装备'].includes(card.type)) return [];
  return getCards().all().filter(c => {
    if (!c || c.id === card.id || c.name === card.name || c.type !== card.type || c.rarity !== card.rarity) return false;
    if (getCards().isRandomObtainable(c)) return true;
    return card.rarity === '职业' && c.rarity === '职业' && c.cls === game.myClass && !c.hero;
  });
}

function openEventRecode() {
  sound('recodeStart');
  game.state = 'modal';
  const eligible = recodeEligibleCards(game.ownedCards, getCards().all(), game.myClass, card => getCards().isRandomObtainable(card));
  const sources = new Map(eligible.map(entry => [entry.uid, recodeSourceSnapshot(entry)]));
  const need = Math.min(2, eligible.length);
  const owner = nodeEventAt(game);
  const convert = () => {
    const entries = owner.recodeUids.map(uid => game.ownedCards.find(o => o.uid === uid));
    if (entries.some((entry, i) => !recodeSourceMatches(entry, owner.recodeSources?.[i]))) {
      UI.log('待重编的原卡已变化或不在随身背包中，本次结果保留。','warn'); closeEventFlow(); return;
    }
    owner.recodeSources ||= entries.map(recodeSourceSnapshot);
    drawEventCards('异常改装台','recode',entries.map(entry => transformCandidates(entry.card)), cards => showEventRecodeResult({ UI, Cards:getCards(), cards, entries, nodeShell:eventNodeShell, setReturn:setBagReturnHook, current:captureEventContext(), done:() => {
      if (entries.some((entry, i) => !game.ownedCards.includes(entry) || !recodeSourceMatches(entry, owner.recodeSources[i])
        || !transformCandidates(entry.card).some(candidate => candidate.id === cards[i].id))) {
        UI.log('原卡或候选条件已变化，结果保留，请重新进入事件。', 'warn'); closeEventFlow(); return;
      }
      finishEventRoll(() => {
      const names = entries.map(entry => entry.card.name);
      if (!eventCommands.recode(entries, cards, owner.recodeSources, transformCandidates)) return false;
      entries.forEach((entry,i) => UI.log(`[[icon:recycle]] 【${esc(names[i])}】重编为【${esc(cards[i].name)}】`, 'loot'));
      sound('recodeComplete'); game.state = 'idle';
      });
    } }), false);
  };
  if (owner.recodeUids?.length) { convert(); return; }
  if (!need) {
    UI.log('[[icon:cards]] 背包中没有可转换的招式或装备卡', 'warn');
    closeEventFlow();
    return;
  }
  const selected = new Set();
  const current = captureEventContext();
  let settled = false;
  const render = () => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(render);
    eventNodeShell({
      tone: 'event', asset: 'scene-event-recode', icon: '[[icon:recycle]]', title: '异常改装台',
      sub: `选择 <b>${need}</b> 张招式或装备卡，将其随机变为同稀有度、同类型的卡牌（<span data-recode-count>${selected.size}</span>/${need}）`,
      body: `<div class="bt-hand event-choice-hand">${eligible.map((o, i) => `
        <button type="button" class="bt-card event-choice-card${selected.has(o.uid) ? ' picked' : ''}" data-act="eventRecodePick" data-i="${i}" aria-pressed="${selected.has(o.uid)}">
          ${getCards().cardHTML(o.card, 'sm')}
          ${selected.has(o.uid) ? '<span class="chest-got-mark">已选</span>' : ''}
        </button>`).join('')}</div>
        <div class="scene-ops"><button class="ov-btn" data-act="eventRecodeLeave">放弃转换</button><button class="ov-btn ok" data-act="eventRecodeGo" ${selected.size !== need ? 'disabled' : ''}>启动重编</button></div>`,
    });
    const active = eventPageBinding('eventRecodePick', current);
    const page = UI.el.ovBody;
    const syncSelection = () => {
      page.querySelectorAll('[data-act="eventRecodePick"]').forEach(button => {
        const picked = selected.has(eligible[Number(button.dataset.i)]?.uid);
        button.classList.toggle('picked', picked);
        button.setAttribute('aria-pressed', String(picked));
        const mark = button.querySelector('.chest-got-mark');
        if (picked && !mark) {
          const label = dom.createElement('span');
          label.className = 'chest-got-mark'; label.textContent = '已选'; button.append(label);
        } else if (!picked) mark?.remove();
      });
      page.querySelector('[data-recode-count]').textContent = String(selected.size);
      page.querySelector('[data-act="eventRecodeGo"]').disabled = selected.size !== need;
    };
    UI.act('eventRecodePick', (d) => {
      if (settled || !active()) return;
      const entry = eligible[+d.i];
      if (!entry) return;
      if (selected.has(entry.uid)) selected.delete(entry.uid);
      else if (selected.size < need) selected.add(entry.uid);
      syncSelection();
    });
    UI.act('eventRecodeLeave', () => { if (!settled && active()) { settled = true; finishEventRoll(() => { game.state = 'idle'; }); } });
    UI.act('eventRecodeGo', () => {
      if (settled || !active() || selected.size !== need) return;
      const fresh = recodeEligibleCards(game.ownedCards, getCards().all(), game.myClass, card => getCards().isRandomObtainable(card));
      const entries = [...selected].map(uid => fresh.find(entry => entry.uid === uid));
      if (entries.some(entry => !entry || !eligible.includes(entry) || !recodeSourceMatches(entry, sources.get(entry.uid)))) {
        UI.log('所选原卡已不符合重编条件，请重新进入事件选择。', 'warn'); closeEventFlow(); return;
      }
      settled = true;
      owner.recodeUids = [...selected];
      owner.recodeSources = entries.map(recodeSourceSnapshot);
      convert();
    });
    UI.refresh(game);
  };
  render();
}

function openEventPotions() {
  if (resumeEventCardChoice()) return;
  const pool = eventPool('道具').filter(c => /药水/.test(c.name));
  const count = Math.min(3, new Set(pool.map(c => c.name)).size);
  if (!count) { UI.log('药品站暂无可领取的药水。','warn'); closeEventFlow(); return; }
  drawEventCards('应急药品站','potions',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-potions', cards));
}

function openEventQuartermaster() {
  if (resumeEventCardChoice()) return;
  const owner = nodeEventAt(game), pool = eventPool('装备');
  const count = Math.min(3,new Set(pool.map(c => c.name)).size);
  if (!count) { UI.log('军需处暂无装备。','warn'); closeEventFlow(); return; }
  if (!owner.quartermasterPaid) {
    if (!spendEventCoins(3, '军需转运费', { receipt:owner, field:'quartermasterPaid' })) { delete owner.actionChoice; closeEventFlow(); return; }
  }
  drawEventCards('转运军需','quartermaster',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-quartermaster', cards));
}

function openEventGamble() {
  const owner = nodeEventAt(game);
  if (!owner.gamble) owner.gamble = { attempts:0, pending:null };
  const state = owner.gamble;
  if (!state.prizeIds) {
    drawEventCards('暗巷赌约','gamble-prizes',[eventPool('装备'),eventPool(['武术','法术']),eventPool(['武术','法术'])], cards => {
      state.prizeIds = cards.map(c => c.id); openEventGamble();
    });
    return;
  }
  game.state = 'modal';
  const prizes = state.prizeIds.map(id => getCards().all().find(c => c.id === id)).filter(Boolean);
  let attempts = state.attempts;
  let settled = false;
  const current = captureEventContext();
  const attempt = () => {
    const attemptNumber = state.pending ?? state.attempts + 1;
    const guaranteed = attemptNumber >= 5;
    eventDice('暗巷赌约 · 投币判定',`gamble-attempt:${attemptNumber}`,
      guaranteed ? [{label:'第 5 次保底：拿走三张卡',value:true}] : [{label:'本次落空',value:false},{label:'拿走三张卡',value:true}], async hit => {
        state.pending = null;
        attempts = state.attempts;
        if (!hit) { sound('blackMarketLose'); render(true); return; }
        settled = true; sound('blackMarketWin');
        const completed = await finishEventRoll(() => openFixedRewardsOnCell(prizes, '暗巷赌约'));
        if (!completed) { state.pending = attemptNumber; settled = false; }
        return completed;
      },6,() => {
        if (!spendEventCoins(3,'暗巷赌约', { receipt:state, field:'pending', value:attemptNumber })) return false;
        state.attempts = attemptNumber;
        return true;
      });
  };
  const render = (lastMiss = false) => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(() => render(lastMiss));
    eventNodeShell({
      tone: 'event', asset: 'scene-event-gamble', icon: '[[icon:dice]]', title: '暗巷赌约',
      sub: `每次投入 <b>3 币</b>后亲手投骰：<b>1～3 点落空，4～6 点拿走三张卡（50%）</b>；第 <b>5</b> 次任意点数都成功。已尝试 ${attempts}/5 次。${lastMiss ? '<br><b class="danger">骰子停下，这次没中。</b>' : ''}`,
      body: `<div class="bt-hand event-choice-hand">${prizes.map((c, i) => `<button type="button" class="bt-card event-choice-card" data-act="eventGambleRead" data-i="${i}" aria-label="放大查看${escAttr(c.name)}" aria-haspopup="dialog">${getCards().cardHTML(c, 'sm')}</button>`).join('')}</div>
        <div class="scene-ops"><button class="ov-btn" data-act="eventGambleLeave">放弃并离开</button><button class="ov-btn ok" data-act="eventGambleTry" ${(game.coins || 0) < 3 || !prizes.length ? 'disabled' : ''}>[[icon:coin]] 投入 3 币${attempts === 4 ? '（本次保底）' : ''}</button></div>`,
    });
    const active = eventPageBinding('eventGambleTry', current);
    UI.act('eventGambleRead', d => {
      const i = Number(d.i), card = prizes[i];
      if (settled || !active() || !card) return;
      const source = UI.el.ovBody.querySelector(`[data-act="eventGambleRead"][data-i="${i}"]`);
      UI.showCardZoom(card, { hideNote:true, presentation:'expedition', from:source, returnFocus:source });
    });
    UI.act('eventGambleLeave', () => { if (!settled && active()) { settled = true; finishEventRoll(() => { game.state = 'idle'; }); } });
    UI.act('eventGambleTry', () => {
      if (!settled && active()) attempt();
    });
    UI.refresh(game);
  };
  if (prizes.length < 3) {
    UI.log('[[icon:cards]] 本次赌约暂无完整的三张奖品', 'warn');
    closeEventFlow();
    return;
  }
  if (state.pending !== null) attempt();
  else render(state.attempts > 0);
}

// 事件分支只覆盖已有资源/效果；未列出的旧事件继续单按钮结算，兼容旧存档与自定义事件卡。
function eventChoiceSpec(card, narrative = null) {
  if (!card) return null;
  const settle = (run) => () => {
    run();
    if (game.hp <= 0 || game.terminalPending || game.state === 'done' || game.state === 'terminalPending') return;
    game.state = 'idle';
  };
  const rewards = (...cards) => openFixedRewardsOnCell(cards, card.name);
  const gainFragment = () => {
    eventCommands.gainFragment();
    // 提示语改写（迭代评审 09-20 B-P1）：原句「可随员工通行证A合成员工通行证A」不成句，
    // 兑换规则以 cards-sync tt-token-color desc 为准
    UI.log(`[[icon:crystal]] 获得员工通行证A碎片（${game.fragments}/2，集齐 2 枚可合成员工通行证A，兑换一张能力卡）`, 'loot');
  };
  const fireball = getCards().all().find(item => item.id === 'tt3-fireball');
  const woodSource = () => game.ownedCards.find(entry => entry.card?.id === 'tt-wood' && !entry.safe && !entry.stored && !entry.pouchOf);
  const EXTRA = {
    'tt6-demondeal': () => [{ label:'领取便携装备', detail:'不搬重箱，投骰确定 1 件普通装备，查看后领取；不损失生命', rolls:true,
      run:() => branchChoices.open('equipment') }],
    'tt6-mystery': () => [{ label:'取走应急零钱', detail:'固定获得 2 币，不领取通行证碎片', run:settle(() => eventCommands.gainCoins(2)) }],
    'tt6-goldmine': () => [{ label:'用木材加固支撑', detail:'消耗随身木材卡 ×1，安全获得 6 币；安全格和收纳区的木材不参与',
      canRun:() => !!woodSource(), unavailable:'随身背包中没有可用的木材卡。',
      claim:() => {
        const entry = woodSource();
        return !!entry && discardInventoryCard(game, { name:entry.card.name, fromSafe:false, uid:entry.uid }, getCards().SHA).ok;
      }, run:settle(() => eventCommands.gainCoins(6)) }],
    'tt6-chestdraw': () => [{ label:'取走库外补给', detail:'不启动开箱，获得木材与口粮各 1 张',
      run:() => rewards(getCards().all().find(item => item.id === 'tt-wood'), getCards().all().find(item => item.id === 'tt-rations')) }],
    'cmtn7qttxqo4': () => [{ label:'领取应急包扎材料', detail:'获得员工通行证A碎片 ×1，回复 3 点生命；不复原卡牌',
      run:settle(() => { gainFragment(); eventCommands.heal(3); }) }],
    'ev19-vital': () => [{ label:'使用创伤处理包', detail:'回复 8 点生命，不增加生命上限', tone:'ok', run:settle(() => eventCommands.heal(8)) }],
    'ev19-pearlbox': () => [{ label:'换取急救物资', detail:'不拿珍珠匣，回复 6 点生命', tone:'ok', run:settle(() => eventCommands.heal(6)) }],
    'ev19-fireballs': () => [{ label:'留一份火种，补充急救物资', detail:'获得「火球」×1，并回复 3 点生命', tone:'ok',
      capacityCard:fireball, canRun:() => !!fireball && game.canReceiveCard(fireball),
      claim:() => claimEventCard(fireball), run:settle(() => eventCommands.heal(3)) }],
    'ev19-classchest': () => [{ label:'只取备用零钱', detail:'不启封物资箱，获得 3 币', run:settle(() => eventCommands.gainCoins(3)) }],
    'ev19-recode': () => [{ label:'精调一件行装', detail:'选 1 张招式或装备，同类型同稀有度候选最多三选一；确认更换时支付 3 币',
      coinCost:3, rolls:true, run:() => branchChoices.open('recode') }],
    'ev19-potions': () => [{ label:'接受现场处理', detail:'不领取药水，回复 6 点生命', tone:'ok', run:settle(() => eventCommands.heal(6)) }],
    'ev19-arrows': () => [{ label:'挑选一份箭具', detail:'投骰抽出最多 3 张非职业箭系列卡牌，选择 1 张', rolls:true,
      run:() => branchChoices.open('arrows') }],
    'ev19-gamble': () => [{ label:'看看低价招式', detail:'先查看 1 张普通招式，可花费 2 币购买，也可放弃；不参与赌约',
      coinCost:2, rolls:true, run:() => branchChoices.open('purchase') }],
    'ev19-quartermaster': () => [{ label:'以旧装备换取物资', detail:'交出 1 件随身装备，从最多 3 件同稀有度装备中换 1 件；不花币，确认前保留原卡',
      rolls:true, run:() => branchChoices.open('trade') }],
  };
  const withBranches = choices => {
    const extra = EXTRA[card.id]?.() || [];
    return choices ? [...choices, ...extra] : extra.length ? extra : null;
  };
  // —— 2026-09-09 事件 v2（Q6/C13 老板定向）：描述已按设计者新版对齐的七个事件，
  //     直接走自定义选项（旧 ink 叙事仍作 intro 展示，效果按新卡面结算）——
  const V2 = {
    'cmtn7qttxqo4': () => [{ label:'修整一件行装', detail:'获得员工通行证A碎片 ×1，并复原 1 张卡牌', tone:'ok', run:() => applyEventEffect(card) }],
    'tt6-mystery': () => [
      { label:'启动配给柜', detail:'1～3 点：员工通行证A碎片 ×1；4～6 点：3 币', tone:'ok', rolls:true,
        run:() => eventDice(card.name, 'supply', [{label:'员工通行证A碎片 ×1',value:'fragment'},{label:'3 币',value:'coins'}],
          value => finishEventRoll(settle(() => { if (value === 'fragment') gainFragment(); else eventCommands.gainCoins(3); })), 6) },
      { label:'离开', detail:'不领取物资', run:settle(() => {}) },
    ],
    'tt6-systemsupply': () => {
      const wood = getCards().all().find(c => c.id === 'tt-wood');
      return [
        { label:'领取建材补给包', detail:'获得员工通行证A碎片 ×1，木材卡 ×1；需背包能放下木材卡', tone:'ok',
          capacityCard:wood, canRun:() => !!wood && game.canReceiveCard(wood),
          claim:() => claimEventCard(wood),
          run:settle(gainFragment) },
        { label:'领取轻装补给包', detail:'获得员工通行证A碎片 ×1，+2 币；不占背包格', tone:'ok',
          run:settle(() => { gainFragment(); eventCommands.gainCoins(2); }) },
      ];
    },
    'tt6-demondeal': () => [
      { label: '协助搬出重箱', detail: '-5 血，获得 1 个军用保险柜', healthCost:5, tone: 'danger', run: () => {
        eventCommands.damage(5, '搬运途中擦伤');
        if (game.hp <= 0 || game.terminalPending) return;
        UI.log('[[icon:tools]] 你在拖出重箱时被破损的车架划伤（-5 血）。运输队按约把军用保险柜留给了你。', 'warn');
        openChestsOnCell([{ kind: 'large' }], '运输队留下的军用保险柜');
      } },
      { label: '不作停留', detail: '不搬运，也不领取物资', run: settle(() => { UI.log('你示意无法停留，沿侧巷继续赶路。', 'sys'); }) },
    ],
    'tt6-airdrop': () => {
      const potionPool = getCards().all().filter(c => c.type === '道具' && getCards().isRandomObtainable(c) && (/药水/.test(c.name) || c.name === '能量饮料'));
      const woodCard = getCards().all().find(c => c.id === 'tt-wood');
      const rationCard = getCards().all().find(c => c.id === 'tt-rations');
      return [
        { label: '木材', detail: '木材卡 ×1', run: () => rewards(woodCard) },   // 需求 #10：物资一律以卡牌入包
        { label: '口粮', detail: '口粮卡 ×1', run: () => rewards(rationCard) },
        { label: '能量饮料', detail: '回复 6 血', tone: 'ok', run: settle(() => { eventCommands.heal(6); UI.log('[[icon:heart]] 一罐能量饮料下肚，回复 6 点生命', 'ok'); }) },
        { label:'随机药水', detail:'亲手投骰抽取 1 瓶药水；投骰前展示全部对应点数', tone:'ok', rolls:true,
          run:() => drawEventCards(card.name,'airdrop-potion',[potionPool], cards => finishEventRoll(() => rewards(...cards))) },
      ];
    },
    'tt6-chestdraw': () => [
      { label:'接通储备库电源', detail:'1～2 点：小型物资箱；3～4 点：密封物资箱；5～6 点：军用保险柜', tone:'ok', rolls:true,
        run:() => eventDice(card.name,'chest-kind',[
          {label:'小型物资箱',value:'small'},{label:'密封物资箱',value:'medium'},{label:'军用保险柜',value:'large'},
        ], kind => finishEventRoll(() => openChestsOnCell([{ kind }], '你投骰选中的物资箱')),6) },
    ],
    'tt6-goldhammer': () => [
      { label: '带走闪金之锤', detail: '获得卡牌「闪金之锤」；放不下时可先整理背包', tone: 'ok', run: () => rewards(getCards().all().find(c => c.id === 'cmtn0xt0zr7')) },
      { label:'接下交接凭据', detail:'替运输员把接应凭据交给下一家商店：随机两格商品免费，排除初始攻击；与领取锤子二选一。', tone:'ok',
        run:settle(() => { nodeEventAt(game).commission = {status:'pending'};
          UI.log('[[icon:notes]] 运输员把接应凭据塞进你手里：“交给下一处交易点的人。认这个签名，两件货物算我的账。”','sys'); }) },
    ],
    'tt6-relief': () => [
      { label:'包扎伤口', detail:'回复 6 点生命', tone:'ok', run:settle(() => eventCommands.heal(6)) },
      { label:'领取防身招式', detail:'放弃治疗，投骰获得 1 张随机招式（武术或法术）', rolls:true,
        run:() => drawEventCards(card.name,'relief-move',[eventPool(['武术','法术'])], cards => finishEventRoll(() => rewards(...cards))) },
    ],
    'ev19-vital': () => [
      { label: '使用封存针剂', detail: '生命上限 +3，并回复 3 点生命', tone: 'ok', run: settle(() => {
        eventCommands.reinforceLife(3);
        UI.log(`[[icon:heart]] 强化药剂生效：生命上限 +3（${game.hp}/${game.maxHp}）`, 'ok');
      }) },
    ],
    'ev19-pearlbox': () => [
      { label: '接过珍珠匣', detail: '获得卡牌「珍珠盒」', tone: 'ok', run: () => rewards(getCards().all().find(c => c.id === 'tt2-pearlbox')) },
    ],
    'ev19-fireballs': () => [
      { label: '接过两份火种', detail: '获得「火球」×2', tone: 'ok', run: () => {
        const fireball = getCards().all().find(c => c.id === 'tt3-fireball');
        rewards(fireball, fireball);
      } },
    ],
    'ev19-classchest': () => [
      { label: '拆开封条', detail: '获得 1 个职业·密封物资箱', tone: 'ok', run: () => {
        openChestsOnCell([{ kind: 'medium', isClass: true }], '回收点留下的职业物资箱');
      } },
    ],
    'ev19-recode': () => [
      { label: '接入改装台', detail:'选好卡牌后，亲手投骰决定同类型同稀有度的新卡', tone: 'ok', rolls:true, run: openEventRecode },
    ],
    'ev19-potions': () => [
      { label: '领取一瓶应急药水', detail:'投骰抽出 3 瓶药水，再选择 1 瓶', tone: 'ok', rolls:true, deferConsume:true, run: openEventPotions },
    ],
    'ev19-arrows': () => [
      { label:'取出封存箭具', detail:'投骰获得 2 张随机非职业箭系列卡牌', tone:'ok', rolls:true, run:() => {
        const arrows = eventPool(['武术','法术','装备']).filter(c => /箭/.test(c.name) && c.rarity !== '职业' && !c.cls);
        drawEventCards(card.name,'arrows',[arrows,arrows], cards => finishEventRoll(() => rewards(...cards)));
      } },
    ],
    'ev19-gamble': () => [
      { label: '看看季渊的赌注', detail:'先投骰抽出货物；每次 3 币，1～3 点落空、4～6 点全拿，第 5 次保底', rolls:true, run: openEventGamble },
    ],
    'ev19-quartermaster': () => [
      { label: '支付 3 币', detail:'亲手投骰抽出 3 张装备，再选择 1 张', coinCost:3, tone:'ok', deferConsume:true, rolls:true, run: openEventQuartermaster },
      { label: '不领取装备', detail: '保留货币继续行进', run: settle(() => { UI.log('你没有领取转运装备，留下货币继续前进。', 'dim'); }) },
    ],
  };
  if (V2[card.id]) return withBranches(V2[card.id]());
  if (narrative) return withBranches(narrative.choices.map(choice => {
    const narrate = () => {
      const result = choice.choose();
      if (result) UI.log(`[[icon:notes]] ${esc(result)}`, 'sys');
    };
    const effects = {
      goldmine_safe: settle(() => { narrate(); eventCommands.gainCoins(3); }),
      goldmine_deep: settle(() => { narrate(); eventCommands.gainCoins(6); eventCommands.damage(3, '塌陷地下库'); }),
      airdrop_wood: () => { narrate(); rewards(getCards().all().find(x => x.id === 'tt-wood')); },   // 需求 #10：物资以卡牌入包
      airdrop_rations: () => { narrate(); rewards(getCards().all().find(x => x.id === 'tt-rations')); },
      airdrop_heal: settle(() => { narrate(); eventCommands.heal(3); }),
      chest_small: () => { narrate(); openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱'); },
      chest_medium: () => { narrate(); openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱'); },
      // timeskip_move（时空孔隙「前进 6 格」）已随 2026-09-19 老板定向从事件池摘除：
      // 卡库本就无 tt6-timeskip 事件卡，此 effect 入口一并退役（scenes 的 chainMove 守卫保留兜底）。
      relief_heal: settle(() => { narrate(); UI.log('[[icon:heart]] 急救点的值守者替你处理了伤口', 'ok'); eventCommands.heal(6); }),
      mystery_supply: () => { narrate(); eventCommands.gainCoins(2); rewards(getCards().all().find(c => c.id === 'tt-token-color')); },
      systemsupply_restock: () => {
        narrate();
        const token = getCards().all().find(c => c.id === 'tt-token-color');
        const c = getCards().all().find(x => x.id === 'tt-wood');
        rewards(token, c);   // 需求 #10：物资以卡牌入包
      },
      demondeal_trade: settle(() => {
        narrate();
        eventCommands.sacrificeLife(1);
        UI.log('[[icon:demon]] 恶魔收走了一点生命力（-1 血）', 'warn');
        const legends = getCards().all().filter(c => c.rarity === '传说' && ['装备', '武术', '法术'].includes(c.type));
        grantEventCard(legends.length ? legends[Math.floor(Random.random('card', 'reward') * legends.length)] : null);
      }),
      bandits_fight: async () => {   // 战斗与开箱路径自管收尾，不走 settle（同 chest_*）
        narrate();
        // 2026-09-11 实机定版：数量随层数缩放（第 1 层 3 只 → 第 3 层起 5 只）——
        // 此前固定 ×5，1-2 层新档（2 费 / 35 血 / 无 AOE）近乎必死
        const gangN = Math.min(5, 3 + game.layerIdx);
        UI.log(`[[icon:swords]] 截道拾荒者一伙（×${gangN}）拦住了去路！`, 'warn');
        game.pendingEventLoot = { text: '密封物资箱 ×2', chests: ['medium', 'medium'] };
        game.state = 'modal';
        const tpl = MAP.monsters.bandit;
        const gang = [];
        for (let i = 0; i < gangN; i++) gang.push(scaledEnemy({ ...tpl }));
        await startBattle(game, gang, { isBoss: false, layer: game.layerIdx, name: tpl.name });
      },
      goldhammer_strike: async () => {
        narrate();
        const enc = MAP.encounters[game.layerIdx] || MAP.encounters[0];
        const tpl = MAP.monsters[enc.pool[Math.floor(Random.random('enemy', 'enemy') * enc.pool.length)]];
        const foe = scaledEnemy({ ...tpl });
        foe.hp -= 5;
        if (foe.hp <= 0) {
          UI.log(`[[icon:tools]] 闪金之锤一击制敌（${foe.name}）！+2 币`, 'coin');
          eventCommands.gainCoins(2);
          game.state = 'idle';
          return;
        }
        UI.log(`[[icon:tools]] 闪金之锤重击 <b>${esc(foe.name)}</b>（-5 血），战斗打响！`, 'warn');
        game.state = 'modal';
        await startBattle(game, [foe], { isBoss: false, layer: game.layerIdx, name: foe.name });
      },
    };
    return { label: choice.label, detail: choice.detail, tone: choice.tone,
      ...(choice.effect === 'goldmine_deep' ? { healthCost:3 } : {}),
      run: effects[choice.effect] || settle(narrate) };
  }));
  return withBranches(null);
}

// 「战地整备」的“修整一件行装”分支在此结算碎片与复原；回复生命由另一选项结算。
// 未迁移的自定义事件也保留此兜底入口；其余事件按各自选项结算。
function applyEventEffect(card) {
  switch (card.id) {
    case 'cmtn7qttxqo4':   // 战地整备：获得员工通行证A碎片；复原 1 张卡牌
      eventCommands.gainFragment();
      UI.log(`[[icon:crystal]] 整备队交给你一枚员工通行证A碎片（${game.fragments}/2）`, 'loot');
      // 2026-09-19 留言 #21：在事件本界面内复原，不再跳成「营火休整」页
      openPocketRestore(1, () => {
        closeEventFlow();
      }, {
        tone: 'event', icon: '[[icon:tools]]', title: '战地整备 · 修整行装',
        sub: '整备队在撤离前替你修整一件行装。',
        feedbackExtra:'员工通行证A碎片 +1',
      });
      return;   // openPocketRestore 自管收尾
    default:
      UI.log('（该事件的效果将在后续版本实装）', 'dim');
  }
  game.state = 'idle';
}

// ---------- 节点弹窗 ----------

  return { runEventDeck, resumeEventCardChoice };
}
