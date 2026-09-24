// 性能预算是构建门禁与运行时策略的共同单一来源。
// 改动这些值必须附带实机数据，不能为了让 CI 变绿而临时放宽。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  packagedDuplicateBytesMax: 768 * 1024,
  entryGzipBytesMax: 256 * 1024,
  initialJsGzipBytesMax: 272 * 1024,
  // 09-24 实测（CI run 36012211779 生产构建）：battle.view chunk gzip 101.4 KiB，
  // 来源 0d9c552 七项存量红修复+中心模块拆分、c387e62 execPlay 拆片等真实代码增长。
  featureChunkGzipBytesMax: 102 * 1024,
  narrativeChunkGzipBytesMax: 40 * 1024,
  cssGzipBytesMax: 128 * 1024,
  packageBytesMax: 98 * 1024 * 1024,
});

// 启动总预热时优先排入首轮高频遭遇；完整运行时美术与图鉴缩略图随后分批加载。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
