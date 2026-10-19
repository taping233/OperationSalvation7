import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { captureBrowserEvidence } from './browser-evidence.mjs';

// Run only in the current CUA session. No browser launch, URL navigation, viewport changes or save reset.
export async function previewPersonnelSkin(tab, options) {
  const { slot, characterName, skinId, skinName, root, directory, name = 'personnel', apply = false } = options;
  if (typeof apply !== 'boolean') throw new Error('apply must be an explicit boolean');
  if (!Number.isInteger(slot) || slot < 1 || slot > 5 || !characterName || !skinName || !/^[a-z0-9-]+$/.test(skinId)) throw new Error('Explicit slot, characterName, skinId and skinName required');
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Unsafe evidence name');
  const folder = path.resolve(root, directory);
  const relative = path.relative(path.resolve(root), folder);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Evidence must stay inside project');
  let ancestor = folder;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const physical = path.resolve(realpathSync(ancestor), path.relative(ancestor, folder));
  const physicalRelative = path.relative(realpathSync(root), physical);
  if (physicalRelative.startsWith('..') || path.isAbsolute(physicalRelative)) throw new Error('Evidence symlink leaves project');
  await mkdir(folder, { recursive: true });
  const record = { version: 1, status: 'inconclusive', slot, characterName, skinId, applyRequested: apply,
    actions: [], errors: [], inputKind: 'real-input', limits: ['Preview does not prove refresh/readback or natural gameplay'] };
  // A new attempt gets a new file, while always replanning from the live DOM.
  const progress = path.join(folder, name + '-route.json');
  if (existsSync(progress)) throw new Error('Use a new attempt name; previous route evidence is preserved');
  const save = () => writeFile(progress, JSON.stringify(record, null, 2) + '\n');
  const visible = async locator => await locator.count() === 1 && await locator.isVisible();
  const observe = async () => { record.lastSnapshot = await tab.playwright.domSnapshot(); await save(); };
  const click = async (locator, detail) => {
    await locator.click(); record.actions.push(detail); await observe();
  };
  try {
    record.url = await tab.url();
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(record.url)) throw new Error('Expected current local game tab');
    await observe();
    const enter = tab.playwright.getByRole('button', { name: '进入城市 ENTER THE CITY', exact: true });
    const archive = tab.playwright.getByRole('button', { name: `进入档位 ${String(slot).padStart(2, '0')}`, exact: true });
    if (await visible(enter)) {
      await click(enter, 'enter-city');
      await archive.waitFor({ state: 'visible', timeoutMs: 5000 });
    }
    const configuration = tab.playwright.getByRole('button', { name: '配置', exact: true });
    if (await visible(archive)) {
      await click(archive, 'enter-selected-slot');
      await configuration.waitFor({ state: 'visible', timeoutMs: 5000 });
    }
    await observe();
    if (!record.lastSnapshot.includes(`档案 / ${String(slot).padStart(2, '0')}`)) throw new Error('Current slot not confirmed; stop instead of switching/resetting another save');
    const character = tab.playwright.getByRole('button', { name: `查看${characterName}`, exact: true });
    if (await visible(configuration)) {
      await click(configuration, 'open-personnel');
      await character.waitFor({ state: 'visible', timeoutMs: 5000 });
    }
    if (!await visible(character)) throw new Error('Character roster not available in current state');
    if (await character.getAttribute('aria-pressed') !== 'true') await click(character, 'choose-character');
    const appearance = tab.playwright.getByRole('button', { name: '外观', exact: true });
    if (!await visible(appearance)) throw new Error('Appearance navigation unavailable');
    if (await appearance.getAttribute('aria-pressed') !== 'true') await click(appearance, 'open-appearance');
    const figure = tab.playwright.locator('.pv12-agent-art');
    if (await figure.getAttribute('data-skin') !== skinId) {
      const escaped = skinName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const skin = tab.playwright.getByRole('button', { name: new RegExp('^' + escaped + '(?: |$)') });
      if (!await visible(skin)) throw new Error('Requested skin unavailable or ambiguous');
      await click(skin, 'preview-skin');
    }
    if (await figure.getAttribute('data-skin') !== skinId) throw new Error('Preview did not reach requested skin');
    if (apply) {
      const applyButton = tab.playwright.getByRole('button', { name: '应用此外观', exact: true });
      if (await visible(applyButton)) await click(applyButton, 'apply-requested-skin');
      const equipped = tab.playwright.getByRole('button', { name: '当前外观已装备', exact: true });
      if (!await visible(equipped)) throw new Error('Equipped state not confirmed');
    }
    record.status = apply ? 'equipped-observed' : 'preview-observed';
    record.proof = await captureBrowserEvidence(tab, { root, directory, name,
      imageSelector: '.pv12-agent-image-stage img', inputKind: record.actions.length ? 'real-input' : 'static-inspection',
      detail: 'Personnel route: ' + (record.actions.join(', ') || 'already at requested preview') + '; no refresh/readback test' });
    if (record.proof.status !== 'captured') record.status = 'inconclusive';
  } catch (error) { record.errors.push(String(error.message || error)); }
  record.inputKind = record.actions.length ? 'real-input' : 'static-inspection';
  await save();
  return record;
}
