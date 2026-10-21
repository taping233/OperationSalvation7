import { esc, escAttr } from '../core/shared.js';
import { Random } from '../core/random.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { makeLastLampEventInstanceId } from '../home/story.last-lamp.js';
import { EVENT_SCENE_META } from './game.run.data.js';
import { bindNodeEvent, nodeEventAt } from './node-reward-state.js';
import { createSignalPuzzleState, mountEventSignalPuzzle } from '../ui/event-signal-puzzle.js';
import { recodeEligibleCards, recodeSourceMatches, recodeSourceSnapshot } from './event-recode-candidates.js';
import { showEventRecodeResult } from '../ui/event-recode-result.js';
import { settleEventCommand } from './event-commands.js';
import { createEventLifecycle } from './event-lifecycle.js';

// Owns one event lifecycle: deterministic draw, page ownership, pending choices,
// reward handoff and save retry. The flow assembly supplies runtime services.
export function createRunEventController(ports) {
const {
  game, UI, dom, MAP, getCards, sound, serializeReward, eventCommands, createDice,
  getActiveSlot, saveGame, pick, weighted, scaledEnemy,
  nodeShell, nodeOpt, enterNode, consumeCurrentCell, finishInstant, cancelLegacyChainMove,
  grantEventCard, openFixedRewardsOnCell, openChestsOnCell, openPocketRestore,
  setBagReturnHook, bagSlots, setCardPageOpen, startBattle,
  RunStorage, storyCommands, eventNarrative, lastLampNarrative,
  eventOptionHTML,
} = ports;
const lifecycle = ports.lifecycle || createEventLifecycle(ports);
const { eventSettling, captureEventContext, eventPageBinding, eventNodeShell, closeEventFlow,
  eventCardChoiceController, resumeEventCardChoice } = lifecycle;
// Only loaded event/story continuations need this presentation ownership probe.
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
    closeEventFlow();
    return;
  }
  if (!await enterNode('event', () => true)) return;
  if (!current()) return;
  const bound = nodeEventAt(game);
  if (!bound && await tryLastLampEvent(current)) return;
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
    closeEventFlow();
    return;
  }
  const card = pick(deck);
  bindNodeEvent(game, card.id);
  // 保存失败仍保留本局已抽事件；结算前的检查点会再次保存。
  saveRunCheckpoint(saveGame);
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

function currentLastLampIdentity(slotId, runId) {
  if (getActiveSlot() !== slotId) return { ok: false, code: 'RUN_CHANGED', message: '当前探索已改变，请在新探索中重新进入事件。' };
  const identity = RunStorage.readIdentity(slotId);
  if (!identity.ok) return identity;
  return identity.value.runId === runId ? identity : { ok: false, code: 'RUN_CHANGED', message: '当前探索已改变，请在新探索中重新进入事件。' };
}

function currentLastLampPage(binding) {
  if (!binding.current()) return { ok:false, code:'EVENT_CHANGED', message:'当前事件页面已改变。' };
  const identity = currentLastLampIdentity(binding.slotId, binding.runId);
  if (!identity.ok) return identity;
  if (game.layerIdx !== binding.layerIdx || game.trackPos !== binding.trackPos ||
      makeLastLampEventInstanceId(binding.runId, game.layerIdx, game.trackPos) !== binding.eventInstanceId) {
    return { ok: false, code: 'EVENT_CHANGED', message: '当前事件节点已改变。' };
  }
  return identity;
}

function lastLampPageBinding(act, current) {
  const binding = eventPageBinding(act, current), page = captureEventPresentation();
  return () => binding() && page();
}

function lastLampResultText(segmentId, choiceId) {
  if (segmentId === 1) return '冰霜化开后，新旧漆面的边缘同时显了出来。这不是画错的箭头，而是某次改道留下的两套路线。';
  if (segmentId === 2) return '两层箭头都是真的。一条是平日近路，一条是风雪封路后的公共疏散线；北门那盏灯才是最后的确认标记。';
  return choiceId === 'open_beacon'
    ? '灯光越过风雪落在体育馆方向，远处也能看清路标；北门通道从此不再藏在暗处。'
    : '窄光贴着墙面照出旧箭头，近处的路仍可辨认；从风雪深处望来，北门依旧是一片黑暗。';
}

