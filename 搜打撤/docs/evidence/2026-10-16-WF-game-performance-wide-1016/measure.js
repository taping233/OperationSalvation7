// Development-only instrumentation in this task's disposable built-in browser tab.
let active = null;
export function begin(label) {
  if (active) throw new Error('capture already active');
  const sample = {label, started:performance.now(), reads:0, writes:0, longTasks:[], stacks:{}, originalRect:Element.prototype.getBoundingClientRect};
  Element.prototype.getBoundingClientRect = function(...args) {
    sample.reads++;
    if (sample.reads < 20 || sample.reads % 50 === 0) {
      const stack=new Error().stack.split('\n').slice(2,5).join('\n');
      sample.stacks[stack]=(sample.stacks[stack]||0)+1;
    }
    return sample.originalRect.apply(this,args);
  };
  sample.observer=new PerformanceObserver(list=>sample.longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration}))));
  sample.observer.observe({type:'longtask'});
  active=sample;
  return {label,visible:!document.hidden};
}
export function end() {
  const s=active;if(!s)throw new Error('no capture');
  Element.prototype.getBoundingClientRect=s.originalRect;s.observer.disconnect();active=null;
  return {label:s.label,elapsed:performance.now()-s.started,reads:s.reads,longTasks:s.longTasks,
    stacks:s.stacks,nodes:document.querySelectorAll('*').length,images:document.images.length,
    heap:performance.memory?.usedJSHeapSize,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
}
