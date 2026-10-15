import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { rarityOf } from '../../../game/src/cards/card-rarity.js';
import { displayCardDescription } from '../../../game/src/cards/card-description-text.js';
import { RETIRE_TT10, RETIRE_TT11 } from '../../../game/src/cards/cards.consts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const bundle = await build({ entryPoints: [path.join(root, 'game/src/cards/cards.data.js')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { dataSlice } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const retired = new Set([...RETIRE_TT10, ...RETIRE_TT11]);
const cards = new Map(Object.values(dataSlice).flatMap(value => Array.isArray(value) ? value : []).filter(card => !retired.has(card.id)).map(card => [card.id, card]));
const art = JSON.parse(fs.readFileSync(path.join(root, 'game/data/art-mapping.json'), 'utf8'));
const redrawnGeometryPath = path.join(root, 'game/art-source/card-frame-study-1014/geometry.json');
const redrawnFrames = fs.existsSync(redrawnGeometryPath) ? JSON.parse(fs.readFileSync(redrawnGeometryPath, 'utf8')) : {};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const assetExists = relative => fs.existsSync(path.join(root, 'game/assets', relative));
function artPath(card) {
  if (art.cardArtOverrides[card.id]) return art.cardArtOverrides[card.id];
  for (const [list, prefix] of [['spellCardArt', 'spell'], ['martialCardArt', 'martial'], ['equipCardArt', 'equip'], ['creatureCardArt', 'creature']]) {
    if (art[list]?.includes(card.id)) return `cards/${prefix}-${card.id}.webp`;
  }
  if (art.eventCardArt[card.id]) return `scenes/${art.eventCardArt[card.id]}.webp`;
  if (art.itemArt[card.id]) return `cards/items/${art.itemArt[card.id]}.webp`;
  if (art.resourceArt[card.id]) return `cards/resources/${art.resourceArt[card.id]}.webp`;
  if (art.heroCardArt[card.id]) return `cards/${art.heroCardArt[card.id]}.webp`;
  if (card.type === '生物' && card.art && art.monsterIds.includes(card.art)) return `portraits/enemies/${card.art}.webp`;
  return null;
}
const rarity = card => rarityOf(card, id => cards.get(id));
const description = card => displayCardDescription(card.desc, card.id);
function pick(predicate, ids = []) {
  for (const card of [...ids.map(id => cards.get(id)), ...cards.values()].filter(Boolean)) {
    const image = artPath(card);
    if (predicate(card) && image && assetExists(image) && description(card).length <= 85) return card;
  }
  throw new Error('No verified representative for ' + predicate.toString());
}
const generalIds = { 初始: 'starter-attack', 古朴: 'tt2-frostsword', 稀有: 'tt12-elemburst', 史诗: 'tt2-apollo', 传说: 'tt3-execute', 衍生: 'tt3-fireball', 职业: 'tt7-goldencicada', 棱彩: 'tt8-hero-assassin' };
const general = Object.entries(generalIds).map(([tier, id]) => ({ card: pick(c => rarity(c) === tier, [id]), caption: tier }));
const roles = [
  ['无', '侠客', 'tt7-goldencicada'], ['黑像', '战士', 'tt7-ironphalanx'],
  ['白塔', '法师', 'tt7-arcanebolt'], ['星月', '牧师', 'tt7-holyglow'], ['常无欲', '降临者', 'tt3sp-shadowshot'],
].map(([name, cls, id]) => ({ card: pick(c => rarity(c) === '职业' && c.cls === cls, [id]), caption: name + ' · ' + cls }));
roles.push({ card: roles[0].card, caption: '职业素框 · 回退预览', frameOverride: 'neutral', note: '同一卡牌演示无人物标记时的素框' });
const typeIds = { 武术: 'tt7-goldencicada', 法术: 'tt3-fireball', 装备: 'tt2-frostsword', 道具: 'tt-jinchuangyao', 资源: 'tt-wood', 生物: 'foe-soldier', 事件: 'tt6-relief', 能力卡: 'tt8-hero-assassin' };
const types = Object.entries(typeIds).map(([type, id]) => ({ card: pick(c => c.type === type, [id]), caption: type }));
const allTypes = new Set([...cards.values()].map(c => c.type));
const allRarities = new Set([...cards.values()].map(rarity));
if (types.length !== allTypes.size || general.length !== allRarities.size) throw new Error('Catalog category coverage changed');
const careerFrames = { 侠客: 'wu', 战士: 'heixiang', 法师: 'baita', 牧师: 'xingyue', 降临者: 'changwuyu' };
const commonGeometry = { 初始: [6.156, 5.882, 4.188, 4.044], 衍生: [6.156, 5.882, 4.188, 4.044], 古朴: [9.118774, 11.647059, 7.816092, 9.647059], 稀有: [9.111792, 11.764706, 7.733538, 9.529412], 史诗: [10.821485, 13.438257, 8.846761, 12.227603], 传说: [12.205045, 14.883149, 10.414972, 13.530135], 棱彩: [13.651591, 17.005076, 12.060302, 15.989848] };
const frameNames = { 初始: 'rose/initial.svg', 古朴: 'rose-painterly-1012/common.webp', 稀有: 'rose-painterly-1012/rare.webp', 史诗: 'rose-painterly-1012/epic.webp', 传说: 'rose-painterly-1012/legendary.webp', 衍生: 'rose/token.svg', 棱彩: 'rose-painterly-1012/prism.webp' };
const frameKeys = { 初始: 'initial', 古朴: 'common', 稀有: 'rare', 史诗: 'epic', 传说: 'legendary', 衍生: 'token', 棱彩: 'prism' };
function render({ card, caption, frameOverride, note }) {
  const tier = rarity(card);
  const career = tier === '职业' ? frameOverride || careerFrames[card.cls] || 'neutral' : null;
  const geometry = career ? [9.852217, 11.764706, 9.852217, 11.764706] : commonGeometry[tier];
  const [top, right, bottom, left] = geometry;
  const frame = career ? `career/${career}.svg` : frameNames[tier];
  const redrawn = redrawnFrames[career || frameKeys[tier]];
  const framePath = path.join(root, 'game/css/card-frames', frame);
  if (!fs.existsSync(framePath)) throw new Error('Missing frame: ' + framePath);
  const copy = description(card);
  const numericCopy = esc(copy).replace(/([+-]?\d+(?:\.\d+)?)/g, '<b>$1</b>');
  const classes = [card.id === 'tt7-goldencicada' ? 'cicada' : '', copy.length > 43 ? 'dense' : '', card.name.length > 6 ? 'long-name' : ''].join(' ');
  const fit = art.itemArt[card.id] ? ' style="object-fit:contain"' : card.type === '生物' ? ' style="object-position:center top"' : '';
  const prism = tier === '棱彩' ? '<div class="prism-halo" aria-hidden="true"></div><div class="prism-sheen" aria-hidden="true"></div>' : '';
  const frameSource = redrawn ? '../../../' + redrawn.path : '/css/card-frames/' + frame;
  const frameStyle = redrawn ? `inset:${redrawn.preview.top}px auto auto ${redrawn.preview.left}px;width:${redrawn.preview.width}px;height:auto` : `inset:-${top}% -${right}% auto -${left}%;width:${100 + left + right}%;height:auto`;
  return `<article class="sample" data-card-id="${esc(card.id)}" data-type="${esc(card.type)}" data-rarity="${esc(tier)}"><div class="card ${classes}"><div class="art"><img src="/assets/${esc(artPath(card))}" alt="${esc(card.name)}卡图"${fit}></div>${prism}<div class="type"><span class="type-label"><span class="type-primary">${esc(card.type)}</span><span class="type-secondary">${esc(card.cls || tier)}</span></span></div><div class="copy"><h2 class="name">${esc(card.name)}</h2><p class="rules">${numericCopy}</p></div><img class="frame" src="${frameSource}" alt="${esc(caption)}${redrawn ? '重绘' : '现有'}边框" style="${frameStyle}"><span class="cost" aria-label="费用${card.cost || 0}">${card.cost || 0}</span></div><p class="caption">${esc(caption)}<small>${esc(note || `${card.name} / ${tier} · ${card.type}`)}</small></p></article>`;
}
const previous = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const style = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
const sections = [
  { key: 'rarity', label: '品质框', entries: general },
  { key: 'career', label: '职业专属框', entries: roles },
  { key: 'types', label: '卡牌类型', entries: types },
];
const page = `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>卡牌全种类参考板</title><style>${style}
.board{max-width:1410px}.gallery-tabs{display:flex;gap:8px;padding:22px 0 0}.gallery-tabs button{padding:10px 20px}.gallery-tabs small{margin-left:10px;opacity:.7}.gallery{display:grid;grid-template-columns:repeat(4,232px);justify-content:space-around;gap:68px 65px;padding:57px 18px 24px}.gallery[hidden]{display:none}.gallery .sample{width:232px}.gallery .card{width:232px;height:346px}.gallery .frame{inset:-18px;width:auto;height:auto;border:0;filter:drop-shadow(1px 3px 2px #0008)}.gallery .caption{margin-top:39px}.gallery .caption small{font-size:11px;letter-spacing:0;line-height:1.5}.gallery .rules{font-size:14px;line-height:1.65;white-space:normal;overflow-wrap:anywhere;margin-top:15px}.gallery .copy{padding-left:14px;padding-right:14px}.gallery .dense .rules{font-size:12.5px;line-height:1.55;margin-top:10px}.gallery .long-name .name{font-size:18px;letter-spacing:0}.gallery .type-label{min-width:116px}.gallery footer{margin-top:0}header h1{font-size:27px}.coverage{color:#95a6b1;font-size:12px;margin-top:20px}footer{border-top:1px solid #39404a;padding-top:15px;margin-top:22px}@media(max-width:1250px){.gallery{grid-template-columns:repeat(3,232px);gap:68px 65px}}@media(max-width:980px){.gallery{grid-template-columns:repeat(2,232px)}}@media(max-width:650px){.gallery{grid-template-columns:232px}.gallery-tabs{flex-wrap:wrap}}
</style><link rel="stylesheet" href="./gallery-appearance.css"><main class="board dark" id="board" data-cost="a"><header><div><div class="eyebrow">代号柒 / CARD STUDY 04</div><h1>卡牌全种类参考板</h1><p>8种卡牌类型 · 8档稀有度 · 5位角色职业框与素框回退</p></div><nav aria-label="费用方案"><button aria-pressed="true" data-option="a">A · 切角徽</button><button aria-pressed="false" data-option="b">B · 垂签</button><button aria-pressed="false" data-option="c">C · 圆章</button></nav></header><nav class="gallery-tabs" aria-label="展示分组">${sections.map((s, i) => `<button type="button" data-group="${s.key}" aria-pressed="${i === 0}">${s.label}<small>${s.entries.length}</small></button>`).join('')}</nav>${sections.map((s, i) => `<section id="group-${s.key}" class="gallery" aria-label="${s.label}"${i ? ' hidden' : ''}>${s.entries.map(render).join('\n')}</section>`).join('')}<footer><span>候选参考板 · 原卡图 · 尚未接入游戏</span><span>2026.10.14 / FRIDAY</span></footer></main><script>
document.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>{document.getElementById('board').dataset.cost=button.dataset.option;document.querySelectorAll('[data-option]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.option===button.dataset.option)));}));
document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.gallery').forEach(panel=>panel.hidden=panel.id!=='group-'+button.dataset.group);document.querySelectorAll('[data-group]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}));
</script></html>`;
fs.writeFileSync(path.join(here, 'gallery.html'), page);
const manifest = sections.map(({ key, entries }) => ({ group: key, cards: entries.map(({ card, caption, frameOverride }) => ({ id: card.id, name: card.name, type: card.type, rarity: rarity(card), cost: card.cost, description: description(card), art: artPath(card), caption, frameOverride })) }));
fs.writeFileSync(path.join(here, 'gallery-catalog.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ cardsInCatalog: cards.size, types: [...allTypes], rarities: [...allRarities], groups: manifest.map(s => ({ key: s.group, cards: s.cards.length })), selected: manifest.flatMap(s => s.cards.map(c => `${s.group}: ${c.caption} — ${c.name} (${c.cost})`)) }, null, 1));
