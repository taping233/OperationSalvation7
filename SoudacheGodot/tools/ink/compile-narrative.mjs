// ported from 搜打撤/scripts/compile-narrative.mjs（Godot 批次 4a ink spike）。
// 与网页版 prebuild 完全同源：直接复用 搜打撤/node_modules 里的 inkjs 2.4.0 编译器，
// 保证 Godot 侧编译产物与网页版 generated/narrative-events.js 字节一致。
// 产出：SoudacheGodot/data/narrative-events.ink.json（纯 JSON，供官方 Ink C# runtime 加载）。
// 用法：node SoudacheGodot/tools/ink/compile-narrative.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsInkDir = path.dirname(fileURLToPath(import.meta.url)); // SoudacheGodot/tools/ink
const godotRoot = path.resolve(toolsInkDir, '..', '..');           // SoudacheGodot/
const repoRoot = path.resolve(godotRoot, '..');                    // 代号柒/
const sourcePath = path.join(repoRoot, '搜打撤', 'narrative', 'events.ink');
const outputPath = path.join(godotRoot, 'data', 'narrative-events.ink.json');

// 以 搜打撤 为模块解析根，require('inkjs/full') 命中 搜打撤/node_modules/inkjs@2.4.0（CJS: dist/ink-full.js）。
const webRequire = createRequire(path.join(repoRoot, '搜打撤', 'package.json'));
const { Compiler } = webRequire('inkjs/full');

const inkjsVersion = JSON.parse(await readFile(path.join(repoRoot, '搜打撤', 'node_modules', 'inkjs', 'package.json'), 'utf8')).version;
const expectedInkjsVersion = '2.4.0';
if (inkjsVersion !== expectedInkjsVersion) {
  throw new Error(`inkjs version mismatch: got ${inkjsVersion}, expected ${expectedInkjsVersion}（必须与网页版编译器同版本）`);
}

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
if (errors.length) {
  throw new Error(`Ink compilation failed:\n${errors.join('\n')}`);
}

const json = JSON.parse(story.ToJson());
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(json)}\n`, 'utf8');
console.log(`Compiled narrative (inkjs ${inkjsVersion}): ${path.relative(repoRoot, sourcePath)} -> ${path.relative(repoRoot, outputPath)}`);
