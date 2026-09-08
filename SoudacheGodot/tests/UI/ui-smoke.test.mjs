#!/usr/bin/env node
// Fast CI smoke for the presentation contract. It is intentionally independent
// of a desktop display; when a Godot binary is available CI may add a native
// launch smoke on top of these deterministic checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const project = read('project.godot');
assert.match(project, /window\/stretch\/mode="canvas_items"/);
assert.match(project, /window\/stretch\/aspect="expand"/);
for (const scene of ['main.tscn', 'menu.tscn', 'run.tscn', 'map.tscn', 'battle.tscn']) {
  const content = read(`scenes/${scene}`);
  assert.match(content, /script = ExtResource/);
}
const manifest = JSON.parse(read('docs/asset-manifest.json'));
for (const asset of manifest.assets) {
  if (asset.path.includes('*')) continue;
  assert.ok(fs.existsSync(path.join(root, asset.path)), `missing localized asset: ${asset.path}`);
  assert.doesNotMatch(asset.source, /sts2|reverse/i);
}
for (const source of ['src/UI/MenuScreen.cs', 'src/UI/RunScreen.cs', 'src/UI/MapScreen.cs', 'src/UI/BattleScreen.cs']) {
  const content = read(source);
  assert.match(content, /AssetLibrary/);
  assert.match(content, /GrabFocus/);
  assert.doesNotMatch(content, /placeholder|占位|等待 Core|尚未|演练/i);
}
assert.match(read('src/UI/MapScreen.cs'), /MapIcon/);
assert.match(read('src/UI/CardHandLayout.cs'), /assets\/cards/);
assert.match(read('src/UI/RunScreen.cs'), /RequestBaseAction/);
assert.match(read('src/UI/RunScreen.cs'), /InventoryLabels/);
assert.match(read('src/UI/MapScreen.cs'), /RequestRunAction/);
assert.match(read('src/UI/MapScreen.cs'), /snapshot\.Actions/);
assert.match(read('src/UI/BattleScreen.cs'), /snapshot\.Enemies/);
assert.match(read('src/UI/BattleScreen.cs'), /CharacterPortrait/);
assert.match(read('src/UI/BattleScreen.cs'), /SelectEnemyTarget/);
assert.match(read('src/UI/BattleScreen.cs'), /SelectPlayerTarget/);
assert.match(read('src/UI/BattleScreen.cs'), /InfuseCount/);
assert.match(read('src/App/CoreUiPort.cs'), /RequestPlayCard\(string cardId, string\? targetId, string\[\] infusionFuelIds\)/);
assert.match(read('src/App/CoreUiPort.cs'), /HandCardInfuseCounts/);
assert.match(read('src/App/CoreUiPort.cs'), /HandCardTargetKinds/);
assert.match(read('src/App/CoreUiPort.cs'), /PlayerTargetId/);
const adapter = read('src/App/CoreGameAdapter.cs');
assert.match(adapter, /Godot\.FileAccess\.Open\("res:\/\/data\/cards\.json"|ReadResourceText\("res:\/\/data\/cards\.json"/);
assert.doesNotMatch(adapter, /GlobalizePath\("res:\/\/data\/cards\.json"/);
assert.doesNotMatch(['UiTheme.cs', 'ScreenChrome.cs', 'CardHandLayout.cs', 'ReferenceHandGeometry.cs'].map(name => read(`src/UI/${name}`)).join('\n'), /placeholder|占位|等待 Core|尚未/i);
console.log(`UI_SMOKE_STATIC_OK assets=${manifest.assets.length} scenes=5 focus=4 stretch=expand`);
