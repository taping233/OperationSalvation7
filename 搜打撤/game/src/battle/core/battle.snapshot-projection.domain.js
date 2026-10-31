// @ts-check
import { itemTargetSideFor } from '../effects/battle.target-rules.js';
import { projectPlayerEffects } from '../runtime/battle.player-effects.js';
import { createBattleSnapshot, createBattleSnapshotSignature } from '../runtime/battle.snapshot.js';
import { buildHandSelectionContract } from './battle.hand-selection.js';

/** Read current live state on every call; cache identity belongs to this runtime.
 * @param {import('./battle.core-ports.types.js').SnapshotProjectionOptions} options */
export function createSnapshotProjection({ runtime: instanceRuntime, executionSession, interactionOf,
  battleBagItems, itemUsability, getConsumedPile, R, isBattleStartEquip, equipCap, equipSkillText, getEquipSkillAvailability }) {
const { actionQueue, stagedDeathFx, handSelectQueue, choiceQueue } = executionSession;
/** @type {Pick<import('../battle.snapshot.types.js').BattleSnapshotInput, 'deckNeed' | 'selDeckMax' | 'selShaN' | 'sel' | 'selPool'>} */
const inactiveDeckSelectionInput = { deckNeed: 0, selDeckMax: 0, selShaN: 0, sel: new Set(), selPool: [] };
const pendingTargetOf = () => { const i = interactionOf('card'); return i ? { uid: i.uid, card: i.card, hint: i.hint,
  fuelUids: Object.freeze([...(i.fuelUids || [])]), battleToken: i.battleToken, selectionId: i.selectionId,
  excludedTargetIndex: i.foeFightFirst ? instanceRuntime.foes.indexOf(i.foeFightFirst) : null } : null; };
const pendingItemOf = () => { const i = interactionOf('item'); return i ? { uid: i.uid, card: i.card, hint: i.hint, excludedTargetId: i.foeFightFirst?.id ?? null } : null; };
/** @returns {import('../battle.snapshot.types.js').BattleSnapshotInput} */
function captureSnapshotInput() {
    const selectingDeck = instanceRuntime.selectingDeck;
    const deckSelectionInput = selectingDeck ? {
      deckNeed: Math.min(R().bossDeckSize, instanceRuntime.selPool.filter(o => !isBattleStartEquip(o.card)).length + Math.min(equipCap(), instanceRuntime.selPool.filter(o => isBattleStartEquip(o.card)).length)),
      selDeckMax: instanceRuntime.selDeckMax, selShaN: instanceRuntime.selShaN,
      sel: instanceRuntime.sel, selPool: instanceRuntime.selPool,
    } : inactiveDeckSelectionInput;
    const pTgt = pendingTargetOf();
    const pItem = pendingItemOf();
    // Match findCard's override/owned/granted precedence without its legacy card repair writes.
    const selectionContract = instanceRuntime.handSelecting ? buildHandSelectionContract(instanceRuntime.handSelecting, instanceRuntime.hand.map(uid => {
      const stored = instanceRuntime.G?.ownedCards?.find(entry => entry.uid === uid) || instanceRuntime.granted.find(entry => entry.uid === uid);
      const card = instanceRuntime.cardOverrides.get(uid) || stored?.card;
      return card ? { uid, card: { name: card.name, type: card.type } } : null;
    })) : null;
    const curseImmunityReset = instanceRuntime.delayed.find(q => q.special === 'curseImmuneOff');
    const potionBar = instanceRuntime.G && !instanceRuntime.selectingDeck ? battleBagItems().reduce(
      /** @param {NonNullable<import('../battle.snapshot.types.js').BattleSnapshotInput['potionBar']>} acc */
      (acc, o) => {
        const g = acc.find(p => p.name === o.card.name);
        if (g) g.count++;
        else {
          const u = itemUsability(o.card);
          acc.push({ uid: o.uid, name: o.card.name, count: 1, desc: String(o.card.desc || ''), aim: itemTargetSideFor(o.card), usable: u.usable, why: u.why });
        }
        return acc;
      }, []) : null;
    const requested = /** @type {{ requestedCards?: Record<string, unknown> }} */ (instanceRuntime.pstat)?.requestedCards;
    const requestedSummary = { ...(requested || {}) };
    delete requestedSummary.history;
    const projectedStatus = requested ? { ...instanceRuntime.pstat, requestedCards: requestedSummary } : instanceRuntime.pstat;
    return {
      battleToken: instanceRuntime.battleState.token, mode: instanceRuntime.mode, turn: instanceRuntime.turn, energy: instanceRuntime.energy, maxEnergy: instanceRuntime.maxEnergy, busy: instanceRuntime.busy, phase: instanceRuntime.battleState.phase,
      actionQueueLength: actionQueue.length, playedMovesThisTurn: instanceRuntime.playedMovesThisTurn, endTurnContext: { deathSave: instanceRuntime.deathSave, timeRune: instanceRuntime.timeRune, extraTurn: instanceRuntime.extraTurn },
      playerEffects: projectPlayerEffects({ playerCurseImmune: instanceRuntime.playerCurseImmune,
        curseImmunityTemporary: !!curseImmunityReset && !curseImmunityReset.restore,
        holyRune: instanceRuntime.holyRune, turn: instanceRuntime.turn, spellCost1: instanceRuntime.spellCost1, meleeCost1: instanceRuntime.meleeCost1, nextSpellTwice: instanceRuntime.nextSpellTwice, allSpellsInfused: instanceRuntime.allSpellsInfused,
        discoverPlus: instanceRuntime.pstat?.status?.discoverPlus, bleedAmp: instanceRuntime.pstat?.status?.bleedAmp, deathSave: instanceRuntime.deathSave, extraTurn: instanceRuntime.extraTurn }),
      opts: instanceRuntime.opts,
      player: instanceRuntime.G ? { hp: instanceRuntime.G.hp, maxHp: instanceRuntime.G.maxHp, atk: instanceRuntime.G.atk, spellPower: instanceRuntime.G.spellPower || 0, myClass: instanceRuntime.G.myClass || null, characterId: instanceRuntime.G.characterId || null } : null,
      handInfuseCounts: instanceRuntime.handInfuseCounts,
      pdef: instanceRuntime.pdef, pstat: projectedStatus, foes: instanceRuntime.foes, deathFxPending: instanceRuntime.foes.map(foe => stagedDeathFx.has(foe)), allies: instanceRuntime.allies, hand: instanceRuntime.hand, drawPile: instanceRuntime.drawPile, discard: instanceRuntime.discard, grave: instanceRuntime.grave, played: instanceRuntime.played, consumed: instanceRuntime.consumed, consumedPile: getConsumedPile(), infusing: instanceRuntime.infusing, discovering: instanceRuntime.discovering,
      handSelecting: instanceRuntime.handSelecting ? { ...instanceRuntime.handSelecting,
        ...selectionContract } : null,
      choosing: instanceRuntime.choosing, pendingTarget: pTgt, pendingHint: instanceRuntime.pendingHint, viewingGrave: instanceRuntime.viewingGrave, viewingDeck: instanceRuntime.viewingDeck, viewingBag: instanceRuntime.viewingBag,
      dreadShown: instanceRuntime.dreadShown, selectingDeck, ...deckSelectionInput,
      potionBar, pendingItem: pItem, slamPending: !!interactionOf('slam'), dartPending: !!interactionOf('dart'),
      equipped: instanceRuntime.equipped.map(e => ({
        uid: e.uid, card: e.card, name: e.card.name, desc: String(e.card.desc || ''),
        skill: equipSkillText(e.card), used: e.used,
        ...(getEquipSkillAvailability ? { skillAvailability: getEquipSkillAvailability(e.uid) } : {}),
      })),
    };
  }
function snapshotSignature(input = captureSnapshotInput()) {
    // The view also reads these rules through battle.core when rendering hand cards.
    return createBattleSnapshotSignature(input, {
      handSelectQueueLength: handSelectQueue.length, choiceQueueLength: choiceQueue.length,
      spellCost1: instanceRuntime.spellCost1, meleeCost1: instanceRuntime.meleeCost1, shaTransform: instanceRuntime.shaTransform, consumeFireballN: instanceRuntime.consumeFireballN, lastPlayedType: instanceRuntime.lastPlayedType,
      stealthStrike: instanceRuntime.stealthStrike, freeCast: instanceRuntime.freeCast, cardOverrides: instanceRuntime.cardOverrides, zeroFeeUntil: instanceRuntime.zeroFeeUntil, growth: instanceRuntime.growth,
    });
  }
/** @returns {import('../battle.snapshot.types.js').BattleSnapshot} */
function getSnapshot() {
    const input = captureSnapshotInput();
    const sig = snapshotSignature(input);
    if (instanceRuntime.snapCache && sig === instanceRuntime.snapSig) return instanceRuntime.snapCache;
    instanceRuntime.storeBattleSnapshot(sig, createBattleSnapshot(input));
    // storeBattleSnapshot synchronously publishes the supplied snapshot on this runtime.
    return /** @type {import('../battle.snapshot.types.js').BattleSnapshot} */ (instanceRuntime.snapCache);
  }
  return { getSnapshot, snapshotSignature };
}
