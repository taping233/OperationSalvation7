import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nodeState from '../game/src/core/map-node-state.js';
import { expeditionRoutes, renderExpeditionPanel, setExpeditionPreview } from '../game/src/run/expedition.view.js';
import { findMapTravelPath } from '../game/src/run/map-travel-path.js';
import { recodeEligibleCards } from '../game/src/run/event-recode-candidates.js';
import { eventSceneHTML } from '../game/src/ui/node-scene-view.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const target = idx => ({ li: 0, idx });
function branchMap(branches = 30) {
  const blocked = branches + 1, end = branches + 2;
  const logical = Array.from({ length: end + 1 }, (_, idx) => ({
    def: { type: idx === 0 ? 'entrance' : idx === blocked ? 'battle' : idx === end ? 'chest' : 'blank' },
    next: idx === 0 ? Array.from({ length: branches }, (_, i) => [0, i + 1])
      : idx === end ? [] : [[0, idx === blocked ? end : blocked]],
  }));
  return { blocked, end, game: { runActive: true, state: 'idle', layerIdx: 0, trackPos: 0, hp: 30, maxHp: 30,
    layerData: [{ logical, doors: [] }], visited: {}, nodeRewards: {},
    seen: Object.fromEntries(logical.map((_, idx) => [`0,${idx}`, 1])),
    nodes: logical.map((cell, idx) => ({ ...target(idx), def: cell.def })),
  } };
}

describe('远征页查询开销', () => {
  it('路线和预览的标签复用本次状态投影，原地领奖仍立即反映', () => {
    const { game } = branchMap(2);
    game.layerData[0].logical[1].def.type = 'chest';
    const reward = game.nodeRewards['0,1'] = { type: 'resource', taken: null };
    const project = vi.spyOn(nodeState, 'mapNodeStatus');
    expect(expeditionRoutes(game)[0].contentState).toBe('pending');
    expect(project).toHaveBeenCalledTimes(2);
    project.mockClear();
    document.body.innerHTML = '<aside id="sidebar"></aside>';
    setExpeditionPreview(game, target(1));
    renderExpeditionPanel(null, game, icon => icon);
    expect(project).toHaveBeenCalledTimes(3);
    expect(document.querySelector('.expedition-map-preview').dataset.contentState).toBe('pending');
    reward.taken = 0;
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('.expedition-map-preview').dataset.contentState).toBe('incomplete');
  });

  it('多条入边仅查询一次阻塞节点；下一次查询立即读取原地领奖、门和可见性变化', () => {
    const { game, blocked, end } = branchMap();
    let reads = 0, reward;
    Object.defineProperty(game.nodeRewards, `0,${blocked}`, { get() { reads++; return reward; } });
    expect(findMapTravelPath(game, target(end))).toBeNull();
    expect(reads).toBe(2);
    game.visited[`0,${blocked}`] = 1;
    reward = { type: 'event-choice', taken: null };
    expect(findMapTravelPath(game, target(end))).toBeNull();
    reward.taken = 0;
    expect(findMapTravelPath(game, target(end))).toEqual([target(1), target(blocked), target(end)]);
    game.layerData[0].doors.push({ at: blocked });
    expect(findMapTravelPath(game, target(end))).toBeNull();
    game.layerData[0].doors.length = 0;
    delete game.seen[`0,${blocked}`]; delete game.visited[`0,${blocked}`];
    expect(findMapTravelPath(game, target(end))).toBeNull();
    game.seen[`0,${blocked}`] = game.visited[`0,${blocked}`] = 1;
    expect(findMapTravelPath(game, target(end))).toEqual([target(1), target(blocked), target(end)]);
  });
});

const obtainable = card => !['初始', '职业', '衍生', '棱彩'].includes(card.rarity) && !card.unrandom;
const oldEligible = (owned, cards, cls) => owned.filter(entry => entry?.card && !entry.safe && !entry.stored
  && ['武术', '法术', '装备'].includes(entry.card.type) && cards.filter(card => card
    && card.id !== entry.card.id && card.name !== entry.card.name && card.type === entry.card.type && card.rarity === entry.card.rarity
    && (obtainable(card) || card.rarity === '职业' && card.cls === cls && !card.hero)).length);
describe('故障重编页候选', () => {
  it('单次图鉴遍历保持候选及背包顺序，包含职业例外、保护牌、同名和同ID排除', () => {
    const cards = Array.from({ length: 600 }, (_, i) => ({ id: `c${i}`, name: `卡${i % 107}`,
      type: ['武术', '法术', '装备', '道具'][i % 4], rarity: ['古朴', '稀有', '职业'][i % 3],
      cls: i % 2 ? '法师' : '侠客', hero: i % 23 === 0, unrandom: i % 11 === 0,
    }));
    const owned = cards.slice(0, 80).map((card, i) => ({ uid: `u${i}`, card, safe: i % 13 === 0, stored: i % 17 === 0 }));
    const check = vi.fn(obtainable);
    expect(recodeEligibleCards(owned, cards, '侠客', check)).toEqual(oldEligible(owned, cards, '侠客'));
    expect(check.mock.calls.length).toBeLessThanOrEqual(cards.length);
    expect(recodeEligibleCards(owned, cards, '法师', obtainable)).toEqual(oldEligible(owned, cards, '法师'));
  });

  it('没有支持类型不扫描图鉴；重新打开读取原地规则变化', () => {
    const original = { id: 'a', name: '甲', type: '装备', rarity: '古朴' };
    const sameId = { ...original, name: '另一个名字' }, sameName = { ...original, id: 'other' };
    const alternative = { ...original, id: 'b', name: '乙', unrandom: true };
    const owned = [{ uid: 'u', card: original }], cards = [original, sameId, sameName, alternative];
    expect(recodeEligibleCards(owned, cards, null, obtainable)).toEqual([]);
    alternative.unrandom = false;
    expect(recodeEligibleCards(owned, cards, null, obtainable)).toEqual(owned);
    alternative.name = original.name;
    expect(recodeEligibleCards(owned, cards, null, obtainable)).toEqual([]);
    const check = vi.fn(obtainable);
    expect(recodeEligibleCards([{ card: { type: '道具' } }], cards, null, check)).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });
});

