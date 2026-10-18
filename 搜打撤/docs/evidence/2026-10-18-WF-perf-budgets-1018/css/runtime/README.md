# 群体拖牌预览的同步快照复用（2026-10-18）

本轮范围经主会话从 CSS 审计转为战斗运行时定位。修复只覆盖一次群体拖牌进入合法战场空地时的同步预览；4 名存活敌人的快照请求从 **8 次减为 1 次**。`getSnapshot()` 即使命中缓存仍采集状态并计算深层签名，减少重复请求可省去对应工作；本实验未测量帧率、耗时或内存收益。

生产仅改 `game/src/battle/view/battle.aim.js` 和 `battle.hover.js`：在一次同步 hover 回调中取一次快照，用于死亡过滤并传给各敌人预览。每个敌人的可用性/预览上下文检查保留；其他入口不传可选快照时仍自行读取当前状态。没有跨帧、跨输入或跨战斗缓存。

| 操作 | 修改前请求 | 修改后请求 | 结果 |
| --- | ---: | ---: | --- |
| 拖入合法空地，4 名存活敌人 | 8 | 1 | 4 个预览 |
| 原地持续悬停下一帧 | 0 | 0 | 原行为保留 |
| 移出后原地修改状态为能量 0、1 名敌人死亡，再进入 | 7 | 1 | 3 个能量不足预览 |

前后两组预览的完整 `outerHTML` 数组逐字节相同；都未提交出牌，取消后预览全部清除。A/B 使用真实 aim→hover 模块和 jsdom 指针/帧事件，core 快照、可用性与上下文为受控桩；这是调用量和 HTML 等价证据，当前窗口浏览器实页由主会话另验。

保存修改前原字节为 `battle.aim.js.before.txt`、`battle.hover.js.before.txt`。实验配置始终从这两份原文载入；`shared` 变体仅应用本次快照传递，不依赖当前生产文件是否已修改。PowerShell 重放：

```powershell
$env:SDT_HOVER_EXPERIMENT = 'baseline'
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/vitest.config.mjs
$env:SDT_HOVER_EXPERIMENT = 'shared'
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/vitest.config.mjs
$env:SDT_HOVER_EXPERIMENT = $null
node docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/verify.mjs
```

生产回归命令：

```text
node node_modules/vitest/vitest.mjs run tests/battle-area-hover-snapshot.test.js tests/battle-hover-play-availability.test.js tests/battle-drag-reference.test.js --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json --outputFile=docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/targeted-final.json
```

结果 **3 文件 36/36 通过**（1+14+21），无失败、无跳过。新增回归还验证未传快照的点击入口每次取新状态。原有 `battle-drag-reference` 只改 AOE 用例的两处调用断言以接收第 6 参数，并增加同一次 snapshot identity 验证，其余业务断言保留；修改前原字节也已保存。初跑 `targeted-initial.json` 的 1 红为此旧 spy 参数断言，最终结果见 [targeted-final.json](targeted-final.json)。文件 SHA 与 HTML 核验见 [verification.json](verification.json)。

现有实页入口为 `http://127.0.0.1:5319/dev/combat-overlay-review.html`，无需新增 DEV 页面。此页使用内存存储、真实 BattleSession 和 battle.view，预置 2 名 100 血训练木桩、9 能量及真实「血蝠风暴」。真实输入步骤：点「普通战重置」，等待 player 状态；按住「血蝠风暴」卡面（避开注能按钮），拖到敌人与手牌之间的战场空地并保持，检查两名敌人均出现预览；按 Esc 取消，检查预览清空且未耗能/出牌；再次拖入，检查预览恢复。点「注能·血蝠风暴」会进入注能选牌，不是本次 AOE hover 验收入口。该页构造开局，不代表自然推进证据。

本代理未启动服务、未使用浏览器、未 build，未修改 CSS、数值规则或共享素材指纹。目录内 `undefined` 是首次实验输出路径的中间文件，不作为证据来源或交付清单。
