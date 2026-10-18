// Read-only DOM diagnostics. Results are geometry observations, never a visual pass.
export function inspectVisibleLayout(root) {
  const doc=root.ownerDocument, win=doc.defaultView;
  const selectors='.event-decisions,.node-main,.node-foot,.ui-design-system,button,summary,.ui-facts';
  const report={viewport:{width:win.innerWidth,height:win.innerHeight},checked:0,issues:[]};
  for(const element of root.querySelectorAll(selectors)){
    const rect=element.getBoundingClientRect(),style=win.getComputedStyle(element);
    if(!element.getClientRects().length||style.visibility==='hidden'||rect.width<1||rect.height<1)continue;
    report.checked++;
    const label=(element.getAttribute('aria-label')||element.textContent||element.className).trim().replace(/\s+/g,' ').slice(0,70);
    if(element.scrollWidth>element.clientWidth+2&&!['auto','scroll'].includes(style.overflowX))report.issues.push({type:'horizontal-overflow',label});
    if(!element.matches('button,summary'))continue;
    // Scrollable does not mean currently visible. Keep checking outer clips:
    // an inner scroll port may itself extend beyond a hidden ancestor.
    let visible={left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
    for(let parent=element.parentElement;parent;parent=parent.parentElement){
      const css=win.getComputedStyle(parent),p=parent.getBoundingClientRect();
      for(const [axis,start,end] of [['X','left','right'],['Y','top','bottom']]){
        const overflow=css[`overflow${axis}`]||css.overflow;
        if(!['auto','scroll','hidden','clip'].includes(overflow))continue;
        if(visible[start]<p[start]-2||visible[end]>p[end]+2){
          report.issues.push({type:['auto','scroll'].includes(overflow)?'action-outside-scrollport':'action-clipped',label,axis:axis.toLowerCase(),ancestor:parent.className||parent.tagName.toLowerCase()});
        }
        visible={...visible,[start]:Math.max(visible[start],p[start]),[end]:Math.min(visible[end],p[end])};
      }
    }
    if(rect.left<-2||rect.top<-2||rect.right>win.innerWidth+2||rect.bottom>win.innerHeight+2)report.issues.push({type:'action-outside-viewport',label});
  }
  return report;
}
