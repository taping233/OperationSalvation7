import { readBase, readBaseReceipt, commitBase } from './base.commands.js';

const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); };
const fail = (code, message, retryable = false, details) => ({ ok: false, code, message, retryable, ...(details ? { details } : {}) });
const PRESET_IDS = Object.freeze(['preset-1', 'preset-2']);
const DEFAULT_PRESETS = Object.freeze({
  'preset-1': Object.freeze({ id: 'preset-1', name: '猛攻', characterId: null, petId: null, picks: Object.freeze([]) }),
  'preset-2': Object.freeze({ id: 'preset-2', name: '跑刀', characterId: null, petId: null, picks: Object.freeze([]) }),
});

function cardRef(value) {
  const source = value?.card || value;
  if (!source || typeof source.cardId !== 'string' || !source.cardId.trim()) return null;
  return { cardId: source.cardId.trim(), ...(typeof source.variantKey === 'string' && source.variantKey.trim() ? { variantKey: source.variantKey.trim() } : {}) };
}

const refKey = ref => `${ref.cardId}::${ref.variantKey || ''}`;

function normalizePicks(picks) {
  if (!Array.isArray(picks)) return null;
  const merged = new Map();
  for (const item of picks) {
    const ref = cardRef(item);
    const count = item?.count;
    if (!ref || !Number.isInteger(count) || count < 1 || count > 99) return null;
    const key = refKey(ref);
    const old = merged.get(key);
    merged.set(key, { card: ref, count: (old?.count || 0) + count });
  }
  return [...merged.values()];
}

function normalizedGoals(base) {
  const tracked = Array.isArray(base?.goals?.tracked) ? base.goals.tracked : [];
  return [...new Set(tracked.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))].slice(0, 3);
}

function normalizedPresets(base) {
  const saved = base?.goals?.presets || {};
  return PRESET_IDS.map(id => {
    const candidate = saved[id] || DEFAULT_PRESETS[id];
    const picks = normalizePicks(candidate.picks) || [];
    return freeze({ id, name: String(candidate.name || DEFAULT_PRESETS[id].name).slice(0, 24), characterId: candidate.characterId || null, petId: candidate.petId || null, picks });
  });
}

export function getPreparation(baseSnapshot) {
  return freeze({ tracked: normalizedGoals(baseSnapshot), presets: normalizedPresets(baseSnapshot) });
}

function catalogMap(cardCatalog = []) { return new Map(cardCatalog.filter(Boolean).map(card => [card.id, card])); }
function stashCount(baseSnapshot, ref) {
  return (baseSnapshot?.stash || []).reduce((sum, stack) => {
    const id = stack?.card?.id;
    const variant = stack?.variantKey || stack?.card?.variantKey;
    return id === ref.cardId && (!ref.variantKey || variant === ref.variantKey) ? sum + Math.max(0, Number(stack.count) || 0) : sum;
  }, 0);
}

export function previewDeployment({ baseSnapshot, preset, mode = 'standard', cardCatalog = [], characters = [], pets = [], bagCapacity = Infinity } = {}) {
  const picks = normalizePicks(preset?.picks);
  if (!baseSnapshot || !preset || !picks) return freeze({ resolvedPicks: [], missing: [], forbidden: [], costs: { stashCards: 0 }, qualification: {}, lossRuleSummary: '未生成预览', canStart: false, errors: ['INVALID_ARGUMENT'] });
  const cards = catalogMap(cardCatalog);
  const missing = [], forbidden = [], resolvedPicks = [];
  for (const pick of picks) {
    const card = cards.get(pick.card.cardId) || (baseSnapshot.stash || []).find(s => s?.card?.id === pick.card.cardId)?.card || null;
    const availableCount = stashCount(baseSnapshot, pick.card);
    const name = card?.name || pick.card.cardId;
    let status = 'ready', appliedCount = pick.count;
    if (card?.rarity === '职业') {
      status = 'forbidden'; appliedCount = 0;
      forbidden.push({ card: pick.card, name, requestedCount: pick.count, code: 'CLASS_CARD_FORBIDDEN' });
    } else if (availableCount < pick.count) {
      status = 'missing'; appliedCount = 0;
      missing.push({ card: pick.card, name, requestedCount: pick.count, availableCount, missingCount: pick.count - availableCount, code: availableCount ? 'INSUFFICIENT_CARDS' : 'CARD_NOT_OWNED' });
    }
    resolvedPicks.push({ card: pick.card, name, requestedCount: pick.count, availableCount, appliedCount, status });
  }
  const characterKnown = !preset.characterId || characters.some(item => item.id === preset.characterId);
  const characterOwned = !preset.characterId || !!baseSnapshot.characters?.[preset.characterId];
  const petKnown = !preset.petId || pets.some(item => item.id === preset.petId);
  const petOwned = !preset.petId || !!baseSnapshot.pets?.[preset.petId];
  const qualification = { characterId: preset.characterId || null, characterKnown, characterOwned, petId: preset.petId || null, petKnown, petOwned };
  const slotsUsed = resolvedPicks.filter(item => item.status === 'ready').length + 1;
  const capacityOk = !Number.isFinite(bagCapacity) || slotsUsed <= bagCapacity;
  return freeze({ mode, resolvedPicks, missing, forbidden, costs: { stashCards: resolvedPicks.reduce((sum, item) => sum + item.appliedCount, 0), slotsUsed, bagCapacity }, qualification, lossRuleSummary: '只有实际带入并在对局中消耗或未成功撤回的卡牌按现有对局规则处理；本预览不扣卡。', canStart: !missing.length && !forbidden.length && characterKnown && characterOwned && petKnown && petOwned && capacityOk, errors: capacityOk ? [] : ['BAG_CAPACITY_EXCEEDED'] });
}

