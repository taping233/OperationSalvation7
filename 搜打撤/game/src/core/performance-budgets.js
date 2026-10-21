// 性能预算是构建门禁与运行时策略的共同单一来源。
// 运行时策略改动必须附带实机数据；构建字节门以固定发布基线和有限余量控制回归。
// 构建字节达标不能证明实机帧率、交互延迟或解码内存达标。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  // 2026-10-21 老板批准全部构建体积上限在前值基础上提高50%；固定上限，不随构建自动上移。
  // 运行时预热及图片保留策略保持原值；授权与验证见 docs/evidence/2026-10-21-WF-portable-clean-1021/README.md。
  packagedDuplicateBytesMax: 1356 * 1024,
  entryGzipBytesMax: 540 * 1024,
  initialJsGzipBytesMax: 615 * 1024,
  featureChunkGzipBytesMax: 156 * 1024,
  narrativeChunkGzipBytesMax: 75 * 1024,
  cssGzipBytesMax: 345 * 1024,
  packageBytesMax: 330 * 1024 * 1024,
});

// 启动仅预热首轮高频遭遇场景；人物、卡图和图鉴由页面入口按需加载。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