describe('节点壳模板解析', () => {
  it.each(['entry', 'fire', 'pickup', 'door', 'altar', 'extract'])('%s 不解析未使用的事件选项模板', tone => {
    const create = vi.spyOn(document, 'createElement');
    const body = '<button data-act="continue">继续</button>';
    const html = eventSceneHTML({ tone, title: '节点', body, layer: 0 });
    expect(html).toContain(body);
    expect(create.mock.calls.filter(([tag]) => tag === 'template')).toHaveLength(0);
  });
  it('多项事件只解析一次body，单项同文叙述仍去重、保留动作键', () => {
    const create = vi.spyOn(document, 'createElement');
    const body = '<button class="evt-opt" data-act="one"><b>接通</b><span>补给。</span></button>';
    eventSceneHTML({ tone: 'event', title: '事件', body: body + body, layer: 0 });
    expect(create.mock.calls.filter(([tag]) => tag === 'template')).toHaveLength(1);
    create.mockClear();
    const html = eventSceneHTML({ tone: 'event', title: '事件', sub: '<b>补给！</b>', body, layer: 0 });
    expect(create.mock.calls.filter(([tag]) => tag === 'template')).toHaveLength(2);
    document.body.innerHTML = html;
    expect(document.querySelector('[data-act="one"]')).not.toBeNull();
    expect(document.querySelector('[data-act="one"] > span')).toBeNull();
    expect(document.querySelector('.event-scene').dataset.eventChoiceCount).toBe('1');
  });
});

describe('选角页图片入口', () => {
  it('只渲染选中大图，切人、皮肤和返回不预热全体4K立绘', async () => {
    vi.resetModules();
    const game = { state: 'idle', layerIdx: 0, trackPos: 0 };
    const acts = {}, skins = new Map(), cancel = vi.fn(), warm = vi.fn();
    const context = () => () => true;
    vi.doMock('../game/src/run/game.session.js', () => ({ game, MAP: { rules: { playerMaxHp: 24, playerAtk: 3 } },
      getActiveSlot: () => 1, exitToTitle: vi.fn(), saveGame: vi.fn(),
    }));
    vi.doMock('../game/src/battle/battle-loader.js', () => ({ captureBattleContext: context, ensureBattleReady: vi.fn(async () => {}) }));
    vi.doMock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn() } }));
    vi.doMock('../game/src/run/game.run.scenes.js', () => ({ preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn() }));
    vi.doMock('../game/src/ui/character-view-motion.js', () => ({ createCharacterViewMotion: () => ({ busy: false, enter() {}, preview() {},
      page: fn => fn(), swapPortrait: (current, next) => current.replaceWith(next),
    }) }));
    vi.stubGlobal('requestIdleCallback', vi.fn());
    const full = vi.fn(cls => `<img src="/${cls}-${skins.get(cls) || 'default'}.webp" alt="">`);
    window.SDT = { UI: { act: (act, fn) => { acts[act] = fn; },
      showOverlay: (_title, html) => { document.body.innerHTML = `<div id="overlay"><div id="ovBody">${html}</div></div>`; },
    }, Sound: { sfx() {} }, Base: {}, Meta: { classLv: () => 1, classXP: () => 0, LEVEL_MAX: 10, xpForNext: () => 100, perkText: () => '' },
    Cards: { classPool: () => [{ id: 'c' }] }, Art: { warmClassRoster: warm, classFullArt: full,
      classAvatarArt: cls => `<img src="/${cls}-avatar.webp" alt="">`, getSkin: cls => skins.get(cls) || 'default',
      listSkins: () => [], setSkin: (cls, skin) => skins.set(cls, skin),
    } };
    try {
      const { openClassChoice } = await import('../game/src/run/game.run.class-choice.page.js');
      expect(openClassChoice({ onCancel: cancel })).toBe(true);
      expect(warm).not.toHaveBeenCalled(); expect(full).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('.cls2-fullart img')).toHaveLength(1);
      expect(document.querySelectorAll('.cls2-face img')).toHaveLength(5);
      acts.selClass({ cls: '法师' });
      expect(full).toHaveBeenLastCalledWith('法师');
      expect(document.querySelector('.cls2-fullart img').getAttribute('src')).toBe('/法师-default.webp');
      acts.clsSkin({ cls: '法师', skin: 'snow' });
      expect(document.querySelector('.cls2-fullart').dataset.skin).toBe('snow');
      expect(document.querySelector('.cls2-fullart img').getAttribute('src')).toBe('/法师-snow.webp');
      acts.cls2Quit(); expect(cancel).toHaveBeenCalledOnce(); expect(warm).not.toHaveBeenCalled();
    } finally {
      for (const path of ['run/game.session', 'battle/battle-loader', 'hub/game.cardslib', 'run/game.run.scenes', 'ui/character-view-motion']) vi.doUnmock(`../game/src/${path}.js`);
    }
  });
});
