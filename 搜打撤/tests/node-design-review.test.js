import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectVisibleLayout } from '../game/dev/visible-layout-check.js';

describe('lightweight node design review fixture',()=>{
  it('runs production pure views without game bootstrap or persistence',async()=>{
    const html=readFileSync('game/dev/node-design-review.html','utf8');
    document.body.innerHTML=html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g,'');
    const {nodeReviewScene}=await import('../game/dev/node-design-review.js');
    expect(nodeReviewScene('fireFull').body).toContain('将复原 0 张');
    expect(nodeReviewScene('fireEmpty').body).toContain('可复原 <b>0 张');
    expect(nodeReviewScene('altarLocked').body).toContain('碎片不足');
    expect(nodeReviewScene('rewardEmpty').body).toContain('此项不可选');
    expect(nodeReviewScene('entry').body).toContain('全部领取后才能继续');
    const source=readFileSync('game/dev/node-design-review.js','utf8');
    expect(source).not.toMatch(/localStorage|sessionStorage|main\.js|Sound|game\.session|saveGame/);
    expect(document.querySelector('.fire-rest-plan')).not.toBeNull();
    expect(document.querySelector('details').open).toBe(false);
    document.querySelector('[data-act="fireRestGo"]').click();
    expect(document.querySelector('#reviewOutput').textContent).toContain('不执行授予');
  });
  it('geometry diagnostics do not mutate content or state',()=>{
    document.body.innerHTML='<main><button>行动</button><details><summary>说明</summary><p>内容</p></details></main>';
    const root=document.querySelector('main'), before=root.outerHTML;
    expect(inspectVisibleLayout(root)).toEqual({viewport:{width:window.innerWidth,height:window.innerHeight},checked:0,issues:[]});
    expect(root.outerHTML).toBe(before);
  });
});
