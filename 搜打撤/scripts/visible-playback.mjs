// Pure visible-DOM planner + bounded built-in-tab runner. No browser bootstrap,
// page evaluation, storage, game API, synthetic input, timers or external clients.
export const VISIBLE_PLAYBACK_VERSION = '20261016-r2.3';
const LABELS = ['领取搜刮点', '继续探索', '返回地图', '进入该地点', '收下'];
const tidy = value => value.replace(/\s+/gu, ' ').trim();
const canonical = name => tidy(name).replace(/^✓\s*/u, '').replace(/\s*→$/u, '')
  .replace(/^继续探索\s+本处休整已经完成$/u, '继续探索');

function fingerprint(text) {
  // UI identities change between snapshots; they do not establish progress.
  const stable = text.replace(/\s*\[ref=[^\]]+\]/gu, '').replace(/\[active\]/gu, '').trim();
  let value = 2166136261;
  for (const char of stable) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function nodesOf(text, role) {
  const nodes = [];
  const pattern = new RegExp(`^\\s*(?:-\\s+)?${role}\\s+"((?:\\\\.|[^"\\\\])*)"(.*)$`, 'u');
  for (const line of text.split('\n')) {
    const match = pattern.exec(line);
    if (!match) continue;
    let name;
    try { name = JSON.parse(`"${match[1]}"`); } catch { continue; }
    nodes.push({ role, name, label: canonical(name), disabled: /\[disabled(?:=true)?\]|disabled:\s*true/u.test(match[2]) });
  }
  return nodes;
}

function dialogBlocks(text) {
  const lines = text.split('\n'), blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const node = nodesOf(lines[index], 'dialog')[0];
    if (!node) continue;
    const indent = lines[index].search(/\S/u);
    let end = index + 1;
    while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/u) > indent)) end++;
    blocks.push({ name: node.name, text: lines.slice(index, end).join('\n') });
  }
  return blocks;
}

function inspect(snapshot) {
  const text = typeof snapshot === 'string' ? snapshot : '';
  const buttons = nodesOf(text, 'button');
  return { text, buttons, summary: { fingerprint: fingerprint(text), characters: text.length,
    headings: nodesOf(text, 'heading').map(node => node.name).slice(0, 12),
    buttons: buttons.map(({ name, disabled }) => ({ name, disabled })),
    excerpt: text.split('\n').filter(line => /领取|奖励|收下|探索|地图|地点|前往中|搜寻|休整|选择|放弃|删除|错误/u.test(line)).slice(0, 16).join('\n').slice(0, 1800) } };
}

/** Only known acquisition/finished transitions qualify. Unknown states stop.
 * options.allowedActions may narrow LABELS; it cannot add actions.
 * options.seenFingerprints carries prior observed action states between runs.
 */
