(() => {
  const probe = window.__photoPerf = { actions: [], reads: [], longTasks: [], animations: [], restore: [] };
  let current = null;
  const finish = record => requestAnimationFrame(() => requestAnimationFrame(() => {
    record.presentMs = performance.now() - record.start;
    record.end = performance.now(); record.done = true;
  }));
  window.addEventListener('click', event => {
    const button = event.target.closest('#btnCardLib,#libType0,#libType1');
    if (!button) return;
    const record = { action: button.id, start: performance.now(), done: false, viewport: {width:innerWidth,height:innerHeight,dpr:devicePixelRatio} };
    current = record; probe.actions.push(record);
    if (button.id !== 'btnCardLib') finish(record);
  }, true);
  const mutation = new MutationObserver(() => {
    if (current?.action === 'btnCardLib' && !current.scheduled && document.querySelector('.card-library-page')) {
      current.scheduled = true; finish(current);
    }
  });
  mutation.observe(document.body, { childList: true, subtree: true });
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) probe.longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
  observer.observe({ entryTypes: ['longtask'] });
  const originalBg = window.SDT.UI._checkPageBg;
  window.SDT.UI._checkPageBg = function(...args) {
    const start = performance.now();
    try { return originalBg.apply(this,args); }
    finally { probe.reads.push({ read: '_checkPageBg', start, duration: performance.now()-start }); }
  };
  probe.restore.push(() => window.SDT.UI._checkPageBg=originalBg);
  for (const [proto,keys] of [[HTMLElement.prototype,['offsetWidth','offsetHeight','offsetLeft','offsetTop']],[Element.prototype,['clientWidth','clientHeight']]]) {
    for (const key of keys) {
      const descriptor=Object.getOwnPropertyDescriptor(proto,key);
      if (!descriptor?.get || !descriptor.configurable) continue;
      Object.defineProperty(proto,key,{...descriptor,get() {
        const start=performance.now();
        try { return descriptor.get.call(this); }
        finally { const duration=performance.now()-start; if(duration>1)probe.reads.push({read:key,start,duration,stack:new Error().stack}); }
      }});
      probe.restore.push(()=>Object.defineProperty(proto,key,descriptor));
    }
  }
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
    if(this.id==='libGrid')probe.animations.push({id:this.id,frames,options});
    return animate.call(this,frames,options);
  };
  probe.restore.push(()=>Element.prototype.animate=animate);
  probe.wait=async()=>{const last=probe.actions.at(-1); if(!last)return null;for(let i=0;i<120&&!last.done;i++)await new Promise(requestAnimationFrame);return last;};
  probe.snapshot=()=>({viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},actions:probe.actions,reads:probe.reads,longTasks:probe.longTasks,animations:probe.animations});
  probe.stop=()=>{probe.restore.forEach(fn=>fn());mutation.disconnect();observer.disconnect();};
  return {installed:true};
})()
