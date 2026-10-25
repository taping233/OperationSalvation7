import { esc as escRaw } from '../core/shared.js';
import { previewDeployment } from './preparation.commands.js';
import { getSources } from './preparation.sources.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { decisionSummaryHTML } from '../ui/decision-summary.js';

// 空值容错（?? ''）是本域展示策略，叠在 core/shared.js 权威转义之上
const esc = value => escRaw(value ?? '');

const optionList = (items, selected, emptyLabel) => `<option value="">${esc(emptyLabel)}</option>${(items || []).map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.name || item.id)}</option>`).join('')}`;
const statusText = item => item.status === 'ready' ? `已有 ${item.availableCount}` : item.status === 'forbidden' ? '职业卡禁带' : `缺 ${Math.max(0, item.requestedCount - item.availableCount)}`;

// 预设摘要的资格提示：canStart 还卡在人物/宠物的收录与拥有上时给出一行原因，
// 否则玩家只看到「需要处理 · 0 缺失 · 0 禁带」无从修复
function qualificationHints(q) {
  if (!q) return '';
  const hints = [];
  if (q.characterId) {
    if (!q.characterKnown) hints.push('人物不在角色册');
    else if (!q.characterOwned) hints.push('人物尚未拥有');
  }
  if (q.petId) {
    if (!q.petKnown) hints.push('宠物不在图鉴');
    else if (!q.petOwned) hints.push('宠物尚未拥有');
  }
  return hints.length ? `<small class="prep-qual-hint">${esc(hints.join(' · '))}</small>` : '';
}

function renderPreset(preset, model) {
  const preview = preset.preview;
  const character = model.characterOptions?.find(item => item.id === preset.characterId)?.name || '未选择人物';
  const pet = model.petOptions?.find(item => item.id === preset.petId)?.name || '无伙伴';
  const facts = preview ? [`带入 ${preview.costs.stashCards} 张`, `占 ${preview.costs.slotsUsed}${Number.isFinite(preview.costs.bagCapacity) ? `/${preview.costs.bagCapacity}` : ''} 格${preview.costs.extraStackSlots ? `（同名超限多占 ${preview.costs.extraStackSlots} 格）` : ''}`, `${preview.missing.length} 缺失`, `${preview.forbidden.length} 禁带`] : ['请先预览方案'];
  return `<section class="prep-preset" data-preset="${esc(preset.id)}">
    <header class="prep-preset-head"><div><h3>${esc(preset.name || '出征方案')}</h3><p>${esc(character)} · ${esc(pet)} · ${preset.picks.length} 种卡牌</p></div></header>
    <details class="prep-preset-editor" data-preset-editor="${esc(preset.id)}"><summary>编辑人物与卡牌</summary><div class="prep-editor-body"><label class="prep-name">方案名<input maxlength="24" data-field="name" value="${esc(preset.name)}"></label>
    <div class="prep-fields"><label>人物<select data-field="characterId">${optionList(model.characterOptions, preset.characterId, '未选择人物')}</select></label><label>宠物<select data-field="petId">${optionList(model.petOptions, preset.petId, '未选择宠物')}</select></label></div>
    <div class="prep-picks">${preset.picks.length ? preset.picks.map(pick => { const hit = preview?.resolvedPicks?.find(item => item.card.cardId === pick.card.cardId && (item.card.variantKey || '') === (pick.card.variantKey || '')); return `<div class="prep-pick ${esc(hit?.status || '')}"><span><b>${esc(hit?.name || pick.name || pick.card.cardId)}</b> ×${pick.count}</span><small>${hit ? esc(statusText(hit)) : '尚未预览'}</small><button class="ui-control" data-ui-action="secondary" data-action="preset-pick-remove" data-card-id="${esc(pick.card.cardId)}" aria-label="移除 ${esc(hit?.name || pick.card.cardId)}">移除</button></div>`; }).join('') : '<p class="prep-empty">还没有选择带入卡牌。</p>'}</div>
    <div class="prep-add"><select data-role="card-add">${optionList(model.cardOptions, null, '选择仓库卡牌')}</select><input data-role="count-add" type="number" min="1" max="99" value="1" aria-label="数量"><button class="ui-control" data-ui-action="secondary" data-action="preset-pick-add">加入愿望清单</button></div>
    </div></details>
    ${decisionSummaryHTML({status:preview?.canStart ? '可以应用' : preview ? '需要处理' : '尚未预览',facts,ready:!!preview?.canStart,className:'prep-summary',actions:`<button class="ui-control" data-ui-action="secondary" data-action="preset-preview"${model.busy ? ' disabled' : ''}>重新预览</button><button class="ui-control prep-apply" data-ui-action="primary" data-action="preset-apply"${preview?.canStart && !model.busy ? '' : ' disabled'}>应用到整备</button>`})}
    ${preview ? qualificationHints(preview.qualification) : ''}
    ${preview?.errors?.includes('BAG_CAPACITY_EXCEEDED') ? '<p class="prep-qual-hint">背包容量不足，请减少携带卡牌或扩建背包。</p>' : ''}
    <p class="prep-empty prep-next-step">应用后，在整备页确认人物、伙伴与卡牌。</p>
  </section>`;
}

function render(model) {
  return `<section class="preparation-module" aria-label="收藏目标与出征预设">
    <header class="prep-goals-head"><h3>收藏目标</h3><span class="prep-count">追踪 ${(model.goals || []).length}/3</span></header>
    ${model.error ? `<p class="prep-error" role="alert">${esc(model.error)}</p>` : ''}
    <div class="prep-goals">${(model.goals || []).map(goal => `<article><div><b>${esc(goal.name || goal.id)}</b><p>${esc(goal.sourceLabel || '来源未确认')}</p></div><button class="ui-control" data-ui-action="secondary" data-action="goal-remove" data-target-id="${esc(goal.id)}">取消追踪</button></article>`).join('') || '<p class="prep-empty">未追踪目标</p>'}</div>
    <div class="prep-goal-add"><select data-role="goal-add">${optionList(model.targetOptions, null, '选择收藏目标')}</select><button class="ui-control" data-ui-action="secondary" data-action="goal-add"${(model.goals || []).length >= 3 ? ' disabled' : ''}>加入追踪</button></div>
    <div class="prep-presets">${(model.presets || []).map(preset => renderPreset(preset, model)).join('')}</div>
  </section>`;
}

/** @param {import('./preparation.types.js').ViewOptions} [options] */
export function buildPreparationViewModel({ baseSnapshot, preparation, cardCatalog = [], characters = [], pets = [], catalogVersion = 'unknown', mode = 'standard', bagCapacity = Infinity, starterCount = 5, starterCard, busy = false, error = '' } = {}) {
  const prep = preparation || { tracked: [], presets: [] };
  const byId = new Map(cardCatalog.map(card => [card.id, card]));
  const goals = (prep.tracked || []).map(id => {
    const card = byId.get(id); const source = getSources(id, catalogVersion, cardCatalog)[0];
    return { id, name: card?.name || id, sourceLabel: source.certainty === 'known' ? source.conditions : '来源未确认', source };
  });
  const stashIds = new Set((baseSnapshot?.stash || []).map(stack => stack?.card?.id).filter(Boolean));
  const characterOptions = characters.map(item => ({ id: item.id, name: item.name || item.id, owned: !!baseSnapshot?.characters?.[item.id] }));
  const petOptions = pets.map(item => ({ id: item.id, name: item.name || item.id, owned: !!baseSnapshot?.pets?.[item.id] }));
  const cardOptions = cardCatalog.filter(card => stashIds.has(card.id)).map(card => ({ id: card.id, name: card.name || card.id }));
  const presets = (prep.presets || []).map(preset => ({ ...preset, picks: preset.picks || [], preview: previewDeployment({ baseSnapshot, preset, mode, cardCatalog, characters, pets, bagCapacity, starterCount, starterCard }) }));
  return Object.freeze({ goals, targetOptions: cardCatalog.map(card => ({ id: card.id, name: card.name || card.id })), presets, characterOptions, petOptions, cardOptions, busy, error });
}

/** @param {HTMLElement} root @param {{model?: ReturnType<typeof buildPreparationViewModel>, onIntent?: (intent: import('./preparation.types.js').Intent) => void}} [options] */
export function mountPreparationView(root, { model, onIntent = () => {} } = {}) {
  if (!root || typeof root.addEventListener !== 'function') throw new TypeError('mountPreparationView 需要 DOM root');
  let current = model || { goals: [], presets: [] };
  const emit = (type, payload = {}) => onIntent({ type, payload });
  const click = event => {
    const button = event.target.closest?.('[data-action]'); if (!button || !root.contains(button) || button.disabled) return;
    const presetRoot = button.closest('[data-preset]'); const presetId = presetRoot?.dataset.preset;
    const action = button.dataset.action;
    if (action === 'goal-add') emit(action, { targetId: /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (root.querySelector('[data-role="goal-add"]'))?.value || '' });
    else if (action === 'goal-remove') emit(action, { targetId: button.dataset.targetId });
    else if (action === 'preset-pick-add') emit(action, { presetId, cardId: presetRoot.querySelector('[data-role="card-add"]')?.value || '', count: Number(presetRoot.querySelector('[data-role="count-add"]')?.value || 1) });
    else if (action === 'preset-pick-remove') emit(action, { presetId, cardId: button.dataset.cardId });
    else emit(action, { presetId });
  };
  const change = event => { const field = event.target.dataset?.field; const presetId = event.target.closest?.('[data-preset]')?.dataset.preset; if (field && presetId) emit('preset-field', { presetId, field, value: event.target.value }); };
  const paint = () => {
    const expanded = new Set([...root.querySelectorAll('details[data-preset-editor][open]')].map(item => item.getAttribute('data-preset-editor')));
    const template = root.ownerDocument.createElement('template');
    template.innerHTML = render(current);
    syncViewChildren(root, template.content, { preserveValue: element => element.hasAttribute('data-role') || element === root.ownerDocument.activeElement });
    for (const item of /** @type {NodeListOf<HTMLDetailsElement>} */ (root.querySelectorAll('details[data-preset-editor]'))) item.open = expanded.has(item.getAttribute('data-preset-editor'));
    root.setAttribute('aria-busy', /** @type {typeof current & {busy?:boolean}} */ (current).busy ? 'true' : 'false');
  };
  root.addEventListener('click', click); root.addEventListener('change', change); paint();
  return { update(nextModel) { current = nextModel || { goals: [], presets: [] }; paint(); }, dispose() { root.removeEventListener('click', click); root.removeEventListener('change', change); root.replaceChildren(); } };
}
