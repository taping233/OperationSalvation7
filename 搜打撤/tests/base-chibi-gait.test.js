import { describe, it, expect } from 'vitest';
import { CHIBI_GAIT, footTarget, solveTwoBone, chibiPose, skinVertex } from '../game/src/hub/base-chibi-gait.js';
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('chibi foot contact and continuous skin', () => {
  it('holds the supporting toe in scene space while the character travels', () => {
    for (const offset of [0, .5]) {
      let anchor = null, cycle = null;
      for (let distance = 29; distance < 145; distance += .12) {
        const foot = footTarget(distance, offset);
        if (!foot.planted) { anchor = null; continue; }
        const nextCycle = Math.floor(distance / CHIBI_GAIT.cycleDistance + offset);
        const world = distance - foot.x;
        if (anchor !== null && nextCycle === cycle) expect(world).toBeCloseTo(anchor, 8);
        anchor = world; cycle = nextCycle;
        expect(foot.y).toBe(0);
      }
    }
  });
  it('clears the ground during swing, keeps a support foot and loops without a jump', () => {
    let lifted = false;
    for (let d = 0; d < 29; d += .1) {
      const front = footTarget(d), back = footTarget(d, .5);
      expect(front.planted || back.planted).toBe(true);
      expect(front.y).toBeLessThanOrEqual(0);
      if (front.y < -8) lifted = true;
    }
    expect(lifted).toBe(true);
    const end = footTarget(29 - .0001), start = footTarget(29 + .0001);
    expect(Math.abs(end.x - start.x)).toBeLessThan(.001);
    expect(Math.abs(end.y - start.y)).toBeLessThan(.001);
  });
  it('keeps upper and lower leg lengths, reachable ankles and stable floor contact', () => {
    for (let distance = 0; distance < 58; distance += .2) {
      const pose = chibiPose({ distance, walk:1, time:distance / 28 });
      for (const leg of pose.legs) {
        const [hip, knee, ankle, toe] = leg.points;
        expect(length(hip, knee)).toBeCloseTo(28, 7);
        expect(length(knee, ankle)).toBeCloseTo(32, 7);
        expect(length(ankle, toe)).toBeCloseTo(16, 2);
        if (leg.planted) expect(toe.y).toBe(206);
      }
    }
  });
  it('has a finite clamped solution for coincident or unreachable targets', () => {
    for (const target of [{x:0,y:0}, {x:900,y:900}]) {
      const chain = solveTwoBone({x:0,y:0}, target, 28, 32);
      expect(chain.flatMap(p => [p.x,p.y]).every(Number.isFinite)).toBe(true);
      expect(length(chain[0], chain[1])).toBeCloseTo(28, 6);
      expect(length(chain[1], chain[2])).toBeCloseTo(32, 6);
    }
  });
  it('maps the shared joint to one point regardless of either bone weight', () => {
    const rest = [{x:0,y:0}, {x:0,y:20}, {x:0,y:40}];
    const pose = [{x:0,y:0}, {x:10,y:18}, {x:25,y:31}];
    for (const weight of [0,.25,.5,.75,1]) {
      const result = skinVertex(rest[1], rest, pose, [weight,1-weight]);
      expect(result.x).toBeCloseTo(pose[1].x, 8); expect(result.y).toBeCloseTo(pose[1].y, 8);
    }
  });
});
