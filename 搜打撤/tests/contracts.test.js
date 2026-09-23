import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { RULES } from '../game/src/core/rules.js';
import '../game/src/core/mapData.js';
import { createEffectExecutor, splitEffectClauses } from '../game/src/battle/battle.effects.js';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { GameStore } from '../game/src/hub/game.store.js';
import { BOOT_ORDER } from '../game/src/boot-order.js';
import { readModuleSources, buildModuleGraph, assertAcyclic } from '../scripts/architecture-graph.mjs';

describe('规则与接口契约', () => {
  it('关键玩法数值保持冻结且与现行规则一致', () => {
    expect(Object.isFrozen(RULES)).toBe(true);
    expect(RULES).toMatchObject({
      emergencyExitCost: 10,
      playerMaxHp: 30,
      bagSize: 16,
      bagMax: 30,
      safeStart: 2,
      safeMax: 6,
      battleEnergy: 2,
      bossDeckSize: 15,
      starterSha: 5,
    });
    // 2026-09-19：骰子/体力系统整体移除，diceSides/staminaMax/staminaWarn 退出规则表
    expect(RULES.map).toEqual({ stepMs: 340, emergencyExitCost: 10, fireHeal: 8, fireClassCardChance: 0.3 });
    expect(RULES.battle.energy).toBe(2);
    expect(RULES.backpack).toMatchObject({ start: 16, max: 30, safeStart: 2, safeMax: 6 });
    expect(RULES.base.stashMax).toBe(100);   // Item 17：仓库可升到 100 格
    expect(RULES.growth).toEqual({ playerMaxHp: 30, playerAtk: 4 });
    expect(window.SDT.MAP.rules).not.toBe(RULES);
    expect(window.SDT.MAP.rules).toEqual(RULES);
  });

  it('效果文本按立即、回合开始、整场和被注能时分类', () => {
    expect(splitEffectClauses('回复 3 点生命；下回合开始：抽 1 张牌；本局对战内：攻击 +2；被注能时：获得 1 点能量')).toEqual({
      immediate: ['回复 3 点生命'],
      turnStart: [{ text: '抽 1 张牌', each: false }],
      battle: ['本局对战内：攻击 +2'],
      onInfused: ['获得 1 点能量'],
      onDraw: [],
      skill: [],
    });
  });

  it('限定技能句独立成桶（装备打出只穿戴，技能由按钮发动）', () => {
    expect(splitEffectClauses('限定技能：抽3张牌')).toEqual({
      immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: ['抽3张牌'],
    });
  });

  it('效果执行器只通过端口修改战斗状态', () => {
    const player = { status: {} };
    const defense = { armor: 0, shield: 0, guard: false };
    const enemy = { name: '测试敌人', status: {} };
    let energy = 2;
    const combat = {
      addCurse: (unit, key, amount) => { unit.status[key] = (unit.status[key] || 0) + amount; },
      addBlessing: (unit, key, amount = 1) => { unit.status[key] = (unit.status[key] || 0) + amount; },
      purify: () => [],
      CURSE_META: {},
    };
    const execute = createEffectExecutor({
      combat,
      getAlive: () => [enemy],
      getPlayerStatus: () => player,
      getPlayerDefense: () => defense,
      getMode: () => 'normal',
      log: () => {}, escapeHtml: value => value, heal: () => {}, pushFloat: () => {},
      drawCards: () => 0, grantStarterAttack: () => {}, markNoDrawNext: () => {},
      queueDiscover: () => {}, randomDiscoverCard: () => null, addTempCard: () => {},
      addDeckCard: () => {}, allCards: () => [], shuffleDeck: () => 0,
      addEnergy: amount => (energy += amount), addEnergyCap: amount => (energy += amount),
    });
    expect(execute({ name: '测试卡' }, '附加 2 层流血，攻击 +3，获得 4 点护甲，获得 1 点能量', enemy).did).toBe(true);
    expect(enemy.status.bleed).toBe(2);
    expect(player.status.atkUp).toBe(3);
    expect(defense.armor).toBe(4);
    expect(energy).toBe(3);
  });

  it('GameStore 提供稳定的可读快照，且不暴露可变集合', () => {
    const store = new GameStore(window.SDT.MAP);
    store.state.coins = 12;
    store.state.inventory.push({ id: 'wood' });
    store.state.discoveredPairs.add('outer:door');
    const snapshot = store.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.coins).toBe(12);
    expect(snapshot.inventory).toHaveLength(1);
    expect(snapshot.discoveredPairs).toEqual(['outer:door']);
    expect(() => snapshot.inventory.push({ id: 'coin' })).toThrow();
  });
});

describe('旧对局存档迁移', () => {
  it('v1 迁入空的档位 1，并保留已有 v2 数据', () => {
    localStorage.clear();
    localStorage.setItem('sdt-save-v1', JSON.stringify({ turn: 7 }));
    RunStorage.migrateLegacy();
    expect(RunStorage.read(1).turn).toBe(7);
    expect(localStorage.getItem('sdt-save-v1')).toBeNull();

    localStorage.setItem('sdt-save-v1', JSON.stringify({ turn: 99 }));
    RunStorage.migrateLegacy();
    expect(RunStorage.read(1).turn).toBe(7);
  });
});

describe('ESM 依赖方向', () => {
  it('src 模块不存在循环依赖', () => {
    const root = resolve(process.cwd(), 'game/src');
    const graph = buildModuleGraph(readModuleSources(root));
    expect(assertAcyclic(graph)).toBe(graph.size);
  });

  it('game.session 不反向导入页面功能模块', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/run/game.session.js'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*game\.(boot|run|hub|notes|cardslib)\.js['"]/);
  });

  it('battle.core 不访问 DOM 或反向导入战斗视图', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/battle/battle.core.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*battle\.view\.js['"]|\bUI\.|document\./);
  });
});

