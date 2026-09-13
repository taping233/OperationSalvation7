/** Original expedition roster. Pure content: no renderer, DOM or storage dependency. */
const CHARACTERS = Object.freeze([
  { id: 'shuangling', name: '无', rulesetId: '侠客', color: '#ed9b53', skin: '#edc3ac', hair: '#e7edf0', outfit: '#26333d', scale: 1 },
  { id: 'baiqi', name: '常无欲', rulesetId: '降临者', color: '#ad9ddd', skin: '#dec0af', hair: '#29313d', outfit: '#e8e5dc', scale: 1.12 },
  { id: 'lituan', name: '白塔', rulesetId: '法师', color: '#e9bd69', skin: '#e1b191', hair: '#78533b', outfit: '#71604a', scale: 0.74 },
  { id: 'xuanli', name: '黑像', rulesetId: '战士', color: '#d0805a', skin: '#69463d', hair: '#ecedf0', outfit: '#303b42', scale: 1.25 },
  { id: 'dengkui', name: '星月', rulesetId: '牧师', color: '#81bcb0', skin: '#dcb397', hair: '#285a59', outfit: '#dedbd0', scale: 1 },
].map(Object.freeze));
const LEGACY = Object.freeze({ 刺客: '侠客', 剑客: '侠客', 游侠: '侠客', 守卫: '战士', 术士: '牧师', 授印者: '牧师', 召唤师: '法师' });
function characterFor(value) {
  return CHARACTERS.find(c => c.id === value || c.name === value || c.rulesetId === (LEGACY[value] || value)) || null;
}
const characterName = value => characterFor(value)?.name || value || '未选择人物';
function migrateCharacterProgress(data) {
  data.characters ||= {};
  const old = data.classes || {};
  for (const c of CHARACTERS) {
    if (data.characters[c.id]) continue;
    const keys = [c.rulesetId, ...Object.keys(LEGACY).filter(k => LEGACY[k] === c.rulesetId)];
    const candidates = keys.map(k => old[k]).filter(Boolean);
    const best = candidates.sort((a,b) => (b.lv || 1) - (a.lv || 1) || (b.xp || 0) - (a.xp || 0))[0];
    data.characters[c.id] = { lv: best?.lv || 1, xp: best?.xp || 0 };
  }
  return data;
}
function migrateRunCharacter(run) {
  if (!run || typeof run !== 'object') return run;
  if (!run.characterId) run.characterId = characterFor(run.myClass)?.id || null;
  const character = characterFor(run.characterId);
  if (character) run.myClass = character.rulesetId;
  return run;
}
export { CHARACTERS, characterFor, characterName, migrateCharacterProgress, migrateRunCharacter };
