import fs from 'node:fs';
const packet = JSON.parse(fs.readFileSync(new URL('./current-catalog.json', import.meta.url), 'utf8'));
const wanted = process.argv.slice(2);
if (wanted.includes('--metadata')) {
  for (const card of packet.cards) if (card.rules?.battle || card.rules?.equip) console.log(JSON.stringify({id:card.id,name:card.name,rules:card.rules}));
  process.exit();
}
const groups = {};
function visit(value, card) {
  if (!value || typeof value !== 'object') return;
  if (value.op && (!wanted.length || wanted.includes(value.op))) (groups[value.op] ??= []).push({ id: card.id, name: card.name, operation: value });
  for (const child of Object.values(value)) visit(child, card);
}
for (const card of packet.cards) visit(card.rules, card);
for (const [op, values] of Object.entries(groups)) console.log(op, JSON.stringify(values));
