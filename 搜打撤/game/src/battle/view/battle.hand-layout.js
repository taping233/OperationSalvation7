// StS2 HandPosHelper 的1—9张横向位置；适配本作220px卡面与完整中文身份区。
// 原位置/弧线保持对称，旋转和弧高压为原值的1/4、0.3，给九叠名称留阅读空间。
const POSITIONS = [
  [[0,-50]], [[-100,-50],[100,-50]], [[-180,-50],[0,-59],[180,-50]],
  [[-240,-25],[-80,-50],[80,-50],[240,-25]],
  [[-340,10],[-170,-30],[0,-50],[170,-30],[340,10]],
  [[-460,13],[-273,-25],[-90,-50],[90,-50],[273,-25],[460,13]],
  [[-534,18],[-365,-14],[-189,-39],[0,-50],[189,-39],[365,-14],[534,18]],
  [[-565,28],[-400,-14],[-231,-39],[-80,-50],[80,-50],[231,-39],[400,-14],[565,28]],
  [[-600,37],[-445,-2],[-300,-29],[-150,-45],[0,-50],[150,-45],[300,-29],[445,-2],[600,37]],
];
const ANGLES = [[0],[-2,2],[-3,0,3],[-8,-4,4,8],[-8,-4,0,4,8],[-9,-6,-3,3,6,9],[-9,-6,-3,0,3,6,9],[-12,-9,-6,-3,3,6,9,12],[-12,-9,-6,-3,0,3,6,9,12]];
export function handDisplayLayout(index, count, width) {
  const row = POSITIONS[count - 1];
  if (!row || !row[index]) throw new RangeError('Battle hand layout supports one to nine groups');
  const span = row.at(-1)[0] - row[0][0];
  const fit = span ? Math.min(1.25, Math.max(0, (width - 244) / span)) : 1;
  const [x, y] = row[index];
  const nextX = row[index + 1]?.[0];
  return { x: Math.round(x * fit), y: Math.round((y + 50) * .3),
    rot: ANGLES[count - 1][index] * .25, scale: 1,
    visibleWidth: nextX == null ? 204 : Math.min(204, Math.max(68, Math.floor((nextX - x) * fit) - 14)) };
}
