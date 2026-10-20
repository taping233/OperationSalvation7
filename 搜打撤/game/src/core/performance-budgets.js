// 性能预算是构建门禁与运行时策略的共同单一来源。
// 运行时策略改动必须附带实机数据；构建字节门以固定发布基线和有限余量控制回归。
// 构建字节达标不能证明实机帧率、交互延迟或解码内存达标。
const PERFORMANCE_BUDGETS = Object.freeze({
  startupPreloadMax: 40,
  retainedImageCountMax: 96,
  retainedImageBytesMax: 192 * 1024 * 1024,
  // 2026-10-20 老板批准提高四项构建上限；固定参考基准：已发布 9b0fe799 同依赖隔离生产构建，
  // entry 356092 B / initial 404522 B / CSS 226967 B / package 222424745 B。
  // 固定上限分别保留约 3.52% / 3.79% / 3.77% / 3.71% 余量；不随新构建自动上移。
  // 对照与证据：docs/evidence/2026-10-20-approved-build-budgets/README.md。
  packagedDuplicateBytesMax: 904 * 1024,
  entryGzipBytesMax: 360 * 1024,
  initialJsGzipBytesMax: 410 * 1024,
  // 09-25 实测（CI run 36121460624 生产构建）：battle feature chunk gzip 102.1 KiB，
  // b3846cf 卡库三发现批增量顶破 102.0 旧预算后按同日口径重定。
  featureChunkGzipBytesMax: 104 * 1024,
  narrativeChunkGzipBytesMax: 50 * 1024,
  cssGzipBytesMax: 230 * 1024,
  packageBytesMax: 220 * 1024 * 1024,
});

// 启动仅预热首轮高频遭遇场景；人物、卡图和图鉴由页面入口按需加载。
const STARTUP_SCENE_KEYS = Object.freeze(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

export { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS };
