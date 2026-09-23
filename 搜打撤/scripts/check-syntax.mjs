import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['game/src', 'scripts'];
const sourceExtensions = new Set(['.js', '.mjs', '.cjs']);
const skippedDirectories = new Set([
  'node_modules', 'generated', 'vendor', 'vendors', 'third_party', 'third-party',
  'dist', 'coverage', '.tmp', '__pycache__',
]);
const sourceFiles = [];

async function collectSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name.toLowerCase())) {
        await collectSources(path.join(directory, entry.name));
      }
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      sourceFiles.push(path.join(directory, entry.name));
    }
  }
}

for (const root of sourceRoots) {
  await collectSources(path.join(projectRoot, root));
}

const failures = [];
for (const file of sourceFiles.sort()) {
  const relativePath = path.relative(projectRoot, file).split(path.sep).join('/');
  const source = await readFile(file, 'utf8');
  try {
    parse(source, {
      ecmaVersion: 'latest',
      sourceType: path.extname(file).toLowerCase() === '.cjs' ? 'script' : 'module',
      locations: true,
      allowReturnOutsideFunction: path.extname(file).toLowerCase() === '.cjs',
    });
  } catch (error) {
    const line = error.loc?.line ?? 1;
    const column = error.loc?.column == null ? 1 : error.loc.column + 1;
    failures.push(`${relativePath}:${line}:${column}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Syntax check failed in ${failures.length} file(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed (${sourceFiles.length} project files).`);
}
