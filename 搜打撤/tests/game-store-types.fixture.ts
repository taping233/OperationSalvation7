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
