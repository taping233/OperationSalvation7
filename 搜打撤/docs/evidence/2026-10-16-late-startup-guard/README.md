# 晚启动提示自愈修复

## 结论

12 秒仍未完成启动只表示耗时较长。提示保留唯一的就绪监测；即使 12 秒后才启动完成，也会撤条停表。真实 SCRIPT/LINK 资源错误仍明确报错，不被等待提示或晚就绪覆盖。用户收起提示或离开页面会释放监测与事件监听，不反复弹出。

本轮只修改 `game/index.html` 的内联启动 guard，新增 `tests/startup-guard.test.js` 及本证据目录。模块入口、CSS 链接和其他源码未改。index 中此前已有的两条 NotoSans 字体预载删除原样保留，不属于本修复；`scope-check.json` 已用逐字前后段比较确认 guard 外字节未变。

## 原因与修复

父会话在普通刷新较慢时看到底部“加载失败”持续存在，随后标题已加载且能进入档位继续游戏；当次未见游戏 Failed 资源日志。浏览器扩展 metadata 错误、输入超时没有被视为游戏资源失败的证据。

旧 guard 在 12 秒时无条件显示失败条并清除 interval，因此无法执行注释承诺的“不论多晚就绪都撤条”。此外，任意 `window.SDT` 就算就绪会早于实际启动：命名空间在模块装配早期建立，`GameStore` 的初态仍是 `boot`。

修复保持 400ms 的单一检查节拍：

- 首个达到 3 秒的检查显示原有中性加载提示
- 12 秒后只升级为“加载耗时较长”，继续检查；`barTone` 只允许阶段变化时更换条，不会每 400ms 重建
- 沿用现有 `game.boot.js` 的标题控件绑定标记 `title.dataset.controlsBound === 'true'`，同时要求 `SDT.game.state` 存在且已离开 `boot`；不新增启动 API，也不把空 SDT 或静态标题 DOM 当作就绪
- 完整就绪时撤条并清除 interval；如果一个节拍内已经进入 modal / idle，同样能识别就绪
- 真实 SCRIPT/LINK 错误覆盖任意等待条，立即停表并保留明确失败条；随后就绪不能抹掉该已证实错误。就绪停表后也保留资源错误报告能力
- 收起提示或 `pagehide` 会清除 interval、移除提示并注销 error / pagehide 监听；用户主动收起后不再弹出

仍在等待且用户未收起的页面只有一个 interval；就绪、真实错误、收起、离页后均无 interval。资源错误后的失败条只等待用户收起或页面离开，不自动假定失败已经恢复。

## 验证

最终命令：

```sh
npx vitest run tests/startup-guard.test.js tests/full-review-regressions-world.test.js tests/contracts.test.js tests/architecture-boundaries.test.js tests/boot.test.js --reporter=verbose
npx eslint tests/startup-guard.test.js
# Acorn 直接解析 index 的内联 script；git diff --check 核对范围内空白
```

结果：5 个测试文件、91 个用例全部通过。其中新 guard 专测 22 例覆盖 3s、12s、长期等待不重建、空/部分 SDT 不误判、快速及晚就绪、标题已进入 modal / idle、关闭、SCRIPT/LINK 在提示前/等待中/12s 后及就绪后的真实错误、重复错误、普通 window/IMG 错误忽略，以及离页清理。既有 WORLD-005、真实 main.js 启动冒烟、契约及架构边界一并通过。新测试 ESLint、内联 Acorn 语法和范围内 diff 空白检查通过。

修复前先对原 guard 运行了初版 21 例专测：20 失败、1 通过，见 `before-test.log`。之后为“就绪后仍报告真实资源错误”补了第 22 例，最终完整结果见 `focused-test.log`。旧 WORLD-005 只在 12 秒后关条、再设置空 SDT，无法证明未关闭时的晚就绪自愈；本轮保留其原契约，使用新专测补齐缺口。

`boot.test.js` 的日志包含 jsdom 音频 codec 以及 `card:martial-melee` 映射警告；该命令退出 0，不把此模拟环境结果视为真实浏览器媒体或网络验证。

## 证据与边界

- `guard-only.patch`：相对本轮开始时工作区的精确 guard diff，排除 index 的既有改动
- `scope-check.json`：范围检查与 index / guard / 测试 / patch 的 SHA256
- `before-test.log`：原 guard 的确定性失败复现
- `focused-test.log`：最终 91/91 定向回归
- `validation.log`：测试文件 lint、内联语法、diff 空白检查

本子任务未操作浏览器、服务、构建、暂存或提交。晚启动与资源错误由真实内联代码、jsdom 和可控时钟确定性验证；没有通过真实浏览器人为延迟模块或制造 404，也没有在本子任务复现一次自然超过 12 秒的云端加载。

父会话在 2026-10-15 22:09 UTC 回报：重启 5300 后正常读档成功，这次正常启动没有慢失败条。此为父会话的实机快路径验证，不属于本子任务直接操作证据；自然慢启动难稳定复现，不能将普通快速刷新等同于超过 12 秒晚启动的实页通过。该修复不推断本次慢加载的网络或扩展根因。
