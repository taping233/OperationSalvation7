import { transformWithEsbuild } from 'vite';
import postcss from 'postcss';
import { posix } from 'node:path';
import { componentScopesPlugin, expandComponentScopes } from './css-component-scopes.mjs';

const CSS_SOURCE = /\.css(?:$|\?)/i;
const SOURCE_MAP_COMMENT = /\/\*[#@]\s*sourceMappingURL\s*=/;
const assetText = source => typeof source === 'string' ? source : Buffer.from(source).toString('utf8');

function hasUnmarkedLicenseComment(source) {
  return [...source.matchAll(/\/\*[\s\S]*?\*\//g)].some(([comment]) =>
    /\b(?:copyright|licen[cs]e)\b/i.test(comment)
    && !/^\/\*!|@(?:license|preserve)\b/i.test(comment));
}

// CSS loaded with new URL(..., import.meta.url) is emitted as an ordinary asset,
// bypassing Vite's CSS minifier. Only remove whitespace and non-legal comments:
// keep selectors, declaration order, identifiers and relative URL resolution.
export function minifyStandaloneCssAssets() {
  let enabled = true;
  let target;
  return {
    name: 'minify-standalone-css-assets',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      // Without composing the original map, changing mapped CSS would invalidate
      // its locations. Preserve both explicit source maps and hidden-map builds.
      enabled = config.build.cssMinify !== false && !config.build.sourcemap;
      target = config.build.cssTarget || undefined;
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
          if (!asset.originalFileNames?.some(name => CSS_SOURCE.test(name))) continue;
          let source = assetText(asset.source);
          // Scope expansion is a compatibility step, independent of compression.
          const expanded = expandComponentScopes(source, { from: asset.fileName });
          if (expanded !== source) {
            const reference = [...source.matchAll(/\/\*[#@]\s*sourceMappingURL\s*=\s*([^\s*]+)\s*\*\//g)].at(-1)?.[1];
            const inline = reference?.startsWith('data:');
            const mapName = reference && !inline
              ? posix.normalize(posix.join(posix.dirname(asset.fileName), decodeURIComponent(reference.split(/[?#]/)[0])))
              : `${asset.fileName}.map`;
            const mapAsset = bundle[mapName];
            if (reference && !inline && !mapAsset) {
              throw new Error(`Cannot expand component scopes without the source map: ${mapName}`);
            }
            if (mapAsset || SOURCE_MAP_COMMENT.test(source)) {
              const previous = mapAsset ? JSON.parse(assetText(mapAsset.source)) : undefined;
              const mapped = await postcss([componentScopesPlugin()]).process(source, {
                from: asset.fileName, to: asset.fileName,
                map: { prev: previous, inline: !mapAsset, annotation: reference || false },
              });
              asset.source = mapped.css;
              if (mapAsset && mapped.map) mapAsset.source = mapped.map.toString();
            } else asset.source = expanded;
            source = assetText(asset.source);
          }
          if (!enabled || bundle[`${asset.fileName}.map`]) continue;
          if (SOURCE_MAP_COMMENT.test(source) || hasUnmarkedLicenseComment(source)) continue;
          const result = await transformWithEsbuild(source, asset.fileName, {
            loader: 'css',
            target,
            charset: 'utf8',
            sourcemap: false,
            minifyWhitespace: true,
            minifySyntax: false,
            minifyIdentifiers: false,
            legalComments: 'inline',
          });
          for (const warning of result.warnings) this.warn(warning.text);
          asset.source = result.code;
        }
      },
    },
  };
}
