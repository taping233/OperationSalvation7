import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCENT_MAX, ACCENT_MIN, IDLE_SPECS, P_LIMIT, emitterBudget, idleMountState,
  idleSpecFor, mountCharacterIdle, unmountCharacterIdle,
} from '../game/src/ui/character-idle.js';
import { CHARACTERS } from '../game/src/core/characters.js';

const css = readFileSync(path.join(process.cwd(), 'game/css/character-idle.css'), 'utf8');

const makeHost = (id) => {
  const host = document.createElement('div');
  host.className = 'cls2-fullart';
  host.innerHTML = `<span class="art-figure-wrap figure-${id}"><img class="art-figure-back"><img class="art-figure"></span>`;
  document.body.appendChild(host);
  return host;
};

beforeEach(() => { unmountCharacterIdle(); document.body.replaceChildren(); });

describe('选人页待机演出规格表（五人差异化）', () => {
  it('规格覆盖五名角色且仅五名，motion 互不相同（不同人物不同动作）', () => {
    expect([...Object.keys(IDLE_SPECS)].sort()).toEqual([...CHARACTERS.map(c => c.id)].sort());
    const motions = Object.values(IDLE_SPECS).map(s => s.motion);
    expect(new Set(motions).size).toBe(motions.length);
    expect(motions.length).toBe(5);
  });

  it('每人特效身份色与 core/characters.js 的角色 color 一致（地面辉光同源）', () => {
    for (const c of CHARACTERS) {
      expect(IDLE_SPECS[c.id].color).toBe(c.color);
      const [r, g, b] = IDLE_SPECS[c.id].floor.rgb;
      expect([r, g, b]).toEqual([
        parseInt(c.color.slice(1, 3), 16), parseInt(c.color.slice(3, 5), 16), parseInt(c.color.slice(5, 7), 16),
      ]);
    }
  });

  it('每人至少两类环境粒子 + 一个周期大招，预算受硬顶约束', () => {
    for (const [id, spec] of Object.entries(IDLE_SPECS)) {
      expect(spec.emitters.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(spec.emitters.map(e => e.kind)).size, id).toBe(spec.emitters.length); // kind 不重复
      for (const e of spec.emitters) {
        expect(e.target, id).toBeGreaterThan(0);
        expect(e.every, id).toBeGreaterThanOrEqual(0);
      }
      expect(spec.accent.kind, id).toBeTruthy();
      expect(spec.accent.every, id).toBeGreaterThanOrEqual(ACCENT_MIN);
      expect(spec.accent.every, id).toBeLessThanOrEqual(ACCENT_MAX);
      expect(emitterBudget(spec), id).toBeLessThanOrEqual(P_LIMIT);
    }
  });

  it('CSS 侧每个 motion 都有对应 keyframes 与选择器（JS/CSS 契约不脱钩）', () => {
    for (const spec of Object.values(IDLE_SPECS)) {
      expect(css).toContain(`data-idle-motion='${spec.motion}']`);
      const cap = spec.motion === 'wu' ? 'Wu' : spec.motion === 'baita' ? 'Baita'
        : spec.motion === 'changwuyu' ? 'Changwuyu' : spec.motion === 'heixiang' ? 'Heixiang' : 'Xingyue';
      expect(css).toContain(`@keyframes idle${cap}`);
    }
    // 层序契约：双层画布 + 立绘显式 z1 + 降动效兜底
    expect(css).toContain('.idle-vfx-back { z-index: 1; }');
    expect(css).toContain('.idle-vfx-front { z-index: 2; }');
    expect(css).toContain('.cls2-fullart.idle-stage .art-figure-wrap { z-index: 1;');
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('选人页待机挂载/卸载', () => {
  it('无宿主 / 无立绘 / 未知角色一律不挂载', () => {
    expect(mountCharacterIdle(null)).toBe(false);
    const bare = document.createElement('div');
    bare.className = 'cls2-fullart';
    document.body.appendChild(bare);
    expect(mountCharacterIdle(bare)).toBe(false);
    expect(mountCharacterIdle(makeHost('foo'))).toBe(false);
    expect(document.querySelectorAll('.idle-vfx').length).toBe(0);
  });

  it('挂载五人任一：标记 idle-stage + data-idle-motion，插入前后两层画布', () => {
    const host = makeHost('wu');
    expect(mountCharacterIdle(host)).toBe(true);
    expect(host.classList.contains('idle-stage')).toBe(true);
    expect(host.dataset.idleMotion).toBe('wu');
    const canvas = [...host.querySelectorAll('canvas.idle-vfx')];
    expect(canvas.map(c => c.className)).toEqual(['idle-vfx idle-vfx-back', 'idle-vfx idle-vfx-front']);
    expect(canvas[0].nextElementSibling.className).toContain('art-figure-wrap');   // 背层在立绘前
    expect(host.lastElementChild.className).toContain('idle-vfx-front');            // 前层殿后
    expect(idleMountState()?.motion).toBe('wu');
  });

  it('同宿主重复挂载幂等；卸载清理标记与画布', () => {
    const host = makeHost('xingyue');
    expect(mountCharacterIdle(host)).toBe(true);
    expect(mountCharacterIdle(host)).toBe(true);
    expect(host.querySelectorAll('canvas.idle-vfx').length).toBe(2);
    unmountCharacterIdle();
    expect(host.classList.contains('idle-stage')).toBe(false);
    expect(host.dataset.idleMotion).toBeUndefined();
    expect(host.querySelectorAll('canvas.idle-vfx').length).toBe(0);
    expect(idleMountState()).toBeNull();
  });

  it('切换角色（新宿主重建）：自动换装到新角色，旧宿主画布与标记被清', () => {
    const oldHost = makeHost('wu');
    expect(mountCharacterIdle(oldHost)).toBe(true);
    const newHost = makeHost('heixiang');
    expect(mountCharacterIdle(newHost)).toBe(true);
    expect(idleMountState()?.motion).toBe('heixiang');
    expect(oldHost.querySelectorAll('canvas.idle-vfx').length).toBe(0);
    expect(oldHost.classList.contains('idle-stage')).toBe(false);
    expect(newHost.querySelectorAll('canvas.idle-vfx').length).toBe(2);
  });

  it('reduceMotion（SDT.Motion 判定）时不挂载，静态立绘原样', () => {
    window.SDT = window.SDT || {};
    window.SDT.Motion = { reduceMotion: () => true };
    try {
      const host = makeHost('baita');
      expect(mountCharacterIdle(host)).toBe(false);
      expect(host.classList.contains('idle-stage')).toBe(false);
      expect(host.querySelectorAll('canvas.idle-vfx').length).toBe(0);
    } finally { delete window.SDT.Motion; }
  });

  it('自挂载：sdt-overlay-mode 广播后自动检出 .cls2-fullart 并挂载', () => {
    makeHost('changwuyu');
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
    expect(idleMountState()?.motion).toBe('changwuyu');
    expect(document.querySelector('.cls2-fullart').classList.contains('idle-stage')).toBe(true);
  });

  it('idleSpecFor 只认已知角色 id', () => {
    expect(idleSpecFor('wu')?.motion).toBe('wu');
    expect(idleSpecFor('nope')).toBeNull();
  });
});
