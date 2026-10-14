/* ============================================================
 * asset-url.js —— 运行时资产 URL 版本化
 *
 * 运行时字符串路径引用的资产（img.src / new Audio / fetch）不经过
 * Vite 的静态资产管线，无法自动哈希。统一走 assetUrl() 追加构建号
 * 查询参数，实现发版后的缓存失效。构建号由 vite.config.js 的
 * define(__BUILD_VERSION__) 注入；测试/无构建环境回退 'dev'。
 * ============================================================ */
/* global __RUNTIME_ASSET_ALIASES__ */
const RUNTIME_ASSET_ALIASES =
  typeof __RUNTIME_ASSET_ALIASES__ !== 'undefined' ? __RUNTIME_ASSET_ALIASES__ : {};
const BUILD_VERSION =
  typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';

export function assetUrl(p) {
  // Source/dev paths remain unchanged. Production aliases are injected only
  // after the build has verified equal bytes; query and public-base prefixes
  // remain attached to the same resource.
  const hashIndex = p.indexOf('#');
  const resource = hashIndex < 0 ? p : p.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : p.slice(hashIndex);
  const queryIndex = resource.indexOf('?');
  const pathname = queryIndex < 0 ? resource : resource.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : resource.slice(queryIndex);
  const match = pathname.match(/^(\.\/|\/)?(assets\/.*)$/);
  const canonical = match && RUNTIME_ASSET_ALIASES[match[2]];
  const published = canonical ? (match[1] || '') + canonical : pathname;
  return published + query + (queryIndex < 0 ? '?' : '&') + 'v=' + BUILD_VERSION + hash;
}
