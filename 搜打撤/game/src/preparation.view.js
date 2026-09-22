import { previewDeployment } from './preparation.commands.js';
import { getSources } from './preparation.sources.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const optionList = (items, selected, emptyLabel) => `<option value="">${esc(emptyLabel)}</option>${(items || []).map(item => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.name || item.id)}</option>`).join('')}`;
const statusText = item => item.status === 'ready' ? `已有 ${item.availableCount}` : item.status === 'forbidden' ? '职业卡禁带' : `缺 ${Math.max(0, item.requestedCount - item.availableCount)}`;

function renderPreset(preset, model) {
  const preview = preset.preview;
  return `<section class="prep-preset" data-preset="${esc(preset.id)}">
    <div class="prep-preset-head"><label>方案名<input maxlength="24" data-field="name" value="${esc(preset.name)}"></label><span>${esc(preset.id)}</span></div>
    <div class="prep-fields"><label>人物<select data-field="characterId">${optionList(model.characterOptions, preset.characterId, '未选择人物')}</select></label><label>宠物<select data-field="petId">${optionList(model.petOptions, preset.petId, '未选择宠物')}</select></label></div>
    <div class="prep-picks">${preset.picks.length ? preset.picks.map(pick => { const hit = preview?.resolvedPicks?.find(item => item.card.cardId === pick.card.cardId && (item.card.variantKey || '') === (pick.card.variantKey || '')); return `<div class="prep-pick ${esc(hit?.status || '')}"><span><b>${esc(hit?.name || pick.name || pick.card.cardId)}</b> ×${pick.count}</span><small>${hit ? esc(statusText(hit)) : '尚未预览'}</small><button data-action="preset-pick-remove" data-card-id="${esc(pick.card.cardId)}" aria-label="移除 ${esc(hit?.name || pick.card.cardId)}">移除</button></div>`; }).join('') : '<p class="prep-empty">还没有选择带入卡牌。</p>'}</div>
    <div class="prep-add"><select data-role="card-add">${optionList(model.cardOptions, null, '选择仓库卡牌')}</select><input data-role="count-add" type="number" min="1" max="99" value="1" aria-label="数量"><button data-action="preset-pick-add">加入愿望清单</button></div>
    ${preview ? `<div class="prep-summary ${preview.canStart ? 'ready' : 'blocked'}"><b>${preview.canStart ? '可以应用' : '需要处理'}</b><span>带入 ${preview.costs.stashCards} 张 · ${preview.missing.length} 缺失 · ${preview.forbidden.length} 禁带</span></div>` : ''}
    <div class="prep-actions"><button data-action="preset-preview">重新预览</button><button data-action="preset-apply"${preview?.canStart ? '' : ' disabled'}>应用到整备</button></div>
    <p class="prep-empty">应用带入卡牌后，在整备页确认宠物并出发；人物仍在出发后选择。</p>
  </section>`;
}

function render(model) {
  return `<section class="preparation-module" aria-label="收藏目标与出征预设">
    <header><div><small>EXPEDITION INTENT</small><h2>下一局目标与准备</h2></div><span class="prep-count">追踪 ${(model.goals || []).length}/3</span></header>
    ${model.error ? `<p class="prep-error" role="alert">${esc(model.error)}</p>` : ''}
    <div class="prep-goals">${(model.goals || []).map(goal => `<article><div><b>${esc(goal.name || goal.id)}</b><p>${esc(goal.sourceLabel || '来源未确认')}</p></div><button data-action="goal-remove" data-target-id="${esc(goal.id)}">取消追踪</button></article>`).join('') || '<p class="prep-empty">尚未追踪目标。最多选择三项。</p>'}</div>
    <div class="prep-goal-add"><select data-role="goal-add">${optionList(model.targetOptions, null, '选择收藏目标')}</select><button data-action="goal-add"${(model.goals || []).length >= 3 ? ' disabled' : ''}>加入追踪</button></div>
    <div class="prep-presets">${(model.presets || []).map(preset => renderPreset(preset, model)).join('')}</div>
  </section>`;
}

export function buildPreparationViewModel({ baseSnapshot, preparation, cardCatalog = [], characters = [], pets = [], catalogVersion = 'unknown', mode = 'standard', bagCapacity = Infinity, busy = false, error = '' } = {}) {
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
  const presets = (prep.presets || []).map(preset => ({ ...preset, picks: preset.picks || [], preview: previewDeployment({ baseSnapshot, preset, mode, cardCatalog, characters, pets, bagCapacity }) }));
  return Object.freeze({ goals, targetOptions: cardCatalog.map(card => ({ id: card.id, name: card.name || card.id })), presets, characterOptions, petOptions, cardOptions, busy, error });
}

export function mountPreparationView(root, { model, onIntent = () => {} } = {}) {
  if (!root || typeof root.addEventListener !== 'function') throw new TypeError('mountPreparationView 需要 DOM root');
  let current = model || { goals: [], presets: [] };
  const emit = (type, payload = {}) => onIntent({ type, payload });
  const click = event => {
    const button = event.target.closest?.('[data-action]'); if (!button || !root.contains(button) || button.disabled) return;
    const presetRoot = button.closest('[data-preset]'); const presetId = presetRoot?.dataset.preset;
    const action = button.dataset.action;
    if (action === 'goal-add') emit(action, { targetId: root.querySelector('[data-role="goal-add"]')?.value || '' });
    else if (action === 'goal-remove') emit(action, { targetId: button.dataset.targetId });
    else if (action === 'preset-pick-add') emit(action, { presetId, cardId: presetRoot.querySelector('[data-role="card-add"]')?.value || '', count: Number(presetRoot.querySelector('[data-role="count-add"]')?.value || 1) });
    else if (action === 'preset-pick-remove') emit(action, { presetId, cardId: button.dataset.cardId });
    else emit(action, { presetId });
  };
  const change = event => { const field = event.target.dataset?.field; const presetId = event.target.closest?.('[data-preset]')?.dataset.preset; if (field && presetId) emit('preset-field', { presetId, field, value: event.target.value }); };
  const paint = () => { root.innerHTML = render(current); root.setAttribute('aria-busy', current.busy ? 'true' : 'false'); };
  root.addEventListener('click', click); root.addEventListener('change', change); paint();
  return { update(nextModel) { current = nextModel || { goals: [], presets: [] }; paint(); }, dispose() { root.removeEventListener('click', click); root.removeEventListener('change', change); root.replaceChildren(); } };
}
