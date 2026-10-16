# 三堆摘要有效卡小补 R3

R7稳定副本冻结后，父级真实BOSS验证手牌不朽斩名称/图/ARIA、5伤、同UID回手均正确，但左下牌库按钮标题/ARIA仍报初始攻击。只读核实battle.core.js的pileTip仍走raw findCard；三个牌堆徽标共用此函数，牌库/墓地内部列表已用findEffectiveCard。

按父级批准，仅将pileTip的一行查询改为findEffectiveCard，保留卡身份分组、计数、原UID和牌堆规则；其他生产文件不动。既有真实Session测试新增三堆title/可点击按钮ARIA/内部列表同名、UID与原卡不变，以及普通战不触发、青龙/取消变形/非初始override实时摘要回归。

本补丁不在R7冻结副本内，必须单独验收。父级第二遍原full运行期间只备份、编辑与记录；尚未运行任何测试、lint或其他验证，等待父级完成信号。

父级另授权同一名称一致性小补：battle.preview.js唯一字符串改为“变形卡按当前效果结算，预览无法精算”，tests/r3-a-preview.test.js对应期望同步。unknown信心、null伤害及条件边界均不变；不扩展预览计算。该两文件同属R7冻结后独立增量，仍未运行任何测试。

## 独立小补验收与释放

父级确认R7第二遍原full终态后，本批再开始验证。`targeted.log`：7文件141项全部通过，包含真实Session新增2例、既有有效卡解析、battle architecture/facade、preview原边界与可读性。`syntax.log`：本批变更4文件语法通过；`lint.log`：4文件lint无错误；`typecheck.log`：既有8配置通过。没有重跑源树全量，以上结果不冒充R7 full覆盖。

生产delta严格仅两行：core堆摘要查询一行、preview理由字符串一行。既有Session测试新增2例，既有preview单个期望同步。完整补丁与逐文件before/after SHA见source-change.patch及source-change-sha256.json，四项最终SHA均已现场再次读取核实。其他view、引擎结算、layers/hash、浏览器、服务、build和真实存档未动。当前全部源码、测试、证据写入已完成释放，无自有运行中测试或静态检查进程。父级后续自然reload验证新摘要属于独立实页验收。
