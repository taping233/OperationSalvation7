/** Current expedition roster. Pure content: no renderer, DOM or storage dependency. */
const CHARACTERS = Object.freeze([
  { id: 'shuangling', name: '无', rulesetId: '侠客', visualId: 'wu', color: '#a9d9ef', tag: '已接入正式美术', bg: '以当前角色档案和战斗立绘为准。', task: '探索升格会遗址。', role: '突进 · 斩击', skin: '#edc3ac', hair: '#e7edf0', outfit: '#26333d', scale: 1 },
  { id: 'baiqi', name: '常无欲', rulesetId: '降临者', visualId: 'chang-wu-yu', color: '#ad9ddd', tag: '已接入正式美术', bg: '以当前角色档案和战斗立绘为准。', task: '追索冬日猜想。', role: '契印 · 异变', skin: '#dec0af', hair: '#29313d', outfit: '#e8e5dc', scale: 1.12 },
  { id: 'lituan', name: '白塔', rulesetId: '法师', visualId: 'bai-ta', color: '#e9bd69', tag: '已接入正式美术', bg: '以当前角色档案和战斗立绘为准。', task: '记录异常回响。', role: '元素 · 装置', skin: '#e1b191', hair: '#78533b', outfit: '#71604a', scale: 0.74 },
  { id: 'xuanli', name: '待定角色 IV', rulesetId: '战士', visualId: null, color: '#86929a', tag: '美术待定', bg: '角色资料与美术暂留空。', task: '待后续确认。', role: '重击 · 护甲', skin: '#777777', hair: '#999999', outfit: '#444444', scale: 1 },
  { id: 'dengkui', name: '待定角色 V', rulesetId: '牧师', visualId: null, color: '#799c94', tag: '美术待定', bg: '角色资料与美术暂留空。', task: '待后续确认。', role: '修复 · 抑制', skin: '#777777', hair: '#999999', outfit: '#444444', scale: 1 },
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
