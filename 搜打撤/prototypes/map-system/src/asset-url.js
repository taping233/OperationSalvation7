/* ============================================================
 * asset-url.js —— 运行时资产 URL 版本化
 *
 * 运行时字符串路径引用的资产（img.src / new Audio / fetch）不经过
 * Vite 的静态资产管线，无法自动哈希。统一走 assetUrl() 追加构建号
 * 查询参数，实现发版后的缓存失效。构建号由 vite.config.js 的
 * define(__BUILD_VERSION__) 注入；测试/无构建环境回退 'dev'。
 * ============================================================ */
export const BUILD_VERSION =
  typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';

export function assetUrl(p) {
  return p + (p.includes('?') ? '&' : '?') + 'v=' + BUILD_VERSION;
}
