import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import artMapping from '../game/data/art-mapping.json';
import scenes from '../game/data/scenes.json';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards.js');
const C = window.SDT.Cards;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
});

describe('0919 都市污染事件池', () => {
  it('含 10 个改名旧事件与 9 个新事件，且全部进入实机事件卡池', () => {
    expect(C.EVENTS_0919).toHaveLength(19);
    const ids = new Set(C.all().filter(c => c.type === '事件').map(c => c.id));
    C.EVENTS_0919.forEach(card => expect(ids.has(card.id), `${card.id} 未进入事件池`).toBe(true));
  });

  it('9 个新事件都有独立卡面映射与整页场景映射', () => {
    const ids = C.EVENTS_0919.map(c => c.id).filter(id => id.startsWith('ev19-'));
    expect(ids).toHaveLength(9);
    ids.forEach(id => {
      expect(artMapping.eventCardArt[id], `${id} 缺卡面图映射`).toBe(`event-${id}`);
      expect(scenes.eventSceneMeta[id], `${id} 缺场景映射`).toHaveLength(3);
    });
  });

  it('九项需求的结算端口均已实装，不是卡面占位描述', () => {
    const source = readFileSync(path.join(ROOT, 'game', 'src', 'game.run.flow.js'), 'utf8');
    [
      'ev19-vital', 'ev19-pearlbox', 'ev19-fireballs', 'ev19-classchest', 'ev19-recode',
      'ev19-potions', 'ev19-arrows', 'ev19-gamble', 'ev19-quartermaster',
    ].forEach(id => expect(source).toContain(`'${id}'`));
    expect(source).toContain("attempts >= 5 || Random.random('event') < 0.5");
    expect(source).toContain("kind: 'medium', isClass: true");
    expect(source).toContain("['武术', '法术', '装备']");
  });
});
