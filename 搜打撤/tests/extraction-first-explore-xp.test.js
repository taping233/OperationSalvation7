import { extractionMocks } from './helpers/environment-fixtures.js';
/* SYS-01 探索奖励（2026-10-03）：撤离经验只统计「首次有效探索量」（首踏入格打标 explored）。
 * 验收钉死两条：
 *   ① 同一有效路线，加或不加安全往返（重复进出已探索格），最终撤离经验相同；
 *   ② 首次探索新节点仍有经验收益（每新首探格 +2）。
 * 另钉旧档迁移口径：无 explored 字段（旧档会话）回退旧公式 20+(turn-1)*2。
 * 台架复用 extraction-settlement.test.js 的 slot=null 真实 altar ESM 分支。 */
import { beforeEach, expect, it, vi } from 'vitest';

const altarState = vi.hoisted(() => ({ game: {}, random: vi.fn(() => 0) }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  MODES: {}, game: altarState.game, getActiveSlot: () => null,
  clearSave: vi.fn(), curLayer: () => null, enterLayer: vi.fn(), exitToTitle: vi.fn(), newUid: vi.fn(),
  saveGame: vi.fn(), scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/core/shared.js', () => ({ clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String, escAttr: value => String(value).replaceAll('"', '&quot;') }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/core/random.js', () => ({
  Random: { random: altarState.random, seed: 1, restore: vi.fn() },
  SeededRandomService: class {
    constructor(seed) { this.state = { seed }; }
    restore(state) { this.state = state; }
    random() { return altarState.random(); }
    snapshot() { return this.state; }
  },
}));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  ...extractionMocks(() => vi),
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

let base, doExtract;
// explored 打标：li,idx → 1（与 moveTo 写入同构）；exploredKeys=n 生成 n 个首踏入格
const makeGame = ({ turn = 3, exploredKeys = null, bossKilled = true } = {}) => {
  const explored = {};
  if (exploredKeys != null) for (let i = 0; i < exploredKeys; i++) explored[`0,${i}`] = 1;
  return {
    state: 'modal', runActive: true, pendingExtraction: null, layerIdx: 2,
    hp: 20, maxHp: 30, coins: 7, turn, myClass: '侠客', mode: 'normal', bossKilled,
    ...(exploredKeys != null ? { explored } : {}),
    inventory: [{ name: '木材', count: 2 }, { name: '口粮', count: 3 }],
    usedPocket: [{ card: { id: 'a', name: '口袋卡' }, count: 4 }],
    ownedCards: [{ uid: 'u1', card: { id: 'b', name: '背包卡' } }],
    elapsed: 0,
  };
};
const setGame = fields => {
  for (const k of Object.keys(altarState.game)) delete altarState.game[k];
  Object.assign(altarState.game, makeGame(fields));
};
const xpOf = () => base.data.classes?.['侠客']?.xp;
// slot=null ephemeral 分支把 baseApi.data 当快照读、结果整体回写——同一测试内多场景必须重置，
// 否则上一次撤离的 xp 会累积进下一次快照（首个场景 44、第二个变 88 的假红）。
const freshBaseData = () => {
  base.data = { wood: 0, rations: 0, pocket: [], stash: [], nestUnlocked: false,
    coins: 0, collection: {}, stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } };
};

beforeEach(async () => {
  vi.resetModules();
  setGame({});
  document.body.innerHTML = '<div id="body"></div>';
  const UI = {
    log: vi.fn(), hideOverlay: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
    showOverlay: (_title, html) => { document.body.innerHTML = html; }, act(name, fn) { this.acts[name] = fn; }, acts: {},
  };
  base = {
    data: { wood: 0, rations: 0, pocket: [], stash: [], nestUnlocked: false,
      coins: 0, collection: {}, stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } },
    deposit: vi.fn(), depositCards: vi.fn(), isSha: () => false, stashRoom: () => 5,
    stashUsed: () => 0, stashCap: () => 5,
  };
  window.SDT = {
    UI, Base: base, Sound: { sfx: vi.fn(), music: vi.fn() },
    Cards: { cardHTML: c => c.name, sellPrice: () => 1 },
    // 真实加算语义（extraction-recovery 同款）：xp 累加，才能断言经验数值
    Meta: { track: vi.fn(), addXpToProgress: (p, amount) => ({ after: { lv: p.lv || 1, xp: (p.xp || 0) + amount } }) },
  };
  altarState.random.mockReset().mockReturnValue(0);
  ({ doExtract } = await import('../game/src/run/game.run.altar.js'));
});

it('验收①：同一有效路线，加 20 次安全往返（重复进出已探索格）撤离经验不变', async () => {
  setGame({ turn: 13, exploredKeys: 12 });   // 12 格有效路线、12 次行动
  freshBaseData();
  expect(await doExtract()).toBe(true);
  const xpDirect = xpOf();
  expect(xpDirect).toBe(20 + 12 * 2);   // 44：只算首探量，与旧口径在无往返时等值

  setGame({ turn: 33, exploredKeys: 12 });   // 同路线 + 20 次安全往返：explored 不涨，turn 只作展示
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf(), '重复走已探索格不得再产生经验').toBe(xpDirect);
});

it('验收②：首次探索新节点仍有收益——每个新首探格恰 +2 XP', async () => {
  setGame({ turn: 1, exploredKeys: 0 });
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(20);   // 零移动撤离 = 纯撤离保底

  setGame({ turn: 2, exploredKeys: 1 });
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(22);

  setGame({ turn: 13, exploredKeys: 12 });
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(44);
});

it('旧档迁移：无 explored 字段的会话回退旧口径 20+(turn-1)*2，存量进度不缩水', async () => {
  setGame({ turn: 4 });   // 不带 explored（旧档读档后的会话形态）
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(26);   // 与 extraction-recovery.test.js「characters.wu.xp=26」同源口径

  setGame({ turn: 21 });   // 研究时点 B 实验（20 次额外往返）旧口径值
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(60);

  setGame({ turn: 0 });   // 异常负值守卫：Math.max(0, …) 不发负经验
  freshBaseData();
  expect(await doExtract()).toBe(true);
  expect(xpOf()).toBe(20);
});
