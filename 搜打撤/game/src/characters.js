/** Original expedition roster. Pure content: no renderer, DOM or storage dependency. */
const CHARACTERS = Object.freeze([
  { id: 'shuangling', name: '无', rulesetId: '侠客', visualId: 'shuangling', color: '#ed9b53', tag: '穿越风雪的刀锋', bg: '白发高马尾的远征队尖兵。她习惯在风雪里先走一步，把危险留在自己的刀锋前。', task: '沿废城的旧通信线路寻找失联队员，带着所有人的讯息返回营地。', role: '突进 · 斩击', skin: '#edc3ac', hair: '#e7edf0', outfit: '#26333d', scale: 1 },
  { id: 'baiqi', name: '常无欲', rulesetId: '降临者', visualId: 'baiqi', color: '#ad9ddd', tag: '未署名的契约', bg: '总是穿着整洁白西装的眼镜男子。他知道隔离区封锁前的秘密，却只愿以契约交换答案。', task: '回收中央遗迹的封存档案，查明自己签署过的最后一份契约。', role: '契印 · 异变', skin: '#dec0af', hair: '#29313d', outfit: '#e8e5dc', scale: 1.12 },
  { id: 'lituan', name: '栗团', rulesetId: '法师', visualId: 'lituan', color: '#e9bd69', tag: '口袋里的小小星图', bg: '褐发与大帽檐下藏着一双好奇的眼睛。栗团从废品中拼出施术器，坚信远征队总能找到回家的路。', task: '收集散落的仪器零件，让营地熄灭的导航灯重新亮起。', role: '元素 · 装置', skin: '#e1b191', hair: '#78533b', outfit: '#71604a', scale: 0.74 },
  { id: 'xuanli', name: '玄砾', rulesetId: '战士', visualId: 'xuanli', color: '#d0805a', tag: '最后一道防线', bg: '白发、深肤色的壮硕男子，曾守住雪崩中的撤离通道。厚重护臂上每一道伤痕都对应一个平安归来的人。', task: '打通废城的撤离路线，确认补给车队能够安全通过。', role: '重击 · 护甲', skin: '#69463d', hair: '#ecedf0', outfit: '#303b42', scale: 1.25 },
  { id: 'dengkui', name: '灯葵', rulesetId: '牧师', visualId: 'dengkui', color: '#81bcb0', tag: '为归途留一盏灯', bg: '深青短发的战地医护员。她背着改装灯箱穿行于废墟，把修复脉冲送到仍在呼救的人身边。', task: '寻找失效药剂的净化配方，为营地留下足够度过寒季的补给。', role: '修复 · 抑制', skin: '#dcb397', hair: '#285a59', outfit: '#dedbd0', scale: 1 },
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
