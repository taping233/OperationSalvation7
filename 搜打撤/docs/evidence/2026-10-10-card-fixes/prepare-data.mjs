import fs from 'node:fs';
import { sourceCardLibrary } from '../../../scripts/sync-cards-from-live.mjs';

const retire = new Set(['tt3-deep-seal', 'tt3eq-boiler', 'tt-medneedle', 'tt-token-color']);
const cards = sourceCardLibrary().filter(c => !retire.has(c.id));
for (const card of cards) {
  if (card.id === 'cc-poison-burst') card.cost = 1;
  if (card.id === 'tt4-shine-token') card.rarity = '传说';
  if (card.id === 'cmtn125e1nk0') {
    card.desc = '发现一张传说卡。';
    card.rules.triggers.onPlay[0].pool.kind = '传说';
  }
}
fs.writeFileSync(new URL('cards-input.json', import.meta.url), JSON.stringify(cards, null, 2) + '\n');
// 先导出完整有效卡库，再删除源码批次中已退役的定义，避免后续批次重新播种。
const dataPath = new URL('../../../game/src/cards/cards.data.js', import.meta.url);
const data = fs.readFileSync(dataPath, 'utf8');
const lines = data.split(/(?<=\n)/).filter(line => ![...retire].some(id =>
  line.includes(`id: '${id}'`) || line.includes(`id: "${id}"`) || line.trim() === `"${id}",`));
fs.writeFileSync(dataPath, lines.join('').replaceAll('发现一张传说或能力卡。', '发现一张传说卡。')
  .replaceAll("name: '员工通行证C', cost: 2, rarity: '史诗'", "name: '员工通行证C', cost: 2, rarity: '传说'")
  .replaceAll("name: '员工通行证C', cost: 0, rarity: '史诗'", "name: '员工通行证C', cost: 0, rarity: '传说'"));