function renderLastLampResult(record, text, binding, saveError = '') {
  if (!currentLastLampPage(binding).ok) return;
  game.state = 'modal';
  let finishing = false;
  nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
    sub: esc(text || lastLampResultText(record.segmentId, record.choiceId)),
    body: `${record.mementoId ? `<p><b>${record.mementoId === 'last_lamp_open_beacon' ? '北门远灯记录' : '遮光近照记录'}</b>已写入基地的见闻纪念。故事记录不提供地图或战力效果。</p>` : '<p>本段见闻已永久记录；下一次探索可继续这条线索。</p>'}
      ${saveError ? `<p class="warn">${esc(saveError)}</p>` : ''}
      <button class="evt-opt ok" data-act="lastLampFinish"><b>${saveError ? '重试保存节点' : '记下并离开'}</b></button>`,
  });
  setBagReturnHook(() => { if (currentLastLampPage(binding).ok) renderLastLampResult(record, text, binding, saveError); });
  const active = lastLampPageBinding('lastLampFinish', binding.current);
  UI.act('lastLampFinish', () => {
    if (finishing || !active()) return;
    if (!currentLastLampPage(binding).ok) return;
    finishing = true;
    const key = `${game.layerIdx},${game.trackPos}`;
    const wasVisited = !!game.visited?.[key];
    consumeCurrentCell();
    if (saveGame() !== true) {
      if (!wasVisited && game.visited) delete game.visited[key];
      renderLastLampResult(record, text, binding, '故事记录已保存，但本次节点保存失败。请重试，期间不会重复推进故事。');
      return;
    }
    setBagReturnHook(null);
    UI.hideOverlay();
    finishInstant();
  });
  UI.refresh(game);
}

