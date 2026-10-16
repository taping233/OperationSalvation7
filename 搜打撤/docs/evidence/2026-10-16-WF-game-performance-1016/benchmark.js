import { mapNodeStatus, isConsumedMapNode } from '../../../game/src/core/map-node-state.js';

// Synthetic, repeatable workload in the current built-in browser; no game/save mutation.
export async function benchmark() {
  const nodes = Array.from({ length: 48 }, (_, idx) => ({ li: 0, idx,
    x: (idx % 8) * 190, y: Math.floor(idx / 8) * 190, def: { type: idx % 3 ? 'battle' : 'blank' } }));
  const game = { nodes, layerIdx: 0, trackPos: 0, nodePos: [nodes],
    layerData: [{ logical: nodes.map((n, idx) => ({ def: n.def,
      next: [idx % 8 < 7 && [0, idx + 1], idx < 40 && [0, idx + 8]].filter(Boolean) })) }],
    visited: Object.fromEntries(nodes.map(n => [`0,${n.idx}`, 1])), seen: {},
    toggles: { index: false }, time: 0,
    cam: { viewW: innerWidth, viewH: innerHeight, zoom: 1.25, cx: 400, cy: 350,
      worldToScreen(x,y) { return {x:(x-this.cx)*this.zoom+this.viewW/2, y:(y-this.cy)*this.zoom+this.viewH/2}; } } };
  for (let i=0;i<300;i++) game[`runtimeField${i}`] = i;
  const canvas = document.createElement('canvas'); canvas.width=innerWidth; canvas.height=innerHeight;
  const ctx=canvas.getContext('2d');
  await window.SDT.Renderer.warm();
  const output={viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}, nodes:nodes.length, runtimeFields:300};
  const measure=(name,run,count)=>{
    const times=[];
    run(0);
    for(let round=0;round<5;round++) {
      const t=performance.now(); for(let i=0;i<count;i++)run(i);
      times.push((performance.now()-t)/count);
    }
    output[name]={medianMs:[...times].sort((a,b)=>a-b)[2], roundsMs:times, iterations:count};
  };
  measure('nodeProjection48',()=>{for(const n of nodes){mapNodeStatus(game,n);isConsumedMapNode(game,n);}},100);
  measure('steadyDraw',()=>window.SDT.Renderer.draw(ctx,game),30);
  measure('zoomDraw',i=>{game.cam.zoom=1+(i%20)*.025;window.SDT.Renderer.draw(ctx,game);},40);
  return output;
}
