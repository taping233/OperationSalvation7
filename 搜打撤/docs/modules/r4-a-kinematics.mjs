import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canvas = { width: 928, height: 760, margin: 12 };
const pivot = { x: 320, y: 731 };
const sword = {
  grip: { x: 457, y: 258 },
  idleTip: { x: 438, y: 719 },
};
const toes = {
  far: { x: 273, y: 735 },
  near: { x: 383, y: 735 },
};
const rig = {
  shoulderFar: { x: 255, y: 163 }, elbowFar: { x: 298, y: 218 }, wristFar: { x: 432, y: 249 },
  shoulderNear: { x: 390, y: 169 }, elbowNear: { x: 411, y: 224 }, wristNear: { x: 457, y: 249 },
  hipFar: { x: 286, y: 383 }, kneeFar: { x: 280, y: 524 }, ankleFar: { x: 273, y: 655 },
  hipNear: { x: 350, y: 383 }, kneeNear: { x: 359, y: 518 }, ankleNear: { x: 368, y: 655 },
};
const handOffsets = {
  far: { x: -25, y: -9 },
  near: { x: 0, y: -9 },
};

const actionSamples = [
  { id: 'atk-00', angle: 0, pelvis: [0, 0], chest: [0, 0] },
  { id: 'atk-01', angle: 12, pelvis: [-2, 3], chest: [1, 0] },
  { id: 'atk-02', angle: 32, pelvis: [-3, 4], chest: [2, -2] },
  { id: 'atk-03', angle: 48, pelvis: [-4, 4], chest: [4, -3] },
  { id: 'atk-04', angle: 58, pelvis: [-5, 4], chest: [6, -3] },
  { id: 'atk-05', angle: 0, pelvis: [0, 3], chest: [2, -3] },
  { id: 'atk-06', angle: -42, pelvis: [5, 2], chest: [13, -4] },
  { id: 'atk-07', angle: -72, pelvis: [7, 2], chest: [18, -4] },
  { id: 'atk-08', angle: -24, pelvis: [2, 1], chest: [6, -1] },
  { id: 'atk-09', angle: 0, pelvis: [0, 0], chest: [0, 0] },
];

const poses = [
  { id: 'idle', label: '待机', angle: 0, pelvis: [0, 0], chest: [0, 0] },
  { id: 'windup', label: '蓄力', angle: 58, pelvis: [-5, 4], chest: [6, -3] },
  { id: 'hit', label: '命中', angle: -72, pelvis: [7, 2], chest: [18, -4] },
  { id: 'recovery', label: '回收', angle: -24, pelvis: [2, 1], chest: [6, -1] },
];

