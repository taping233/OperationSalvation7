import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sourceCardLibrary, diff } from '../../../scripts/sync-cards-from-live.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const source = sourceCardLibrary();
const renamed = source.map(card => card.id === 'tt2-forestarrow' ? { ...card, name: '回音箭' } : card);
const result = diff(source, renamed);
if (result.upserts.length || result.retire.length || result.changed.length !== 1 || result.changed[0].id !== 'tt2-forestarrow') throw new Error('Rename must change exactly one card');
const temp = path.join(root, '.tmp/echo-arrow-rename.json');
fs.mkdirSync(path.dirname(temp), { recursive: true });
fs.writeFileSync(temp, JSON.stringify(renamed, null, 2));
const run = spawnSync(process.execPath, ['scripts/sync-cards-from-live.mjs', '--input', temp], { cwd: root, encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout);
fs.writeFileSync(path.join(dir, 'rename-receipt.json'), JSON.stringify({ card_id: 'tt2-forestarrow', before: result.changed.length && source.find(c => c.id === 'tt2-forestarrow').name, after: '回音箭', changed: 1, added: 0, retired: 0, method: 'sync-cards-from-live.mjs; source library snapshot with one name edit' }, null, 2) + '\n');
console.log(run.stdout);
