import { chibiPose, skinVertex, smooth } from './base-chibi-gait.js';

function grid(pixi, texture, width, height, rows = 18, columns = 3) {
  const positions = new Float32Array((rows + 1) * (columns + 1) * 2);
  const uvs = new Float32Array(positions.length), rest = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const index = row * (columns + 1) + col;
    uvs[index * 2] = col / columns; uvs[index * 2 + 1] = row / rows;
    positions[index * 2] = col / columns * width; positions[index * 2 + 1] = row / rows * height;
    rest.push({ x:positions[index * 2], y:positions[index * 2 + 1], v:row / rows });
    if (row < rows && col < columns) {
      const a = index, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const mesh = new pixi.SimpleMesh(texture, positions, uvs, new Uint16Array(indices), pixi.DRAW_MODES.TRIANGLES);
  // Canvas triangle antialiasing otherwise leaves bright hairline gaps.
  mesh.canvasPadding = 1;
  return { mesh, rest, update(map) {
    for (let index = 0; index < rest.length; index++) {
      const p = map(rest[index]); positions[index * 2] = p.x; positions[index * 2 + 1] = p.y;
    }
    mesh.geometry.getBuffer('aVertexPosition').update();
  } };
}

function limb(pixi, texture, width, height, points) {
  const item = grid(pixi, texture, width, height, 24);
  const rest = points.map(([x, y]) => ({ x:x * width, y:y * height }));
  const weights = item.rest.map(p => {
    const upper = 1 - smooth(.28, .47, p.v);
    const tip = smooth(.75, .88, p.v);
    return [upper, 1 - upper - tip, tip];
  });
  return { ...item, pose(chain) {
    let index = 0;
    item.update(p => skinVertex(p, rest, chain, weights[index++]));
  } };
}

async function readyImage(image) {
  if (image.complete && image.naturalWidth) return;
  await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once:true });
    image.addEventListener('error', () => reject(new Error('小人素材加载失败')), { once:true });
  });
}

export async function createChibiSkin(host) {
  let pixi = await import('pixi.js');
  if (!pixi.utils.isWebGLSupported()) pixi = await import('pixi.js-legacy');
  const images = [...host.querySelectorAll('.chibi-part')];
  await Promise.all(images.map(readyImage));
  if (!host.isConnected) return null;
  const textures = {};
  for (const image of images) {
    const name = image.className.replace('chibi-part chibi-', '');
    textures[name] = new pixi.Texture(new pixi.BaseTexture(image));
  }
  const app = new pixi.Application({ width:170, height:240, resolution:3, autoDensity:true,
    backgroundAlpha:0, antialias:true, autoStart:false, sharedTicker:false,
    forceCanvas:!pixi.utils.isWebGLSupported() });
  app.view.className = 'chibi-skin';
  app.view.setAttribute('aria-hidden', 'true');
  app.stage.position.set(10, 20);
  const hair = grid(pixi, textures.hair, 100, 140, 18);
  const sword = grid(pixi, textures.sword, 105, 154, 1, 1);
  const body = grid(pixi, textures.body, 76, 78, 12, 4);
  const head = grid(pixi, textures.head, 74, 74, 1, 1);
  const legPoints = [[.64,.025],[.42,.35],[.52,.78],[.25,.98]];
  // Both feet use the same facing boot; the old back boot faced the opposite way.
  const legs = [limb(pixi, textures['leg-front'], 23, 68, legPoints), limb(pixi, textures['leg-front'], 23, 68, legPoints)];
  const armPoints = [[.63,.09],[.45,.48],[.40,.82],[.45,.97]];
  const arms = [limb(pixi, textures['arm-back'], 27, 61, armPoints), limb(pixi, textures['arm-front'], 28, 61, armPoints)];
  legs[0].mesh.tint = 0xe2e8ed;
  app.stage.addChild(hair.mesh, sword.mesh, arms[0].mesh, legs[0].mesh, legs[1].mesh, body.mesh, arms[1].mesh, head.mesh);
  host.querySelector('.chibi-scale').append(app.view);
  let destroyed = false;
  function render(options) {
    if (destroyed) return;
    const pose = chibiPose(options);
    hair.update(p => {
      const weight = smooth(.15, .95, p.v);
      return pose.head({ x:37 + p.x + pose.hairSway * weight, y:-9 + p.y + weight * .25 * pose.hairSway });
    });
    sword.update(p => pose.torso({ x:20 + p.x, y:39 + p.y }));
    legs.forEach((item, index) => item.pose(pose.legs[index].points));
    arms.forEach((item, index) => item.pose(pose.arms[index]));
    body.update(p => pose.torso({ x:39 + p.x + smooth(.43, 1, p.v) * pose.skirtSway, y:76 + p.y }));
    head.update(p => pose.head({ x:39 + p.x, y:10 + p.y }));
    app.render();
    host.dataset.skinPhase = String(pose.phase);
    host.dataset.frontFoot = `${pose.legs[1].points[3].x.toFixed(3)},${pose.legs[1].points[3].y.toFixed(3)}`;
    host.dataset.backFoot = `${pose.legs[0].points[3].x.toFixed(3)},${pose.legs[0].points[3].y.toFixed(3)}`;
    host.dataset.frontPlanted = String(pose.legs[1].planted);
    host.dataset.backPlanted = String(pose.legs[0].planted);
  }
  render({});
  host.dataset.skin = 'true';
  return { render, dispose() {
    if (destroyed) return;
    destroyed = true;
    app.destroy(true, { children:true, texture:false, baseTexture:false });
    for (const texture of Object.values(textures)) texture.destroy(true);
  } };
}