export function planVisibleStep(snapshot, options = {}) {
  const view = inspect(snapshot), { text, buttons, summary } = view;
  const stop = (reason, state = 'needs-review') => ({ kind: 'stop', reason, state, summary });
  if (!text.trim() || text.length > 200000 || /(?:snapshot|快照).*(?:truncated|已截断)|\.\.\. \d+ more/iu.test(text)) return stop('invalid-snapshot');
  if (options.seenFingerprints && (!Array.isArray(options.seenFingerprints) || options.seenFingerprints.some(value => typeof value !== 'string'))) return stop('invalid-options');
  if (options.allowedActions && (!Array.isArray(options.allowedActions) || options.allowedActions.some(label => !LABELS.includes(label)))) return stop('invalid-options');
  if ((options.seenFingerprints || []).includes(summary.fingerprint)) return stop('loop-detected');
  if (/(?:错误|失败|异常|Error|Exception)[:：]|页面出错|运行时错误|(?:保存|领取|操作|加载|读档|写入|同步)(?:未成功|失败)|未保存|存档错误提示|发生错误|出了?错误|unhandled|uncaught|traceback/iu.test(text)) return stop('visible-error');
  if (/(?:删除|覆盖|清空|移除).{0,12}存档|确认删除|永久删除/u.test(text)) return stop('protected-action');
  if (buttons.some(node => /删除|覆盖.*存档|清空|丢弃|购买|买入|出售|确认放弃|放弃剩余|结束回合|出牌|撤退|投降|攻击目标/u.test(node.name))) return stop('protected-action');
  if (/事件选项|先选择一个选项|点击选项查看已知结果|选择后确认|永久放弃剩余.*离开后无法找回/u.test(text)) return stop('event-or-irreversible-choice');
  // Opening a known sealed chest is allowed even if its future cards require a
  // choice. Actual reward-selection screens always stop, including one fit card.
  const chestOffer = /获得搜刮点|战斗胜利/u.test(text) && /待领取搜刮点/u.test(text) && /领取搜刮点后/u.test(text);
  const decisions = text.replace(/领取搜刮点后[，,]?\s*从\s*\d+\s*张卡牌中选择\s*1\s*张/gu, '领取搜刮点后揭晓卡牌');
  if (/选择收获|选择卡牌|请选择.*(?:卡牌|奖励)|选择\s*(?:一|1)\s*张|(?:二|三|\d)选(?:一|1)|任选\s*1\s*张|两张资源卡中选择一张|其余(?:卡牌)?永久放弃|从\s*\d+\s*张卡牌中选择/u.test(decisions)) return stop('card-choice');
  const takes = buttons.filter(node => node.label === '收下');
  if (takes.length > 1) return stop('multiple-rewards');
  const dialogs = dialogBlocks(text);
  const fixedReward = dialogs.length === 1 && /^archive\s+收获\s*·\s*小型物资箱\s*·\s*第\s*1\s*\/\s*1$/u.test(dialogs[0].name)
    && nodesOf(dialogs[0].text, 'heading').filter(node => node.name === '领取奖励').length === 1
    && nodesOf(dialogs[0].text, 'complementary').some(node => node.name === '奖励操作');
  if (dialogs.length > 1) return stop('multiple-dialogs');
  if (!fixedReward && nodesOf(text, 'heading').some(node => node.name === '领取奖励')) return stop('unknown-reward-dialog');
  const rewardText = dialogs.length === 1 ? dialogs[0].text : text;
  const rewardButtons = dialogs.length === 1 ? nodesOf(rewardText, 'button') : buttons;
  if (fixedReward && rewardButtons.filter(node => node.label === '收下').length !== takes.length) return stop('conflicting-states');
  const reward = nodesOf(rewardText, 'complementary').some(node => node.name === '奖励操作')
    && (nodesOf(rewardText, 'heading').some(node => ['搜刮完成', '战斗胜利', '随行补给', '获得搜刮点'].includes(node.name)) || fixedReward);
  if (reward && takes.length === 1 && (/奖励可分别领取|放不下|当前候选都/u.test(text) || buttons.filter(node => node.label === '整理背包').length > 1)) return stop('multiple-or-blocked-rewards');
  const entryComplete = !fixedReward && /随行补给/u.test(text) && /已领取所有奖励|补给已齐备/u.test(text);
  const rewardComplete = reward && !takes.length && !/待领取|放不下|奖励可分别领取|尚未领取/u.test(rewardText)
    && rewardButtons.filter(node => node.label === '整理背包').length <= 1 && !rewardButtons.some(node => /全部收下/u.test(node.name))
    && /\d+\s*张已入背包|这里没有奖励|已领取所有奖励/u.test(rewardText);
  const rested = !fixedReward && /休整完毕/u.test(text) && /本处休整已经完成/u.test(text);
  if ((entryComplete || rested) && (takes.length || /待领取|尚未领取|放不下|奖励可分别领取/u.test(text))) return stop('conflicting-states');
  const preview = /可以前往/u.test(text) && buttons.some(node => node.name === '关闭地点预览');
  if ((chestOffer && (takes.length || rewardComplete || buttons.some(node => ['继续探索', '返回地图'].includes(node.label)))) || (preview && (chestOffer || reward || rested))) return stop('conflicting-states');
  let label, state;
  if (chestOffer) { label = '领取搜刮点'; state = 'sealed-chest'; }
  else if (reward && takes.length === 1) { label = '收下'; state = 'single-reward'; }
  else if (entryComplete || rewardComplete || rested) {
    label = buttons.some(node => node.label === '继续探索') ? '继续探索' : '返回地图'; state = 'completed';
  } else if (preview) { label = '进入该地点'; state = 'selected-reachable-location'; }
  else {
    const entries = buttons.filter(node => node.label === '进入该地点');
    const traveling = text.split('\n').some(line => /^\s*-\s+(?:text|generic|status):\s*前往中\s*·\s*\d+\s*\/\s*\d+\s*段(?:\s|$)/u.test(line));
    if (traveling && entries.length === 1 && entries[0].disabled
      && buttons.filter(node => node.name === '关闭地点预览').length === 1 && !dialogs.length) {
      return { kind: 'wait', reason: 'known-travel-transition', state: 'traveling', summary,
        waitFor: { role: 'button', name: entries[0].name, state: 'hidden', disabled: true } };
    }
    const heading = nodesOf(text, 'heading').find(node => /搜寻物资/u.test(node.name));
    if (heading && /正在解锁封存物资|职业补给：本职业专属卡牌/u.test(text)) {
      return { kind: 'wait', reason: 'known-chest-animation', state: 'opening-chest', summary,
        waitFor: { role: 'heading', name: heading.name, state: 'hidden' } };
    }
    return stop('unknown-state');
  }
  if (options.allowedActions && !options.allowedActions.includes(label)) return stop('action-not-allowed', state);
  if (fixedReward && rewardButtons.filter(node => node.label === label).length !== 1) return stop('missing-button', state);
  const matches = buttons.filter(node => node.label === label);
  if (matches.length !== 1) return stop(matches.length ? 'ambiguous-button' : 'missing-button', state);
  if (matches[0].disabled) return stop('disabled-button', state);
  return { kind: 'action', state, reason: 'known-visible-transition', summary,
    action: { role: 'button', name: matches[0].name, exact: true, label } };
}