async function tryLastLampEvent(current = captureEventContext()) {
  if (!current()) return true;
  const slotId = getActiveSlot();
  if (!slotId) return false;
  const identity = RunStorage.readIdentity(slotId);
  if (!identity.ok) {
    if (identity.code === 'RECOVERY_REQUIRED') {
      game.state = 'modal';
      nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:cross]]', title: '故事记录暂不可用',
        sub: '该档位存在待恢复事务，当前节点没有被消费。',
        body: '<button class="evt-opt" data-act="lastLampRetry"><b>重试读取</b><span>恢复完成后再继续；不会写入故事或结算原事件</span></button>',
      });
      const active = lastLampPageBinding('lastLampRetry', current);
      UI.act('lastLampRetry', () => { if (active()) return runEventDeck(); });
      UI.refresh(game);
      return true;
    }
    console.warn('[story] 无法读取稳定探索身份，回退普通事件', identity);
    return false;
  }
  const runId = identity.value.runId;
  const eventInstanceId = makeLastLampEventInstanceId(runId, game.layerIdx, game.trackPos);
  const binding = { current, slotId, runId, eventInstanceId, layerIdx: game.layerIdx, trackPos: game.trackPos };
  const status = storyCommands.inspect(slotId, { runId, eventInstanceId });
  if (!status.ok) { console.warn('[story] 故事状态不可用，保留原数据并回退普通事件', status); return false; }
  if (status.value.kind === 'complete' || status.value.kind === 'already-read-this-run') return false;
  if (status.value.kind === 'recover') {
    renderLastLampResult(status.value.record, lastLampResultText(status.value.record.segmentId, status.value.record.choiceId), binding);
    return true;
  }
  const segmentId = status.value.segmentId;
  const waitingPage = captureEventPresentation({ allowClosing:true });
  let narrative = null;
  try { narrative = await lastLampNarrative(segmentId); }
  catch (error) { console.warn('[story] 环境故事运行失败，回退普通事件', error); }
  // The completed node transition may naturally clear its old surface. A new
  // page or event request must not receive this late story continuation.
  if (!currentLastLampPage(binding).ok || !waitingPage()) return true;
  if (!narrative || !narrative.choices?.length) return false; // 原事件照旧结算，不因故事消费节点
  game.state = 'modal';
  let settled = false;
  nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
    sub: esc(narrative.intro),
    body: narrative.choices.map((choice, index) => `<button class="evt-opt ${choice.tone || ''}" data-act="lastLampChoice" data-i="${index}"><b>${esc(choice.label)}</b><span>${esc(choice.detail)}</span></button>`).join(''),
  });
  const activeChoice = lastLampPageBinding('lastLampChoice', current);
  UI.act('lastLampChoice', async d => {
    if (settled || !activeChoice()) return;
    const choice = narrative.choices[+d.i];
    if (!choice) return;
    const boundBefore = currentLastLampPage(binding);
    if (!boundBefore.ok) { UI.log(`[[icon:cross]] ${boundBefore.message}`, 'warn'); return; }
    settled = true;
    const fresh = storyCommands.inspect(slotId, { runId, eventInstanceId });
    if (!fresh.ok) { settled = false; if (currentLastLampPage(binding).ok) showChoiceError(fresh.message || '故事档案读取失败'); return; }
    if (fresh.value.kind === 'recover') { renderLastLampResult(fresh.value.record, lastLampResultText(segmentId, fresh.value.record.choiceId), binding); return; }
    const requestId = `last-lamp:${eventInstanceId}`;
    const result = await storyCommands.record({ slotId, requestId, expectedRevision: fresh.revision },
      { runId, eventInstanceId, segmentId, choiceId: choice.effect });
    // A committed Base receipt remains valid even when this page has gone.
    if (!activeChoice()) return;
    if (!result.ok) {
      settled = false;
      if (currentLastLampPage(binding).ok) showChoiceError(result.message || '故事记录保存失败，请重试');
      return;
    }
    const boundAfter = currentLastLampPage(binding);
    if (!boundAfter.ok) { console.warn('[story] 旧探索记录已保存，但不会消费当前节点', boundAfter); return; }
    setBagReturnHook(null);
    const output = result.value.output;
    const record = { ...output, mementoId: output.mementoId || null };
    sound(record.mementoId ? 'storyComplete' : 'eventClue');
    let resultText = lastLampResultText(record.segmentId, record.choiceId);
    try { resultText = choice.choose() || resultText; }
    catch (error) { console.warn('[story] 环境故事结尾解析失败，使用固定结果文案', error); }
    renderLastLampResult(record, resultText, binding);
  });
  UI.refresh(game);
  setBagReturnHook(() => { if (currentLastLampPage(binding).ok) tryLastLampEvent(current); });
  function showChoiceError(message) {
    if (!currentLastLampPage(binding).ok) return;
    nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:cross]]', title: '最后一盏引路灯', sub: esc(message),
      body: '<button class="evt-opt" data-act="lastLampChoiceRetry"><b>重试选择</b><span>尚未写入故事，也未消费当前节点</span></button>' });
    setBagReturnHook(() => { if (currentLastLampPage(binding).ok) showChoiceError(message); });
    const activeRetry = lastLampPageBinding('lastLampChoiceRetry', current);
    UI.act('lastLampChoiceRetry', () => { if (!activeRetry() || !currentLastLampPage(binding).ok) return; settled = false; tryLastLampEvent(current); });
    UI.refresh(game);
  }
  return true;
}

