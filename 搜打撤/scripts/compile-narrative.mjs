import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/full';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'narrative', 'events.ink');
const outputPath = path.join(root, 'game', 'src', 'generated', 'narrative-events.js');
const source = await readFile(sourcePath, 'utf8');
const errors = [];
let story;
try {
  story = new Compiler(source, {
    errorHandler: (message, type) => errors.push(`${type}: ${message}`),
  }).Compile();
} catch (error) {
  throw new Error(errors.length ? `Ink compilation failed:\n${errors.join('\n')}` : error.message);
}
const json = JSON.parse(story.ToJson());
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath,
  `// Generated from narrative/events.ink by scripts/compile-narrative.mjs.\nexport default ${JSON.stringify(json)};\n`,
  'utf8');
console.log(`Compiled narrative: ${path.relative(root, sourcePath)} -> ${path.relative(root, outputPath)}`);
