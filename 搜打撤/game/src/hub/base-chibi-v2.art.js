// All coordinates are on ONE 1024x1536 setup painting. No part is rescaled.
export const V2_ART = Object.freeze({ width:1024, height:1536, scale:150 / 1024, y:-18,
  pivot:{x:635,y:990}, neck:{x:631,y:625},
  legs:[[[552,1028],[488,1200],[470,1370],[532,1493]], [[651,1035],[652,1200],[665,1364],[734,1478]]],
  arms:[[[479,690],[405,838],[373,997],[363,1056]], [[707,729],[762,872],[808,1010],[829,1064]]],
});
const layers = [
  { name:'weapon', polygons:[[[292,442],[331,435],[392,563],[430,573],[444,587],[384,640],[450,764],[409,774],[365,665],[333,652],[328,627]], [[405,1060],[468,1060],[444,1143],[393,1175],[387,1159]]]},
  { name:'armFront', polygons:[[[394,680],[479,701],[512,755],[490,810],[484,864],[463,927],[444,980],[408,996],[408,1068],[362,1100],[321,1056],[316,1024],[289,1004],[290,970],[321,944],[326,895],[343,836],[379,779],[382,742]]]},
  { name:'armBack', polygons:[[[714,748],[749,721],[777,805],[765,854],[827,904],[850,951],[873,1004],[855,1019],[859,1073],[831,1100],[798,1067],[789,1004],[753,986],[748,941],[721,891]]]},
  { name:'legFront', skinTop:1125, polygons:[[[496,1022],[613,1022],[603,1128],[565,1218],[526,1309],[519,1369],[543,1418],[599,1499],[575,1526],[406,1526],[403,1442],[418,1358],[430,1260],[455,1171],[476,1126]]]},
  { name:'legBack', skinTop:1125, polygons:[[[610,1027],[707,1038],[722,1154],[714,1241],[705,1339],[718,1390],[795,1473],[799,1524],[604,1524],[589,1411],[600,1356],[602,1268],[605,1178]]]},
  { name:'hair', polygons:[[[274,44],[557,44],[592,136],[575,181],[454,235],[438,410],[433,522],[463,651],[388,820],[325,908],[300,990],[358,1076],[397,1155],[470,1289],[390,1338],[238,1296],[64,1140],[35,885],[115,599],[202,312]]]},
];

function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax,ay] = polygon[i], [bx,by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) result = !result;
  }
  return result;
}

// Technical layer extraction copies original RGBA pixels; it does not repaint.
export function splitV2Pixels(pixels, width, height) {
  const ratio = width / V2_ART.width;
  const names = [...layers.map(item => item.name), 'core'];
  const output = Object.fromEntries(names.map(name => [name, new Uint8ClampedArray(pixels.length)]));
  let opaque = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    if (!pixels[at + 3]) continue;
    const px = x / ratio, py = y / ratio;
    const skin = pixels[at] > 115 && pixels[at] > pixels[at + 1] + 8 && pixels[at + 1] > pixels[at + 2] + 5;
    let layer = layers.find(item => (!item.skinTop || py >= item.skinTop || skin)
      && item.polygons.some(polygon => inside(px, py, polygon)));
    const silver=pixels[at]+pixels[at+1]+pixels[at+2]>330&&Math.abs(pixels[at]-pixels[at+1])<14&&pixels[at+2]>=pixels[at]-12;
    if (py>1125 && !skin && silver && inside(px,py,layers[5].polygons[0])) layer=layers[5];
    if (py>1125 && (!layer || layer.name==='core')) layer=layers[px<605?3:4];
    // A hidden garment tip will be covered by the completed thigh layer in motion.
    if (px>=584&&px<=625&&py>=1080&&py<=1140) layer=layers[3];
    output[layer?.name || 'core'].set(pixels.subarray(at, at + 4), at);
    opaque++;
  }
  let mismatches = 0;
  for (let at = 0; at < pixels.length; at += 4) {
    const layer = names.find(name => output[name][at + 3]);
    if (layer && [0,1,2,3].some(channel => output[layer][at + channel] !== pixels[at + channel])) mismatches++;
    if (!layer && pixels[at + 3]) mismatches++;
  }
  return { output, opaque, mismatches, ratio, names };
}

