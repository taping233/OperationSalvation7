// @vitest-environment node
import { expect, it } from 'vitest';
import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';

const keys = {base:'base', run:'run', journal:'journal'};
const journal = () => ({version:1, txId:'tx', slotId:1, requestId:'request', command:'test', fingerprint:'same', runId:'run',
  expectedBaseRevision:0, expectedRunRevision:0, before:{baseRaw:'old-base', runRaw:'old-run'},
  after:{baseRaw:'new-base', runRaw:'new-run'}, receipt:{ok:true, revision:1}, phase:'prepared'});

it.each(['base', 'run'])('rejects already-stale %s without leaving a journal that blocks future work', field => {
  const data = new Map([['base','old-base'], ['run','old-run']]);
  data.set(field, 'third-value');
  const storage = {getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value), removeItem:key => data.delete(key)};
  const pair = createRecoverablePair({storage, keyFor:() => keys});
  const before = new Map(data);
  expect(pair.commit(1, journal())).toMatchObject({ok:false, code:'RECOVERY_BLOCKED'});
  expect(data).toEqual(before);
  expect(pair.readJournal(1)).toEqual({ok:true, value:null});
  data.set(field, field === 'base' ? 'old-base' : 'old-run');
  expect(createRecoverablePair({storage,keyFor:() => keys}).commit(1,journal()).ok).toBe(true);
  expect(data.get('base')).toBe('new-base');
  expect(data.get('run')).toBe('new-run');
  expect(data.has('journal')).toBe(false);
});

it('does not start a journal when preflight cannot read the current pair', () => {
  let writes = 0;
  const storage = {getItem:key => {if (key === 'base') throw Error('read'); return null;}, setItem:() => writes++, removeItem:() => writes++};
  expect(createRecoverablePair({storage,keyFor:() => keys}).commit(1,journal())).toMatchObject({ok:false, code:'STORAGE_READ_FAILED'});
  expect(writes).toBe(0);
});
