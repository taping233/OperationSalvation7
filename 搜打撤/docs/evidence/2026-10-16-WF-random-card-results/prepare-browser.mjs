import { readFileSync, writeFileSync } from 'node:fs';

const directory = new URL('./', import.meta.url);
const game = new URL('../../../game/', directory);
const source = readFileSync(new URL('src/r7a.qa.js', game), 'utf8');
let fixture = source.replaceAll("import('./", "import('/src/")
  .replace("showOverlay(title,html,mode){", "showOverlay(title,html,mode){overlay.className=mode==='battle'?'room-view':'';overlay.querySelector('.card').className=mode==='battle'?'card room battle':'card';")
  .replace("new URL('../data/map.json',import.meta.url)", "'/data/map.json'")
  .replace('battleEnergy:2', 'battleEnergy:99')
  .replace('battleHandMax:10', 'battleHandMax:99')
  .replace("const {BattleSession}=await import('/src/battle/core/battle.core.js');", "window.SDT.Cards.ensureSha(); window.SDT.Cards.ensureStarters(); window.SDT.Cards.ensureTabletop(); window.SDT.Cards.ensureDmgTypes(); window.SDT.Cards.ensureEffectFields();\nconst {BattleSession}=await import('/src/battle/core/battle.core.js');")
  .replace("ownedCards:[0,1].map((_,i)=>({uid:`qa-r7-${i}`,card:{...sha}}))", "ownedCards:['cmtn1wnhhym','cc-mana-surge'].map((id,i)=>({uid:`qa-result-${i}`,card:{...window.SDT.Cards.all().find(c=>c.id===id)}}))")
  .replace('hp:50,maxHp:50', 'hp:99999,maxHp:99999')
  .replace('myClass:null', "myClass:'法师'")
  .replace("const selected=resolveEncounterGroup(map.encounters,map.monsters,groupId);", "const selected=resolveEncounterGroup(map.encounters,map.monsters,groupId);")
  .replace('({...map.monsters[id]})', "({...map.monsters[id],hp:99999,atk:1})");
if (fixture === source || fixture.includes('ownedCards:[0,1]')) throw new Error('Fixture replacement failed');
writeFileSync(new URL('browser.mjs', directory), fixture);
let html = readFileSync(new URL('../../previews/r7a-encounters/index.html', directory), 'utf8');
const styles = [...readFileSync(new URL('index.html', game), 'utf8').matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
  .map(match => match[0].replace('href="css/', 'href="/css/')).join('\n');
html = html.replace(/<link\b[^>]*>/g, '').replace('</head>', `${styles}</head>`)
  .replace('../../../game/src/r7a.qa.js', './browser.mjs')
  .replace('R7-a 混编战斗隔离验收', '随机卡牌结果 · 真实战斗验收')
  .replace('固定50生命 / 4攻击 / 两张初始攻击', '构造手牌：江湖救急、法力奔涌；99能量；高血量靶子');
fixture += `\nfor (const [id,uid] of [['qaAcquire','qa-result-0'],['qaCast','qa-result-1']]) document.getElementById(id).addEventListener('click',()=>{BattleSession.commands.playCard(uid,0);});\n`;
html = html.replace('<button id="qaEnd">', '<button id="qaAcquire">测试随机获得</button><button id="qaCast">测试随机释放</button><button id="qaEnd">')
  .replace('</style>', '.qa-bar{position:fixed;left:35%;top:0;z-index:10000;max-width:440px;font-size:10px;opacity:.8}.qa-bar output{display:none}</style>');
writeFileSync(new URL('browser.mjs', directory), fixture);
writeFileSync(new URL('browser.html', directory), html);
console.log('Prepared real BattleSession/BattleView fixture; no player save wiring.');