export function v2Pose({ time = 0, distance = 0, walk = 0, reaction = -1, rest = false } = {}, helpers) {
  const { footTarget, solveTwoBone, smooth, mix } = helpers;
  const phase = distance / 29 * Math.PI * 2, breath = Math.sin(time * Math.PI * 2 / 3.2);
  const greet = reaction < 0 ? 0 : smooth(0,.28,reaction) * (1 - smooth(1.15,1.7,reaction));
  const angle = rest ? 0 : walk * .012 * Math.sin(phase) - greet * .012;
  const bob = rest ? 0 : .8 * breath * (1 - walk) + walk * (10 + 3 * Math.cos(phase * 2));
  const rotate = (p, pivot, a) => ({ x:pivot.x + Math.cos(a) * (p.x-pivot.x) - Math.sin(a) * (p.y-pivot.y),
    y:pivot.y + Math.sin(a) * (p.x-pivot.x) + Math.cos(a) * (p.y-pivot.y) });
  const torso = p => { const next = rotate(p, V2_ART.pivot, angle); next.y += bob; return next; };
  const head = p => {
    const strength = rest ? 0 : 1 - smooth(565,695,p.y);
    return torso(rotate(p, V2_ART.neck, strength * (.004 * breath - .008 * walk * Math.sin(phase-.3) - greet * .027)));
  };
  const asPoints = list => list.map(([x,y]) => ({x,y}));
  const legs = V2_ART.legs.map((list,index) => {
    const original = asPoints(list), foot = footTarget(distance,index * .5);
    const center=original[0].x + original[3].x - original[2].x;
    const toe = { x:mix(original[3].x,center,walk) - foot.x * walk / V2_ART.scale, y:original[3].y + foot.y * .65 * walk / V2_ART.scale };
    const ankleVector = { x:original[2].x - original[3].x, y:original[2].y - original[3].y };
    const rolled = rotate(ankleVector, {x:0,y:0}, -.07 * walk * Math.sin(foot.phase * Math.PI * 2));
    const ankle = { x:toe.x + rolled.x, y:toe.y + rolled.y };
    const hip = torso(original[0]);
    const upper = Math.hypot(original[1].x-original[0].x,original[1].y-original[0].y);
    const lower = Math.hypot(original[2].x-original[1].x,original[2].y-original[1].y);
    const chain = solveTwoBone(hip,ankle,upper,lower,-1);
    const points = [...chain,toe].map((p,i) => ({x:mix(torso(original[i]).x,p.x,walk), y:mix(i===3?original[i].y:torso(original[i]).y,p.y,walk)}));
    if (rest) return { rest:original, points:original, planted:true };
    return { rest:original, points, planted:walk ? foot.planted : true };
  });
  const arms = V2_ART.arms.map((list,index) => {
    const original = asPoints(list), points = original.map(torso), shoulder = points[0];
    const upper = walk * .075 * Math.sin(phase + index * Math.PI);
    const wave = index === 0 ? greet : 0;
    for (let i = 1; i < points.length; i++) {
      points[i] = rotate(points[i],shoulder,upper + wave * 1.05);
      if (i >= 2) points[i] = rotate(points[i],points[1],wave * (1.15 + .07 * Math.sin(Math.max(0,reaction-.25)*15)));
    }
    return { rest:original, points:rest?original:points };
  });
  return { torso, head, legs, arms, phase, greet, rest, hair:rest?0:.55*breath + walk * 3.1*Math.sin(phase-.7), skirt:walk*.8*Math.sin(phase-.4) };
}
