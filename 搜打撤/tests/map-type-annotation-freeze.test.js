// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

// 2026-10-27: only chest diagnostic wording changed to 搜刮点; route generation is retained.
// JSDoc type expansion must preserve the pre-expansion algorithm, independently
// of the companion byte fingerprints. Baseline proof: hubrun-I03-frozen-ast.json.
const algorithmHashes = {
  "game/src/run/map-generator.js": "cde01f4691021325de5cc2dad6b4191807e6c59684d682c2f5795bfdb0879bf4",
  "game/src/run/layeredMap.js": "a44384329ca3a58773dfa3c01e5c72dd3d2df9c7f4a1419a0e0285425455af54",
  "game/src/ui/route-overlay.js": "025e039f7f51c39ac9b3b5ce258106170ae2d17f2f1770b5c1edc3b5328ba083"
};
const discardSyntaxMetadata = (key, value) => ['start', 'end', 'loc', 'raw'].includes(key) ? undefined : value;

describe('地图兼容算法独立于类型注释保持冻结', () => {
  it.each(Object.entries(algorithmHashes))('%s retains the exact runtime AST', (path, expected) => {
    const ast = parse(readFileSync(path, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    const hash = createHash('sha256').update(JSON.stringify(ast, discardSyntaxMetadata)).digest('hex');
    expect(hash).toBe(expected);
  });
});
