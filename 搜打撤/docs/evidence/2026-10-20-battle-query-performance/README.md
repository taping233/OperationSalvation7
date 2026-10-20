# 战斗卡面与求费查询优化

有效卡面查询在单次调用内复用已找到的原始归属实例；没有跨调用缓存。拥有卡、临时卡、替身及转换规则改变后，下次查询立即读取新值。费用计算保留原优先级，只有实际进入消耗区法术折扣分支才扫描消耗区，并以计数循环代替 filter 临时数组。

## 同输入操作数验证

`tests/battle-query-cost-benchmark.test.js` 使用 60 个拥有卡实例、20 个消耗区 UID，每场景 100 次调用，以 UID 属性读取数计数；每次同时断言卡面引用或费用结果。基线为本轮开始时实际工作树源码，SHA256 见外部 baseline-sha256.txt。

- 有效卡面：12,000 → 6,000 次比较（降低 50%）。
- 固定费用覆盖消耗区折扣：21,000 → 0 次比较。
- 确实需要消耗区折扣：21,000 → 21,000 次，费用仍为 10。
- 这是确定性逻辑操作数，不是浏览器帧率、实际游戏 FPS 或整场加速比例。

复现：应用补丁前后分别运行 `npx vitest run tests/battle-query-cost-benchmark.test.js --reporter=dot`，比较 BATTLE_QUERY_UID_COMPARISONS 行；应用前需先放入该新增基准测试。外部 before.log 与 after.log 保存相同输入结果。最终代码完整定向记录见外部 focused.log。

## 本轮验证及边界

独立源码小副本中，8 文件 80 项通过：battle-card-inspection、battle-effective-card、battle-pure-rules、battle-nature-staff-cost、tt12-structured-preplay、battle-query-cost-benchmark、contracts、architecture-boundaries。

新增覆盖：owned/granted 单次归属扫描；原地替换、数组替换、迁入 granted、添加/移除替身；全局及结构化各高优先级费用；消耗区重复 UID、同名归属优先级、缺失 UID、替身类型变化与稀疏数组。既有回归覆盖转换卡面及实时来源、显式执行候选、旧卡修复、自然法杖回合限制和 TT12 结构化费用。

改动源码及两份测试 ESLint 通过；项目 typecheck 全部配置通过。测试使用隔离配置（jsdom，最多 2 workers），未运行 npm pretest 数据/剧情校验；未运行全量、构建或内置浏览器实页。应用到集成树后仍需按质量门补验，不能将此定向结果视为全量或实页通过。未改事件总线及派发顺序，未改渲染、存档、主工作树，未发布。

## 外部原始记录

原始日志保留在工作区 work-battle-cost-20261020/docs/evidence/2026-10-20-battle-query-performance/，不随发布提交。

- before.log: SHA256 cf9ecd88fdbfbe25f7a8b7d4f42c5c28ac157f71b37dd6bb138f9e211a7fedae

- after.log: SHA256 76dfa7823439b7dcda2cdd50c082f55f102c5127483704fe7770f91adebeeb6a

- focused.log: SHA256 04772e72e55d1455d2ed07499b6ce0a5a038609752bec408e1fa585e9f41b4dd

- typecheck.log: SHA256 f92af4f8c4e5b44caf1d71fb66382f39107fa6c1e0a1435ec7f63ab95864cbe2

- baseline-sha256.txt: SHA256 53a80aec6c87e9863b427b29d117d38e559c8babbc925c9eece6cbea18875490
