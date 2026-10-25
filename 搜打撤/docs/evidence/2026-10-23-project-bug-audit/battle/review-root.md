# 根部 UI 候选独立反证

2026-10-23。只读核查源码/现行契约；未修改源码，未另开浏览器。结论已发主会话。

## UI-1：不应列为已确认的「选角被覆写」bug

`game/src/run/game-session-departure.js:50` 返回 `runtime.openClassChoice()`；轻门面 `game/src/run/game.run.class-choice.js:73-76` 只等待模块载入后调用页面并返回结果。叶页面 `game/src/run/game.run.class-choice.page.js:448-449` 是 `render(); return true;`，不等待玩家确认。真正角色赋值在独立的 `confirmClass` 处理器第 398-399 行。故「await newRun 等待玩家选角确认」这个前提不成立。

`game/src/run/game.run.dev.js:57-59` 明确写有「节点测试绕过了正常的选人流程；补齐一个真实角色」，并选择黑像/战士；`game/src/ui/game-map-controls.js:71` 也把该入口标记为开发者节点测试。当前证据支持“开发者测试局使用固定默认角色”，不能仅据强制黑像或一个错误模拟 newRun 的夹具报正常选角缺陷。主会话实页所见选人页短暂呈现可作为过渡闪现观察项，不能写成玩家确认的角色又被覆写。

## UI-2：建议确认 P2，题目限定为「整档保全/导入/中断导入恢复入口未接入选档页」

这是已实现功能缺少可达入口，不能概括为“所有恢复都不可用”：`slotRecovery` 按钮和上一 Run 检查点恢复仍存在，正常事务日志的自动恢复也存在。

直接证据：

- `game/src/ui/menu-slots.js:161` 调用 `bindSlotArchive`，绑定实际处理器；但选档页唯一操作区第 49-53 行只有进入/恢复上一 Run 检查点、覆盖重开、删除，没有导出、导入或中断导入恢复按钮。
- 全 `game` 生产 JS/HTML 搜索 `exportSlotArchive|importSlotArchive|recoverSlotImport`，每个名字只在 `game/src/ui/save-management.js:4,13,45` 的注册位置出现。没有生成对应 data-act 的页面，也没有程序调用这些注册处理器。
- `game/src/ui/menu-slots.js:116` 对基地主档异常建议“请先导出或恢复有效备档”；`game/src/ui/save-management.js:39` 在无有效上一检查点时建议“可先导出整档保全原始数据”；`game/src/ui/menu-settings.js:105` 的删档确认也建议先导出整档。这些都是面向玩家的当前操作承诺，但正常界面没有导出入口。
- 当前契约 `docs/save-format.md:163-167` 明确支持整档导入导出、异常档导出保全和中断导入的显式恢复，不是从未承诺的新功能。
- `game/src/hub/recovery.commands.js:94-100` 的进入档位自动恢复只读普通 journal，不能补上中断整档导入的恢复路径；对应 `sdt-import-v1-slotN` 只能由 `saveArchive.recoverImport` 清理。`game/src/hub/save-archive.js:119` 会因该记录拒绝下一次导入，普通写入也被拦。
- `tests/save-management-review.test.js:15,24,29` 是直接调用捕获的处理器，没有渲染选档页并检查实际按钮；这些 handler 单测通过不能证明 UI 可达。

最小人工路径：开始游戏 → 选档页，在任意已有档位寻找整档导出/导入，均无入口；若该档已有无有效上一 Run 检查点的损坏主档，点击“查看恢复选项”只显示导出建议，仍无法从页面执行保全。风险描述应是“玩家无法执行已提供的档案保全/导入/中断导入恢复操作”，不要写成数据已经删除或确认发生永久丢档。

本轮验证命令：定向 `rg -n` 查入口、处理器及调用链，均退出 0；未运行新增测试。主会话已有页面探针，应以其渲染/浏览器证据补齐最终报告。
