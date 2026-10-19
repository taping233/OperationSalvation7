import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Resolve through Stryker's actual client, rather than accidentally testing
// the unrelated top-level qs while a vulnerable nested copy remains installed.
const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve('@stryker-mutator/core'));
const clientRequire = createRequire(coreRequire.resolve('typed-rest-client'));
const qs = clientRequire('qs');

test('Stryker client resolves the patched qs 6.x dependency', () => {
  const [major, minor] = clientRequire('qs/package.json').version.split('.').map(Number);
  assert.equal(major, 6);
  assert.ok(minor >= 16);
});

test('comma stringification tolerates null and undefined entries', () => {
  for (const value of [null, undefined]) {
    assert.doesNotThrow(() => qs.stringify({ a: [value, 'b'] }, {
      arrayFormat: 'comma', encodeValuesOnly: true,
    }));
  }
});

test('bracket-key comma arrays enforce the configured array limit', () => {
  assert.throws(() => qs.parse('a[]=1,2,3,4', {
    comma: true, arrayLimit: 3, throwOnLimitExceeded: true,
  }), RangeError);
});

test('untrusted isBuffer properties cannot break query serialization', () => {
  const parsed = qs.parse('x[constructor][isBuffer]=y', { plainObjects: true });
  assert.doesNotThrow(() => qs.stringify(parsed));
});

test('ordinary nested and repeated query parameters keep their contract', () => {
  const input = { search: 'snow & ice', page: '2', filter: { kind: 'card' }, tag: ['a', 'b'] };
  assert.deepEqual(qs.parse(qs.stringify(input)), input);
});

test('the actual REST client builds ordinary and nullable comma queries', () => {
  const clientUtil = coreRequire('typed-rest-client/Util.js');
  assert.equal(clientUtil.getUrl('/reports', 'https://example.invalid/api/', {
    params: { tag: ['a', 'b'], query: 'snow & ice' },
  }), 'https://example.invalid/reports?tag=a&tag=b&query=snow%20%26%20ice');
  assert.doesNotThrow(() => clientUtil.getUrl('/reports', 'https://example.invalid/', {
    params: { tag: [null, 'b'] }, options: { arrayFormat: 'comma' },
  }));
});
