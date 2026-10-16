// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as selection from '../game/src/hub/departure.selection-state.js';

beforeEach(() => selection.replaceDeployPick(null));

describe('departure selection live binding', () => {
  it('loads without a DOM and preserves replacement/mutation identity synchronously', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(selection.deployPick).toBeNull();
    const first = { 'card:original': 2 };
    expect(selection.replaceDeployPick(first)).toBeUndefined();
    expect(selection.deployPick).toBe(first);
    first['card:original'] += 1;
    expect(selection.deployPick['card:original']).toBe(3);
    const next = { 'card:next': 1 };
    selection.replaceDeployPick(next);
    expect(selection.deployPick).toBe(next);
    expect(first).toEqual({ 'card:original': 3 });
    selection.replaceDeployPick(null);
    expect(selection.deployPick).toBeNull();
  });

  it('keeps departure rendering outside every HTML entry static closure while retaining the shared binding', () => {
    const gameRoot = path.resolve('game');
    const html = readFileSync(path.join(gameRoot, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
      .map(match => path.resolve(gameRoot, match[1]));
    const seen = new Set();
    const visit = file => {
      if (seen.has(file) || !file.endsWith('.js')) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const node of parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
        if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
          || !node.source?.value.startsWith('.')) continue;
        visit(path.resolve(path.dirname(file), node.source.value));
      }
    };
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach(visit);
    expect(seen.has(path.resolve('game/src/hub/departure.selection-state.js'))).toBe(true);
    expect(seen.has(path.resolve('game/src/hub/game.hub.depart.js'))).toBe(false);
    expect(seen.has(path.resolve('game/src/hub/game.hub.runtime.js'))).toBe(false);
  });
});