describe('架构守护（2026-09-11 批次 1）', () => {
  const SRC = resolve(process.cwd(), 'game/src');
  const listSrc = (dir = SRC) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() && e.name !== 'generated'
        ? listSrc(join(dir, e.name))
        : (e.name.endsWith('.js') ? [join(dir, e.name)] : []));

  it('window.SDT 只允许在 sdt-facade.js 初始化', () => {
    const offenders = listSrc().filter((f) => basename(f) !== 'sdt-facade.js')
      .filter((f) => /window\.SDT\s*=\s*window\.SDT|window\.SDT\s*=\s*\{\}/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => `${basename(f)} 仍在初始化 window.SDT`)).toEqual([]);
  });

  it('核心机制层不访问 DOM', () => {
    const core = ['battle/battle.core.js', 'battle/battle.runtime.js', 'battle/battle.engine.js', 'battle/battle.enemy-phase.js',
      'battle/battle.effects.js', 'battle/battle.deck.js', 'battle/battle.rules.js',
      'battle/battle.state.js', 'battle/battle.piles.js', 'hub/game.store.js', 'hub/game.storage.js', 'cards/cards.js',
      'core/rules.js', 'hub/meta.js', 'hub/base.js', 'core/random.js', 'core/mapData.js', 'run/map-graph.js',
      'cards/mech-sentences.js', 'core/characters.js', 'core/shared.js', 'core/asset-url.js', 'core/sdt-facade.js'];
    const offenders = [];
    for (const name of core) {
      const source = readFileSync(join(SRC, name), 'utf8');
      const hit = source.match(/\bdocument\b|querySelector|getElementById|innerHTML|\.classList/);
      if (hit) offenders.push(`${name}: ${hit[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it('数据模块 cards.js 不生成 HTML（卡面渲染已外迁 cards.view.js）', () => {
    const source = readFileSync(join(SRC, 'cards/cards.js'), 'utf8');
    expect(source).not.toMatch(/<div|<span|innerHTML/);
  });

  it('实机卡库批次数据外置到 game/data/cards-sync.json（批次 6）', () => {
    const source = readFileSync(join(SRC, 'cards/cards.js'), 'utf8');
    // 源码不再内嵌实机同步卡数据，只从中央数据源取
    expect(source).not.toContain('[sync-cards-from-live:begin]');
    expect(source).toContain('CARDS_SYNC: DATA.cardsSync.cards');
    const doc = JSON.parse(readFileSync(resolve(process.cwd(), 'game/data/cards-sync.json'), 'utf8'));
    expect(doc.version).toBeGreaterThanOrEqual(1);
    expect(doc.cards.length).toBeGreaterThan(0);
    expect(doc.cards.every(c => c.id && c.name)).toBe(true);
    // 同步脚本只写数据、不改源码
    const script = readFileSync(resolve(process.cwd(), 'scripts/sync-cards-from-live.mjs'), 'utf8');
    expect(script).toContain('cards-sync.json');
    expect(script).not.toMatch(/writeFileSync\(CARDS_JS/);
  });
});

describe('Electron 启动契约', () => {
  it('桌面开发态只加载 Vite 构建产物，不直接加载含裸模块导入的源码', () => {
    const main = readFileSync(resolve(process.cwd(), 'desktop-app/main.js'), 'utf8');
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'desktop-app/package.json'), 'utf8'));
    expect(main).toContain("path.join(__dirname, 'game')");
    expect(main).not.toMatch(/prototypes|map-system/);
    expect(pkg.build.files).toContain('suggestions-store.cjs');
    expect(pkg.scripts.prestart.indexOf('build:game')).toBeLessThan(pkg.scripts.prestart.indexOf('check:version'));
  });

  it('首页监听在 DOMContentLoaded 的易失败初始化链之前绑定', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/game.boot.js'), 'utf8');
    const earlyBind = source.indexOf('\n  bindTitle();');
    const boot = source.indexOf("window.addEventListener('DOMContentLoaded'");
    expect(earlyBind).toBeGreaterThan(0);
    expect(earlyBind).toBeLessThan(boot);
  });

  it('双击启动器会先刷新构建产物，避免桌面端长期运行旧前端', () => {
    const launcher = readFileSync(resolve(process.cwd(), '启动搜打撤.bat'), 'utf8');
    const prestart = launcher.indexOf('call npm run prestart');
    const launch = launcher.indexOf('start "" "%ELECTRON%" "%APPDIR%"');
    expect(prestart).toBeGreaterThan(0);
    expect(launch).toBeGreaterThan(prestart);
  });

  it('main.js 副作用导入顺序与 boot-order.js 的 BOOT_ORDER 逐项一致（批次 5）', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/main.js'), 'utf8');
    // 只取顶格的副作用导入；被注释掉的模块（如 scene/runtime.js）不计入；id 含域目录前缀
    const imported = [...source.matchAll(/^\s*import\s+'\.\/([\w./-]+)\.js';/gm)].map(m => m[1]);
    expect(imported.length).toBeGreaterThan(0);
    expect(imported).toEqual(BOOT_ORDER);
    for (const id of BOOT_ORDER) {
      expect(existsSync(resolve(process.cwd(), `game/src/${id}.js`)), `BOOT_ORDER 中的 ${id}.js 不存在`).toBe(true);
    }
  });
});
