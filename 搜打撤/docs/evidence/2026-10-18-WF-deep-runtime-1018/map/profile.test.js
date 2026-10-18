import { test, expect, vi } from 'vitest';
import fs from 'node:fs';
import inspector from 'node:inspector';
import { performance } from 'node:perf_hooks';
const folder = '.tmp/deep-perf-1018/map';
const noop = () => {};
let trace = null;
let calls = 0;
function context() {
  const methods = new Map();
  return new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({width: String(text).length * 6});
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({addColorStop: noop});
    if (!methods.has(key)) methods.set(key, (...args) => { calls++; if (trace) trace.push([key, ...args.map(a => typeof a === 'object' ? (a?.commands || a?.src || 'object') : a)]); });
    return methods.get(key);
  }, set(target, key, value) { target[key] = value; if (trace) trace.push(['set',key,value]); return true; } });
}
function percentile(values, q) { return [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)]; }
test('actual generated map draw profile', async () => {
  vi.stubGlobal('Image', class { complete=true; naturalWidth=512; naturalHeight=512; width=512; height=512; src=''; });
  vi.stubGlobal('Path2D', class { commands=[]; moveTo(...a){this.commands.push(['moveTo',...a]);} quadraticCurveTo(...a){this.commands.push(['quadraticCurveTo',...a]);} bezierCurveTo(...a){this.commands.push(['bezierCurveTo',...a]);} lineTo(...a){this.commands.push(['lineTo',...a]);} closePath(){this.commands.push(['closePath']);} addPath(p){this.commands.push(['addPath',p.commands]);} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(context);
  window.SDT = { Motion: {reduceMotion:()=>true} };
  const { game } = await import('../../../game/src/run/game.session.kernel.js');
  const { buildNewRunDerived } = await import('../../../game/src/run/game.session.map.js');
  buildNewRunDerived('deep-runtime-1018-map');
  game.layerIdx=game.layerData.reduce((best,layer,i,layers)=>layer.logical.length>layers[best].logical.length?i:best,0); const li=game.layerIdx;
  game.trackPos=game.layerData[li].entrances[0];
  game.seen={}; game.visited={}; game.state='idle'; game.runActive=false; game.time=100;
  game.toggles={index:false}; game.pos={...game.nodePos[li][game.trackPos]};
  const bounds=game.layerBounds[li];
  game.cam={viewW:1280,viewH:800,cx:(bounds.minX+bounds.maxX)/2,cy:(bounds.minY+bounds.maxY)/2,zoom:.75,
    worldToScreen(x,y){return {x:(x-this.cx)*this.zoom+this.viewW/2,y:(y-this.cy)*this.zoom+this.viewH/2};}};
  await import('../../../game/src/core/renderer.js?deepbaseline');
  const baseline=window.SDT.Renderer;
  await import('../../../game/src/core/renderer.js');
  const candidate=window.SDT.Renderer;
  const ctx=context();
  const report={environment:{node:process.version,platform:process.platform,arch:process.arch},scope:'Actual generated v5 map; largest real layer, real renderer/node/road modules; jsdom with controlled canvas/Image. Measures JavaScript, excludes browser layout/raster/GPU.',layer:li,layerNodeCounts:game.layerData.map(l=>l.logical.length),nodes:game.layerData[li].logical.length, totalNodes:game.nodes.length,scenarios:{}};
  function draw(renderer, scenario, i) {
    game.cam.zoom=scenario==='geometry'?.35+(i%20)*.075:scenario==='zoom'?.65+(i%90)*.004:.85;
    game.cam.cx=(bounds.minX+bounds.maxX)/2+(scenario==='pan'?Math.sin(i/20)*300:0);
    game.moveTarget=['selection','geometry'].includes(scenario)?{li,idx:(i%game.layerData[li].logical.length)}:null;
    renderer.draw(ctx,game);
  }
  for (const scenario of ['pan','zoom','selection']) {
    for(let i=0;i<100;i++){draw(baseline,scenario,i);draw(candidate,scenario,i);}
    const samples={baseline:[],candidate:[]},cpu={baseline:0,candidate:0};
    for(let batch=0;batch<30;batch++)for(const label of batch%2?['candidate','baseline']:['baseline','candidate']) {
      const renderer=label==='baseline'?baseline:candidate;
      const start=performance.now(), usage=process.cpuUsage();
      for(let i=0;i<30;i++)draw(renderer,scenario,i+batch*30);
      const elapsed=performance.now()-start,u=process.cpuUsage(usage);
      samples[label].push(elapsed/30);cpu[label]+=(u.user+u.system)/1000;
    }
    report.scenarios[scenario]=Object.fromEntries(Object.entries(samples).map(([label,values])=>[label,{medianMs:percentile(values,.5),p95Ms:percentile(values,.95),cpuMsPerDraw:cpu[label]/900}]));
  }
  const brush=await import('../../../game/src/core/map-brush-art.js');
  const roadSpy=vi.spyOn(brush,'drawMapBrushRoad');
  const previous={baseline:new Map(),candidate:new Map()},rebakes={baseline:0,candidate:0};
  const snapshots=(renderer,label,i,scenario='selection')=>{
    roadSpy.mockClear();draw(renderer,scenario,i);
    const result=roadSpy.mock.calls.map(([,road,scale,options])=>{
      if(scenario==='selection'&&previous[label].get(road.edgeKey)!==road.section)rebakes[label]++;
      previous[label].set(road.edgeKey,road.section);
      return JSON.parse(JSON.stringify({edgeKey:road.edgeKey,curve:road.curve,section:road.section,start:road.start,end:road.end,scale,alpha:options?.alpha}));
    });
    return result;
  };
  let geometryCases=0;
  for(let i=0;i<80;i++){
    const idx=i%report.nodes,key=`${li},${idx}`;
    if(i%10===0)game.visited[key]=1;
    if(i%10===5)delete game.visited[key];
    if(i%12===0)game.entrySupply={layerIdx:li,trackPos:idx,cardIds:['a','b'],taken:[]};
    if(i%12===3)game.entrySupply.taken.push(0,1);
    expect(snapshots(candidate,'candidate',i)).toEqual(snapshots(baseline,'baseline',i));geometryCases++;
  }
  for(let i=0;i<80;i++){expect(snapshots(candidate,'candidate',i,'geometry')).toEqual(snapshots(baseline,'baseline',i,'geometry'));geometryCases++;}
  report.equivalence={geometryCases,includes:'zoom .35–1.775, selection changes, in-place visited changes, pending and completed entry supply; exact numeric curve/clip/alpha equality',selectionSectionChanges:rebakes};
  roadSpy.mockRestore();
  const session=new inspector.Session(); session.connect();
  const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(err,result)=>err?reject(err):resolve(result)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval',{interval:100}); await post('Profiler.start');
  for(let i=0;i<1600;i++)draw(baseline,'zoom',i);
  const {profile}=await post('Profiler.stop');session.disconnect();
  fs.writeFileSync(`${folder}/baseline.cpuprofile`,JSON.stringify(profile));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const hits=new Map();
  for(const id of profile.samples||[]){const n=nodes.get(id),k=`${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url}:${n.callFrame.lineNumber+1}`;hits.set(k,(hits.get(k)||0)+1);}
  report.cpuTop=[...hits].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([frame,samples])=>({frame,samples}));
  fs.writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  baseline.dispose();candidate.dispose();
  expect(report.nodes).toBeGreaterThan(0);
});
