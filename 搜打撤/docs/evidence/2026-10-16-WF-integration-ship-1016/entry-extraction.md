# 异步选角与撤离流程集成修复

两组失败由测试夹具与当前合法运行环境不一致引起；没有修改生产源码。

- `tests/e4-async-entry.test.js`：会话 mock 只提供 `MAP.altar`，遗漏 `MAP.rules`。选角页当前显示基础生命、攻击，真实默认值由 `game/src/core/rule-config.js` 的 `growth` 提供（30、4），再由 `core/rules.js` 映射为 `playerMaxHp`、`playerAtk`；会话初始化和新局逻辑也依赖同一规则对象。补齐合法 mock 后，原先 11 个异常均消除。
- 同文件 `guards class grant transition (normal)` 随后显露过期契约：未领取补给即调用继续并期望回到地图。现行 `docs/rules.md` 第 7 行与 `docs/PARALLEL-REGISTRY.md` 的 `WF-entry-all-claim-1015` 已确认全部领取才放行。现在先断言未领取时仍为 modal 且没有继续按钮，再真实调用领取动作，确认 `taken` 与继续按钮，最后沿用原放行及旧回调失效断言。没有删断言或跳测试。
- `tests/extraction-flow.test.js`：mock 把 HTML 写入 `#body`，但没有暴露真实 `UI.init()` 会安装的 `UI.el.ovBody`。献祭重绘后恢复已点卡片焦点依赖该端口。为 mock 接上既有 body 节点，原三项撤离/整理业务断言保持不变。

验证：`npm run test:target -- tests/e4-async-entry.test.js tests/extraction-flow.test.js`，退出码 0；2 个文件、33 项全部通过（Vitest 3.2.7，2026-10-16 00:44 UTC，约 6.17 秒）。未运行全量、构建或浏览器；由主代理统筹最终冻结门。暂存、提交、推送均未执行。
