import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  IDLE_SPECS, idleMountState,
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

describe('选人页CSS待机规格表', () => {
  it('规格覆盖五名角色且仅五名，motion 互不相同（不同人物不同动作）', () => {
    expect([...Object.keys(IDLE_SPECS)].sort()).toEqual([...CHARACTERS.map(c => c.id)].sort());
    const motions = Object.values(IDLE_SPECS).map(s => s.motion);
    expect(new Set(motions).size).toBe(motions.length);
    expect(motions.length).toBe(5);
  });

  it('CSS 侧每个 motion 都有对应 keyframes 与选择器（JS/CSS 契约不脱钩）', () => {
    for (const spec of Object.values(IDLE_SPECS)) {
      expect(css).toContain(`data-idle-motion='${spec.motion}']`);
      const cap = spec.motion === 'wu' ? 'Wu' : spec.motion === 'baita' ? 'Baita'
        : spec.motion === 'changwuyu' ? 'Changwuyu' : spec.motion === 'heixiang' ? 'Heixiang' : 'Xingyue';
      expect(css).toContain(`@keyframes idle${cap}`);
    }
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

  it('挂载角色保留待机标记，不创建特效画布', () => {
    const host = makeHost('wu');
    expect(mountCharacterIdle(host)).toBe(true);
    expect(host.classList.contains('idle-stage')).toBe(true);
    expect(host.dataset.idleMotion).toBe('wu');
    expect(host.querySelectorAll('canvas').length).toBe(0);
    expect(idleMountState()?.motion).toBe('wu');
  });

  it('同宿主重复挂载幂等；卸载清理标记与画布', () => {
    const host = makeHost('xingyue');
    expect(mountCharacterIdle(host)).toBe(true);
    expect(mountCharacterIdle(host)).toBe(true);
    expect(host.querySelectorAll('canvas.idle-vfx').length).toBe(0);
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
    expect(newHost.querySelectorAll('canvas.idle-vfx').length).toBe(0);
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
