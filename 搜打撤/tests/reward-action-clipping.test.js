import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it, vi } from 'vitest';
import { inspectVisibleLayout } from '../game/dev/visible-layout-check.js';

afterEach(()=>{vi.restoreAllMocks();document.body.innerHTML='';});
const rect=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});
function fixture({outer=rect(0,0,400,200),scroll=rect(0,0,400,200),action=rect(10,180,150,226),axis='Y',overflow='auto'}={}){
  document.body.innerHTML='<section class="outer"><main><div class="scroll"><button>腾位置领取</button></div></main></section>';
  const root=document.querySelector('main'),button=root.querySelector('button'),port=root.querySelector('.scroll'),clip=root.parentElement;
  for(const [element,box] of [[clip,outer],[port,scroll],[button,action]])vi.spyOn(element,'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(button,'getClientRects').mockReturnValue([action]);
  vi.spyOn(window,'getComputedStyle').mockImplementation(element=>({visibility:'visible',overflowX:element===port&&axis==='X'?overflow:element===clip?'hidden':'visible',overflowY:element===port&&axis==='Y'?overflow:element===clip?'hidden':'visible'}));
  return root;
}
it('reports actions below an auto scrollport rather than passing AX-present buttons',()=>{
  const report=inspectVisibleLayout(fixture());
  expect(report.issues).toContainEqual(expect.objectContaining({type:'action-outside-scrollport',label:'腾位置领取',axis:'y'}));
});
it('continues beyond an inner scrollport and beyond fixture root to the clipping ancestor',()=>{
  const report=inspectVisibleLayout(fixture({scroll:rect(0,0,400,300)}));
  expect(report.issues).toContainEqual(expect.objectContaining({type:'action-clipped',ancestor:'outer'}));
});
it('detects horizontal action clipping too',()=>{
  const report=inspectVisibleLayout(fixture({scroll:rect(0,0,100,200),action:rect(80,10,160,50),axis:'X',overflow:'hidden'}));
  expect(report.issues).toContainEqual(expect.objectContaining({type:'action-clipped',axis:'x'}));
});
it('accepts a fully contained action and never changes scroll positions or DOM',()=>{
  const root=fixture({action:rect(10,140,150,186)}),before=root.outerHTML;
  expect(inspectVisibleLayout(root).issues).toEqual([]);
  expect(root.outerHTML).toBe(before);expect(root.querySelector('.scroll').scrollTop).toBe(0);
});
it('picker preserves readable card width and its own scroll fallback with a separate action row',()=>{
  const css=postcss.parse(readFileSync('game/css/chest-reward-overview.css','utf8'));
  const values=selector=>{const result={};css.walkRules(rule=>{if(rule.selectors.includes(`body #overlay .card .cqo-frame .cqp-dialog ${selector}`))rule.walkDecls(d=>result[d.prop]=d.value);});return result;};
  expect(values('.reward-stage')).toMatchObject({'container-type':'size',flex:'1 1 0',overflow:'auto'});
  expect(values('.reward-objects')).toMatchObject({flex:'none','min-height':'100%','overflow-x':'auto'});
  expect(values('.reward-unit .reward-card')['--reward-card-space']).toBe('clamp(8px,calc((100cqh - 480px) / 2),30px)');
  const faceWidth = '280px';
  expect(values('.reward-unit .reward-card')['max-width']).toBe(faceWidth);
  expect(values('.reward-unit:has(.reward-target-label) .reward-card')['max-width']).toBe(faceWidth);
  expect(values('.reward-unit .reward-card .hs-card')['aspect-ratio']).toBe('2/3');
  expect(values('.reward-replica[data-reward-count] .reward-unit .reward-card')['margin-block']).toBe('var(--reward-card-space)');
  expect(values('.reward-claim')['min-height']).toBe('46px');
  expect(values('.reward-unit .reward-card')['min-width']).toBe(faceWidth);
  expect(values('.reward-objects:has(> .reward-unit:nth-child(5))')['grid-auto-columns']).toBe(faceWidth);
});
