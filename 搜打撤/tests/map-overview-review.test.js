import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../game/src/core/renderer.js',async()=>{
  const {default:SDT}=await import('../game/src/core/sdt-facade.js');
  SDT.Renderer={draw:vi.fn(),warm:vi.fn(async()=>{})};return {};
});
describe('map overview fixture wiring',()=>{
  it('uses real camera and toolbar while keeping all progress in fixed fixture memory',async()=>{
    const html=readFileSync('game/dev/map-overview-review.html','utf8');
    document.body.innerHTML=html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g,'');
    const canvas=document.querySelector('canvas');
    canvas.getBoundingClientRect=()=>({width:1180,height:664,left:0,right:1180,top:0,bottom:664});
    canvas.getContext=()=>({setTransform:vi.fn()});
    vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));
    await import('../game/dev/map-overview-review.js');
    document.querySelector('[data-expedition-tool="overview"]').click();
    document.querySelector('[data-review="check"]').click();
    expect(document.querySelector('output').textContent).toContain('可见中心 24/24');
    document.querySelector('[data-review="inset"]').click();
    document.querySelector('[data-review="check"]').click();
    expect(document.querySelector('output').textContent).toContain('可见中心 24/24');
    document.querySelector('[data-review="hide"]').click();
    expect(document.querySelector('.map-review-tools').hidden).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(document.querySelector('.map-review-tools').hidden).toBe(false);
    const source=readFileSync('game/dev/map-overview-review.js','utf8');
    expect(source).not.toMatch(/main\.js|game\.session|saveGame|Sound/);
    expect(html).toContain("Object.defineProperty(window,'localStorage'");
    vi.unstubAllGlobals();
  });
});
