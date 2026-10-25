import { beforeAll, beforeEach, expect, it } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();

let Base, Art, selectSkin, readBase;
beforeAll(async () => {
  window.SDT ||= {Icons:{img:() => ''}};
  window.SDT.Icons ||= {img:() => ''};
  await import('../game/src/cards/cards.js');
  await import('../game/src/core/art.js');
  ({readBase} = await import('../game/src/hub/base.commands.js'));
  ({selectSkin} = await import('../game/src/hub/collection.commands.js'));
  ({Base, Art} = window.SDT);
});
beforeEach(async () => {
  localStorage.clear(); Base.use(1); await Base.save(); Art.setSkin('wu','default');
});
const context = requestId => ({slotId:1,requestId,expectedRevision:readBase(1).revision});

it('replaying an old real skin receipt never reverses a later saved choice in Art', async () => {
  const firstContext=context('first-skin');
  const first=await selectSkin(firstContext,{characterId:'wu',skinId:'casual'});
  expect(first.ok).toBe(true); expect(Art.getSkin('wu')).toBe('casual');
  expect((await selectSkin(context('later-skin'),{characterId:'wu',skinId:'default'})).ok).toBe(true);
  expect(Art.getSkin('wu')).toBe('default');
  const saved=localStorage.getItem(Base.SLOT_KEY(1));
  const replay=await selectSkin(firstContext,{characterId:'wu',skinId:'casual'});
  expect(replay).toEqual(first);
  expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(saved);
  expect(Base.data.appearance.selectedSkins.wu).toBe('default');
  expect(Art.getSkin('wu')).toBe('default');
});

it('replaying the current choice still restores the matching runtime skin without another save', async () => {
  const request=context('current-skin');
  const first=await selectSkin(request,{characterId:'wu',skinId:'casual'});
  const saved=localStorage.getItem(Base.SLOT_KEY(1));
  Art.setSkin('wu','default');
  expect(await selectSkin(request,{characterId:'wu',skinId:'casual'})).toEqual(first);
  expect(Art.getSkin('wu')).toBe('casual');
  expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(saved);
});

it('selecting an unlocked legacy skin with missing artwork uses its promised default fallback', async () => {
  await selectSkin(context('initial-art'),{characterId:'wu',skinId:'casual'});
  Base.data.appearance.characterSkins.wu=['legacy-missing-art'];
  await Base.save();
  const result=await selectSkin(context('missing-art'),{characterId:'wu',skinId:'legacy-missing-art'});
  expect(result).toMatchObject({ok:true,value:{selectedSkinId:'legacy-missing-art',assetFallback:true,fallbackSkinId:'default'}});
  expect(Base.data.appearance.selectedSkins.wu).toBe('legacy-missing-art');
  expect(Art.getSkin('wu')).toBe('default');
});
