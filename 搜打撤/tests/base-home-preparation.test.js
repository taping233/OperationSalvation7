import { expect, it, vi } from 'vitest';
import { baseHomeV3HTML } from '../game/src/hub/hub.home-v3.js';
import { bindBasePageMotionV7 } from '../game/src/hub/base-page-motion-v7.js';

it('未整备和已保留的整备状态都在同一操作区显示，难度与出征入口不分离', () => {
  const base = { data:{ stash:[], pocket:[], ammoTaught:true } };
  const options = { base, meta:{ pendingColl:() => [], pendingAch:() => [] }, modes:{standard:{id:'standard'}}, mode:'standard', character:{name:'无'}, picks:8 };
  for (const prepared of [false,true]) {
    document.body.innerHTML = baseHomeV3HTML({ ...options, prepared });
    const panel = document.querySelector('.base-home-preparation');
    expect(panel.querySelector('#btnDeploy').dataset.act).toBe('deploy');
    expect(panel.querySelector('[aria-label="行动难度"]')).not.toBeNull();
    expect(panel.querySelector('.base-home-ready-facts').textContent).toContain(prepared ? '无' : '待选择');
    expect(panel.textContent).toContain(prepared ? '8 张' : '待配置');
  }
  document.body.replaceChildren();
});

it('首页只移动整备与事务，固定导航不参与分批入场', () => {
  const original = Element.prototype.animate;
  const animate = vi.fn(() => ({ cancel() {}, finished:new Promise(() => {}) }));
  Element.prototype.animate = animate;
  vi.stubGlobal('matchMedia', () => ({ matches:false, addEventListener() {}, removeEventListener() {} }));
  document.body.innerHTML = '<div class="base-frame-v7"><main class="hub-page" data-view="deploy"><div class="base-home-v7"><aside class="base-home-affairs"></aside><section class="base-home-preparation"></section></div></main><nav class="base-navigation-v7"><button class="hub-tab on" data-tab="deploy">基地</button></nav></div>';
  try {
    const dispose = bindBasePageMotionV7(document.querySelector('.base-frame-v7'));
    expect(animate.mock.instances.every(node => !node.matches('.hub-tab'))).toBe(true);
    expect(animate.mock.instances.some(node => node.matches('.base-home-preparation'))).toBe(true);
    dispose();
  } finally { Element.prototype.animate = original; vi.unstubAllGlobals(); document.body.replaceChildren(); }
});
