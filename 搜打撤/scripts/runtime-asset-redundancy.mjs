import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { full } from 'acorn-walk';
import { RUNTIME_REDUNDANCY_REVIEW } from './runtime-asset-redundancy-review.mjs';

// Git normalizes CRLF to LF; line endings do not change asset-path semantics.
const sha256 = code => createHash('sha256').update(code.replaceAll('\r\n', '\n')).digest('hex');
const posix = value => String(value).replace(/\\/g, '/');
const JS_SOURCE_RE = /\.(?:[cm]?js|jsx|tsx?)$/;
const ROOT_RE = /(?:assets\/|portraits\/frames\/|scenes\/|map-nodes\/|ui\/slot-)/;
const isString = node => node?.type === 'Literal' && typeof node.value === 'string';
const LEGACY_CHEST_FRAME_RE = /^scenes\/chests\/(?:small|medium|large|class|boss)-rig-(?:640-v1|v1)\/frame-\d{2}\.webp$/;
// Legacy and current safe timelines share frame-00 names. Match the retired rig
// directory as well, so keeping safe-simple-v7 cannot restore unrelated rigs.
const referenceNeedle = asset => LEGACY_CHEST_FRAME_RE.test(asset)
  ? path.posix.basename(path.posix.dirname(asset)) : path.posix.basename(asset);
// These candidates retain their source bytes. A changed/missing source must be
// reviewed again before omitting its whole family from a later production build.
const retainedSourceFamily = asset => LEGACY_CHEST_FRAME_RE.test(asset) && asset.includes('-rig-v1/')
  ? 'original-chest-rigs' : asset.startsWith('ui/slot-weather/') ? 'slot-weather' : null;
const referenceNeedles = asset => {
  const family = retainedSourceFamily(asset);
  return [asset, referenceNeedle(asset), ...(family
    ? [family === 'original-chest-rigs' ? 'rig-v1' : 'slot-weather'] : [])];
};
const pathNeedle = candidate => candidate.category === 'chests'
  ? referenceNeedle(candidate.path) : candidate.category === 'frames'
    ? path.posix.basename(candidate.path) : path.posix.basename(candidate.path, '.webp');

const isJoinedAssetRoot = node => node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
  && (node.callee.property.name === 'join' || node.callee.property.value === 'join')
  && node.callee.object.type === 'ArrayExpression'
  && node.callee.object.elements.some(part => isString(part) && /^(?:\.{1,2}[\/\\])*[\/\\]?assets(?:[\/\\]|$)/.test(part.value));
function hasJoinedAssetRoot(code) {
  let found = false;
  full(parse(code, { ecmaVersion: 'latest', sourceType: 'module' }), node => {
    if (isJoinedAssetRoot(node)) found = true;
  });
  return found;
}

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
    // Split asset roots can bypass template/concatenation matching entirely.
    // Treat joined arrays rooted at assets as opaque, even when currently static.
    if (isJoinedAssetRoot(node)) opaque = true;
  });
  return opaque;
}

