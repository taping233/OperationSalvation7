import { DATA } from '../core/data-loader.js';
import { characterFor } from '../core/characters.js';
import { commitBase, readBase, readBaseReceipt } from './base.commands.js';
import { addXpToProgress, collectionXpFor, LEVEL_MAX, perkText, xpForNext } from './meta.js';
import { SKIN_FULL_ART, setActiveSkin } from '../core/art.js';
import { clone, fail, freezeDeep } from './commands.shared.js';

const catalogCards = catalog => {
  if (Array.isArray(catalog)) return catalog;
  if (catalog && typeof catalog.all === 'function') return catalog.all() || [];
  return [];
};
const collectible = card => !!card && !!characterFor(card.cls) &&
  (card.rarity === '职业' || card.type === '能力卡');
const variantKeyOf = value => value && (value.variantKey || value.card?.variantKey);
const stackKeyOf = stack => stack && (stack.stackKey ||
  (stack.card && stack.card.id ? `card:${stack.card.id}${variantKeyOf(stack) ? `:${variantKeyOf(stack)}` : ''}` : ''));
const cardRef = card => freezeDeep({ cardId: card.id, ...(variantKeyOf(card) ? { variantKey: variantKeyOf(card) } : {}) });
const sameRef = (a, b) => a && b && a.id === b.id && (variantKeyOf(a) || '') === (variantKeyOf(b) || '');

function getCollection(baseSnapshot, cardCatalog) {
  const snapshot = baseSnapshot || {};
  const stacks = Array.isArray(snapshot.stash) ? snapshot.stash : [];
  const records = snapshot.collection && typeof snapshot.collection === 'object' ? snapshot.collection : {};
  const cards = catalogCards(cardCatalog);
  const views = cards.filter(collectible).map(card => {
    const matching = stacks.filter(stack => sameRef(stack.card, card));
    const sourceIds = matching.map(stackKeyOf).filter(Boolean);
    const ownedCount = matching.reduce((sum, stack) => sum + Math.max(0, Number(stack.count) || 0), 0);
    return {
      card: cardRef(card),
      registered: !!records[card.id],
      ownedCount,
      characterId: characterFor(card.cls)?.id,
      canConvert: ownedCount > 0 && sourceIds.length === new Set(sourceIds).size,
      sourceIds,
    };
  });
  // 老档永久记录不能因卡牌退役或目录暂缺而从展位候选中消失。
  Object.keys(records).filter(cardId => !views.some(view => view.card.cardId === cardId)).forEach(cardId => {
    const matching = stacks.filter(stack => stack.card && stack.card.id === cardId);
    views.push({
      card: freezeDeep({ cardId }),
      registered: true,
      ownedCount: matching.reduce((sum, stack) => sum + Math.max(0, Number(stack.count) || 0), 0),
      canConvert: false,
      sourceIds: matching.map(stackKeyOf).filter(Boolean),
    });
  });
  return freezeDeep(views);
}

function skinIdsFor(snapshot, characterId) {
  const stored = snapshot?.appearance?.characterSkins?.[characterId];
  const selected = snapshot?.appearance?.selectedSkins?.[characterId];
  const legacyAvailable = (SKIN_FULL_ART[characterId] || []).map(skin => skin.id);
  return [...new Set(['default', ...legacyAvailable, ...(Array.isArray(stored) ? stored : []), ...(selected ? [selected] : [])])];
}

function getCharacter(baseSnapshot, characterId) {
  const character = characterFor(characterId);
  if (!character) return null;
  const progress = baseSnapshot?.characters?.[character.id] || { lv: 1, xp: 0 };
  const level = Math.max(1, Number(progress.lv) || 1);
  const xp = Math.max(0, Number(progress.xp) || 0);
  const maxed = level >= LEVEL_MAX;
  const selected = baseSnapshot?.appearance?.selectedSkins?.[character.id] || 'default';
  const view = {
    characterId: character.id,
    level,
    xp,
    maxed,
    selectedSkinId: selected,
    availableSkinIds: skinIdsFor(baseSnapshot, character.id),
    ...(maxed ? {} : { nextReward: { level: level + 1, xpRequired: xpForNext(level), perk: perkText(level + 1) } }),
  };
  return freezeDeep(view);
}

const milestoneNeed = (milestone, total) => milestone.need === 'all' ? total : Number(milestone.need) || 0;
const reachedMilestones = (snapshot, cards) => {
  const total = cards.filter(collectible).length;
  const registered = new Set(Object.keys(snapshot.collection || {}).filter(id => cards.some(card => card.id === id && collectible(card))));
  return DATA.achievements.collectionMilestones
    .filter(milestone => registered.size >= milestoneNeed(milestone, total))
    .map(milestone => milestone.id);
};

function unwrapCommit(result) {
  if (!result.ok) return result;
  return { ok: true, value: freezeDeep(clone(result.value.output)), revision: result.revision };
}

