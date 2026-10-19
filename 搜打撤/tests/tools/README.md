# 定向质量工具

这些工具补充既有 Vitest/ESLint/类型检查/jscpd。按一批改动集中运行，不替代项目质量门，也不默认每个小改全仓运行。

- `npm run quality:property`：稳定手牌支付规则；4条属性各500样本，固定 seed 20261018，以及3条既有测试。
- `npm run quality:mutation`：仅变异 `battle.hand-selection.js`，单进程；不改业务源文件。当前1个语义等价变异存活，报告如实保留，不跳过、不修改断言求满分。
- `npm run quality:unused`：Knip仅报告。独立tests/tools/knip.report.json配置将游戏JS列为入口以保护副作用/动态注册，因而不能据此声称死文件已清零。忽略 `.tmp/**` 中的生成式变异沙箱副本，仍报告真实源码、历史引用和外部工具缺口；缺失恢复文件不能视为已删除。禁止自动fix/delete。
- `npm run quality:axe-dom`：在JSDOM读取静态index，审查9类标签/ARIA规则；不执行应用脚本，不加载外部资源，不跑浏览器。退出0表示无已确认违规，仍须查看incomplete。不包含对比度、布局、Canvas或实页体验。

Stryker的配置与测试只覆盖一个纯模块；新模块要按真实边界另定范围。Stryker不能发现规格本身的误解。所有工具都不能自动证明审美、趣味或完整玩家体验。

日常Stryker/axe输出位于node_modules/.cache/quality-tools/，不会覆盖本批历史证据。

本批试用、许可、剩余问题和原始报告：[证据](../../docs/evidence/2026-10-18-quality-tools-trial/README.md)。

既有根knip.json保留原字节，本批专用配置不替代其既有入口/忽略约定。

## 奖励序列深化

`node node_modules/vitest/vitest.mjs run --config tests/tools/reward-sequences.vitest.config.mjs` 单独验证真实奖励状态、资源领取、容量整理UI及生产库存适配器。4属性1040组生成用例，含重复确认、存档重载、旧按钮、容量变化与计数守恒；详见[本次证据](../../docs/evidence/2026-10-18-reward-property-sequences/README.md)。这不是实页、异步重入或所有奖励路径的正确性证明。
