# TT12 两项失败定向诊断

2026-10-20 22:16–22:17（Asia/Shanghai）：当前卡库来源 `sourceCardLibrary()` 返回 282 张牌，`tt12-hitechrd` 与 `tt12-freezeray` 均存在。

- 原套件单跑：`vitest run tests/card-description-text.test.js --reporter=dot`，退出码 0，18 项通过，日志 `original-alone.log`。
- 精确重跑此前失败组合：`vitest run tests/sts2-structured-description.test.js tests/card-description-text.test.js tests/runtime-hotpaths.test.js --reporter=dot`，退出码 0，46 项通过，日志 `combined-repeat.log`。
- 两次诊断间所记录的 12 项输入 SHA 均稳定；`inputs-before-original.json` 保存首次诊断输入，`input-comparison.json` 保存与两个测试结束后的比较。
- 自有描述实现自 22:13 后没有源码编辑；此次两套用例均以该最终增量运行通过，没有回滚主树、修改卡库/既有测试或使用编辑前副本。

当前不能复现先前两项缺牌失败；证据支持“运行当时 TT12 来源缺失”，不支持将其判成本次描述逻辑的稳定回归。失败时没有同步抓到全卡库 SHA，且当前 cards.data.js / cards.sync.js 的 mtime 为 22:15:13，因此不能区分此前并行写入瞬态与初始化瞬态，也不能宣称已证明具体根因。当前原套件与原组合均已通过，按任务边界停止深挖。

代表输入 SHA256：

- cards.data.js：1B36066F8CF8BBCA3B37BDD31FB3F3E15B9A5E0657F76890444BE964105A10FE
- cards.sync.js：4E818B3FD9273BAF7F470D5D6B223A2F457589CE9366E7983A62C93AA968C49A
- card-description-text.js：6A8BFEB28EB021F2A3A4B2B49A77BB33BF5A032CC082C6282D89EF1921F02255
- structured-card-description.js：3BE02C9985C2E66B1BDC1261CC5CB0E90EFF23A6142CCC56F072CA0B25FA140D
- cards.view.js：38735176857AEEE1FF86D3199D0284D9E43BD4F330778A0DED6CAF133725A8BB
- tests/card-description-text.test.js：51B6F2F0E8AA99BBB061F2E6EF1A5E2E466F0490631F1100887097A694C4C862
