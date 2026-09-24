/* 局内流程模块的架构守护（2026-09-11 架构批次 4）
 *
 * game.run.js 曾是 1400 行 God module，现拆为「装配壳 + 三层」：
 *   game.run.scenes.js（L0）→ game.run.altar.js（L1）→ game.run.flow.js（L2）
 * 本文件锁定三件事：
 *   1. 壳不再堆业务代码，被拆走的入口只在分层文件里定义一次；
 *   2. 依赖方向单向（下层不得反向 import 上层），避免拆完又互相缠绕；
 *   3. 局内调用不再经过 game.grantCard 全局属性，只保留对外兼容挂载。
 * 纯源码静态断言（不 import 游戏模块，避免 jsdom 环境桩干扰）。 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file) => readFileSync(resolve(process.cwd(), `game/src/${file}`), 'utf8');
const importedModules = (code) => [...code.matchAll(/^import\s+(?:\{[^}]*\}\s+from\s+)?'\.\/([\w.]+)\.js';/gm)].map(m => m[1]);

const SHELL = source('run/game.run.js');
const SCENES = source('run/game.run.scenes.js');
const ALTAR = source('run/game.run.altar.js');
const FLOW = source('run/game.run.flow.js');

it('满包拒绝新卡，只允许普通背包已有未满堆合并', () => {
  const text = source('run/game.session.js');
  const body = text.match(/function canReceiveCard\(card\) \{([\s\S]*?)\n {2}\}/)[1];
  const game = { ownedCards: [] };
  const receive = new Function('game', 'stackCapOf', 'canAcceptCard', `return function(card) {${body}}`)(game, () => 3, () => false);
  const card = { name: '测试卡' };
  expect(receive(card)).toBe(false);
  game.ownedCards = [{ card, safe: true }, { card, stored: true }];
  expect(receive(card)).toBe(false);
  game.ownedCards = [{ card }];
  expect(receive(card)).toBe(true);
  game.ownedCards = Array.from({ length: 3 }, () => ({ card }));
  expect(receive(card)).toBe(false);
  game.ownedCards.push({ card });
  expect(receive(card)).toBe(true);
});

describe('局内流程模块分层（批次 4）', () => {
  it('壳只做装配：不再定义任何被拆走的流程入口', () => {
    for (const name of ['moveTo', 'resolveCell', 'runInstant', 'buildEncounter', 'openScene', 'nodeShell', 'grantEventCard', 'openAltarRitual', 'openClassChoice', 'openDoorModal', 'doExtract', 'triggerEventCard']) {
      expect(SHELL, `壳里不应再有 ${name} 的实现`).not.toContain(`function ${name}(`);
    }
    expect(SHELL.split('\n').length).toBeLessThan(120);
    expect(SHELL).toContain('function bindRunMixins() {');
    expect(SHELL).toContain('function devForceBattle(');
  });

  it('对外导出面不变：game.boot.js / game.bag.js 依赖的符号仍从 game.run.js 出', () => {
    const exported = SHELL.match(/^export \{([^}]*)\};/m)[1].split(',').map(s => s.trim());
    for (const name of ['bindRunMixins', 'moveTo', 'openAltarRitual', 'openClassChoice', 'openShop', 'showRunTransition', 'devForceBattle']) {
      expect(exported, `${name} 应仍在 game.run.js 导出`).toContain(name);
    }
  });

  it('依赖方向单向：scenes 不依赖上层，altar 不依赖 flow，flow 可依赖两者', () => {
    const scenesDeps = importedModules(SCENES);
    expect(scenesDeps).not.toContain('game.run.altar');
    expect(scenesDeps).not.toContain('game.run.flow');
    expect(scenesDeps).not.toContain('game.run');
    const altarDeps = importedModules(ALTAR);
    expect(altarDeps).not.toContain('game.run.flow');
    expect(altarDeps).not.toContain('game.run');
    expect(altarDeps).toContain('game.run.scenes');
    const flowDeps = importedModules(FLOW);
    expect(flowDeps).toContain('game.run.scenes');
    expect(flowDeps).toContain('game.run.altar');
  });

  it('三层各自导出下游需要的入口，且每个入口只定义一次', () => {
    const layers = { 'game.run.scenes.js': SCENES, 'game.run.altar.js': ALTAR, 'game.run.flow.js': FLOW };
    const required = {
      'game.run.scenes.js': ['buildEncounter', 'cancelLegacyChainMove', 'enterNode', 'finishInstant', 'grantEventCard', 'nodeOpt', 'nodeShell', 'openBattleCell', 'openBlankSafePage', 'openChestsOnCell', 'openPickupPage', 'openPocketRestore', 'preloadAllNodeShellBgs', 'showRunTransition'],
      'game.run.altar.js': ['openDoorModal', 'openFireRest', 'openClassChoice', 'openAltarRitual'],
      'game.run.flow.js': ['moveTo'],
    };
    for (const [file, names] of Object.entries(required)) {
      for (const name of names) {
        expect(layers[file], `${file} 应导出 ${name}`).toMatch(new RegExp(`^export (function|const) ${name}\\b`, 'm'));
        const defined = Object.values(layers).filter(code => new RegExp(`^export function ${name}\\(`, 'm').test(code));
        expect(defined, `${name} 只应定义在一个分层文件里`).toHaveLength(1);
      }
    }
    // 商店控制器是全流程唯一实例，装配在 L0，上层 import 复用而不是各自 new
    expect(SCENES).toContain('export const { openShop } = createShopController(');
    expect(ALTAR).not.toContain('createShopController');
    expect(FLOW).not.toContain('createShopController');
  });

  it('发卡不再走 game.grantCard 全局属性，兼容挂载只在壳里保留一处', () => {
    for (const [file, code] of Object.entries({ SCENES, ALTAR, FLOW })) {
      expect(code, `${file} 内应直接调用 grantEventCard`).not.toContain('game.grantCard(');
    }
    expect(FLOW).toMatch(/\bgrantEventCard\(/);
    const mounts = SHELL.match(/game\.grantCard\s*=/g) || [];
    expect(mounts).toHaveLength(1);
    expect(SHELL).toContain('game.grantCard = grantEventCard;');
  });
});
