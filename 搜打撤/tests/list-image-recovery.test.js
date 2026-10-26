// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createListImageRecovery } from '../game/src/ui/list-image-recovery.js';

const flush = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };
let cleanup;
afterEach(() => { cleanup?.(); cleanup=null; vi.unstubAllGlobals(); document.body.replaceChildren(); });
function fixture(count=1, options={}) {
  const probes=[];
  vi.stubGlobal('Image',class {
    naturalWidth=120;
    removeAttribute() {}
    decode() { return new Promise((resolve,reject) => { this.resolve=resolve;this.reject=reject; }); }
    constructor() { probes.push(this); }
  });
  document.body.innerHTML=`<section id="list"><div class="cards">${Array.from({length:count},(_,i)=>`<button data-browser-key="${i}"><div class="hsc-art"><img data-asset-key="card-${i}" src="/card-${i}.webp"></div></button>`).join('')}</div><footer></footer></section>`;
  const root=document.getElementById('list'),images=[...root.querySelectorAll('img')];
  const recovery=createListImageRecovery({root,host:root.querySelector('footer'),...options});
  cleanup=recovery.dispose;
  images.forEach(image=>image.dispatchEvent(new Event('error')));
  return {root,images,probes,recovery};
}
it('offers one optional list control, retries at most four images together, and preserves card controls',async()=>{
  const {root,images,probes}=fixture(6);
  expect(root.querySelectorAll('.list-image-recovery')).toHaveLength(1);
  const retry=root.querySelector('.list-image-recovery button');
  expect(retry.closest('[data-browser-key]')).toBeNull();
  retry.focus();retry.click();retry.click();
  retry.blur(); // Browsers may blur a newly disabled retry control to body.
  expect(probes).toHaveLength(4);
  expect(retry.disabled).toBe(true);
  probes[0].resolve();await flush();
  expect(probes).toHaveLength(5);
  probes[1].resolve();await flush();
  expect(probes).toHaveLength(6);
  probes.slice(2).forEach(probe=>probe.resolve());await flush();
  expect(root.querySelector('.list-image-recovery')).toBeNull();
  expect(images.every(image=>image.dataset.visualState==='ready')).toBe(true);
  expect(probes.map(probe=>probe.src)).toEqual(images.map((_,i)=>`/card-${i}.webp`));
  expect(root.querySelectorAll('[data-browser-key]')).toHaveLength(6);
  expect(document.activeElement.closest('[data-browser-key]')).not.toBeNull();
});
it('a failed manual attempt remains retryable without automatically starting a new request',async()=>{
  const {root,probes}=fixture();
  root.querySelector('.list-image-recovery button').click();
  probes[0].reject(new Error('offline'));await flush();
  expect(probes).toHaveLength(1);
  expect(root.querySelector('.list-image-recovery button').disabled).toBe(false);
  root.querySelector('.list-image-recovery button').click();
  expect(probes).toHaveLength(2);
});
it('successful recovery does not take focus back after the user operates another control',async()=>{
  const {root,probes}=fixture();
  const retry=root.querySelector('.list-image-recovery button');retry.focus();retry.click();retry.blur();
  const next=document.createElement('button');next.textContent='其他操作';document.body.append(next);
  next.dispatchEvent(new Event('pointerdown',{bubbles:true}));next.focus();
  probes[0].resolve();await flush();
  expect(document.activeElement).toBe(next);
});
it.each(['source','page'])('late completion after changing %s cannot replace the new content or steal focus',async change=>{
  const {root,images,probes}=fixture();
  root.querySelector('.list-image-recovery button').click();
  if(change==='source') images[0].src='/new-card.webp';else root.remove();
  const next=document.createElement('button');next.textContent='下一页';document.body.append(next);next.focus();
  await flush();probes[0].resolve();await flush();
  expect(images[0].getAttribute('src')).toBe(change==='source'?'/new-card.webp':'/card-0.webp');
  expect(document.activeElement).toBe(next);
  expect(root.querySelector('.list-image-recovery')).toBeNull();
});