const round = (n, digits = 3) => Number(n.toFixed(digits));
const rotate = (v, degrees) => {
  const a = degrees * Math.PI / 180;
  return {
    x: v.x * Math.cos(a) - v.y * Math.sin(a),
    y: v.x * Math.sin(a) + v.y * Math.cos(a),
  };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const add = (point, offset) => ({ x: point.x + offset[0], y: point.y + offset[1] });
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const solveTwoBone = (start, target, upperLength, lowerLength, bendSign) => {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const rawDistance = Math.hypot(dx, dy);
  const minReach = Math.abs(upperLength - lowerLength);
  const maxReach = upperLength + lowerLength;
  const reachable = rawDistance >= minReach - 1e-6 && rawDistance <= maxReach + 1e-6;
  const solvedDistance = Math.min(maxReach, Math.max(minReach, rawDistance));
  const ux = rawDistance ? dx / rawDistance : 1;
  const uy = rawDistance ? dy / rawDistance : 0;
  const along = (upperLength ** 2 - lowerLength ** 2 + solvedDistance ** 2) / (2 * solvedDistance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const joint = {
    x: start.x + ux * along - uy * height * bendSign,
    y: start.y + uy * along + ux * height * bendSign,
  };
  const solvedEnd = { x: start.x + ux * solvedDistance, y: start.y + uy * solvedDistance };
  return {
    reachable,
    joint,
    solvedEnd,
    targetErrorPx: distance(solvedEnd, target),
    upperLengthErrorPx: Math.abs(distance(start, joint) - upperLength),
    lowerLengthErrorPx: Math.abs(distance(joint, solvedEnd) - lowerLength),
  };
};
const swordVector = { x: sword.idleTip.x - sword.grip.x, y: sword.idleTip.y - sword.grip.y };
const swordLength = distance(sword.grip, sword.idleTip);
const axis = { x: swordVector.x / swordLength, y: swordVector.y / swordLength };
const normal = { x: -axis.y, y: axis.x };
const swordShape = [
  ['pommelLeft', -46, 9], ['pommelRight', -46, -9],
  ['guardLeft', -5, 45], ['guardRight', -5, -45],
  ['bladeBaseLeft', 20, 32], ['bladeBaseRight', 20, -32],
  ['tipLeft', swordLength, 5], ['tipRight', swordLength, -5],
];

const evaluatePose = (pose) => {
  const tipDelta = rotate(swordVector, pose.angle);
  const tip = { x: sword.grip.x + tipDelta.x, y: sword.grip.y + tipDelta.y };
  const corners = Object.fromEntries(swordShape.map(([id, along, across]) => {
    const local = { x: axis.x * along + normal.x * across, y: axis.y * along + normal.y * across };
    const turned = rotate(local, pose.angle);
    return [id, { x: sword.grip.x + turned.x, y: sword.grip.y + turned.y }];
  }));
  const points = Object.values(corners);
  const boundsOk = points.every((point) => point.x >= canvas.margin && point.x <= canvas.width - canvas.margin
    && point.y >= canvas.margin && point.y <= canvas.height - canvas.margin);
  const wristTargets = Object.fromEntries(Object.entries(handOffsets).map(([id, offset]) => {
    const targetDelta = rotate(offset, pose.angle);
    const target = { x: sword.grip.x + targetDelta.x, y: sword.grip.y + targetDelta.y };
    // The greybox rounds exported joint coordinates to whole pixels, as the frame exporter will.
    const exported = { x: Math.round(target.x), y: Math.round(target.y) };
    return [id, { target, exported }];
  }));
  const armDefinitions = {
    far: ['shoulderFar', 'elbowFar', 'wristFar'],
    near: ['shoulderNear', 'elbowNear', 'wristNear'],
  };
  const arms = Object.fromEntries(Object.entries(armDefinitions).map(([id, [shoulderId, elbowId, wristId]]) => {
    const shoulder = add(rig[shoulderId], pose.chest);
    const upper = distance(rig[shoulderId], rig[elbowId]);
    const lower = distance(rig[elbowId], rig[wristId]);
    const bendSign = Math.sign(cross(rig[shoulderId], rig[wristId], rig[elbowId])) || 1;
    return [id, { shoulder, target: wristTargets[id].target, upper, lower,
      ...solveTwoBone(shoulder, wristTargets[id].target, upper, lower, bendSign) }];
  }));
  const legDefinitions = {
    far: ['hipFar', 'kneeFar', 'ankleFar'],
    near: ['hipNear', 'kneeNear', 'ankleNear'],
  };
  const legs = Object.fromEntries(Object.entries(legDefinitions).map(([id, [hipId, kneeId, ankleId]]) => {
    const hip = add(rig[hipId], pose.pelvis);
    const upper = distance(rig[hipId], rig[kneeId]);
    const lower = distance(rig[kneeId], rig[ankleId]);
    const ankleToToe = { x: toes[id].x - rig[ankleId].x, y: toes[id].y - rig[ankleId].y };
    const ankleTarget = { x: toes[id].x - ankleToToe.x, y: toes[id].y - ankleToToe.y };
    const bendSign = Math.sign(cross(rig[hipId], rig[ankleId], rig[kneeId])) || 1;
    const solution = solveTwoBone(hip, ankleTarget, upper, lower, bendSign);
    const solvedToe = { x: solution.solvedEnd.x + ankleToToe.x, y: solution.solvedEnd.y + ankleToToe.y };
    return [id, { hip, ankleTarget, solvedToe, upper, lower, footErrorPx: distance(solvedToe, toes[id]), ...solution }];
  }));
  return {
    ...pose,
    sword: {
      grip: sword.grip,
      tip,
      corners,
      lengthPx: distance(sword.grip, tip),
      boundsOk,
    },
    arms,
    legs,
  };
};
const results = poses.map(evaluatePose);
const sampledAction = actionSamples.map(evaluatePose);

const frameBudget = { idle: 6, attack: 10 };
const rgbaBytes = canvas.width * canvas.height * 4 * (frameBudget.idle + frameBudget.attack);
const report = {
  schemaVersion: 1,
  purpose: 'R4-a deterministic greybox kinematics validation; not final art',
  canvas,
  pivot,
  sourceToRigTranslation: { x: -44, y: 16 },
  rig,
  convention: 'angle is a clockwise-positive rotation from the source idle sword vector',
  sourceMeasurement: {
    swordGrip: sword.grip,
    swordTip: sword.idleTip,
    swordVector,
    swordLengthPx: round(distance(sword.grip, sword.idleTip)),
  },
  frameBudget: {
    ...frameBudget,
    total: frameBudget.idle + frameBudget.attack,
    rawRgbaBytes: rgbaBytes,
    rawRgbaMiB: round(rgbaBytes / 1024 / 1024),
    reference30x512x760MiB: round(30 * 512 * 760 * 4 / 1024 / 1024),
  },
  poses: results.map((result) => ({
    id: result.id,
    angleDeg: result.angle,
    pelvisOffsetPx: result.pelvis,
    chestOffsetPx: result.chest,
    sword: {
      grip: result.sword.grip,
      tip: { x: round(result.sword.tip.x), y: round(result.sword.tip.y) },
      corners: Object.fromEntries(Object.entries(result.sword.corners).map(([id, point]) => [id, {
        x: round(point.x), y: round(point.y),
      }])),
      lengthPx: round(result.sword.lengthPx),
      boundsOk: result.sword.boundsOk,
    },
    arms: Object.fromEntries(Object.entries(result.arms).map(([id, arm]) => [id, {
      reachable: arm.reachable, targetErrorPx: round(arm.targetErrorPx),
      shoulder: { x: round(arm.shoulder.x), y: round(arm.shoulder.y) },
      elbow: { x: round(arm.joint.x), y: round(arm.joint.y) },
      wrist: { x: round(arm.solvedEnd.x), y: round(arm.solvedEnd.y) },
      upperLengthErrorPx: round(arm.upperLengthErrorPx), lowerLengthErrorPx: round(arm.lowerLengthErrorPx),
    }])),
    legs: Object.fromEntries(Object.entries(result.legs).map(([id, leg]) => [id, {
      reachable: leg.reachable, footErrorPx: round(leg.footErrorPx),
      hip: { x: round(leg.hip.x), y: round(leg.hip.y) },
      knee: { x: round(leg.joint.x), y: round(leg.joint.y) },
      ankle: { x: round(leg.solvedEnd.x), y: round(leg.solvedEnd.y) },
      toe: { x: round(leg.solvedToe.x), y: round(leg.solvedToe.y) },
      upperLengthErrorPx: round(leg.upperLengthErrorPx), lowerLengthErrorPx: round(leg.lowerLengthErrorPx),
    }])),
  })),
  actionSamples: sampledAction.map((result) => ({
    id: result.id, angleDeg: result.angle, swordBoundsOk: result.sword.boundsOk,
    swordCorners: Object.fromEntries(Object.entries(result.sword.corners).map(([id, point]) => [id, { x: round(point.x), y: round(point.y) }])),
    arms: Object.fromEntries(Object.entries(result.arms).map(([id, arm]) => [id, {
      reachable: arm.reachable, targetErrorPx: round(arm.targetErrorPx),
      shoulder: { x: round(arm.shoulder.x), y: round(arm.shoulder.y) },
      elbow: { x: round(arm.joint.x), y: round(arm.joint.y) },
      wrist: { x: round(arm.solvedEnd.x), y: round(arm.solvedEnd.y) },
      upperLengthErrorPx: round(arm.upperLengthErrorPx), lowerLengthErrorPx: round(arm.lowerLengthErrorPx),
    }])),
    legs: Object.fromEntries(Object.entries(result.legs).map(([id, leg]) => [id, {
      reachable: leg.reachable, footErrorPx: round(leg.footErrorPx),
      hip: { x: round(leg.hip.x), y: round(leg.hip.y) },
      knee: { x: round(leg.joint.x), y: round(leg.joint.y) },
      ankle: { x: round(leg.solvedEnd.x), y: round(leg.solvedEnd.y) },
      toe: { x: round(leg.solvedToe.x), y: round(leg.solvedToe.y) },
      upperLengthErrorPx: round(leg.upperLengthErrorPx), lowerLengthErrorPx: round(leg.lowerLengthErrorPx),
    }])),
  })),
};

const reportPath = path.join(here, 'R4-A-RIG-KINEMATICS.json');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const panelW = canvas.width / 4;
const scale = 0.245;
const svgPanels = results.map((result, index) => {
  const ox = index * panelW;
  const sx = (x) => round(ox + x * scale, 2);
  const sy = (y) => round(34 + y * scale, 2);
  const pelvis = { x: 317 + result.pelvis[0], y: 377 + result.pelvis[1] };
  const chest = { x: 319 + result.chest[0], y: 203 + result.chest[1] };
  const head = { x: chest.x + 3, y: chest.y - 104 };
  const armLines = Object.values(result.arms).map((arm) =>
    `<polyline points="${sx(arm.shoulder.x)},${sy(arm.shoulder.y)} ${sx(arm.joint.x)},${sy(arm.joint.y)} ${sx(arm.solvedEnd.x)},${sy(arm.solvedEnd.y)}" fill="none" stroke="#ffd166" stroke-width="3"/>`).join('');
  const legLines = Object.values(result.legs).map((leg) =>
    `<polyline points="${sx(leg.hip.x)},${sy(leg.hip.y)} ${sx(leg.joint.x)},${sy(leg.joint.y)} ${sx(leg.solvedEnd.x)},${sy(leg.solvedEnd.y)} ${sx(leg.solvedToe.x)},${sy(leg.solvedToe.y)}" fill="none" stroke="#7dd3fc" stroke-width="4"/>`).join('');
  const swordPolygon = ['pommelLeft', 'pommelRight', 'guardRight', 'bladeBaseRight', 'tipRight', 'tipLeft', 'bladeBaseLeft', 'guardLeft']
    .map((id) => `${sx(result.sword.corners[id].x)},${sy(result.sword.corners[id].y)}`).join(' ');
  return `<g>
    <rect x="${ox + 1}" y="1" width="${panelW - 2}" height="218" rx="5" fill="#17212b" stroke="#52606d"/>
    <text x="${ox + 9}" y="20" fill="#e8edf2" font-size="12">${result.label} ${result.angle > 0 ? '+' : ''}${result.angle}°</text>
    <line x1="${sx(canvas.margin)}" y1="${sy(0)}" x2="${sx(canvas.margin)}" y2="${sy(canvas.height)}" stroke="#334553" stroke-dasharray="3 3"/>
    <line x1="${sx(canvas.width - canvas.margin)}" y1="${sy(0)}" x2="${sx(canvas.width - canvas.margin)}" y2="${sy(canvas.height)}" stroke="#334553" stroke-dasharray="3 3"/>
    <line x1="${sx(toes.far.x)}" y1="${sy(toes.far.y)}" x2="${sx(toes.near.x)}" y2="${sy(toes.near.y)}" stroke="#9aa8b4" stroke-width="3"/>
    <line x1="${sx(pelvis.x)}" y1="${sy(pelvis.y)}" x2="${sx(chest.x)}" y2="${sy(chest.y)}" stroke="#7dd3fc" stroke-width="5"/>
    <line x1="${sx(chest.x)}" y1="${sy(chest.y)}" x2="${sx(head.x)}" y2="${sy(head.y)}" stroke="#7dd3fc" stroke-width="4"/>
    <circle cx="${sx(head.x)}" cy="${sy(head.y - 18)}" r="8" fill="none" stroke="#7dd3fc" stroke-width="3"/>
    ${legLines}
    <polygon points="${swordPolygon}" fill="#f59e0b" fill-opacity="0.42" stroke="#fbbf24" stroke-width="1.2"/>
    <circle cx="${sx(result.sword.grip.x)}" cy="${sy(result.sword.grip.y)}" r="3" fill="#fff"/>
    ${armLines}
    <circle cx="${sx(pivot.x)}" cy="${sy(pivot.y)}" r="3" fill="#fb7185"/>
  </g>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="928" height="220" viewBox="0 0 928 220">
  <rect width="928" height="220" fill="#0b1118"/>
  ${svgPanels}
</svg>\n`;
fs.writeFileSync(path.join(here, 'R4-A-RIG-POSES.svg'), svg);

const failures = report.poses.flatMap((pose) => {
  const errors = [];
  if (!pose.sword.boundsOk) errors.push(`${pose.id}: sword polygon out of safe bounds`);
  if (Object.values(pose.legs).some((leg) => !leg.reachable || leg.footErrorPx > 1)) errors.push(`${pose.id}: leg IK failed`);
  if (Object.values(pose.arms).some((arm) => !arm.reachable || arm.targetErrorPx > 1)) errors.push(`${pose.id}: arm IK failed`);
  return errors;
});
for (const sample of report.actionSamples) {
  if (!sample.swordBoundsOk) failures.push(`${sample.id}: sword polygon out of safe bounds`);
  if (Object.values(sample.legs).some((leg) => !leg.reachable || leg.footErrorPx > 1)) failures.push(`${sample.id}: leg IK failed`);
  if (Object.values(sample.arms).some((arm) => !arm.reachable || arm.targetErrorPx > 1)) failures.push(`${sample.id}: arm IK failed`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS ${reportPath}`);
}
