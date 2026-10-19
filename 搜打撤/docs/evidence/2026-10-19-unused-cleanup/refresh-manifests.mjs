// Reuse only Vite's existing manifest writers; do not invoke buildStart/cleanup/build.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { collectVerifiedRuntimeAssetAliases } from '../../../scripts/runtime-asset-aliases.mjs';
import { collectReviewedRuntimeAssetExclusions } from '../../../scripts/runtime-asset-redundancy.mjs';
import { RUNTIME_ASSET_DIRS, includeRuntimeThumbnailMetadata } from '../../../scripts/runtime-asset-publication.mjs';
const root = process.cwd();
const game = path.join(root, 'game');
const code = fs.readFileSync('vite.config.js', 'utf8');
const functions = ['getVerifiedRuntimeAssetAliases', 'getAliasedDuplicateAssets', 'collectImageFiles', 'writeArtManifest', 'writeThumbManifest'];
const ast = parse(code, { sourceType: 'module', ecmaVersion: 'latest' });
const declarations = functions.map(name => {
  const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  if (!node) throw Error('Existing manifest writer missing: ' + name);
  return code.slice(node.start, node.end);
}).join('\n');
const reviewed = collectReviewedRuntimeAssetExclusions(root);
if (reviewed.warnings.length) throw Error(reviewed.warnings.join('\n'));
const targets = new Set(['art-manifest.js', 'thumb-manifest.js'].map(f => path.join(game, 'src/generated', f)));
const context = { path, console, ROOT: root, GAME_ROOT: game, ASSETS_ROOT: path.join(game, 'assets'),
  ART_MANIFEST_DIRS: RUNTIME_ASSET_DIRS.filter(dir => dir !== 'sfx' && dir !== 'thumbs'), IMAGE_EXT_RE: /\.(webp|png|jpe?g|gif|svg)$/i,
  ITEM_ART_ALIAS: Object.freeze({ id: 'tt-token-color', target: 'cmtmvq6ss84l' }), aliasedDuplicateAssets: null, verifiedRuntimeAssetAliases: null,
  reviewedRuntimeAssetExclusions: reviewed.excludedAssets, collectVerifiedRuntimeAssetAliases, includeRuntimeThumbnailMetadata,
  readFileSync: fs.readFileSync, existsSync: fs.existsSync, readdirSync: fs.readdirSync,
  writeFileSync(file, bytes) { if (!targets.has(path.resolve(file))) throw Error('Unexpected generated target: ' + file); fs.writeFileSync(file, bytes); },
};
vm.runInNewContext(declarations + '\nwriteArtManifest(); writeThumbManifest();', context);
