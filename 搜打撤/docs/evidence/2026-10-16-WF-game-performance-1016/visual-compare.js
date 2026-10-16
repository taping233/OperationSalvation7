import * as before from './brush-baseline.js';
import * as after from '../../../game/src/core/map-brush-art.js';
import { mapTravelCurve } from '../../../game/src/run/map-travel-path.js';

export async function compareRoads() {
  await Promise.all([before.prepareMapBrushArt(), after.prepareMapBrushArt()]);
  const canvases = [before, after].map(api => {
    const canvas=document.createElement('canvas'); canvas.width=640;canvas.height=500;
    const ctx=canvas.getContext('2d');
    for (const [i, points] of [
      [{x:70,y:70},{x:560,y:70}],
      [{x:70,y:180},{x:220,y:300}],
      [{x:360,y:170},{x:560,y:390}],
      [{x:80,y:420},{x:300,y:420}],
    ].entries()) {
      const section=mapTravelCurve(...points);
      api.drawMapBrushRoad(ctx,{section,edgeKey:`visual-${i}`},1);
    }
    return canvas;
  });
  const a=canvases[0].getContext('2d').getImageData(0,0,640,500).data;
  const b=canvases[1].getContext('2d').getImageData(0,0,640,500).data;
  let alphaAbs=0, alphaMax=0, changed=0, painted=0;
  for(let i=3;i<a.length;i+=4){
    const diff=Math.abs(a[i]-b[i]);alphaAbs+=diff;alphaMax=Math.max(alphaMax,diff);
    if(diff>10)changed++;if(a[i]||b[i])painted++;
  }
  const host=document.createElement('section');host.id='perf-road-comparison';
  host.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#122530;display:flex;align-items:center;justify-content:center;gap:10px';
  for(const [i,canvas] of canvases.entries()) {
    const panel=document.createElement('div');panel.style.cssText='color:white;font:18px sans-serif';
    const label=document.createElement('p');label.textContent=i?'优化后道路纹理':'优化前道路纹理';
    panel.append(label,canvas);host.append(panel);
  }
  document.body.append(host);
  return {alphaMeanAbsolute:alphaAbs/(640*500),alphaMeanOnPaint:alphaAbs/painted,
    alphaMax,changedOver10Pixels:changed,paintedPixels:painted};
}
