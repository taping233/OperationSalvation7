import { describe, expect, it } from 'vitest';
import map from '../game/data/map.json';
import { eliteBestiaryCards } from '../game/src/cards/elite-bestiary.js';
import { dataSlice } from '../game/src/cards/cards.data.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { TYPE_ART:{}, img:() => '' };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
await import('../game/src/cards/cards.js');
const cards = window.SDT.Cards;
cards.ensureTabletop();

describe('精英照相馆图鉴', () => {
  it('九种精英使用各自立绘和现行攻血能力，进入完整卡库且不会进入随机池', () => {
    const ids = map.encounters.flatMap(enc => enc.guaranteedElite || []);
    expect(eliteBestiaryCards).toHaveLength(9);
    for (const id of ids) {
      const enemy = map.monsters[id];
      const registered = cards.all().filter(card => card.id === `foe-${id}`);
      expect(registered).toHaveLength(1);
      expect(registered[0]).toMatchObject({ name:enemy.name, type:'生物', art:id, rarity:'衍生', unrandom:true, sellable:false });
      expect(registered[0].desc).toContain(`攻击 ${enemy.atk} / 生命 ${enemy.hp}`);
      expect(registered[0].desc).toContain(enemy.desc);
      expect(cards.isRandomObtainable(registered[0])).toBe(false);
      expect(dataSlice.BESTIARY).toContainEqual(registered[0]);
    }
  });
});
