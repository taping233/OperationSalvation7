# 验收证据

按验收批次保存截图、日志和数据：`e2-*`、`e7-*`、`e8-*` 以及 `refactor-2026-09-28/`。证据只证明对应报告的时点与范围，不能单独代表当前全量验收。

`e8-card-migration-2026-09-27/catalog-before.json` 被卡牌盘点和生产测试直接读取；目录与文件路径保持不变。报告入口见[工程批次索引](../archive/engineering-2026-09-27/README.md)和[重构执行记录](../REFACTOR-2026-09-28.md)。

[Agent 输出逐项快照](agent-output-inventory-2026-09-28.tsv)列出本机 `output/` 的 250 个实验子目录和 67 个根文件；背景与保留理由见[项目文件夹盘点](../PROJECT-FOLDER-INVENTORY-2026-09-28.md)。`output/` 被 Git 忽略，快照中的路径只在对应本机现场核实过。

[低成本优化与验证记录](LOW-COST-OPTIMIZATIONS-2026-09-28.md)记录照相馆选片台修复、当前窗口实页、隔离构建预算、字体许可边界及研究所未验证项。

[第六轮隔离生产构建日志](refactor-2026-09-28/round6-isolated-build.log)保留前置数据校验、Vite 转换与 postbuild 预算的完整输出；该产物目录已在收尾时清理。
