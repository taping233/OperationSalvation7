// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('game/assets/asset-manifest.json'));
// Pinned final WebP fingerprints from the two original creation receipts.
// This is a nine-file repository contract, not a fixture or a global asset audit.
const cases = [
  [
    "scenes/map-environment-1021/outskirts-simple.webp",
    76516,
    "0f3e4d1b3173c0fc2091c70434a11257058debd07afd8faf690ed381f6babddc",
    "docs/evidence/2026-10-21-map-decoration/assets.json",
    "game/src/core/map-city-atmosphere.js",
    "老板授权生成的项目环境素材；Codex内置ImageGen生成；来源见同目录README.md与prompts.json"
  ],
  [
    "scenes/map-environment-1021/watchline-simple.webp",
    82298,
    "d416aa3db47e9e005f2119d8b8fd48fb2383ed89533d228e6d1dc0b977663e9f",
    "docs/evidence/2026-10-21-map-decoration/assets.json",
    "game/src/core/map-city-atmosphere.js",
    "老板授权生成的项目环境素材；Codex内置ImageGen生成；来源见同目录README.md与prompts.json"
  ],
  [
    "scenes/map-environment-1021/ruins-simple.webp",
    109466,
    "336eeb81ef44d3f07f3727bde6266f28e3af1b1e12c23138630135c410d116e7",
    "docs/evidence/2026-10-21-map-decoration/assets.json",
    "game/src/core/map-city-atmosphere.js",
    "老板授权生成的项目环境素材；Codex内置ImageGen生成；来源见同目录README.md与prompts.json"
  ],
  [
    "scenes/map-environment-1021/core-simple.webp",
    109614,
    "66c7c6d0207b355cd3228b092d0e8bb36c652af297343172e81929e7cc4f3260",
    "docs/evidence/2026-10-21-map-decoration/assets.json",
    "game/src/core/map-city-atmosphere.js",
    "老板授权生成的项目环境素材；Codex内置ImageGen生成；来源见同目录README.md与prompts.json"
  ],
  [
    "ui/map-tools-1021/bag-v2.webp",
    10368,
    "19d0258ea69363be8fd57a19222bb8368b5e4dfcb32c08203b547c65701850fd",
    "docs/evidence/2026-10-21-map-floating-tools/icons.json",
    "game/src/run/expedition-tool-art.js",
    "老板授权生成的地图工具图标；Codex内置ImageGen生成；方舟节点图仅作画法参考，不直接使用原作资源（据同目录README.md与prompts.json）"
  ],
  [
    "ui/map-tools-1021/safe-v2.webp",
    11276,
    "82bb782a889bc8c3797eef5f65116a9825c74bf4e6963b1bebb857f347caa775",
    "docs/evidence/2026-10-21-map-floating-tools/icons.json",
    "game/src/run/expedition-tool-art.js",
    "老板授权生成的地图工具图标；Codex内置ImageGen生成；方舟节点图仅作画法参考，不直接使用原作资源（据同目录README.md与prompts.json）"
  ],
  [
    "ui/map-tools-1021/pocket-v2.webp",
    11268,
    "0e49c66ff29f2427a42c238528b831cf63c7e1e6610a62c0b75d77a58641719b",
    "docs/evidence/2026-10-21-map-floating-tools/icons.json",
    "game/src/run/expedition-tool-art.js",
    "老板授权生成的地图工具图标；Codex内置ImageGen生成；方舟节点图仅作画法参考，不直接使用原作资源（据同目录README.md与prompts.json）"
  ],
  [
    "ui/map-tools-1021/focus-v2.webp",
    10640,
    "e6737899cd522e9da9044a9256c76ed55cc9580eb7dff1125afa58e08da0893a",
    "docs/evidence/2026-10-21-map-floating-tools/icons.json",
    "game/src/run/expedition-tool-art.js",
    "老板授权生成的地图工具图标；Codex内置ImageGen生成；方舟节点图仅作画法参考，不直接使用原作资源（据同目录README.md与prompts.json）"
  ],
  [
    "ui/map-tools-1021/overview-v2.webp",
    11076,
    "c9cb6db4b607061901372c919177fdcbabe0fc30a06f3bf4877563a21fcc312f",
    "docs/evidence/2026-10-21-map-floating-tools/icons.json",
    "game/src/run/expedition-tool-art.js",
    "老板授权生成的地图工具图标；Codex内置ImageGen生成；方舟节点图仅作画法参考，不直接使用原作资源（据同目录README.md与prompts.json）"
  ]
];

describe('2026-10-21 map asset registration (nine-file scope only)', () => {
  it('keeps the manifest count consistent after adding the nine registrations', () => {
    expect(cases).toHaveLength(9);
    expect(new Set(cases.map(([assetPath]) => assetPath)).size).toBe(9);
    expect(manifest.count).toBe(manifest.assets.length);
    // 1601 existing entries + 9 additions; allow later independently registered assets.
    expect(manifest.count).toBeGreaterThanOrEqual(1610);
  });

  it.each(cases)('registers %s against its original receipt and current URL reference',
    (assetPath, bytes, sha256, source, reference, license) => {
      const registrations = manifest.assets.filter(entry => entry.path === assetPath);
      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toEqual({ path: assetPath, ext: 'webp', bytes, sha256, license, source });
      const receipts = JSON.parse(read(source)).filter(entry => entry.path === `game/assets/${assetPath}`);
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ path: `game/assets/${assetPath}`, bytes, sha256 });
      expect(receipts[0].sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(read(reference)).toContain(`new URL('../../assets/${assetPath}',`);
    });

  it.each(cases)('matches the real regular-file bytes for %s (not the whole tree)',
    (assetPath, bytes, sha256) => {
      const file = new URL(`../game/assets/${assetPath}`, import.meta.url);
      // Do not let a symlink-backed verification snapshot masquerade as a regular checkout.
      expect(lstatSync(file).isFile()).toBe(true);
      const actual = readFileSync(file);
      expect(actual.length).toBe(bytes);
      expect(createHash('sha256').update(actual).digest('hex')).toBe(sha256);
    });
});
