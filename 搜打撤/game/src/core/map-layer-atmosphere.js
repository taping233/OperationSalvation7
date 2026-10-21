// Presentation only: layer identity stays in the cached backdrop, beneath routes and nodes.
const profiles = [
  { filter:'grayscale(.88) brightness(.38) contrast(1.14)', wash:'rgba(1,10,17,.21)',
    fog:'rgba(49,83,100,.18)', edge:'rgba(67,91,103,.10)', propsFilter:'saturate(.65)',
    props:[ [0,0,.015,.22,330,.31], [1,0,.75,.13,360,.29], [0,1,.11,.65,320,.30], [1,1,.74,.60,360,.30] ] },
  { filter:'grayscale(.86) brightness(.39) contrast(1.12)', wash:'rgba(5,16,29,.22)',
    fog:'rgba(99,151,182,.25)', edge:'rgba(124,167,191,.15)', propsFilter:'saturate(.45) brightness(1.08)',
    props:[ [0,0,.005,.18,350,.36], [1,1,.75,.14,365,.34], [0,1,.08,.67,310,.25], [1,0,.73,.63,390,.32] ] },
  { filter:'grayscale(.85) brightness(.40) contrast(1.18)', wash:'rgba(5,19,19,.23)',
    fog:'rgba(69,119,115,.20)', edge:'rgba(105,147,137,.13)', propsFilter:'saturate(.35) contrast(1.12)',
    props:[ [1,1,-.025,.19,395,.37], [0,1,.77,.20,340,.35], [1,0,.065,.66,370,.32], [1,1,.74,.62,390,.32] ] },
  { filter:'grayscale(.82) brightness(.34) contrast(1.20)', wash:'rgba(12,6,19,.24)',
    fog:'rgba(82,51,100,.19)', edge:'rgba(111,64,119,.16)', propsFilter:'saturate(.35) brightness(.88) contrast(1.18)',
    props:[ [1,1,-.025,.18,405,.29], [1,0,.76,.18,385,.28], [0,1,.09,.66,345,.28], [1,1,.73,.60,405,.32] ] },
];

export function mapLayerAtmosphere(layer = 0) {
  return profiles[layer] || profiles[0];
}

export function drawMapLayerHaze(ctx, w, h, layer) {
  const profile = mapLayerAtmosphere(layer);
  ctx.save();
  ctx.fillStyle = profile.wash;
  ctx.fillRect(0, 0, w, h);
  // Keep haze at the margins: the centre remains quiet for routes and fogged nodes.
  /** @type {Array<[number, number, number, string]>} */
  const hazeStops = [
    [.10,.22,.52,profile.fog], [.94,.58,.43,profile.edge], [.12,.92,.30,profile.edge],
  ];
  for (const [x,y,r,color] of hazeStops) {
    const haze = ctx.createRadialGradient(w*x,h*y,0,w*x,h*y,w*r);
    haze.addColorStop(0,color); haze.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = haze; ctx.fillRect(0,0,w,h);
  }
  // Small irregular pollution seams belong to the frame, never to a traversable road.
  if (layer === 3) {
    ctx.strokeStyle = 'rgba(143,92,153,.16)'; ctx.lineWidth = Math.max(1,w/1100);
    for (const side of [0,1]) {
      const x = side ? w*.96 : w*.035, direction = side ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(x,h*.31);
      ctx.bezierCurveTo(x+direction*w*.035,h*.40,x-direction*w*.018,h*.48,x+direction*w*.025,h*.55);
      ctx.bezierCurveTo(x+direction*w*.055,h*.63,x+direction*w*.015,h*.69,x+direction*w*.035,h*.77);
      ctx.stroke();
    }
  }
  ctx.restore();
}
