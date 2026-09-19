// 性能预算是构建门禁与运行时策略的共同单一来源。
// 改动这些值必须附带实机数据，不能为了让 CI 变绿而临时放宽。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  packagedDuplicateBytesMax: 768 * 1024,
  entryGzipBytesMax: 205 * 1024,
  initialJsGzipBytesMax: 240 * 1024,
  featureChunkGzipBytesMax: 90 * 1024,
  narrativeChunkGzipBytesMax: 40 * 1024,
  cssGzipBytesMax: 85 * 1024,
  packageBytesMax: 72 * 1024 * 1024,
});

// 标题页只准备首轮高频遭遇。其余场景在玩家选择路线时按目标格预取，
// 卡面与图鉴继续依赖 loading="lazy" / 缩略图，禁止恢复全量启动预热。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
