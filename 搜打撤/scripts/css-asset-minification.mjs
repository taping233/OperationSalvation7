import { transformWithEsbuild } from 'vite';

const CSS_SOURCE = /\.css(?:$|\?)/i;
const SOURCE_MAP_COMMENT = /\/\*[#@]\s*sourceMappingURL\s*=/;

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
        if (!enabled) return;
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
          if (!asset.originalFileNames?.some(name => CSS_SOURCE.test(name))) continue;
          if (bundle[`${asset.fileName}.map`]) continue;
          const source = typeof asset.source === 'string'
            ? asset.source : Buffer.from(asset.source).toString('utf8');
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
