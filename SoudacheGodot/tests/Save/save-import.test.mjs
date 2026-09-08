#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertInputPath, convertEntries } from '../../tools/import-localstorage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(root, 'tools', 'import-localstorage.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdt-save-import-'));
const input = path.join(temp, 'export.json');
const output = path.join(temp, 'saves');
const run = entries => { fs.rmSync(output, { recursive: true, force: true }); return convertEntries(entries, output); };

try {
  const runPayload = { version: 1, seed: 9, rngState: { gameplay: 42 }, hp: 20, maxHp: 30, inventory: [] };
  const basePayload = { version: 1, wood: 3, stash: [{ card: { id: 'c1', name: '木材' }, count: 2 }], backs: { classic: true } };
  run({ 'sdt-save-v2-slot1': JSON.stringify(runPayload), 'sdt-base-v2-slot1': JSON.stringify(basePayload), 'sdt-base-v2-slot2': JSON.stringify({ wood: 4 }), 'sdt-base-v2-slot3': JSON.stringify({ wood: 5 }), 'sdt-base-v2-slot4': JSON.stringify({ wood: 6 }), 'sdt-base-v2-slot5': JSON.stringify({ wood: 8 }) });
  const slot0 = JSON.parse(fs.readFileSync(path.join(output, 'save_0.json'), 'utf8'));
  assert.equal(slot0.version, 3); assert.equal(slot0.slot, 0); assert.deepEqual(slot0.rngStreams, { gameplay: 42 }); assert.equal(slot0.base.wood, 3);
  const slot4 = JSON.parse(fs.readFileSync(path.join(output, 'save_4.json'), 'utf8'));
  assert.equal(slot4.runActive, false); assert.equal(slot4.base.wood, 8);
  for (let index = 0; index < 5; index++) assert.ok(fs.existsSync(path.join(output, `save_${index}.json`)));
  assert.ok(fs.existsSync(path.join(output, 'import-manifest.json')));

  run({ 'sdt-save-v1': JSON.stringify({ seed: 1 }), 'sdt-base-v1': JSON.stringify({ rations: 4 }) });
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'save_0.json'), 'utf8')).base.rations, 4);

  assert.throws(() => run({ 'sdt-save-v2-slot1': '{bad' }), /not valid JSON/);
  assert.throws(() => run({ 'sdt-save-v2-slot1': JSON.stringify({ version: 99 }) }), /newer than importer support/);

  const privatePath = path.join(temp, 'User Data', 'export.json'); fs.mkdirSync(path.dirname(privatePath), { recursive: true }); fs.writeFileSync(privatePath, '{}');
  assert.throws(() => assertInputPath(privatePath), /profile\/private storage paths are refused/);
  console.log('SAVE_IMPORT_OK');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
