import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { full } from 'acorn-walk';
import { RUNTIME_REDUNDANCY_REVIEW } from './runtime-asset-redundancy-review.mjs';

const sha256 = code => createHash('sha256').update(code).digest('hex');
const posix = value => String(value).replace(/\\/g, '/');
const JS_SOURCE_RE = /\.(?:[cm]?js|jsx|tsx?)$/;
const ROOT_RE = /(?:assets\/|portraits\/frames\/|scenes\/|map-nodes\/)/;
const isString = node => node?.type === 'Literal' && typeof node.value === 'string';
const pathNeedle = candidate => candidate.category === 'frames'
  ? path.posix.basename(candidate.path) : path.posix.basename(candidate.path, '.webp');

// Opaque paths cannot be proved unused by searching for filenames. Every
// module constructing dynamic asset URLs needs an unchanged reviewed consumer.
// A new/changed constructor, syntax error or incomplete source scan retains
// all candidates. This never filters arbitrary assets by their date or suffix.
export function hasOpaqueAssetPaths(code) {
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const urlFunctions = new Set(['assetUrl']);
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration' && /asset-url\.[cm]?js$/.test(node.source.value)) {
      for (const specifier of node.specifiers) {
        if (specifier.imported?.name === 'assetUrl') urlFunctions.add(specifier.local.name);
      }
    }
  }
  let opaque = false;
  full(ast, node => {
    if (node.type === 'CallExpression'
      && (node.callee.type === 'Identifier' && urlFunctions.has(node.callee.name)
        || node.callee.type === 'MemberExpression' && (node.callee.property.name === 'assetUrl' || node.callee.property.value === 'assetUrl'))
      && !isString(node.arguments[0])) opaque = true;
    if (node.type === 'NewExpression' && node.callee.name === 'URL'
      && !isString(node.arguments[0])) opaque = true;
    if (node.type === 'TemplateLiteral' && node.expressions.length
      && node.quasis.some(part => ROOT_RE.test(part.value.cooked || part.value.raw))) opaque = true;
    if (node.type === 'BinaryExpression' && node.operator === '+'
      && [node.left, node.right].some(part => isString(part) && ROOT_RE.test(part.value))) opaque = true;
  });
  return opaque;
}

