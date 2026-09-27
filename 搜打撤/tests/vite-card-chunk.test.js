// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from '../vite.config.js';

const manualChunks = config.build.rollupOptions.output.manualChunks;
const gameRoot = path.dirname(fileURLToPath(new URL('../game/index.html', import.meta.url)));
const moduleId = relativePath => path.join(gameRoot, 'src', relativePath);

describe('Vite manualChunks', () => {
  it('puts the current card catalog and data loader files in their shared chunk', () => {
    for (const file of [
      'cards/cards.data.js',
      'cards/cards.catalog.js',
      'cards/cards.consts.js',
      'core/data-loader.js',
    ]) {
      expect(manualChunks(moduleId(file))).toBe('game-card-catalog');
    }
  });

  it('accepts POSIX and Windows paths without capturing adjacent modules', () => {
    expect(manualChunks('/workspace/game/src/cards/cards.catalog.js')).toBe('game-card-catalog');
    expect(manualChunks('C:\\workspace\\game\\src\\core\\data-loader.js')).toBe('game-card-catalog');
    expect(manualChunks(moduleId('cards/cards.js'))).toBeUndefined();
    expect(manualChunks(moduleId('cards/card-rules.schema.js'))).toBeUndefined();
    expect(manualChunks(moduleId('core/rules.js'))).toBeUndefined();
    expect(manualChunks('/workspace/other/src/cards/cards.catalog.js')).toBeUndefined();
  });

  it('preserves the existing vendor chunk assignments', () => {
    expect(manualChunks('/workspace/node_modules/pixi.js/lib/index.js')).toBe('vendor-render');
    expect(manualChunks('/workspace/node_modules/@pixi/core/lib/index.js')).toBe('vendor-render');
    expect(manualChunks('/workspace/node_modules/inkjs/dist/ink.js')).toBe('vendor-narrative');
    expect(manualChunks('/workspace/node_modules/howler/dist/howler.js')).toBe('vendor-runtime');
    expect(manualChunks('/workspace/node_modules/motion/dist/motion.js')).toBe('vendor-runtime');
  });
});
