import { expect, it } from 'vitest';
import { normalizeBaseState } from '../game/src/hub/base-state.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();

it('normalizes array commit metadata before JSON can discard its revision and receipts', () => {
  const state = normalizeBaseState({_m01:[]});
  expect(Array.isArray(state._m01)).toBe(false);
  state._m01.revision = 1;
  state._m01.requests.request = {fingerprint:'payment', result:{ok:true}};
  const reloaded = normalizeBaseState(JSON.parse(JSON.stringify(state)));
  expect(reloaded._m01).toEqual({revision:1, requests:{request:{fingerprint:'payment', result:{ok:true}}}});
});

it.each([null, false, 2, 'bad'])('normalizes invalid metadata %j into a serializable object', value => {
  expect(normalizeBaseState({_m01:value})._m01).toEqual({revision:0, requests:{}});
});

it('retains valid commit identity and idempotent receipts', () => {
  const metadata = {revision:7, requests:{request:{fingerprint:'original', result:{ok:true}}}};
  expect(normalizeBaseState({_m01:structuredClone(metadata)})._m01).toEqual(metadata);
});

it('commits once and replays the same receipt after loading a repaired array metadata save', async () => {
  window.SDT ||= {Icons:{img:() => ''}};
  window.SDT.Icons ||= {img:() => ''};
  await import('../game/src/hub/base.js');
  const {readBase, commitBase, readBaseReceipt} = await import('../game/src/hub/base.commands.js');
  const base = window.SDT.Base;
  localStorage.clear();
  localStorage.setItem(base.SLOT_KEY(1), JSON.stringify({version:2, coins:10, _m01:[]}));
  base.use(1);
  const before = readBase(1);
  expect(before.revision).toBe(0);
  const context = {slotId:1, requestId:'metadata-repair', expectedRevision:0};
  const afterState = structuredClone(before.value);
  afterState.coins -= 2;
  const first = await commitBase(context, {command:'metadata-test', beforeRevision:0, afterState, payload:{price:2}});
  expect(first.ok).toBe(true);
  base.use(1);
  expect(readBase(1).value.coins).toBe(8);
  expect(readBaseReceipt(context, {command:'metadata-test', payload:{price:2}})).toEqual(first);
  expect(readBase(1).revision).toBe(1);
});
