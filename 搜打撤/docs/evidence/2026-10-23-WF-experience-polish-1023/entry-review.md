# P1-ENTRY-01 技术验收

选人确认的两个等待点均须继续由原确认页面与对局持有；deferred 整备入口允许 `beforeConfirm` 创建新对局，随后改由整备页及新上下文持有。修改仅存在于 `.tmp/polish-1023/project/` 的选人叶页面与对应定向测试，未改主线源码、测试或配置。

## 已完成

- 教学保存等待结束后，普通入口检查原选人页仍挂载、可见且未关闭，另核验等待前捕获的对局上下文。deferred 入口检查 `isConfirmationCurrent`，上下文在 `beforeConfirm` 完成后捕获，保留合法换局。
- `beforeConfirm` 自身等待结束后，普通入口由仅检查节点连接改为同时检查原页面可见性与原对局上下文。deferred 继续使用其整备页有效性检查。
- 保留原三例回归，新增教学等待期间离页、隐藏、换局三个拒绝例；deferred 合法换局正例与教学等待期间 `isConfirmationCurrent=false` 拒绝例；`beforeConfirm` 等待期间隐藏、同档换局两个拒绝例。测试使用真实 `captureBattleContext`，未将其恒定模拟为成功。

## 证据

- `entry-red.txt`：原实现新增教学等待失效三个回归均失败；原有三例及 deferred 合法换局正例通过。
- `entry-green.txt`：首次修复后确认回归 7/7 通过。
- `entry-review-red.txt`：复核新增三个边界，deferred 失效正确拒绝；`beforeConfirm` 等待期间隐藏、换局两例暴露迟到确认，修前实际返回 true。
- `entry-review-green.txt`：复核修正后 `departure-class-confirmation` 10/10、`departure-browse-state` 7/7、`page-entry-cancellation` 3/3 通过，共 20 例。集中命令退出码 1，原因是第四套 `class-choice-lazy-entry` 静态依赖的 `scripts/architecture-graph.mjs` 未复制进隔离副本，套件未加载；并非已执行用例失败。
- `entry-review-lazy.txt`：按统筹授权原样复制缺失测试脚本后，仅补跑未加载套件；`class-choice-lazy-entry` 22/22 通过，命令退出码 0。预设 offline 故障用例有预期警告，全部断言通过。与前次 20 个有效用例合计 **42 个不同用例通过**。
- 测试依赖 `scripts/architecture-graph.mjs` 主线原件与副本 SHA256 均为 `B88CBDF88E8A2C65A8727F2C00F2A8A13EDAF4493F1E1B29EBE060F1F2624778`；只读复制未改内容或配置。

## 验收边界

本项技术验收已完成，无待补定向用例。未执行主线测试、全量测试、构建、安装或主线源码写入。实页核心旅程由独立代理执行，本报告不将 jsdom 输入与真实浏览器输入混记；真实浏览器下的受控写锁延迟竞态未执行，精确时序由上述受控 Promise 回归覆盖。
