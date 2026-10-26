// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createVisualResourceRecovery, watchCriticalImageRecovery } from '../game/src/ui/visual-resource-recovery.js';

const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
let probes,cleanup;
beforeEach(()=>{
  vi.useFakeTimers();probes=[];cleanup=[];
  vi.stubGlobal('Image',class {
    naturalWidth=120;
    removeAttribute(){}
    decode(){return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
    constructor(){probes.push(this);}
  });
});
afterEach(()=>{cleanup.forEach(dispose=>dispose());vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();document.body.replaceChildren();});
function fixture(){
  document.body.innerHTML='<section id="visual"><button hidden>隐藏操作</button><button id="next">继续</button></section>';
  const host=document.getElementById('visual'),apply=vi.fn(),onStatus=vi.fn();
  const recovery=createVisualResourceRecovery({host,source:'/picture.webp',apply,onStatus});
  cleanup.push(recovery.dispose);recovery.fail();
  return {host,apply,onStatus,recovery};
}

it('returns focus after the disabled retry button blurs during successful loading',async()=>{
  const {host,apply}=fixture();
  const retry=host.querySelector('.visual-resource-recovery button');retry.focus();retry.click();retry.blur();
  probes[0].resolve();await flush();
  expect(apply).toHaveBeenCalledOnce();expect(host.querySelector('.visual-resource-recovery')).toBeNull();
  expect(document.activeElement).toBe(document.getElementById('next'));
});

it('does not restore retry focus after another pointer action even when that control later blurs',async()=>{
  const {host}=fixture();
  const retry=host.querySelector('.visual-resource-recovery button');retry.focus();retry.click();retry.blur();
  const other=document.createElement('button');other.textContent='其他操作';document.body.append(other);
  other.dispatchEvent(new Event('pointerdown',{bubbles:true}));other.focus();other.blur();
  probes[0].resolve();await flush();expect(document.activeElement).toBe(document.body);
});

it('page disposal cancels a decode without applying its later result or reporting ready',async()=>{
  const {host,apply,onStatus}=fixture();
  host.querySelector('.visual-resource-recovery button').click();host.remove();await flush();
  probes[0].resolve();await flush();
  expect(apply).not.toHaveBeenCalled();expect(onStatus.mock.calls.map(([status])=>status)).toEqual(['unavailable','loading','cancelled']);
  expect(vi.getTimerCount()).toBe(0);
});

it('a changed srcset creates a new critical recovery before its old observer is delivered',async()=>{
  document.body.innerHTML='<figure><img data-visual-critical src="/picture.webp" alt="图片"></figure>';
  const image=document.querySelector('img');Object.defineProperty(image,'complete',{value:false});
  const first=watchCriticalImageRecovery(image);cleanup.push(first.dispose);
  image.dispatchEvent(new Event('error'));document.querySelector('.visual-resource-recovery button').click();
  image.setAttribute('srcset','/new-picture.webp 2x');
  const second=watchCriticalImageRecovery(image);cleanup.push(second.dispose);
  expect(second).not.toBe(first);
  probes[0].resolve();await flush();
  expect(image.getAttribute('src')).toBe('/picture.webp');expect(image.getAttribute('srcset')).toBe('/new-picture.webp 2x');
  expect(image.dataset.visualState).toBe('unavailable');
});
