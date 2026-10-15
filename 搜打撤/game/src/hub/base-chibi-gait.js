// Foot targets share the scene root, not the bobbing pelvis (Spineboy setup).
// The cosine-law solver and skin transforms below are project implementations.
export const CHIBI_GAIT = Object.freeze({ cycleDistance:29, stance:.62, speed:28, ground:206 });
const TAU = Math.PI * 2;
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const point = (x, y) => ({ x, y });

export function solveTwoBone(root, target, upper, lower, bend = -1) {
  const dx = target.x - root.x, dy = target.y - root.y;
  const raw = Math.hypot(dx, dy);
  const distance = Math.max(Math.abs(upper - lower) + .001, Math.min(upper + lower - .001, raw));
  const axis = Math.atan2(dy, dx);
  const cosine = Math.max(-1, Math.min(1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance)));
  const angle = axis + bend * Math.acos(cosine);
  return [root, point(root.x + Math.cos(angle) * upper, root.y + Math.sin(angle) * upper),
    point(root.x + Math.cos(axis) * distance, root.y + Math.sin(axis) * distance)];
}

function hermite(a, b, tangent, t) {
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a + (t ** 3 - 2 * t ** 2 + t) * tangent
    + (-2 * t ** 3 + 3 * t ** 2) * b + (t ** 3 - t ** 2) * tangent;
}

// Native art faces left. The renderer mirrors it when travelling right.
export function footTarget(distance, offset = 0) {
  const phase = ((distance / CHIBI_GAIT.cycleDistance + offset) % 1 + 1) % 1;
  const half = CHIBI_GAIT.cycleDistance * CHIBI_GAIT.stance / 2;
  if (phase < CHIBI_GAIT.stance) return { phase, planted:true, x:-half + CHIBI_GAIT.cycleDistance * phase, y:0,
    roll: .15 * smooth(.46, CHIBI_GAIT.stance, phase) };
  const swing = (phase - CHIBI_GAIT.stance) / (1 - CHIBI_GAIT.stance);
  return { phase, planted:false, x:hermite(half, -half, CHIBI_GAIT.cycleDistance * (1 - CHIBI_GAIT.stance), swing),
    y:-10 * Math.sin(Math.PI * swing) ** 2, roll:.22 * Math.sin(TAU * swing) };
}

function rotate(p, pivot, angle, yOffset = 0) {
  const c = Math.cos(angle), s = Math.sin(angle), dx = p.x - pivot.x, dy = p.y - pivot.y;
  return point(pivot.x + c * dx - s * dy, pivot.y + s * dx + c * dy + yOffset);
}

export function chibiPose({ time = 0, distance = 0, walk = 0, reaction = -1 } = {}) {
  const phase = distance / CHIBI_GAIT.cycleDistance * TAU;
  const breath = Math.sin(time * TAU / 3.1);
  const greet = reaction < 0 ? 0 : smooth(0, .22, reaction) * (1 - smooth(1.3, 1.7, reaction));
  const bob = mix(.1 + .15 * breath, 1.1 + .9 * Math.cos(phase * 2), walk) + greet * .4;
  const lean = .017 * Math.sin(phase) * walk - greet * .018;
  const pelvis = point(77, 132);
  const torso = p => rotate(p, pelvis, lean, bob);
  const legs = [63, 91].map((base, index) => {
    const foot = footTarget(distance, index * .5);
    const toe = point(base - 5 + foot.x * walk, CHIBI_GAIT.ground + foot.y * walk);
    const angle = -.48 + foot.roll * walk;
    const ankle = point(toe.x - Math.sin(angle) * 16, toe.y - Math.cos(angle) * 16);
    const hip = torso(point(base, 132));
    const chain = solveTwoBone(hip, ankle, 28, 32, 1);
    // The target is reachable for this gait; retain the independently anchored foot.
    return { points:[...chain, toe], planted:foot.planted, phase:foot.phase };
  });
  const arms = [point(59, 89), point(94, 91)].map((rest, index) => {
    const shoulder = torso(rest);
    const swing = Math.sin(phase + index * Math.PI) * .15 * walk;
    let upper = (index ? .16 : -.12) + swing;
    let lower = (index ? -.12 : .06) + swing * .45;
    if (index) {
      upper = mix(upper, 1.12, greet);
      lower = mix(lower, 2.48 + .12 * Math.sin(Math.max(0, reaction - .2) * 18), greet);
    }
    const elbow = point(shoulder.x + Math.sin(upper) * 25, shoulder.y + Math.cos(upper) * 25);
    const wrist = point(elbow.x + Math.sin(lower) * 23, elbow.y + Math.cos(lower) * 23);
    const hand = point(wrist.x + Math.sin(lower) * 8, wrist.y + Math.cos(lower) * 8);
    return [shoulder, elbow, wrist, hand];
  });
  const neck = torso(point(77, 79));
  const headAngle = -.012 * Math.sin(phase - .3) * walk + .009 * breath - .06 * greet;
  const head = p => rotate(torso(p), neck, headAngle);
  return { legs, arms, torso, head, neck, bob, lean, greet,
    hairSway: .65 * breath + walk * 2.4 * Math.sin(phase - .85),
    skirtSway:walk * 1.4 * Math.sin(phase - .5), phase };
}

// All grid vertices blend transforms from the same continuous source image.
// Bone endpoints map exactly; the blend band prevents a hard elbow/knee seam.
export function skinVertex(vertex, rest, posed, weights) {
  let x = 0, y = 0;
  for (let index = 0; index < weights.length; index++) {
    const weight = weights[index];
    if (!weight) continue;
    const a = rest[index], b = rest[index + 1], c = posed[index], d = posed[index + 1];
    const rx = b.x - a.x, ry = b.y - a.y, length = Math.hypot(rx, ry);
    const tx = d.x - c.x, ty = d.y - c.y, nextLength = Math.hypot(tx, ty);
    const along = ((vertex.x - a.x) * rx + (vertex.y - a.y) * ry) / (length * length);
    const across = (-(vertex.x - a.x) * ry + (vertex.y - a.y) * rx) / length;
    x += weight * (c.x + along * tx - across * ty / nextLength);
    y += weight * (c.y + along * ty + across * tx / nextLength);
  }
  return point(x, y);
}
