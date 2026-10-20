import { readFileSync, writeFileSync } from 'node:fs';
import { SAMPLE_CUES as before } from './before.catalog.js';
const base = 'docs/evidence/2026-10-18-premium-ui-sfx/';
const receipt = JSON.parse(readFileSync(`${base}receipt.json`, 'utf8'));
const replacements = {
  click:2568, select:1109, confirm:2573, back:2575, switch:2577, deny:2569,
  'page-short':1104, 'page-long':1101, 'paper-place':2380, 'paper-place-2':1530,
  'book-open':2578, 'book-close':2575, 'leather-pick':2020, 'leather-drop':2576,
  'coin-one':2021, 'coin-many':269, latch:2574, 'metal-click':2577,
  cloth:2575, door:2578, blunt:2153, 'knife-cut':2158, 'knife-cut-2':2166,
  'knife-draw':2166, 'wood-creak':268, parry:2160, 'parry-2':2765,
  pierce:2761, arrow:2771, buckle:2577, unbuckle:2573,
  'shield-break':2795, heavy:2794, lunge:2141, leather:1530,
  'reward-small':2018, 'reward-rare':2015, 'reward-complete':270,
  'magic-1':2589, 'magic-2':873, 'magic-3':2584, 'magic-4':3083,
  'magic-5':3083, 'magic-6':863, 'magic-7':2345,
};
const cues = {};
for (const [id, cue] of Object.entries(before)) {
  const ids = cue.files.map(file => replacements[file.split('/').at(-1).replace('.ogg','')]);
  if (ids.some(value => !value)) throw Error(`Unmapped source ${id}`);
  const gain = ['hover','navigate'].includes(id) ? .035 : cue.group === 'ui' ? .2 : cue.group === 'reward' ? .24 : cue.group === 'transition' ? .18 : .32;
  const { rate, lowpass, ...keep } = cue;
  cues[id] = { ...keep, files:[...new Set(ids)].map(value => `assets/sfx/mixkit-1018/${value}.wav`), gain };
}
// Prioritise quiet, cohesive menu feedback; reserve complete stings for milestones.
for (const id of ['click','cardSelect','characterSelect','switch','shutter','pick','altarActivate','altarOffer']) cues[id].files=['assets/sfx/mixkit-1018/2568.wav'];
for (const id of ['hover','navigate']) cues[id].files=['assets/sfx/mixkit-1018/2568.wav'];
for (const id of ['gain','stashDeposit','reveal','runeExchange']) cues[id].files=['assets/sfx/mixkit-1018/2020.wav'];
for (const id of ['ding','levelup','achievementUnlock','collectionUnlock']) cues[id].files=['assets/sfx/mixkit-1018/600.wav'];
for (const id of ['heal','cardRestore']) cues[id].files=['assets/sfx/mixkit-1018/2628.wav'];
for (const id of ['chestBurst','altarEnter']) cues[id].files=['assets/sfx/mixkit-1018/2583.wav'];
for (const id of ['chestShake','searchStart','recodeStart','shuffle']) cues[id].files=['assets/sfx/mixkit-1018/1530.wav'];
for (const id of ['turnSelf','phaseSelf']) cues[id].files=['assets/sfx/mixkit-1018/2568.wav'];
for (const id of ['turnFoe','phaseFoe']) cues[id].files=['assets/sfx/mixkit-1018/1109.wav'];
const tail=readFileSync(`${base}before.catalog.js`,'utf8').split('export function resolveSampleCue')[1];
writeFileSync('game/src/audio/sound.samples.catalog.js','// Mixkit成品游戏音效；来源与许可见 assets/sfx/mixkit-1018/SOURCES.md。\nexport const SAMPLE_CUES = Object.freeze({\n'+Object.entries(cues).map(([id,cue])=>`  ${id}: ${JSON.stringify(cue)},`).join('\n')+'\n});\n\nexport function resolveSampleCue'+tail);
writeFileSync(`${base}mapping.json`,JSON.stringify(cues,null,2)+'\n');
const manifest=JSON.parse(readFileSync('game/assets/asset-manifest.json','utf8'));
if (manifest.assets.some(item=>item.path.startsWith('sfx/mixkit-1018/'))) throw Error('Already installed');
manifest.assets.unshift(...receipt.files.map(({seconds,sample_rate,channels,download_page,download_url,title,...entry})=>entry));
manifest.count=manifest.assets.length;
writeFileSync('game/assets/asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const previousLibrary=JSON.parse(readFileSync('game/assets/sfx/web-foley-1018/library.json','utf8'));
const library={...previousLibrary,name:'Mixkit · 成品游戏音效',version:'MIXKIT 10.18',featuredTitle:'新版点击与奖励 · 由老板试听',cues:previousLibrary.cues.map(old=>{
  const cue=cues[old.id];return {...old,gain:cue.gain,note:'Mixkit游戏音效 · 保留原音色与完整收尾',variants:cue.files.map(file=>({src:'./'+file,seconds:receipt.files.find(source=>'assets/'+source.path===file).seconds}))};
})};
writeFileSync('game/assets/sfx/mixkit-1018/library.json',JSON.stringify(library,null,2)+'\n');
let audition=readFileSync('game/src/audio/sfx-audition.js','utf8');
audition=audition.replace("'./assets/sfx/web-foley-1018/library.json'","'./assets/sfx/mixkit-1018/library.json'");
writeFileSync('game/src/audio/sfx-audition.js',audition);
const historical='tests/sound-web-library.test.js';
let test=readFileSync(historical,'utf8');
test=test.replace("from '../game/src/audio/sound.samples.catalog.js'","from '../docs/evidence/2026-10-18-premium-ui-sfx/before.catalog.js'");
writeFileSync(historical,'// Historical 19:58 integration snapshot; superseded by the Mixkit selection.\n'+test);
let html=readFileSync('game/index.html','utf8');
const oldLine=html.split('\n').find(line=>line.includes('credits-audio')&&line.includes('当前音效：'));
if (!oldLine) throw Error('Current audio credit missing');
html=html.replace(oldLine,'          <p class="credits-audio">当前音效：<a href="https://mixkit.co/free-sound-effects/" target="_blank" rel="noopener noreferrer">Mixkit</a> · <a href="https://mixkit.co/license/#sfxFree" target="_blank" rel="noopener noreferrer">Sound Effects Free License</a>。保留完整原始WAV，仅调播放音量。</p>');
writeFileSync('game/index.html',html);
let docs=readFileSync('docs/audio-system.md','utf8');
const start=docs.indexOf('全部运行短音效由'),end=docs.indexOf('\n\n首次解锁后',start);
docs=docs.slice(0,start)+'全部运行短音效由 `sound.samples.catalog.js` 的106个明确事件及 `phase` 双方别名维护，`sound.samples.player.js` 只播放已解码文件。老板否决此前实物拼配版后，当前全部事件改用本轮从Mixkit下载的成品游戏音效，目录 `game/assets/sfx/mixkit-1018/`。按钮使用同系界面轻反馈；领取物品、钱币、里程碑、稀有奖励、胜利分别选用不同的成品声音；卡牌使用纸张，战斗使用完整刀刃、箭矢、拳击与法术声音。保留下载WAV原字节，仅设运行增益，不对成品做离线裁切、滤波或重配平。逐件来源、SHA256与许可见[Mixkit来源](../game/assets/sfx/mixkit-1018/SOURCES.md)；替换范围与未验证状态见[本轮记录](evidence/2026-10-18-premium-ui-sfx/README.md)。旧音效和旧来源保留但均不在当前映射；旧合成模块仍不在运行链。'+docs.slice(end);
const materials=docs.indexOf('当前45份新剪辑');
docs=docs.slice(0,materials)+'当前素材来自本轮下载的40份Mixkit完整WAV，许可为 Mixkit Sound Effects Free License，允许纳入电子游戏，禁止作为素材库或随源码单独再分发。运行与原件均不进Git，来源地址及精确SHA256见本轮收据。\n\n新版试听入口 `game/sfx-audition.html?set=web` 已切换到Mixkit，优先显示按钮与奖励。试听使用运行相对增益，不包含游戏总线滤波/限幅及并发控制。老板明确要求由其验证，本轮不运行测试、浏览器验收或听感验证；既有自动测试结果只代表上一套，不能用于本套。音乐未变。\n';
writeFileSync('docs/audio-system.md',docs);
console.log('已接入Mixkit的106事件映射、40份完整WAV；旧文件保留。按老板要求未运行验证。');
