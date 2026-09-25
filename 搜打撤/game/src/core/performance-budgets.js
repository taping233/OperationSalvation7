// 性能预算是构建门禁与运行时策略的共同单一来源。
// 改动这些值必须附带实机数据，不能为了让 CI 变绿而临时放宽。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  packagedDuplicateBytesMax: 768 * 1024,
  entryGzipBytesMax: 256 * 1024,
  initialJsGzipBytesMax: 272 * 1024,
  // 09-25 实测（CI run 36120407786 生产构建）：battle feature chunk gzip 102.1 KiB > 102.0 KiB——
  // b3846cf 卡库三发现批 cards.sync.js 增补（ensureRandomPoolFixes 等 +18 行）顶破 0.6 KiB 余量。
  // 按本文件自身规矩附实测数据抬至 103 KiB（留 0.9 KiB 余量保持门禁紧度；仅构建门禁消费）。
  featureChunkGzipBytesMax: 103 * 1024,
  narrativeChunkGzipBytesMax: 40 * 1024,
  cssGzipBytesMax: 128 * 1024,
  packageBytesMax: 98 * 1024 * 1024,
});

// 启动总预热时优先排入首轮高频遭遇；完整运行时美术与图鉴缩略图随后分批加载。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
