/* 基地模块的架构守护（2026-09-22 六文件重构批3）
 *
 * game.hub.js 曾是 1265 行混装（页签壳 + 出征整备流 + 六页签 HTML + 物资抽屉），现拆为：
 *   game.hub.js         —— 壳：装配、事件分派、出发与整备编排、closeBase
 *   game.hub.depart.js  —— 出发页与出征整备（hubDeployHTML / openDepartPrep / deployPick 态）
 *   game.hub.pages.js   —— 六页签 HTML 与 openStashItem/openRawItem 抽屉
 *   game.hub.bridge.js  —— 中立桥：slots.renderHub 注册点 + homeRequestId（bag-return-hook 先例）
 * 锁定四件事：
 *   1. 壳不再定义被拆走的入口，行数不回涨成 God file；
 *   2. 对外导出面（五件套）不变；
 *   3. 依赖单向：切片不 import 壳（contracts 拒环），重绘回环只经 bridge 的 slots；
 *   4. 共享可变态单一归属：deployPick 在 depart 片（壳经 setDeployPick 写），
 *      hubCollectionView 留壳、hubAchHTML 形参注入。
 * 纯源码静态断言（不 import 游戏模块，避免 jsdom 环境桩干扰）——对齐 run-architecture 先例。 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file) => readFileSync(resolve(process.cwd(), `game/src/${file}`), 'utf8');
const importedModules = (code) => [...code.matchAll(/^import\s+(?:\{[^}]*\}\s+from\s+)?'\.\/([\w.]+)\.js';/gm)].map((m) => m[1]);

const SHELL = source('game.hub.js');
const DEPART = source('game.hub.depart.js');
const PAGES = source('game.hub.pages.js');
const BRIDGE = source('game.hub.bridge.js');

describe('基地模块分层（批3 拆分）', () => {
  it('壳只做装配：被拆走的入口不在 game.hub.js 定义，行数不上浮', () => {
    for (const name of ['hubDeployHTML', 'openDepartPrep', 'renderDepartPrep', 'deploySlotsUsed',
      'hubShopHTML', 'hubStashHTML', 'hubPetsHTML', 'openStashItem', 'openRawItem',
      'hubUpgradeHTML', 'hubClassesHTML', 'collRoomHTML', 'hubAchHTML']) {
      expect(SHELL, `壳里不应再有 ${name} 的实现`).not.toContain(`function ${name}(`);
    }
    expect(SHELL.split('\n').length).toBeLessThan(430);
    expect(SHELL).toContain('function renderHub(');
    expect(SHELL).toContain('function closeBase(');
  });

  it('对外导出面不变：五件套仍从 game.hub.js 出（deployPick 经转出）', () => {
    const exported = [...SHELL.matchAll(/^export \{([^}]*)\};/gm)]
      .flatMap((m) => m[1].split(',')).map((s) => s.trim()).filter(Boolean);
    for (const name of ['closeBase', 'deployPick', 'openBaseHub', 'renderHub', 'renderHomeScene']) {
      expect(exported, `${name} 应仍在 game.hub.js 导出`).toContain(name);
    }
  });

  it('依赖单向：切片与桥不得 import 壳；壳装配三件套', () => {
    expect(importedModules(DEPART)).not.toContain('game.hub');
    expect(importedModules(PAGES)).not.toContain('game.hub');
    expect(importedModules(BRIDGE)).not.toContain('game.hub');
    for (const mod of ['game.hub.depart', 'game.hub.pages', 'game.hub.bridge']) {
      expect(importedModules(SHELL), `壳应装配 ${mod}`).toContain(mod);
    }
  });

  it('重绘回环只经桥：切片用 hubBridge 别名（防局部 slots 遮蔽），壳完成 slots 注册', () => {
    for (const [name, code] of [['depart', DEPART], ['pages', PAGES]]) {
      expect(code, `${name} 不得直调 renderHub`).not.toMatch(/(^|[^.\w])renderHub\s*\(/m);
      // 实机教训（2026-09-22 depBack TypeError）：切片内存在业务局部 slots（槽位数/收藏槽），
      // 裸 import { slots } 会被遮蔽——桥引用必须走 hubBridge 别名。
      expect(code, `${name} 桥引用必须用 slots as hubBridge 别名`).toContain('slots as hubBridge');
      expect(code, `${name} 不得出现裸 slots.renderHub(`).not.toContain('slots.renderHub(');
      expect(code, `${name} 应经 hubBridge.renderHub 重绘`).toContain('hubBridge.renderHub(');
    }
    expect(SHELL).toContain('slots.renderHub = renderHub');
    expect(BRIDGE).toContain('export const slots = {}');
  });

  it('共享态单一归属：deployPick 在 depart 带 setter；hubAchHTML 形参注入', () => {
    expect(DEPART).toContain('let deployPick = null;');
    expect(DEPART).toContain('function setDeployPick(');
    expect(SHELL).not.toContain('let deployPick');
    expect(SHELL).toContain('setDeployPick({})');
    expect(PAGES).toContain('function hubAchHTML(hubCollectionView)');
    expect(SHELL).toContain('hubAchHTML(hubCollectionView)');
  });
});