// 把库里的卡发给玩家（同名堆未满并入现有格；堆满或新卡需要空格——叠放上限见 game.session #7；
// 珍珠盒扩出来的格子只收资源卡——canAcceptCard 统一判定，Q5 老板定向）
async function triggerEventCard(card, current) {
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
  const loadingBody = UI.el?.ovBody;
  const loadingSurface = loadingBody?.firstElementChild;
  // ink 运行时异常兜底（迭代评审 09-20 C-P2）：此前 await 抛错会永久卡 modal（事件页永不渲染、仅按 B 可解）
  let narrative = null;
  try { narrative = await eventNarrative(card.id); }
  catch (e) { console.error('[event] ink 叙事运行异常，回落默认结算：', e); }
  // 转场退出可以自然清空旧画面；另一个页面或探索已接管时不投影迟到叙事。
  if (!current() || game.state !== 'modal' || (loadingBody && (UI.el?.ovBody !== loadingBody ||
      (loadingBody.firstElementChild && loadingBody.firstElementChild !== loadingSurface)))) return;
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
    : `<button class="evt-opt ok" data-act="evtNext"><b>获取并离开</b></button>`;
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
      sub: esc((narrative && narrative.intro) || card.desc || '神秘事件发生了……'),
      body: optionHTML(),
      foot:'<button class="ov-btn" data-act="evtReturn">返回地图</button><button class="ov-btn" data-act="evtBag">整理背包</button><p class="reward-notice" data-event-capacity role="status"></p>',
    });
    const active = eventPageBinding(choices ? 'evtChoice' : 'evtNext', current);
    const choiceCurrent = () => !evtSettled && current() && pageRevision === revision;
    if (signalPuzzle) mountEventSignalPuzzle(UI.el?.ovBody?.firstElementChild, signalPuzzle, () => choiceCurrent() && active());
    const executeChoice = index => {
      if (!choiceCurrent()) return false;
      const choice = choices?.[index];
      if (!choice) return false;
      selectedChoice = index;
      if (choice.canRun && !choice.canRun()) {
        renderEventPage('当前放不下，奖励与选择已保留。');
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
          if (!saveRunCheckpoint(saveGame)) {
            if (hadChoice) record.actionChoice = previousChoice;
            else delete record.actionChoice;
            evtSettled = false;
            renderEventPage('未能保存选择，请重试。');
            return false;
          }
          setBagReturnHook(null);
          UI.hideOverlay();
          choice.run();
          return true;
        } finally { eventSettling.delete(record); }
      }
      setBagReturnHook(null);
      const completed = settleEventAction(() => {
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
    UI.act('evtNext', () => {
      if (choices || evtSettled || !active()) return;
      evtSettled = true;
      setBagReturnHook(null);
      if (!settleEventAction(() => { UI.hideOverlay(); applyEventEffect(card); })) {
        evtSettled = false;
        renderEventPage('本次事件尚未完成，请重试。');
        return;
      }
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
      option?.click(); option?.focus();
    }
  };
  renderEventPage();
}

function eventPool(types) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return getCards().all().filter(c => wanted.has(c.type) && getCards().isRandomObtainable(c));
}

