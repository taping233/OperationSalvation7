import { GameStore } from '../game/src/hub/game.store.js';
import type { JsonData } from '../game/src/hub/game.store.types.js';

declare const store: GameStore;

// Mutable runtime state remains writable, including the stored card's rules.
store.state.coins = 7;
store.state.ownedCards.push({ uid: 'u1', card: {
  cost: 2,
  type: '法术',
  rarity: '古朴',
  desc: '示例',
  value: 3,
  dmg: 1,
  rules: { triggers: { onPlay: [{ op: 'damage', amount: 2 }] } },
  meta: { origin: 'test' },
  mechanics: { target: 'enemy' },
} });
store.state.ownedCards[0].card.rules!.triggers!.onPlay![0].amount = 3;

const snapshot = store.getSnapshot();
const amount: number | undefined = snapshot.ownedCards[0].card.rules?.triggers?.onPlay?.[0].amount;
const metadata: JsonData | undefined = snapshot.ownedCards[0].card.meta?.origin;
const mechanics: JsonData | undefined = snapshot.ownedCards[0].card.mechanics?.target;
void amount;
void metadata;
void mechanics;

// Caller-owned map and live render objects intentionally retain reference types.
snapshot.map.rules.playerMaxHp = 40;
const hoverObject: unknown = snapshot.hover;
const targetObject: unknown = snapshot.moveTarget;
void hoverObject;
void targetObject;

// Pending run data remains writable on the store and recursively readonly in snapshots.
store.state.entrySupply = { version: 1, layerIdx: 0, trackPos: 0, cardIds: ['supply'], taken: [] };
store.state.entrySupply.taken.push(0);
store.state.nodeRewards = { '0,0': { version: 1, type: 'resource', cardIds: ['reward'], taken: null } };
store.state.nodeRewards['0,0'] = { version: 1, type: 'event', eventId: 'ev1' };
store.state.pendingEventLoot = { text: '物资箱', chests: ['medium'] };
store.state.pendingEventLoot.chests.push('large');
store.state.pendingExtraction = { version: 1, runId: 'run-test', phase: 'organizing', requestSeq: 0, remainingCards: [{ card: {name: '测试牌'}, count: 1 }], keptPocket: [], totalPocketCount: 0, lostPocketCount: 0, resources: {wood: 0, rations: 0} };
store.state.pendingRunePick = [{ kind: 'life', name: '生命符文', rarity: '古朴', desc: '示例', attrs: ['火'] }];
const pendingSnapshot = store.getSnapshot();
const supplyIds: readonly string[] | undefined = pendingSnapshot.entrySupply?.cardIds;
const rewardType: string | undefined = pendingSnapshot.nodeRewards?.['0,0'].type;
void supplyIds;
void rewardType;
// @ts-expect-error Snapshot pending supply arrays cannot be mutated.
pendingSnapshot.entrySupply!.taken.push(1);
const resource = pendingSnapshot.nodeRewards!['0,0'];
if (resource.type === 'resource') {
  // @ts-expect-error Nested reward choice is readonly.
  resource.taken = 0;
  // @ts-expect-error Reward candidate IDs are readonly.
  resource.cardIds.push('extra');
}
// @ts-expect-error Snapshot reward records cannot be replaced.
pendingSnapshot.nodeRewards!['0,0'] = { version: 1, type: 'event', eventId: 'ev2' };
// @ts-expect-error Pending loot is readonly through the snapshot.
pendingSnapshot.pendingEventLoot!.chests.push('large');
// @ts-expect-error Pending extraction records are readonly through the snapshot.
pendingSnapshot.pendingExtraction!.remainingCards = [];
// @ts-expect-error Pending rune candidates are readonly through the snapshot.
pendingSnapshot.pendingRunePick!.push({ kind: 'life', name: '生命符文', rarity: '古朴', desc: '示例', attrs: ['水'] });
// @ts-expect-error Supply tracking requires numeric indexes.
store.state.entrySupply.taken.push('0');
// @ts-expect-error Reward choices require their schema's fields.
store.state.nodeRewards['0,0'] = { version: 1, type: 'resource' };
// @ts-expect-error Undeclared extensions have no typed snapshot contract.
pendingSnapshot.futureSession;

// @ts-expect-error Runtime-added rune attributes are recursively readonly in snapshots.
pendingSnapshot.nestRunes?.[0].attrs.push('水');
