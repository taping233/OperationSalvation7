import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { RULES } from '../game/src/rules.js';
import '../game/src/mapData.js';
import { createEffectExecutor, splitEffectClauses } from '../game/src/battle.effects.js';
import { RunStorage } from '../game/src/game.storage.js';
import { GameStore } from '../game/src/game.store.js';

describe('规则与接口契约', () => {
  it('关键玩法数值保持冻结且与现行规则一致', () => {
    expect(Object.isFrozen(RULES)).toBe(true);
    expect(RULES).toMatchObject({
      diceSides: 3,
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
    expect(RULES.map).toEqual({ diceSides: 3, stepMs: 340, emergencyExitCost: 10, fireHeal: 8, staminaMax: 60, staminaWarn: 10, fireClassCardChance: 0.3 });
    expect(RULES.battle.energy).toBe(2);
    expect(RULES.backpack).toMatchObject({ start: 16, max: 30, safeStart: 2, safeMax: 6 });
    expect(RULES.base.stashMax).toBe(49);
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
    const files = readdirSync(root).filter(name => name.endsWith('.js'));
    const graph = new Map(files.map(name => [name, []]));
    for (const name of files) {
      const source = readFileSync(join(root, name), 'utf8');
      for (const match of source.matchAll(/from\s+['"]\.\/(.+?\.js)['"]|import\s+['"]\.\/(.+?\.js)['"]/g)) {
        const dependency = basename(match[1] || match[2]);
        if (graph.has(dependency)) graph.get(name).push(dependency);
      }
    }
    const visiting = new Set();
    const visited = new Set();
    const visit = (name, trail = []) => {
      if (visiting.has(name)) throw new Error(`循环依赖：${[...trail, name].join(' -> ')}`);
      if (visited.has(name)) return;
      visiting.add(name);
      for (const dependency of graph.get(name)) visit(dependency, [...trail, name]);
      visiting.delete(name);
      visited.add(name);
    };
    for (const name of files) visit(name);
    expect(visited.size).toBe(files.length);
  });

  it('game.session 不反向导入页面功能模块', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/game.session.js'), 'utf8');
    expect(source).not.toMatch(/from ['"]\.\/game\.(boot|run|hub|notes|cardslib)\.js['"]/);
  });

  it('battle.core 不访问 DOM 或反向导入战斗视图', () => {
    const source = readFileSync(resolve(process.cwd(), 'game/src/battle.core.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*battle\.view\.js['"]|\bUI\.|document\./);
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
});
