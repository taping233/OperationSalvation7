import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Called inside the current Codex CUA session with its existing tab handle.
// This module never launches a browser, navigates, changes viewport or clicks.
export async function captureBrowserEvidence(tab, options) {
  const { root, directory, name = 'page', imageSelector = 'img', inputKind, detail } = options;
  if (!['real-input', 'static-inspection', 'synthetic-event'].includes(inputKind) || !detail) throw new Error('Declare inputKind and actual coverage detail');
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error('Unsafe evidence name');
  const folder = path.resolve(root, directory);
  const relative = path.relative(path.resolve(root), folder);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) throw new Error('Evidence must stay inside project');
  let ancestor = folder;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const physical = path.resolve(realpathSync(ancestor), path.relative(ancestor, folder));
  const physicalRelative = path.relative(realpathSync(root), physical);
  if (path.isAbsolute(physicalRelative) || physicalRelative === '..' || physicalRelative.startsWith('..' + path.sep)) throw new Error('Evidence symlink leaves project');
  const png = path.join(folder, name + '.png');
  const json = path.join(folder, name + '.json');
  if (existsSync(png) || existsSync(json)) throw new Error('Use a new evidence name; existing artifacts are preserved');
  await mkdir(folder, { recursive: true });
  const record = { version: 1, status: 'inconclusive', source: 'Codex current in-app browser tab',
    capturedAt: new Date().toISOString(), inputKind, detail, screenshot: null, errors: [] };
  try {
    record.url = await tab.url();
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(record.url)) throw new Error('Expected local game page');
    // Save the screenshot first, so a later connection loss does not discard it.
    const bytes = await tab.screenshot({ fullPage: false });
    await writeFile(png, bytes, { flag: 'wx' });
    record.screenshot = { path: path.basename(png), bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') };
    record.images = await tab.playwright.locator(imageSelector).evaluateAll(images => images.map(image => ({
      src: image.currentSrc || image.src, complete: image.complete,
      width: image.naturalWidth, height: image.naturalHeight,
      fit: getComputedStyle(image).objectFit,
    })));
    record.console = await tab.dev.logs({ levels: ['error'], limit: 30 });
    record.status = 'captured'; // A capture is evidence, not an automatic gameplay pass.
  } catch (error) { record.errors.push(String(error.message || error)); }
  await writeFile(json, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return record;
}
