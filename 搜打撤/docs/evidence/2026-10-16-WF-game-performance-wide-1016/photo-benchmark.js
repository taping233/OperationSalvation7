const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function renderBenchmark(path,rounds=5) {
  const page=await import(/* @vite-ignore */ path);
  const common=await import('/src/hub/game.cardslib.common.js');
  if(document.querySelector('.card-library-page')) {common.closeCardPageTop();await sleep(350);}
  const samples=[], longTasks=[];
  const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration}))));
  observer.observe({type:'longtask'});
  for(let i=0;i<rounds;i++) {
    const start=performance.now();page.openCardLibrary();const mounted=performance.now();
    const grid=document.getElementById('libGrid');grid.getBoundingClientRect();const laidOut=performance.now();
    await page.preparePhotoStudioEntry();const ready=performance.now();
    if(grid.children.length < 15 || !grid.querySelector('img')) throw new Error('benchmark invalid: empty gallery');
    samples.push({syncMs:mounted-start,layoutMs:laidOut-mounted,readyMs:ready-start,
      mountedImages:grid.querySelectorAll('img').length,shells:grid.children.length});
    await sleep(120);
    common.closeCardPageTop();await sleep(350);
  }
  observer.disconnect();
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},samples,longTasks,
    note:'Direct page mount + explicit layout/readiness in a disposable tab; excludes facade/cut duration; synthetic calls, no save writes.'};
}