function hasOpaqueRuntimeSourcePaths(filename, code) {
  if (JS_SOURCE_RE.test(filename)) return hasOpaqueAssetPaths(code);
  if (filename.endsWith('.html')) {
    return [...code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .some(match => !/type\s*=\s*["'](?:importmap|application\/json)["']/i.test(match[1])
        && match[2].trim() && hasOpaqueAssetPaths(match[2]));
  }
  return false;
}

function readRuntimeReviewSources(projectRoot) {
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

export function planReviewedRuntimeAssetExclusions(sources, catalogs, review = RUNTIME_REDUNDANCY_REVIEW, sourceAssets = null) {
  const excludedAssets = new Set();
  const warnings = [];
  if (!sources) return { excludedAssets, warnings: ['Runtime source scan unavailable; retaining reviewed assets.'] };
  const records = new Map(sources.map(record => [posix(record.path), record.code]));
  // One normalized digest per file per scan, shared by selectors and explicit
  // indirect URL inputs. The cache never survives a plan invocation.
  const digestCache = new Map();
  const matchesFingerprint = (filename, expected) => {
    const code = records.get(filename);
    if (code === undefined || typeof expected !== 'string') return false;
    if (!digestCache.has(filename)) digestCache.set(filename, sha256(code));
    return digestCache.get(filename) === expected;
  };
  for (const [consumer, dependencies] of Object.entries(review.opaqueConsumerDependencies || {})) {
    if (!matchesFingerprint(consumer, review.opaqueConsumers[consumer])) {
      warnings.push(`Changed/missing indirect asset consumer ${consumer}; retaining reviewed assets.`);
    }
    for (const [filename, expected] of Object.entries(dependencies)) {
      if (!matchesFingerprint(filename, expected)) {
        warnings.push(`Changed/missing asset path dependency ${filename} of ${consumer}; retaining reviewed assets.`);
      }
    }
  }
  try {
    for (const [filename, code] of records) {
      if (hasOpaqueRuntimeSourcePaths(filename, code)
        && !matchesFingerprint(filename, review.opaqueConsumers[filename])) {
        warnings.push(`Unreviewed dynamic asset consumer ${filename}; retaining reviewed assets.`);
      }
    }
  } catch (error) {
    warnings.push(`Runtime path analysis inconclusive (${error.message}); retaining reviewed assets.`);
  }
  if (warnings.length) return { excludedAssets, warnings };

  const changedSourceFamilies = new Set();
  for (const candidate of review.candidates) {
    const family = retainedSourceFamily(candidate.path);
    if (!family) continue;
    const actual = sourceAssets instanceof Map ? sourceAssets.get(candidate.path) : null;
    if (!/^[a-f0-9]{64}$/.test(candidate.sourceSha256 || '')
      || !Number.isSafeInteger(candidate.sourceBytes) || candidate.sourceBytes <= 0
      || actual?.sha256 !== candidate.sourceSha256 || actual?.bytes !== candidate.sourceBytes) {
      changedSourceFamilies.add(family);
    }
  }
  for (const family of changedSourceFamilies) {
    warnings.push(`Changed/missing reviewed source bytes for ${family}; retaining its source assets.`);
  }

  const unverified = new Set();
  for (const [category, fingerprints] of Object.entries(review.consumerFingerprints)) {
    if (Object.entries(fingerprints).some(([filename, expected]) => !matchesFingerprint(filename, expected))) {
      unverified.add(category);
      warnings.push(`Changed/missing ${category} selector; retaining its reviewed assets.`);
    }
  }
  const sourceText = [...records.values()];
  for (const candidate of review.candidates) {
    if (unverified.has(candidate.category) || changedSourceFamilies.has(retainedSourceFamily(candidate.path))) continue;
    if (candidate.category === 'frames') {
      const required = catalogPaths(catalogs?.[candidate.role]);
      if (!required) continue;
      const relative = candidate.path.slice(`portraits/frames/${candidate.role}/`.length);
      if (required.has(relative)) continue;
    }
    const needles = [...referenceNeedles(candidate.path), pathNeedle(candidate)];
    if (sourceText.some(code => needles.some(needle => code.includes(needle)))) continue;
    excludedAssets.add(candidate.path);
  }
  return { excludedAssets, warnings };
}

export function collectReviewedRuntimeAssetExclusions(projectRoot, review = RUNTIME_REDUNDANCY_REVIEW) {
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
  // No cross-call cache: config/buildStart/closeBundle must observe source edits.
  // Only retained source candidates carry this contract; historical approved
  // deletions remain absent and must not be treated as unreadable source assets.
  const sourceAssets = new Map();
  for (const candidate of review.candidates) {
    if (!retainedSourceFamily(candidate.path)) continue;
    try {
      const bytes = readFileSync(path.join(projectRoot, 'game/assets', candidate.path));
      sourceAssets.set(candidate.path, { bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') });
    } catch { /* Missing/unreadable bytes retain the complete reviewed family. */ }
  }
  return planReviewedRuntimeAssetExclusions(sources, catalogs, review, sourceAssets);
}

// The early manifest decision and the actual complete Rollup graph must agree.
// An async module restoring a reference (or files changing during the build)
// must fail loudly rather than publish a manifest that requests missing files.
function isStaticRawData(module) {
  const [filename, query = ''] = posix(module?.id || '').split('#')[0].split('?');
  const params = new URLSearchParams(query);
  const svgRaw = filename.endsWith('.svg') && params.has('raw');
  const textUrl = filename.endsWith('.txt') && params.has('url') && params.has('no-inline');
  if (!svgRaw && !textUrl) return false;
  try {
    const ast = parse(module.code || '', { ecmaVersion: 'latest', sourceType: 'module' });
    const value = ast.body.length === 1 && ast.body[0].type === 'ExportDefaultDeclaration'
      && ast.body[0].declaration.type === 'Literal' ? ast.body[0].declaration.value : null;
    if (typeof value !== 'string') return false;
    if (textUrl) return true;
    return /^\s*<svg[\s>]/i.test(value) && /<\/svg>\s*$/i.test(value)
      && !/<(?:script|foreignObject)\b|\bon\w+\s*=|\b(?:href|src)\s*=|url\s*\(/i.test(value);
  } catch { return false; }
}

export function assertExcludedRuntimeAssetReferences(modules, excludedAssets) {
  if (!excludedAssets?.size) return;
  if (!modules) throw new Error('Cannot verify reviewed asset exclusions without the complete Rollup module graph.');
  for (const module of modules) {
    const id = posix(module?.id || '').split(/[?#]/)[0];
    const code = module?.code || '';
    if (id.includes('/game/src/') && !/\.(?:[cm]?js|jsx|tsx?|json|css)$/.test(id) && !isStaticRawData(module)) {
      throw new Error(`Unsupported runtime source type ${id}; retain reviewed assets before building.`);
    }
    if (id.includes('/game/') && !id.includes('/game/src/') && JS_SOURCE_RE.test(id)
      && hasOpaqueAssetPaths(code)) {
      throw new Error(`Unscanned dynamic game asset consumer ${id}; restore publication before building.`);
    }
    if (id.includes('/game/') && JS_SOURCE_RE.test(id) && code.includes('join') && hasJoinedAssetRoot(code)) {
      throw new Error(`Joined asset root in runtime graph ${id}; restore publication before building.`);
    }
    for (const asset of excludedAssets) {
      if (id.endsWith(`/assets/${asset}`) || referenceNeedles(asset).some(needle => code.includes(needle))) {
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
