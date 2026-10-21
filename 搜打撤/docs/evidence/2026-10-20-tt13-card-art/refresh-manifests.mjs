import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Invoke the existing Vite manifest generators without running buildStart/build.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const configFile = path.join(root, 'vite.config.js');
let source = fs.readFileSync(configFile, 'utf8');
source = source.slice(0, source.indexOf('export default defineConfig({'));
source = source.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(configFile).href));
source = source.replace(/from '([^']+)'/g, (match, specifier) => {
  if (specifier.startsWith('node:')) return match;
  const file = specifier === 'vite' ? path.join(root, 'node_modules/vite/dist/node/index.js') : path.resolve(root, specifier);
  return `from '${pathToFileURL(file).href}'`;
});
source += '\nreviewedRuntimeAssetExclusions = collectReviewedRuntimeAssetExclusions(ROOT).excludedAssets;\nwriteArtManifest();\nwriteThumbManifest();\n';
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
