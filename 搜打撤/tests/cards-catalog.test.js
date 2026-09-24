import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA } from '../game/src/core/data-loader.js';
import { buildCanonicalCardMap, classifyCardContent, resolveCardCatalog, validateCardId } from '../game/src/cards/cards.catalog.js';
import { validateCardDefinition } from '../game/src/cards/card-rules.schema.js';

const canonical = DATA.cardsSync.cards.find(card => card.id === 'tt8-hero-sealer');

describe('TT10/TT11 canonical catalog resolver', () => {
  it('uses canonical fields and preserves snapshot-only metadata', () => {
    const [resolved] = resolveCardCatalog([{
      ref: canonical.id,
      metadata: { name: 'stale name', desc: 'stale text', art: 'hero-art', battle: true },
    }], 'test batch');
    expect(resolved).toMatchObject(canonical);
    expect(resolved.name).toBe(canonical.name);
    expect(resolved.desc).toBe(canonical.desc);
    expect(resolved.art).toBe('hero-art');
    expect(resolved.battle).toBe(true);
  });

  it('leaves rows without a sync definition unchanged', () => {
    const row = { id: 'warehouse-only', name: '仓库独有卡', desc: '保留原行' };
    expect(resolveCardCatalog([row], 'test batch')[0]).toBe(row);
  });

  it('fails clearly for missing references and duplicate ids', () => {
    expect(() => resolveCardCatalog(['missing-canonical-id'], 'TT10')).toThrow(/missing cards-sync id/);
    expect(() => resolveCardCatalog([canonical.id, canonical.id], 'TT11')).toThrow(/duplicate id/);
    expect(() => resolveCardCatalog([
      canonical.id,
      { id: canonical.id, name: 'duplicate inline definition' },
    ], 'TT11')).toThrow(/duplicate id/);
    expect(() => resolveCardCatalog([
      { id: 'warehouse-only', name: 'one' },
      { id: 'warehouse-only', name: 'two' },
    ], 'TT11')).toThrow(/duplicate id/);
  });

  it('fails when the canonical source itself has duplicate or missing ids', () => {
    expect(() => buildCanonicalCardMap([{ id: 'same' }, { id: 'same' }])).toThrow(/duplicate id/);
    expect(() => buildCanonicalCardMap([{ name: 'missing id' }])).toThrow(/without an id/);
  });


  it('classifies saved entries by stable id while preserving their saved snapshot', () => {
    const savedBuiltin = { ...canonical, name: '旧存档名称', desc: '旧存档描述' };
    expect(classifyCardContent(savedBuiltin)).toEqual({
      kind: 'builtin', id: canonical.id, definition: canonical, saved: savedBuiltin,
    });
    const custom = { id: 'player-card-1', name: '自建卡', cost: 1, type: '武术' };
    expect(classifyCardContent(custom)).toEqual({ kind: 'custom', id: custom.id, definition: custom, saved: custom });
  });

  it('rejects unstable ids and invalid canonical content definitions', () => {
    expect(validateCardId('stable-card-1')).toBe(true);
    expect(validateCardId(' card ')).toBe(false);
    expect(validateCardId('two words')).toBe(false);
    expect(validateCardDefinition({ id: 'bad id', name: '', type: '', cost: null }).ok).toBe(false);
    expect(validateCardDefinition(canonical).ok).toBe(true);
  });


  it('validate-data invokes card rule schema validation for the sync catalog', () => {
    const workspaceRoot = process.cwd();
    const testModuleUrl = new URL('file:///' + path.resolve(workspaceRoot, 'tests/cards-catalog.test.js').replaceAll('\\', '/'));
    const scriptPath = fileURLToPath(new URL('../scripts/validate-data.mjs', testModuleUrl));
    const preload = `import fs from 'node:fs';
const read = fs.readFileSync.bind(fs);
fs.readFileSync = (file, ...args) => {
  if (String(file).replaceAll(String.fromCharCode(92), '/').endsWith('game/data/cards-sync.json')) {
    const data = JSON.parse(read(file, ...args));
    data.cards[0].rules = { version: 999 };
    return JSON.stringify(data);
  }
  return read(file, ...args);
};`;
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(preload)}`, scriptPath,
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    expect(result.status, result.stderr + result.stdout).toBe(1);
    expect(result.stderr).toContain(`cards-sync[${DATA.cardsSync.cards[0].id}].rules.version: must equal 1`);
  });

  it('rejects a metadata value that would otherwise shadow a canonical field', () => {
    const [resolved] = resolveCardCatalog([{
      ref: canonical.id,
      metadata: { name: 'wrong', rarity: '错误', art: 'decorative-art' },
    }], 'test batch');
    expect(resolved.name).toBe(canonical.name);
    expect(resolved.rarity).toBe(canonical.rarity);
    expect(resolved.art).toBe('decorative-art');
  });
});