// 这里只保留本事件节点的预留与承接事实，不回滚已经发放的资源或奖励快照。
function settleEventAction(run, record = nodeEventAt(game), consume = true) {
  const accepted = settleEventCommand({ state:game, record, settling:eventSettling, run, consume,
    consumeCell:consumeCurrentCell, serializeReward:state => serializeReward(state) });
  if (!accepted) return false;
  eventSettling.add(record);
  try {
    if (game.hp <= 0 || game.terminalPending || game.state === 'done' || game.state === 'terminalPending') return true;
    if (game.state !== 'modal') {
      if (game.chainMove) cancelLegacyChainMove();
      closeEventFlow();
    }
    else if (!saveRunCheckpoint(saveGame)) {
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
  return createDice({ UI, save:saveGame,
    show:spec => { game.state = 'modal'; eventNodeShell({ tone:'event', asset:EVENT_SCENE_META[owner.eventId]?.[2], icon:'[[icon:dice]]', ...spec }); UI.refresh(game); },
    bind:act => eventPageBinding(act, current), onLeave:closeEventFlow, setReturn:setBagReturnHook,
  }).open({ owner, key, title, outcomes, done, sides, beforeRoll, current });
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
    drawEventCards('故障重编','recode',entries.map(entry => transformCandidates(entry.card)), cards => showEventRecodeResult({ UI, Cards:getCards(), cards, entries, nodeShell:eventNodeShell, setReturn:setBagReturnHook, current:captureEventContext(), done:() => {
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
      tone: 'event', asset: 'scene-event-recode', icon: '[[icon:recycle]]', title: '故障重编',
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
  if (!count) { UI.log('药摊暂无药水。','warn'); closeEventFlow(); return; }
  drawEventCards('避难市集药摊','potions',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-potions', cards));
}

function openEventQuartermaster() {
  if (resumeEventCardChoice()) return;
  const owner = nodeEventAt(game), pool = eventPool('装备');
  const count = Math.min(3,new Set(pool.map(c => c.name)).size);
  if (!count) { UI.log('军需处暂无装备。','warn'); closeEventFlow(); return; }
  if (!owner.quartermasterPaid) {
    if (!spendEventCoins(3, '军需征用', { receipt:owner, field:'quartermasterPaid' })) { delete owner.actionChoice; closeEventFlow(); return; }
  }
  drawEventCards('装备征用令','quartermaster',Array(count).fill(pool), cards => eventCardChoiceController().open('ev19-quartermaster', cards));
}

function openEventGamble() {
  const owner = nodeEventAt(game);
  if (!owner.gamble) owner.gamble = { attempts:0, pending:null };
  const state = owner.gamble;
  if (!state.prizeIds) {
    drawEventCards('地下商场黑市','gamble-prizes',[eventPool('装备'),eventPool(['武术','法术']),eventPool(['武术','法术'])], cards => {
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
    eventDice('地下商场黑市 · 投币判定',`gamble-attempt:${attemptNumber}`,
      guaranteed ? [{label:'第 5 次保底：拿走三张卡',value:true}] : [{label:'本次落空',value:false},{label:'拿走三张卡',value:true}], hit => {
        state.pending = null;
        attempts = state.attempts;
        if (!hit) { sound('blackMarketLose'); render(true); return; }
        settled = true; sound('blackMarketWin');
        const completed = finishEventRoll(() => openFixedRewardsOnCell(prizes, '地下商场黑市'));
        if (!completed) { state.pending = attemptNumber; settled = false; }
        return completed;
      },6,() => {
        if (!spendEventCoins(3,'黑市抽签', { receipt:state, field:'pending', value:attemptNumber })) return false;
        state.attempts = attemptNumber;
        return true;
      });
  };
  const render = (lastMiss = false) => {
    if (settled || !current()) return;
    game.state = 'modal';
    setBagReturnHook(() => render(lastMiss));
    eventNodeShell({
      tone: 'event', asset: 'scene-event-gamble', icon: '[[icon:dice]]', title: '地下商场黑市',
      sub: `每次投入 <b>3 币</b>后亲手投骰：<b>1～3 点落空，4～6 点拿走三张卡（50%）</b>；第 <b>5</b> 次任意点数都成功。已尝试 ${attempts}/5 次。${lastMiss ? '<br><b class="danger">指示灯变红，这次什么也没拿到。</b>' : ''}`,
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
    UI.log('[[icon:cards]] 黑市货架无法生成完整的三张奖品', 'warn');
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
  // —— 2026-09-09 事件 v2（Q6/C13 老板定向）：描述已按设计者新版对齐的七个事件，
  //     直接走自定义选项（旧 ink 叙事仍作 intro 展示，效果按新卡面结算）——
  const V2 = {
    'tt6-mystery': () => [
      { label:'投骰领取', detail:'1～3 点：员工通行证A碎片 ×1；4～6 点：3 币', tone:'ok', rolls:true,
        run:() => eventDice(card.name, 'supply', [{label:'员工通行证A碎片 ×1',value:'fragment'},{label:'3 币',value:'coins'}],
          value => finishEventRoll(settle(() => { if (value === 'fragment') gainFragment(); else eventCommands.gainCoins(3); })), 6) },
      { label:'离开', detail:'不领取物资', run:settle(() => {}) },
    ],
    'tt6-systemsupply': () => {
      const wood = getCards().all().find(c => c.id === 'tt-wood');
      return [
        { label:'碎片与木材', detail:'获得员工通行证A碎片 ×1，木材卡 ×1；需背包能放下木材卡', tone:'ok',
          capacityCard:wood, canRun:() => !!wood && game.canReceiveCard(wood),
          claim:() => claimEventCard(wood),
          run:settle(gainFragment) },
        { label:'碎片与货币', detail:'获得员工通行证A碎片 ×1，+2 币；不占背包格', tone:'ok',
          run:settle(() => { gainFragment(); eventCommands.gainCoins(2); }) },
      ];
    },
    'tt6-demondeal': () => [
      { label: '成交', detail: '-5 血，获得 1 个军用保险柜', healthCost:5, tone: 'danger', run: () => {
        eventCommands.damage(5, '隧道血契');
        if (game.hp <= 0 || game.terminalPending) return;
        UI.log('[[icon:demon]] 恶魔收走了 5 点生命力，并丢给你一个军用保险柜', 'warn');
        openChestsOnCell([{ kind: 'large' }], '恶魔的报酬');
      } },
      { label: '拒绝', detail: '无事发生', run: settle(() => { UI.log('你顶住了诱惑，继续赶路', 'sys'); }) },
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
      { label:'投骰开箱', detail:'1～2 点：小型物资箱；3～4 点：密封物资箱；5～6 点：军用保险柜', tone:'ok', rolls:true,
        run:() => eventDice(card.name,'chest-kind',[
          {label:'小型物资箱',value:'small'},{label:'密封物资箱',value:'medium'},{label:'军用保险柜',value:'large'},
        ], kind => finishEventRoll(() => openChestsOnCell([{ kind }], '你投骰选中的物资箱')),6) },
    ],
    'tt6-goldhammer': () => [
      { label: '查看并领取', detail: '获得卡牌「闪金之锤」；放不下时可先整理背包', tone: 'ok', run: () => rewards(getCards().all().find(c => c.id === 'cmtn0xt0zr7')) },
      { label:'接受送信委托', detail:'替校工把配送凭据交给下一家商店：随机两格商品免费，排除初始攻击；与领取锤子二选一。', tone:'ok',
        run:settle(() => { nodeEventAt(game).commission = {status:'pending'};
          UI.log('[[icon:notes]] 校工把配送凭据塞进你的手里：“交给下一家店的行商，两格货物算我的账。”','sys'); }) },
    ],
    'tt6-relief': () => [
      { label:'接受处理', detail:'回复 6 点生命', tone:'ok', run:settle(() => eventCommands.heal(6)) },
      { label:'领取防身招式', detail:'放弃治疗，投骰获得 1 张随机招式（武术或法术）', rolls:true,
        run:() => drawEventCards(card.name,'relief-move',[eventPool(['武术','法术'])], cards => finishEventRoll(() => rewards(...cards))) },
    ],
    'ev19-vital': () => [
      { label: '接受强化急救', tone: 'ok', run: settle(() => {
        eventCommands.reinforceLife(3);
        UI.log(`[[icon:heart]] 强化药剂生效：生命上限 +3（${game.hp}/${game.maxHp}）`, 'ok');
      }) },
    ],
    'ev19-pearlbox': () => [
      { label: '取走珍珠匣', tone: 'ok', run: () => rewards(getCards().all().find(c => c.id === 'tt2-pearlbox')) },
    ],
    'ev19-fireballs': () => [
      { label: '接收封装火种', tone: 'ok', run: () => {
        const fireball = getCards().all().find(c => c.id === 'tt3-fireball');
        rewards(fireball, fireball);
      } },
    ],
    'ev19-classchest': () => [
      { label: '启封黑箱', tone: 'ok', run: () => {
        openChestsOnCell([{ kind: 'medium', isClass: true }], '军方调拨的黑色职业宝箱');
      } },
    ],
    'ev19-recode': () => [
      { label: '接入重编台', detail:'选好卡牌后，亲手投骰决定同类型同稀有度的新卡', tone: 'ok', rolls:true, run: openEventRecode },
    ],
    'ev19-potions': () => [
      { label: '查看药摊', detail:'投骰抽出 3 瓶药水，再选择 1 瓶', tone: 'ok', rolls:true, deferConsume:true, run: openEventPotions },
    ],
    'ev19-arrows': () => [
      { label:'投骰打开弹药柜', tone:'ok', rolls:true, run:() => {
        const arrows = eventPool(['武术','法术','装备']).filter(c => /箭/.test(c.name) && c.rarity !== '职业' && !c.cls);
        drawEventCards(card.name,'arrows',[arrows,arrows], cards => finishEventRoll(() => rewards(...cards)));
      } },
    ],
    'ev19-gamble': () => [
      { label: '查看黑市货物', detail:'先投骰抽出货物；每次 3 币，1～3 点落空、4～6 点全拿，第 5 次保底', rolls:true, run: openEventGamble },
    ],
    'ev19-quartermaster': () => [
      { label: '支付 3 币', detail:'亲手投骰抽出 3 张装备，再选择 1 张', coinCost:3, tone:'ok', deferConsume:true, rolls:true, run: openEventQuartermaster },
      { label: '放弃征用', detail: '保留货币继续行进', run: settle(() => { UI.log('你没有签下军需征用单', 'dim'); }) },
    ],
  };
  if (V2[card.id]) return V2[card.id]();
  if (narrative) return narrative.choices.map(choice => {
    const narrate = () => {
      const result = choice.choose();
      if (result) UI.log(`[[icon:notes]] ${esc(result)}`, 'sys');
    };
    const effects = {
      goldmine_safe: settle(() => { narrate(); eventCommands.gainCoins(3); }),
      goldmine_deep: settle(() => { narrate(); eventCommands.gainCoins(6); eventCommands.damage(3, '塌方采掘点'); }),
      airdrop_wood: () => { narrate(); rewards(getCards().all().find(x => x.id === 'tt-wood')); },   // 需求 #10：物资以卡牌入包
      airdrop_rations: () => { narrate(); rewards(getCards().all().find(x => x.id === 'tt-rations')); },
      airdrop_heal: settle(() => { narrate(); eventCommands.heal(3); }),
      chest_small: () => { narrate(); openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱'); },
      chest_medium: () => { narrate(); openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱'); },
      // timeskip_move（时空孔隙「前进 6 格」）已随 2026-09-19 老板定向从事件池摘除：
      // 卡库本就无 tt6-timeskip 事件卡，此 effect 入口一并退役（scenes 的 chainMove 守卫保留兜底）。
      relief_heal: settle(() => { narrate(); UI.log('[[icon:heart]] 爱心救济站为你处理了伤口', 'ok'); eventCommands.heal(6); }),
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
        grantEventCard(legends.length ? legends[Math.floor(Random.random('card') * legends.length)] : null);
      }),
      bandits_fight: async () => {   // 战斗与开箱路径自管收尾，不走 settle（同 chest_*）
        narrate();
        // 2026-09-11 实机定版：数量随层数缩放（第 1 层 3 只 → 第 3 层起 5 只）——
        // 此前固定 ×5，1-2 层新档（2 费 / 35 血 / 无 AOE）近乎必死
        const gangN = Math.min(5, 3 + game.layerIdx);
        UI.log(`[[icon:swords]] 反抗组织拾荒者一伙（×${gangN}）拦住了去路！`, 'warn');
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
        const tpl = MAP.monsters[enc.pool[Math.floor(Random.random('enemy') * enc.pool.length)]];
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
  });
  return null;
}

// 事件效果结算（旧版单按钮路径：仅剩自定义/未迁移事件卡会走到这里，tt6 十事件已全部走 ink）
function applyEventEffect(card) {
  switch (card.id) {
    case 'cmtn7qttxqo4':   // 修鞋铺（2026-09-09 审计补实装）：获得员工通行证A碎片；复原 1 张卡牌
      eventCommands.gainFragment();
      UI.log(`[[icon:crystal]] 修鞋铺送了你一枚员工通行证A碎片（${game.fragments}/2）`, 'loot');
      // 2026-09-19 留言 #21：在事件本界面内复原，不再跳成「营火休整」页
      openPocketRestore(1, () => {
        closeEventFlow();
      }, {
        tone: 'event', icon: '[[icon:tools]]', title: '修鞋铺 · 修整行装',
        sub: '老师傅替你修整行装。',
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
