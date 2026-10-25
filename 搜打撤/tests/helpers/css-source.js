import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { expandComponentScopes } from '../../scripts/css-component-scopes.mjs';

// Source-contract tests inspect the same expanded selectors served by Vite.
export function readCssSource(file, encoding = 'utf8') {
  const from = file instanceof URL ? fileURLToPath(file) : String(file);
  return expandComponentScopes(readFileSync(file, encoding), { from });
}

// Native nesting outside finite component scopes is flattened by Vite's CSS
// compiler. A Node child keeps esbuild's typed arrays outside jsdom's realm.
export function readCompiledCssSource(file) {
  return execFileSync(process.execPath,['--input-type=module','-e',
    "import {readFileSync} from 'node:fs'; import {transformSync} from 'esbuild'; process.stdout.write(transformSync(readFileSync(0,'utf8'),{loader:'css',target:'chrome105'}).code);"],
  { input:readCssSource(file),encoding:'utf8',maxBuffer:16*1024*1024 });
}