function createCollectionCommands(deps = {}) {
  const io = {
    readBase: deps.readBase || readBase,
    readBaseReceipt: deps.readBaseReceipt || readBaseReceipt,
    commitBase: deps.commitBase || commitBase,
    cards: deps.cards || (() => (globalThis.window && window.SDT && window.SDT.Cards)),
    applySkin: deps.applySkin || setActiveSkin,
  };

  async function convert(context, input) {
    if (!context || typeof context !== 'object' || !input || typeof input.stackKey !== 'string' ||
        !Number.isInteger(input.count) || input.count <= 0) {
      return fail('INVALID_ARGUMENT', 'stackKey 不能为空，count 必须是正整数');
    }
    const payload = { stackKey: input.stackKey, count: input.count };
    const prior = io.readBaseReceipt(context, { command: 'collection.commit', payload });
    if (!prior.ok) return prior;
    if (prior.value) return unwrapCommit(prior);
    const read = io.readBase(context.slotId);
    if (!read.ok) return read;
    const draft = clone(read.value);
    const matches = (draft.stash || []).filter(stack => stackKeyOf(stack) === input.stackKey);
    if (matches.length > 1) return fail('INVALID_STATE', '库存引用不唯一，请刷新仓库', false, { stackKey: input.stackKey });
    const stack = matches[0];
    if (!stack) return fail('NOT_FOUND', '库存中找不到这堆卡牌', false, { stackKey: input.stackKey });
    const card = stack.card;
    if (!collectible(card)) return fail('NOT_COLLECTIBLE', '这张卡不能转化为人物经验', false, { cardId: card && card.id });
    if ((Number(stack.count) || 0) < input.count) {
      return fail('INSUFFICIENT_CARDS', '卡牌数量不足，整笔转换未执行', false,
        { stackKey: input.stackKey, available: Number(stack.count) || 0, required: input.count });
    }
    const cards = catalogCards(io.cards());
    const canonical = cards.find(item => sameRef(item, card));
    if (!canonical) return fail('NOT_FOUND', '卡牌配置中找不到该卡牌', false, { cardId: card.id });
    if (!collectible(canonical)) return fail('NOT_COLLECTIBLE', '这张卡不能转化为人物经验', false, { cardId: card.id });

    const beforeReached = new Set(reachedMilestones(draft, cards));
    const first = !draft.collection?.[card.id];
    draft.collection ||= {};
    if (first) draft.collection[card.id] = { name: canonical.name, rarity: canonical.rarity, ts: Date.now() };
    draft.collXp ||= {};
    if (canonical.rarity === '职业') draft.collXp[card.id] = true;
    stack.count -= input.count;
    if (stack.count <= 0) draft.stash.splice(draft.stash.indexOf(stack), 1);

    const character = characterFor(canonical.cls);
    draft.characters ||= {};
    const gain = collectionXpFor(canonical) * input.count;
    const progress = addXpToProgress(draft.characters[character.id] || { lv: 1, xp: 0 }, gain);
    draft.characters[character.id] = { ...progress.after };
    const afterReached = reachedMilestones(draft, cards);
    const newUnlocks = afterReached.filter(id => !beforeReached.has(id));
    const receipt = {
      consumed: [{ stackKey: input.stackKey, count: input.count }],
      firstRegistrations: first ? [cardRef(canonical)] : [],
      xpChanges: [{ characterId: character.id, before: progress.before, after: progress.after }],
      rewards: [],
      newUnlocks,
    };
    const committed = await io.commitBase(context, {
      beforeRevision: read.revision,
      command: 'collection.commit',
      payload,
      afterState: draft,
      output: receipt,
      events: [{
        type: 'collection.committed',
        payload: { cardId: canonical.id, stackKey: input.stackKey, count: input.count, characterId: character.id, xp: gain, firstRegistration: first },
      }],
    });
    return unwrapCommit(committed);
  }

  async function select(context, input) {
    if (!context || typeof context !== 'object' || !input || typeof input.characterId !== 'string' || typeof input.skinId !== 'string') {
      return fail('INVALID_ARGUMENT', 'characterId 和 skinId 不能为空');
    }
    const character = characterFor(input.characterId);
    if (!character) return fail('NOT_FOUND', '人物不存在', false, { characterId: input.characterId });
    const payload = { characterId: character.id, skinId: input.skinId };
    const prior = io.readBaseReceipt(context, { command: 'appearance.select', payload });
    if (!prior.ok) return prior;
    if (prior.value) {
      const result = unwrapCommit(prior);
      if (result.ok) io.applySkin(character.id, input.skinId);
      return result;
    }
    const read = io.readBase(context.slotId);
    if (!read.ok) return read;
    const draft = clone(read.value);
    draft.appearance ||= { characterSkins: {}, selectedSkins: {} };
    draft.appearance.characterSkins ||= {};
    draft.appearance.selectedSkins ||= {};
    const available = skinIdsFor(draft, character.id);
    const knownForCharacter = (SKIN_FULL_ART[character.id] || []).some(skin => skin.id === input.skinId);
    const knownElsewhere = Object.values(SKIN_FULL_ART).flat().some(skin => skin.id === input.skinId);
    const storedQualification = (draft.appearance.characterSkins[character.id] || []).includes(input.skinId);
    if (!available.includes(input.skinId)) {
      return knownElsewhere ? fail('LOCKED', '该人物尚未解锁此皮肤', false, payload)
        : fail('NOT_FOUND', '未知皮肤 ID', false, payload);
    }
    draft.appearance.selectedSkins[character.id] = input.skinId;
    const assetFallback = input.skinId !== 'default' && !knownForCharacter;
    const view = {
      characterId: character.id,
      selectedSkinId: input.skinId,
      availableSkinIds: available,
      assetFallback,
      ...(assetFallback && storedQualification ? { fallbackSkinId: 'default' } : {}),
    };
    const committed = await io.commitBase(context, {
      beforeRevision: read.revision,
      command: 'appearance.select',
      payload,
      afterState: draft,
      output: view,
      events: [{ type: 'appearance.changed', payload: { characterId: character.id, skinId: input.skinId, assetFallback } }],
    });
    const result = unwrapCommit(committed);
    if (result.ok) io.applySkin(character.id, input.skinId);
    return result;
  }

  return Object.freeze({ convertCollection: convert, selectSkin: select });
}

const defaults = createCollectionCommands();
const convertCollection = defaults.convertCollection;
const selectSkin = defaults.selectSkin;

export {
  createCollectionCommands, getCollection, getCharacter, convertCollection, selectSkin,
  stackKeyOf,
};
