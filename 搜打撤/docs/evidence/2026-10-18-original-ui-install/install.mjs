import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES as before } from './before.catalog.js';

const base = 'docs/evidence/2026-10-18-original-ui-install/';
const source = 'docs/evidence/2026-10-18-arknights-sfx-return/';
const destination = 'game/assets/sfx/original-ui-1018/';
mkdirSync(destination, { recursive: true });
const samples = [
  ['click', 'v2-01-click.wav', .185],
  ['confirm', 'v2-02-confirm.wav', .225],
  ['reward', 'v3-reward-A-light.wav', .29],
];
const entries = samples.map(([name, file, seconds]) => {
  copyFileSync(source + file, destination + name + '.wav');
  const bytes = readFileSync(destination + name + '.wav');
  return { path: `sfx/original-ui-1018/${name}.wav`, ext: 'wav',
    license: 'Project original audio — independently generated for this project; no third-party audio samples',
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    source: source + (name === 'reward' ? 'reward-v3.py' : 'redesign-v2.py'),
    original_path: source + file,
    processing: 'exact copy of the user-reviewed WAV master; runtime gain only', seconds };
});
const cues = structuredClone(before), changed = {};
function use(ids, sample, gain = .65) {
  for (const id of ids.split(' ')) {
    if (!cues[id]) throw Error(`Missing existing cue: ${id}`);
    cues[id] = { ...cues[id], files: [`assets/sfx/original-ui-1018/${sample}.wav`], gain };
    changed[id] = cues[id];
  }
}
use('click cardSelect characterSelect switch shutter pick altarActivate altarOffer', 'click');
use('hover navigate', 'click', .08);
use('confirm prepReady extractionConfirm eventSafe', 'confirm');
use('gain stashDeposit coin tradeSell tradeBuy ding levelup achievementUnlock collectionUnlock eventComplete storyComplete recodeComplete reveal runeExchange legend rarePlay altarReward eggHatch petRescue blackMarketWin victory bossVictory runClear extractionSuccess chestBurst', 'reward');
const tail = readFileSync(base + 'before.catalog.js', 'utf8').split('export function resolveSampleCue')[1];
writeFileSync('game/src/audio/sound.samples.catalog.js', '// 按钮/奖励使用老板认可的原创三样，其余沿用Mixkit；来源见各素材目录SOURCES.md。\nexport const SAMPLE_CUES = Object.freeze({\n' + Object.entries(cues).map(([id, cue]) => `  ${id}: ${JSON.stringify(cue)},`).join('\n') + '\n});\n\nexport function resolveSampleCue' + tail);
writeFileSync(base + 'mapping.json', JSON.stringify(changed, null, 2) + '\n');
const manifest = JSON.parse(readFileSync('game/assets/asset-manifest.json', 'utf8'));
if (manifest.assets.some(item => item.path.startsWith('sfx/original-ui-1018/'))) throw Error('Already installed');
manifest.assets.unshift(...entries.map(({ seconds, ...entry }) => entry));
manifest.count = manifest.assets.length;
writeFileSync('game/assets/asset-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
const receipt = { date: '2026-10-18', selected: { click: 'V2', confirm: 'V2', reward: 'V3 A / first-listed option' },
  runtimeGain: .65, hoverGain: .08, baseSfxGainUnchanged: 1.5,
  scope: Object.keys(changed), tests_run: false, browser_verified: false, listening_verified_in_game: false,
  third_party_audio_inputs: [], files: entries };
writeFileSync(base + 'receipt.json', JSON.stringify(receipt, null, 2) + '\n');
let library = JSON.parse(readFileSync('game/assets/sfx/mixkit-1018/library.json', 'utf8'));
library = { ...library, name: '当前音效 · 原创点击/确认/奖励', version: 'ORIGINAL UI 10.18',
  featuredLabel: '已选三样', featuredTitle: 'V2点击、V2确认、V3奖励A', featuredIds: ['click', 'confirm', 'gain'],
  cues: library.cues.map(cue => changed[cue.id] ? { ...cue, gain: cues[cue.id].gain,
    note: cues[cue.id].files[0].includes('reward') ? '原创奖励A · 清冷轻亮' : '已认可的V2原创样音',
    variants: cues[cue.id].files.map(file => ({ src: './' + file,
      seconds: entries.find(entry => 'assets/' + entry.path === file).seconds })) } : cue) };
writeFileSync(destination + 'library.json', JSON.stringify(library, null, 2) + '\n');
let audition = readFileSync('game/src/audio/sfx-audition.js', 'utf8');
audition = audition.replace("'./assets/sfx/mixkit-1018/library.json'", "'./assets/sfx/original-ui-1018/library.json'");
writeFileSync('game/src/audio/sfx-audition.js', audition);
let html = readFileSync('game/index.html', 'utf8');
const old = html.split('\n').find(line => line.includes('credits-audio') && line.includes('当前音效：'));
if (!old) throw Error('Current sound credits missing');
html = html.replace(old, '          <p class="credits-audio">按钮与奖励：本项目原创设计，使用独立音源，未包含第三方游戏录音。其他音效：<a href="https://mixkit.co/free-sound-effects/" target="_blank" rel="noopener noreferrer">Mixkit</a> · <a href="https://mixkit.co/license/#sfxFree" target="_blank" rel="noopener noreferrer">Sound Effects Free License</a>。</p>');
writeFileSync('game/index.html', html);
let docs = readFileSync('docs/audio-system.md', 'utf8');
const start = docs.indexOf('全部运行短音效由');
docs = docs.slice(0, start) + `全部运行短音效由 \`sound.samples.catalog.js\` 的106个明确事件及 \`phase\` 双方别名维护，\`sound.samples.player.js\` 只播放已解码文件。按钮/选择采用老板认可的V2原创点击，确认/准备完成采用V2原创确认，领取/钱币/奖励/胜利反馈采用V3奖励A（列表首项）。三样位于 \`game/assets/sfx/original-ui-1018/\`，由本项目独立生成，没有第三方音频采样，按已试听WAV原字节接入。三个事件族增益0.65，悬停/导航0.08，既有SFX基准1.5不变；满音量设置下三样净总线增益约0.975，接近候选文件本身响度。\n\n其余场景、卡牌与战斗音效继续使用Mixkit文件，音乐未改。替换事件清单、文件指纹和来源见[本轮接入记录](evidence/2026-10-18-original-ui-install/README.md)与[原创三样来源](../game/assets/sfx/original-ui-1018/SOURCES.md)。旧素材和来源保留，方舟原录音未进入当前映射。所有音频仍不进Git，按路径、SHA256与生成/下载方式留档。\n\n新版试听入口 \`game/sfx-audition.html?set=web\` 优先列出当前三样，其余事件按当前映射展示。试听不包含游戏总线滤波/限幅与并发；老板要求自行验证，本轮不运行测试、构建、浏览器验收或游戏内听感验证。\n`;
writeFileSync('docs/audio-system.md', docs);
console.log(`已接入3份原创WAV，更新${Object.keys(changed).length}个按钮/奖励触发；其余保持现状，未运行验证。`);
