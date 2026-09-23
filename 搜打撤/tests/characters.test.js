import { describe, it, expect } from 'vitest';
import { CHARACTERS, characterFor, migrateCharacterProgress, migrateRunCharacter } from '../game/src/core/characters.js';
describe('人物身份与历史存档', () => {
  it('五人各有唯一身份及规则，历史职业可解析', () => {
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(5);
    expect(new Set(CHARACTERS.map(c => c.rulesetId)).size).toBe(5);
    expect(characterFor('剑客').id).toBe('wu');
  });
  it('保留更高历史进度，幂等且不覆盖新人物进度', () => {
    const data = { classes: { 剑客: {lv:5,xp:2}, 侠客: {lv:2,xp:4} }, stash: [1] };
    migrateCharacterProgress(data);
    expect(data.characters.wu).toEqual({lv:5,xp:2});
    data.characters.wu.xp = 9;
    migrateCharacterProgress(data);
    expect(data.characters.wu.xp).toBe(9);
    expect(data.stash).toEqual([1]);
    expect(data.classes.剑客.lv).toBe(5);
  });
  it('对局迁移保持物品，人物 ID 优先于旧职业', () => {
    const run = { myClass:'战士', ownedCards:[{uid:'a'}] };
    expect(migrateRunCharacter(run).characterId).toBe('heixiang');
    run.characterId = 'changwuyu';
    expect(migrateRunCharacter(run).myClass).toBe('降临者');
    expect(run.ownedCards).toEqual([{uid:'a'}]);
  });
  it('旧名拼音 id 归一：进度留高级别，characterId 与查询兼容旧值（2026-09-20 全量改名）', () => {
    const data = { characters: { shuangling: {lv:3,xp:5}, wu: {lv:1,xp:1} } };
    migrateCharacterProgress(data);
    expect(data.characters.wu).toEqual({lv:3,xp:5});
    expect(data.characters.shuangling).toBeUndefined();
    expect(migrateRunCharacter({ characterId: 'xuanli' }).characterId).toBe('heixiang');
    expect(characterFor('shuangling').id).toBe('wu');
    expect(characterFor('dengkui').name).toBe('星月');
  });
});