export function hasOpaqueRuntimeSourcePaths(filename, code) {
  if (JS_SOURCE_RE.test(filename)) return hasOpaqueAssetPaths(code);
  if (filename.endsWith('.html')) {
    return [...code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .some(match => !/type\s*=\s*["'](?:importmap|application\/json)["']/i.test(match[1])
        && match[2].trim() && hasOpaqueAssetPaths(match[2]));
  }
  return false;
}

export function readRuntimeReviewSources(projectRoot) {
  const result = [];
  const visit = relative => {
    const directory = path.join(projectRoot, relative);
    if (!existsSync(directory)) throw new Error(`Missing runtime source directory: ${relative}`);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (next === 'game/src/generated' || next.endsWith('.d.ts')) continue;
      if (entry.isDirectory()) visit(next);
      else if (/\.(?:[cm]?js|jsx|tsx?|json|css)$/.test(next)) result.push({ path: next, code: readFileSync(path.join(projectRoot, next), 'utf8') });
    }
  };
  for (const directory of ['game/src', 'game/data', 'game/css']) visit(directory);
  for (const entry of readdirSync(path.join(projectRoot, 'game'), { withFileTypes: true })) {
    if (!entry.isDirectory() && entry.name.endsWith('.html')) {
      const relative = `game/${entry.name}`;
      result.push({ path: relative, code: readFileSync(path.join(projectRoot, relative), 'utf8') });
    }
  }
  return result;
}

function catalogPaths(catalog) {
  if (!catalog || typeof catalog.sequences !== 'object' || !catalog.sequences
    || !Object.keys(catalog.sequences).length) return null;
  const names = Object.values(catalog.sequences);
  if (names.some(sequence => !Array.isArray(sequence) || !sequence.length
    || sequence.some(name => typeof name !== 'string'))) return null;
  const paths = new Set(names.flat().map(name => `${name}.webp`));
  if (catalog.staticFallback !== undefined) {
    if (typeof catalog.staticFallback !== 'string') return null;
    paths.add(`${catalog.staticFallback}.webp`);
  }
  paths.add('sprite-v1/neutral.webp');
  return paths;
}

export function planReviewedRuntimeAssetExclusions(sources, catalogs, review = RUNTIME_REDUNDANCY_REVIEW) {
  const excludedAssets = new Set();
  const warnings = [];
  if (!sources) return { excludedAssets, warnings: ['Runtime source scan unavailable; retaining reviewed assets.'] };
  const records = new Map(sources.map(record => [posix(record.path), record.code]));
  try {
    for (const [filename, code] of records) {
      if (hasOpaqueRuntimeSourcePaths(filename, code)
        && review.opaqueConsumers[filename] !== sha256(code)) {
        warnings.push(`Unreviewed dynamic asset consumer ${filename}; retaining reviewed assets.`);
      }
    }
  } catch (error) {
    warnings.push(`Runtime path analysis inconclusive (${error.message}); retaining reviewed assets.`);
  }
  if (warnings.length) return { excludedAssets, warnings };

  const unverified = new Set();
  for (const [category, fingerprints] of Object.entries(review.consumerFingerprints)) {
    if (Object.entries(fingerprints).some(([filename, expected]) => {
      const code = records.get(filename);
      return code === undefined || sha256(code) !== expected;
    })) {
      unverified.add(category);
      warnings.push(`Changed/missing ${category} selector; retaining its reviewed assets.`);
    }
  }
  for (const candidate of review.candidates) {
    if (unverified.has(candidate.category)) continue;
    if (candidate.category === 'frames') {
      const required = catalogPaths(catalogs?.[candidate.role]);
      if (!required) continue;
      const relative = candidate.path.slice(`portraits/frames/${candidate.role}/`.length);
      if (required.has(relative)) continue;
    }
    const needle = pathNeedle(candidate);
    if ([...records.values()].some(code => code.includes(candidate.path) || code.includes(needle))) continue;
    excludedAssets.add(candidate.path);
  }
  return { excludedAssets, warnings };
}

export function collectReviewedRuntimeAssetExclusions(projectRoot) {
  let sources;
  try { sources = readRuntimeReviewSources(projectRoot); }
  catch (error) {
    return { excludedAssets: new Set(), warnings: [`Runtime source scan unavailable (${error.message}); retaining reviewed assets.`] };
  }
  const catalogs = {};
  for (const role of ['wu', 'changwuyu', 'baita', 'heixiang', 'xingyue']) {
    try {
      catalogs[role] = JSON.parse(readFileSync(path.join(projectRoot,
        `game/assets/portraits/frames/${role}/sprite-v1/animations.json`), 'utf8'));
    } catch { /* An absent/unknown catalog retains that role's legacy files. */ }
  }
  return planReviewedRuntimeAssetExclusions(sources, catalogs);
}

// The early manifest decision and the actual complete Rollup graph must agree.
// An async module restoring a reference (or files changing during the build)
// must fail loudly rather than publish a manifest that requests missing files.
export function assertExcludedRuntimeAssetReferences(modules, excludedAssets) {
  if (!excludedAssets?.size) return;
  if (!modules) throw new Error('Cannot verify reviewed asset exclusions without the complete Rollup module graph.');
  for (const module of modules) {
    const id = posix(module?.id || '').split(/[?#]/)[0];
    const code = module?.code || '';
    if (id.includes('/game/src/') && !/\.(?:[cm]?js|jsx|tsx?|json|css)$/.test(id)) {
      throw new Error(`Unsupported runtime source type ${id}; retain reviewed assets before building.`);
    }
    if (id.includes('/game/') && !id.includes('/game/src/') && JS_SOURCE_RE.test(id)
      && hasOpaqueAssetPaths(code)) {
      throw new Error(`Unscanned dynamic game asset consumer ${id}; restore publication before building.`);
    }
    for (const asset of excludedAssets) {
      if (id.endsWith(`/assets/${asset}`) || code.includes(asset) || code.includes(path.posix.basename(asset))) {
        throw new Error(`Excluded runtime asset referenced by ${id}: ${asset}. Restore publication or review the selector before building.`);
      }
    }
  }
}

export function assertRuntimeExclusionPlanUnchanged(before, after) {
  if (before.size !== after.size || [...before].some(asset => !after.has(asset))) {
    throw new Error('Reviewed runtime asset selection changed during build. Rebuild from stable sources; no omitted asset may be silently requested.');
  }
}