export function createPreparationCommands(deps = {}) {
  const port = { readBase: deps.readBase || readBase, readBaseReceipt: deps.readBaseReceipt || readBaseReceipt, commitBase: deps.commitBase || commitBase };
  const commitGoals = async (context, command, payload, mutate, output) => {
    const prior = await port.readBaseReceipt(context, { command, payload });
    if (!prior.ok || prior.value) return prior;
    const current = port.readBase(context.slotId);
    if (!current.ok) return current;
    const next = clone(current.value); next.goals ||= { tracked: [], presets: {} }; next.goals.presets ||= {};
    mutate(next);
    return port.commitBase(context, { beforeRevision: current.revision, command, payload, afterState: next, events: [{ type: `preparation.${command}`, payload }], output });
  };

  const setTrackedGoals = async (context, { targetIds } = {}) => {
    if (!Array.isArray(targetIds) || targetIds.some(id => typeof id !== 'string' || !id.trim())) return fail('INVALID_ARGUMENT', 'targetIds 必须是稳定 ID 数组');
    const unique = [...new Set(targetIds.map(id => id.trim()))];
    if (unique.length > 3) return fail('GOAL_LIMIT', '最多追踪 3 项目标', false, { limit: 3 });
    const payload = { targetIds: unique };
    return commitGoals(context, 'setTrackedGoals', payload, next => { next.goals.tracked = unique; }, { goals: unique });
  };

  const savePreset = async (context, input = {}) => {
    if (!PRESET_IDS.includes(input.presetId)) return fail('INVALID_ARGUMENT', 'presetId 只允许 preset-1 或 preset-2');
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const picks = normalizePicks(input.picks);
    if (!name || name.length > 24 || !picks) return fail('INVALID_ARGUMENT', '预设名需为 1～24 字，picks 需为稳定 CardRef 与正整数数量');
    const preset = { id: input.presetId, name, characterId: input.characterId || null, petId: input.petId || null, picks };
    const payload = clone(preset);
    return commitGoals(context, 'savePreset', payload, next => { next.goals.presets[input.presetId] = clone(preset); }, { preset });
  };

  const startDeployment = async (context, input = {}) => {
    if (typeof deps.startDeployment !== 'function') return fail('DEPENDENCY_UNAVAILABLE', 'M11 出征事务尚未接入，不能从 M06 创建对局', true);
    const current = port.readBase(context.slotId);
    if (!current.ok) return current;
    const preset = normalizedPresets(current.value).find(item => item.id === input.presetId);
    if (!preset) return fail('NOT_FOUND', '找不到出征预设');
    const preview = previewDeployment({ baseSnapshot: current.value, preset, mode: input.mode, cardCatalog: deps.cardCatalog || [], characters: deps.characters || [], pets: deps.pets || [], bagCapacity: typeof deps.bagCapacity === 'function' ? deps.bagCapacity(current.value) : deps.bagCapacity });
    if (!preview.canStart) return fail('INVALID_STATE', '预设当前不可出征，请处理缺卡、禁带或资格问题', false, { preview });
    return deps.startDeployment(context, { presetId: input.presetId, mode: input.mode, expectedRunRevision: input.expectedRunRevision, resolvedPicks: preview.resolvedPicks, characterId: preset.characterId, petId: preset.petId });
  };

  return { getPreparation: slotId => { const result = port.readBase(slotId); return result.ok ? { ...result, value: getPreparation(result.value) } : result; }, setTrackedGoals, savePreset, startDeployment };
}

const production = createPreparationCommands();
export const setTrackedGoals = production.setTrackedGoals;
export const savePreset = production.savePreset;
export const startDeployment = production.startDeployment;
export { PRESET_IDS, DEFAULT_PRESETS };
