// 性能预算是构建门禁与运行时策略的共同单一来源。
// 改动这些值必须附带实机数据，不能为了让 CI 变绿而临时放宽。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  // 09-25 老板拍板「守卫的余量翻倍」：体积类预算按 新值 = 实测值 + 2×(旧预算 − 实测值)
  // 向上取整（实测取自同日本地生产构建：entry 242.9 / initial-js 255.7 / battle 102.1 /
  // narrative 31.0 / css 121.5 KiB、package 85.27 MiB、duplicates 0.62 MiB），
  // 为 A3 迁移等后续批次预留增长空间。startupPreload/retainedImage* 为运行时策略，不在本次范围。
  packagedDuplicateBytesMax: 904 * 1024,
  entryGzipBytesMax: 270 * 1024,
  initialJsGzipBytesMax: 290 * 1024,
  // 09-25 实测（CI run 36121460624 生产构建）：battle feature chunk gzip 102.1 KiB，
  // b3846cf 卡库三发现批增量顶破 102.0 旧预算后按同日口径重定。
  featureChunkGzipBytesMax: 104 * 1024,
  narrativeChunkGzipBytesMax: 50 * 1024,
  cssGzipBytesMax: 136 * 1024,
  packageBytesMax: 112 * 1024 * 1024,
});

// 启动总预热时优先排入首轮高频遭遇；完整运行时美术与图鉴缩略图随后分批加载。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
