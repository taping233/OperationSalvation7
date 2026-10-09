import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildDoc } from '../../../scripts/sync-cards-from-live.mjs';

// 本轮开始前 cards-sync.json 无工作区差异；复用该基线，只同步老板点名目标。
const previous = JSON.parse(execFileSync('git', ['show', 'HEAD:搜打撤/game/data/cards-sync.json'], { encoding: 'utf8' }));
const input = JSON.parse(fs.readFileSync(new URL('cards-input.json', import.meta.url), 'utf8'));
const targetIds = ['cc-poison-burst', 'tt4-shine-token', 'cmtn125e1nk0'];
const targets = targetIds.map(id => input.find(c => c.id === id));
if (targets.some(c => !c)) throw new Error('目标缺失');
for (const card of targets) if (card.id !== 'cmtn125e1nk0') delete card.rules;
const retire = [...new Set([...previous.retire, 'tt3-deep-seal', 'tt3eq-boiler', 'tt-medneedle', 'tt-token-color'])];
const priorIds = new Set(previous.cards.map(c => c.id));
const doc = buildDoc(targets.filter(c => !priorIds.has(c.id)), targets.filter(c => priorIds.has(c.id)), retire, previous.version + 1, previous);
doc.changelog[0] = '2026-10-10 老板卡牌修正（v36）：毒爆1费；神秘召唤仅发现传说；员工通行证C传说；退役深海印记、魔法锅炉、急救合剂和重复员工通行证A合成材料，保留实际授予职业能力的通行证A。';
fs.writeFileSync(new URL('../../../game/data/cards-sync.json', import.meta.url), JSON.stringify(doc, null, 2) + '\n');
const dataPath = new URL('../../../game/src/cards/cards.data.js', import.meta.url);
const data = fs.readFileSync(dataPath, 'utf8');
fs.writeFileSync(dataPath, data.split(/(?<=\n)/).map(line => {
  if (line.includes("id: 'tt4-shine-token', name: '员工通行证C', cost: 0")) return '      "tt4-shine-token",\n';
  if (line.includes('id: "cmtn125e1nk0"')) return '      "cmtn125e1nk0",\n';
  return line;
}).join(''));
console.log(JSON.stringify({ version: doc.version, targets: targetIds, retire }));
