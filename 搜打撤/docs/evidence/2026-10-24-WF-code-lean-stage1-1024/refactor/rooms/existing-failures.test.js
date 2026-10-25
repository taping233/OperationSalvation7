import fs from 'node:fs';
import { expect, it, vi } from 'vitest';
const before = 'node_modules/.cache/lean-refactor-1024/before/';

it('the icon implementation and every local dependency are byte-identical to the frozen source', () => {
  for(const file of ['icons-bitmap','semantic-icons','asset-url','shared','icon-hydration','sdt-facade']) {
    const path = `game/src/core/${file}.js`;
    expect(fs.readFileSync(path)).toEqual(fs.readFileSync(before + path));
  }
});

// These reproduce the two existing assertions without changing the public test.
// Expected failure here means the frozen source has the same incompatibility.
it.fails('frozen icon implementation fails the original crystal PNG assertion', async () => {
  vi.stubGlobal('MutationObserver', undefined);
  try {
    const {Icons} = await import('../../../../../game/src/core/icons-bitmap.js');
    expect(Icons.url('crystal')).toContain('ui/icons/crystal.png');
  } finally { vi.unstubAllGlobals(); }
});

it.fails('frozen altar source fails the original literal confirmation-icon assertion', () => {
  expect(fs.readFileSync(before + 'game/src/run/game.run.altar.js','utf8')).toContain('[[icon:crystal]] 确认献祭');
});
