import { describe, it, expect } from 'vitest';
import { CHARACTERS, characterFor, migrateCharacterProgress, migrateRunCharacter } from '../game/src/characters.js';
describe('人物身份与历史存档', () => {
  it('五人各有唯一身份及规则，历史职业可解析', () => {
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(5);
    expect(new Set(CHARACTERS.map(c => c.rulesetId)).size).toBe(5);
    expect(characterFor('剑客').id).toBe('shuangling');
  });
  it('保留更高历史进度，幂等且不覆盖新人物进度', () => {
    const data = { classes: { 剑客: {lv:5,xp:2}, 侠客: {lv:2,xp:4} }, stash: [1] };
    migrateCharacterProgress(data);
    expect(data.characters.shuangling).toEqual({lv:5,xp:2});
    data.characters.shuangling.xp = 9;
    migrateCharacterProgress(data);
    expect(data.characters.shuangling.xp).toBe(9);
    expect(data.stash).toEqual([1]);
    expect(data.classes.剑客.lv).toBe(5);
  });
  it('对局迁移保持物品，人物 ID 优先于旧职业', () => {
    const run = { myClass:'战士', ownedCards:[{uid:'a'}] };
    expect(migrateRunCharacter(run).characterId).toBe('xuanli');
    run.characterId = 'baiqi';
    expect(migrateRunCharacter(run).myClass).toBe('降临者');
    expect(run.ownedCards).toEqual([{uid:'a'}]);
  });
});