it.each(['remove','src','data-lib-src'])('releases all four active slots after %s and continues queued images',async change=>{
  const onRecovered=vi.fn();
  const {root,images,probes}=fixture(8,{onRecovered,source:image=>image.dataset.libSrc||image.getAttribute('src')||''});
  root.querySelector('.list-image-recovery button').click();
  expect(probes).toHaveLength(4);
  images.slice(0,4).forEach((image,index)=>{
    if(change==='remove')image.closest('button').remove();
    else if(change==='src')image.setAttribute('src',`/new-${index}.webp`);
    else image.dataset.libSrc=`/new-${index}.webp`;
  });
  await flush();
  expect(probes).toHaveLength(8);
  expect(probes.slice(4).map(probe=>probe.src)).toEqual(images.slice(4).map(image=>image.getAttribute('src')));
  probes.slice(0,4).forEach(probe=>probe.resolve());await flush();
  expect(onRecovered).not.toHaveBeenCalled();
  expect(images.slice(0,4).every(image=>image.dataset.visualState==='unavailable')).toBe(true);
  probes.slice(4).forEach(probe=>probe.resolve());await flush();
  expect(onRecovered.mock.calls.map(([image])=>image)).toEqual(images.slice(4));
  expect(root.querySelector('.list-image-recovery')).toBeNull();
});

it('a replacement failure releases its old slot but waits for another explicit retry',async()=>{
  const {root,images,probes,recovery}=fixture(6);
  root.querySelector('.list-image-recovery button').click();
  images[0].setAttribute('src','/replacement.webp');
  recovery.fail(images[0]);
  await flush();
  expect(probes).toHaveLength(5);expect(probes[4].src).toBe('/card-4.webp');
  probes[0].resolve();await flush();
  expect(images[0].getAttribute('src')).toBe('/replacement.webp');
  expect(images[0].dataset.visualState).toBe('unavailable');
  probes.slice(1).forEach(probe=>probe.resolve());await flush();
  expect(probes).toHaveLength(6);
  probes[5].resolve();await flush();
  const retry=root.querySelector('.list-image-recovery button');
  expect(retry.disabled).toBe(false);expect(probes).toHaveLength(6);
  retry.click();expect(probes).toHaveLength(7);expect(probes[6].src).toBe('/replacement.webp');
});

it('a failed attempt frees a slot while remaining an explicit retry after the queue drains',async()=>{
  const {root,probes}=fixture(5);
  const retry=root.querySelector('.list-image-recovery button');retry.click();
  probes[0].reject(new Error('offline'));await flush();
  expect(probes).toHaveLength(5);expect(retry.disabled).toBe(true);
  probes.slice(1).forEach(probe=>probe.resolve());await flush();
  expect(retry.disabled).toBe(false);expect(probes).toHaveLength(5);
  retry.click();expect(probes).toHaveLength(6);expect(probes[5].src).toBe('/card-0.webp');
});

it('disposing a partially active queue keeps old completions from starting more work',async()=>{
  const onRecovered=vi.fn();
  const {root,probes,recovery}=fixture(9,{onRecovered});
  root.querySelector('.list-image-recovery button').click();
  const lateError=probes[0].onerror;
  recovery.dispose();
  lateError();probes.forEach(probe=>probe.resolve());await flush();
  expect(probes).toHaveLength(4);expect(onRecovered).not.toHaveBeenCalled();
  expect(root.querySelector('.list-image-recovery')).toBeNull();
});

it('restores retry focus to an available card control when the recovered card is disabled',async()=>{
  const {root,images,probes}=fixture(2);
  images[0].closest('button').hidden=true;images[1].closest('button').disabled=true;
  const next=document.createElement('button');next.textContent='可用操作';root.append(next);
  const retry=root.querySelector('.list-image-recovery button');retry.focus();retry.click();retry.blur();
  probes.forEach(probe=>probe.resolve());await flush();
  expect(document.activeElement).toBe(next);
});
