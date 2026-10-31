import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickStaticHandRegion, resolveHandHit, readingAccessBands } from '../game/dev/hand-fixed-hit.js';
const regions = [
  { uid: '7', left: 100, right: 260, top: 200, bottom: 440 },
  { uid: '8', left: 180, right: 340, top: 200, bottom: 440 },
];
it('uses the painted face in overlaps and falls back to static slots without a native face', () => {
  for (const actualUid of ['7', '8']) expect(resolveHandHit({ regions, x: 220, y: 300, actualUid })).toEqual({ uid:actualUid, route:'visible-card' });
  expect(resolveHandHit({ regions, x:220, y:300, actualUid:null })).toEqual({ uid:'8', route:'static-region' });
});
it('keeps exclusive visible strips on their own card', () => {
  expect(pickStaticHandRegion(regions, 179, 300)).toBe('7');
  expect(pickStaticHandRegion(regions, 180, 300)).toBe('8');
});
it('uses half-open boundaries without extending or snapping across empty space', () => {
  expect(pickStaticHandRegion(regions, 100, 200)).toBe('7');
  expect(pickStaticHandRegion(regions, 340, 300)).toBeNull();
  expect(pickStaticHandRegion(regions, 220, 440)).toBeNull();
  expect(pickStaticHandRegion(regions, 99, 300)).toBeNull();
  expect(pickStaticHandRegion([], 220, 300)).toBeNull();
});
it('preserves real control ownership even within another static card region', () => {
  expect(resolveHandHit({ regions, x: 220, y: 300, actualUid: '7', interactive: true })).toEqual({ uid: '7', route: 'control' });
});
it('retains real raised-card reading outside the static band', () => {
  expect(resolveHandHit({ regions, x: 220, y: 170, actualUid: '7' })).toEqual({ uid: '7', route: 'visible-card' });
  expect(resolveHandHit({ regions, x: 20, y: 170, actualUid: null })).toEqual({ uid: null, route: 'outside-reading' });
});
it('defaults to the original policy and shares the resolver across ordinary hover/down logging', () => {
  const html = readFileSync('game/dev/hand-pointer-review.html', 'utf8');
  const js = readFileSync('game/dev/hand-pointer-review.js', 'utf8');
  expect(html).toContain('<option value="original">原命中</option><option value="fixed">固定选牌区域</option>');
  expect(js).toContain('createPointerLog(body,output,policyForEvent)');
  expect(js).toContain("if(policySelect.value==='fixed')policyForEvent(e)");
  expect(js).toContain("'button,input,select,textarea,a'");
});

it('keeps the continuous visible-strip to infusion route while preserving the central fixed selection point', () => {
  const regions = [{ uid: '7', left: 659.5, right: 819.3, top: 462.2, bottom: 701.9 },
    { uid: '8', left: 738.1, right: 897.9, top: 462.2, bottom: 701.9 }];
  const accessBands = readingAccessBands({ uid: '7', left: 659.5, right: 819.3, raisedTop: 422.8,
    restDrop: 39.4, cardTop: 422.8, controls: [{ top: 457.2, bottom: 481.8, width: 45, height: 24.6 }] });
  for (const [x,y] of [[718,515],[745,500],[771,480],[784,471]]) {
    expect(resolveHandHit({ regions, x,y, actualUid:'7',ownerUid:'7',accessBands }).uid).toBe('7');
  }
  for (const actualUid of ['7','8']) expect(resolveHandHit({regions,x:792,y:553,actualUid,ownerUid:'7',accessBands})).toEqual({uid:actualUid,route:'visible-card'});
});
it('derives stable access bounds during lift, excludes zero-size controls and does not extend beyond card width', () => {
  const args={uid:'7',left:100,right:260,raisedTop:200,restDrop:64};
  const lifted=readingAccessBands({...args,cardTop:200,controls:[{top:256,bottom:296,width:60,height:40}]});
  const moving=readingAccessBands({...args,cardTop:232,controls:[{top:288,bottom:328,width:60,height:40},{top:0,bottom:0,width:0,height:0}]});
  expect(moving).toEqual(lifted); expect(lifted).toEqual([{uid:'7',left:100,right:260,top:256,bottom:360}]);
  expect(resolveHandHit({regions,x:270,y:300,actualUid:'8',ownerUid:'7',accessBands:lifted}).uid).toBe('8');
});

it('re-exports the production policy rather than maintaining a second fixture implementation', async () => {
  const production = await import('../game/src/battle/view/battle.hand-hit.js');
  expect(resolveHandHit).toBe(production.resolveHandHit);
  expect(readingAccessBands).toBe(production.readingAccessBands);
  expect(pickStaticHandRegion).toBe(production.pickStaticHandRegion);
});
