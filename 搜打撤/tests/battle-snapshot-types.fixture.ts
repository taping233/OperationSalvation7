import { createBattleSnapshot } from '../game/src/battle/battle.snapshot.js';
import { previewAction } from '../game/src/battle/battle.preview.js';
import type { BattleSnapshotInput, PreviewActionInput } from '../game/src/battle/battle.snapshot.types.js';

const card = {
  id: 'starter-attack',
  name: '初始攻击',
  type: '武术',
  cost: 1,
  dmg: 0,
  dmgType: 'attack',
  desc: '攻(+0):造成等同于攻击力的伤害',
  rules: { triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', extra: { tags: ['fixture'] } }] } },
};

const input: BattleSnapshotInput = {
  battleToken: 11, mode: 'normal', turn: 1, energy: 3, maxEnergy: 3,
  busy: false, phase: 'player', actionQueueLength: 0, opts: {},
  player: { hp: 20, maxHp: 20, atk: 4, spellPower: 0 }, pdef: null, pstat: { status: {} },
  foes: [{ hp: 8, dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } }],
  deathFxPending: [false], allies: [], hand: ['card-1'], drawPile: [], discard: [], grave: [],
  infusing: { uid: 'card-1', card, picked: new Set() }, discovering: { options: [card] },
  handSelecting: null, choosing: null, pendingTarget: { uid: 'card-1', card }, pendingHint: null,
  viewingGrave: false, viewingDeck: false, viewingBag: false, dreadShown: false,
  selectingDeck: false, deckNeed: 0, selDeckMax: 0, selShaN: 0, sel: new Set(), selPool: [],
  potionBar: null, pendingItem: null, slamPending: false, dartPending: false,
  equipped: [{ uid: 'equip-1', card, name: '装备', desc: '', skill: '', used: false }],
};

const snapshot = createBattleSnapshot(input);
const snapshotAmountField: string | undefined = snapshot.pendingTarget?.card?.rules?.triggers?.onPlay?.[0].amountField;
void snapshotAmountField;
const action: PreviewActionInput = {
  snapshot,
  action: { kind: 'play-card', uid: 'card-1', targetIndex: 0 },
  cardContext: { card, targetIndexes: [0], legal: true, effectiveCost: 1, damageGrowth: 0 },
};
previewAction(action);
