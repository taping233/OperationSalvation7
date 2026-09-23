/* TT10/TT11 的定版卡必须引用 cards-sync；源文件不再复制其语义字段。 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parse } from 'acorn';
import cardsSync from '../game/data/cards-sync.json';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

const Cards = window.SDT.Cards;
const syncMap = new Map(cardsSync.cards.map(card => [card.id, card]));
const source = readFileSync(path.resolve(process.cwd(), 'game/src/cards.data.js'), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const dataSlice = ast.body
  .find(node => node.type === 'ExportNamedDeclaration')
  ?.declaration?.declarations?.find(node => node.id.name === 'dataSlice')?.init;

function batchEntries(name) {
  const property = dataSlice.properties.find(item => item.key.name === name);
  expect(property?.value.type).toBe('CallExpression');
  expect(property.value.callee.name).toBe('resolveCardCatalog');
  const [array] = property.value.arguments;
  expect(array.type).toBe('ArrayExpression');
  return array.elements.map(entry => {
    if (entry.type === 'Literal' && typeof entry.value === 'string') {
      return { id: entry.value, reference: true, metadata: [] };
    }
    const properties = new Map(entry.properties.map(item => [item.key.name, item]));
    if (properties.has('ref')) {
      const metadata = properties.get('metadata')?.value?.properties || [];
      return { id: properties.get('ref').value.value, reference: true, metadata };
    }
    return { id: properties.get('id')?.value?.value, reference: false, metadata: [] };
  });
}

describe('TT10/TT11 canonical catalog guard', () => {
  for (const [label, propertyName, table] of [
    ['TABLETOP10', 'TABLETOP10', () => Cards.TABLETOP10],
    ['TABLETOP11', 'TABLETOP11', () => Cards.TABLETOP11],
  ]) {
    it(`${label} references every sync-owned row and preserves batch order`, () => {
      const entries = batchEntries(propertyName);
      const ids = entries.map(entry => entry.id);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(table().map(card => card.id)).toEqual(ids);

      for (const entry of entries) {
        const definition = syncMap.get(entry.id);
        if (definition) {
          expect(entry.reference).toBe(true);
          const runtimeCard = table().find(card => card.id === entry.id);
          for (const [field, value] of Object.entries(definition)) {
            expect(runtimeCard[field], `${entry.id}.${field}`).toEqual(value);
          }
          for (const metadataProperty of entry.metadata) {
            expect(Object.hasOwn(definition, metadataProperty.key.name)).toBe(false);
          }
        } else {
          expect(entry.reference).toBe(false);
        }
      }
    });
  }

  it('保留受缚之残影与满电动力锤回归锚', () => {
    expect(syncMap.get('tt8-hero-sealer').name).toBe('受缚之残影');
    expect(syncMap.get('tt6-goldhammer').name).toBe('满电动力锤');
    expect(Cards.TABLETOP11.find(card => card.id === 'tt8-hero-sealer').name).toBe('受缚之残影');
    expect(Cards.TABLETOP11.find(card => card.id === 'tt6-goldhammer').name).toBe('满电动力锤');
  });
});
