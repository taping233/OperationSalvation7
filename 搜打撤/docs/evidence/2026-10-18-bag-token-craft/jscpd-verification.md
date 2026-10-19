# 通行证收拢后定向克隆复核

2026-10-18 UTC，Node22.23.3，沿用 tests/tools/redundancy-report.json，仅运行 `npm run quality:clones -- hub`。没有安装、改package、跑全域或重跑游戏测试。

hub由6组/59重复行/599重复tokens降为4组/37行/336tokens。两组通行证合成重复（原game.bag.js:368–381对652–664、382–389对667–674）均已不在相同阈值报告中；新game.bag.token-craft.js没有形成达阈值克隆。

剩余4组未扩整改：
- battle-settlement.commands：收据读取/事务创建的恢复和陈旧归属守卫，必须保留两入口校验语义。
- extraction.commands：卡牌提取/终局完成两种命令的档位、runId与inFlight守卫，不等同多余校验。
- departure.view-updates：两条reconcile路径的DOM顺序/尾部移除，可列以后评估，但本次未证明应该合并。
- game.bag.js:411–417对487–493：锦囊/珍珠盒分组流程，前置筛选谓词不同（pouchOf vs stored且无pouchOf）。保留容器边界，不能直接整段替换。

“剩余”不代表全部必需或全部有问题；该报告只证明这两组已消失，不证明业务正确性，业务测试见本任务其他证据。原13组前快照没有覆盖。

原始after：jscpd-hub-after.json；前后统计与剩余位置：jscpd-hub-comparison.json。
