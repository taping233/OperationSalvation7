# AOE悬停原始手牌投影（2026-10-21）

基线为已发布56efd4d3。四个生产文件与三个测试精确采用独立补丁；单次同步AOE目标循环仅解析一次原始手牌，逐目标费用、能力与资格检查不缓存，最终提交不接收该上下文。不存在跨帧、跨悬停或跨战斗缓存；独立生命周期审查无行为阻塞。

真实BattleSession.restore、render、startAim与派发pointermove/frame的jsdom路径中，四名存活敌人、9张原始手牌的投影8→1、findCardInState调用88→25、owned UID读取380→65；费用与能力检查均仍为8次。30/60张规模夹具同样投影8→1，不代表典型玩家牌量。四个预览文本逐字一致，现行tt3-flame-storm亦通过。计数不是耗时、堆字节或FPS。

- 独立29文件555项及两哨兵文件57项通过，列表与原报告见本目录。overlay哨兵使用仅跟随文件链接的读适配器，不冒充正常生产门；完整542模块检查无环/无违规/无失效守卫键。
- ab-summary.json绑定原源码4项预期优化失败/4项通过，错误aim级保留上下文3项预期新鲜度失败/5项通过，恢复候选8项通过。原始报告/日志完整保留；重放脚本仅供原独立目录重放，不在本证据目录直接执行。
- applied-patch.json记录精确补丁与七文件SHA；base-reconciliation.json证明只对齐已发布对象，旧index和31路径未变；prior-build-preservation.json证明重建前1595产物逐一匹配前批冻结清单。
- 唯一标准npm run build含原prebuild/postbuild通过；1595文件、171877082字节，entry gzip368132、initial JS gzip417834、CSS gzip226802，原预算不变。相对56efd4d3包体+92字节、entry/initial各+8字节；不宣称包体改善。静态产物资源闭环无缺件、排除项引用或警告，覆盖边界见原报告。
- 正常选择器staged门和普通hook随后记录于外部performance-preview-context-integration-56-20261021/preview-context-release-manifest.json与本目录不可变报告；本预冻结记录不预称通过。

当前批尚无内置浏览器实页、帧时或远端CI结论；jsdom派发事件不等同真实指针输入。无本批服务，不提交、推送或部署。新增上下文不涉及资源路径消费者；不改资源指纹、质量门或预算。
