// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { THREE_ROLE_FRAME_SEQUENCES, THREE_ROLE_FRAME_SIZE, threeRoleTimeline } from '../game/src/battle/view/battle.frame-catalog-three-role.js';

const json = path => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
const manifest = json('game/assets/asset-manifest.json');

describe('three redrawn battle sprites', () => {
  it.each(['baita', 'heixiang', 'xingyue'])('%s retains exact rest endpoints, authored timing and fallen completion', role => {
    const seq = THREE_ROLE_FRAME_SEQUENCES[role];
    const neutral = seq.idle[0];
    for (const action of ['atk', 'hurt']) {
      expect(seq[action][0]).toBe(neutral);
      expect(seq[action].at(-1)).toBe(neutral);
    }
    expect(seq.death[0]).toBe(neutral);
    expect(seq.death.at(-1)).not.toBe(neutral);
    expect(THREE_ROLE_FRAME_SIZE).toEqual({ width: 512, height: 342 });
    for (const [action, ms] of Object.entries({ idle: 3000, atk: 417, hurt: 334, death: 875 })) {
      const timeline = threeRoleTimeline(role, action);
      expect(timeline.list).toHaveLength(timeline.dur.length);
      expect(timeline.dur.reduce((a, b) => a + b, 0)).toBe(ms);
      expect(timeline.hold).toBe(action === 'death');
      expect(timeline.loop).toBe(action === 'idle');
      const fast = threeRoleTimeline(role, action, 2);
      expect(fast.dur.reduce((a, b) => a + b, 0)).toBe(action === 'idle' ? ms : ms / 2);
    }
    expect(threeRoleTimeline(role, 'unknown')).toBeNull();
  });

  it.each(['baita', 'heixiang', 'xingyue'])('%s references existing, registered and unchanged texture bytes', role => {
    const bank = [...new Set(Object.values(THREE_ROLE_FRAME_SEQUENCES[role]).flat())];
    expect(bank.length).toBe(50);
    for (const name of bank) {
      const path = `portraits/frames/${role}/${name}.webp`;
      const raw = readFileSync(resolve(process.cwd(), 'game/assets', path));
      const entry = manifest.assets.find(asset => asset.path === path);
      expect(entry, path).toBeDefined();
      expect(entry.bytes).toBe(raw.length);
      expect(entry.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
    }
    const catalog = json(`game/assets/portraits/frames/${role}/sprite-v1/animations.json`);
    expect(catalog.facing).toBe('right');
    expect(catalog.fixedGeometry).toBe(true);
  });

  it('uses the mage/priest cast animation and keeps unknown roles unsupported', () => {
    for (const role of ['baita', 'xingyue']) {
      expect(threeRoleTimeline(role, 'cast')).toEqual(threeRoleTimeline(role, 'atk'));
    }
    expect(threeRoleTimeline('unsupported', 'idle')).toBeNull();
  });
});