/** Caller supplies its existing authorized tab. maxSteps is 1..8 (default 4).
 * Uses domSnapshot/getByRole/locator and count/isEnabled/isVisible/click/waitFor/and.
 * All conditional waits share a 10-second wall-clock budget and 8-wait limit.
 * Every attempted real click gets before/after summaries. No retry after errors.
 */
export async function runVisibleSteps(tab, options = {}) {
  const maxSteps = options.maxSteps ?? 4, timeoutMs = options.timeoutMs ?? 5000;
  const steps = [], waits = [], seen = Array.isArray(options.seenFingerprints) ? [...options.seenFingerprints] : [];
  const result = (reason, plan, extra = {}) => ({ status: 'stopped', reason, steps, waits,
    final: plan, seenFingerprints: seen, ...extra });
  if (options.seenFingerprints && (!Array.isArray(options.seenFingerprints) || options.seenFingerprints.some(value => typeof value !== 'string'))) return result('invalid-options', null);
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 8 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) return result('invalid-options', null);
  if (!tab?.playwright?.domSnapshot || !tab.playwright.getByRole) return result('unsupported-tab', null);
  let snapshot, waitDeadline;
  const settle = async (plan, target = plan.waitFor, observedLocator, failureReason = 'wait-error') => {
    if (waits.length >= 8) return 'wait-limit';
    const now = Date.now();
    waitDeadline ??= now + 10000;
    const waitTimeoutMs = Math.min(timeoutMs, waitDeadline - now);
    if (waitTimeoutMs <= 0) return 'wait-budget-exhausted';
    const wait = { before: plan.summary, target, timeoutMs: waitTimeoutMs, result: 'pending' };
    waits.push(wait);
    try {
      let locator = observedLocator || tab.playwright.getByRole(target.role, { name: target.name, exact: true });
      // Intersection disappears when this exact observed button is either
      // removed/renamed or no longer disabled. Never click to finish travel.
      if (target.disabled) locator = locator.and(tab.playwright.locator(':disabled'));
      await locator.waitFor({ state: target.state, timeoutMs: waitTimeoutMs });
      snapshot = await tab.playwright.domSnapshot();
      wait.after = inspect(snapshot).summary; wait.result = 'settled';
    } catch (error) { wait.result = 'error'; wait.error = String(error); return failureReason; }
    if (wait.after.fingerprint === wait.before.fingerprint) return 'animation-not-settled';
    return null;
  };
  try { snapshot = await tab.playwright.domSnapshot(); } catch (error) { return result('snapshot-error', null, { error: String(error) }); }
  for (;;) {
    let plan = planVisibleStep(snapshot, { ...options, seenFingerprints: seen });
    if (plan.kind === 'stop') return result(plan.reason, plan);
    if (plan.kind === 'wait') {
      const reason = await settle(plan);
      if (reason) return result(reason, plan);
      continue;
    }
    if (steps.length >= maxSteps) return result('max-steps', plan);
    seen.push(plan.summary.fingerprint);
    const step = { index: steps.length + 1, action: plan.action, state: plan.state, before: plan.summary, after: null, result: 'pending' };
    steps.push(step);
    let locator, preflightReason;
    try {
      locator = tab.playwright.getByRole('button', { name: plan.action.name, exact: true });
      step.liveCount = await locator.count();
      if (step.liveCount === 0) preflightReason = 'live-button-disappeared';
      else if (step.liveCount !== 1) preflightReason = 'live-ambiguous-button';
      else if (!await locator.isEnabled()) preflightReason = 'live-disabled-button';
      else if (!await locator.isVisible()) preflightReason = 'live-hidden-button';
      if (preflightReason) step.result = 'not-clicked';
      else { await locator.click({ timeoutMs }); step.result = 'clicked'; }
    } catch (error) { step.result = 'error'; step.error = String(error); }
    try { snapshot = await tab.playwright.domSnapshot(); step.after = inspect(snapshot).summary; }
    catch (error) { return result('snapshot-error-after-click', plan, { error: String(error) }); }
    if (preflightReason) {
      const refreshedPlan = planVisibleStep(snapshot, { ...options, seenFingerprints: seen });
      // Only a specifically identified visible transition can resume a vanished
      // button attempt. A different action, choice or unknown page returns control.
      if (preflightReason === 'live-button-disappeared' && refreshedPlan.kind === 'wait') {
        step.refreshed = true;
        const reason = await settle(refreshedPlan);
        if (reason) return result(reason, refreshedPlan, { refreshed: true });
        continue;
      }
      return result(preflightReason, refreshedPlan, preflightReason === 'live-button-disappeared' ? { refreshed: true } : {});
    }
    if (step.result === 'error') return result('click-error', plan);
    const afterPlan = planVisibleStep(snapshot, { ...options, seenFingerprints: [] });
    if (afterPlan.kind === 'action' && afterPlan.action.name === plan.action.name && afterPlan.state === plan.state) {
      // Closing UI can change unrelated controls while retaining the old button.
      // Wait once for that already-clicked button; never click it a second time.
      const priorWaitCount = waits.length;
      const reason = await settle(afterPlan, { role: 'button', name: plan.action.name, state: 'hidden' }, locator, 'no-visible-progress');
      step.after = inspect(snapshot).summary;
      if (waits.length > priorWaitCount) {
        step.waitedForButtonHidden = waits.at(-1).result === 'settled';
        if (waits.at(-1).error) step.waitError = waits.at(-1).error;
      }
      if (reason) return result(reason, planVisibleStep(snapshot, { ...options, seenFingerprints: seen }));
    }
  }
}
