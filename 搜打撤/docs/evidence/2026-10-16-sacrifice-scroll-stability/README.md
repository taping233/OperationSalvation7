# 献祭选牌滚动稳定修复

同一次献祭选牌里，点选或取消选中后保留候选区的滚动位置，焦点仍回到刚操作的候选。关闭后重开从顶部开始，选择不跨会话继承。

## 实现与范围

`openBagSacrifice` 的会话闭包保存自己的 `.sac-hand` 引用；重绘前读取该容器的 `scrollTop`，`showOverlay` 替换 DOM 后立即还原。保留既有 `focus({ preventScroll:true })`，让真实弹窗的延后首焦点逻辑继续保留主动焦点。

仅 [game.run.altar.js](../../../game/src/run/game.run.altar.js) 新增五行。原普通随身背包筛选、安全格/容器排除、献祭数量、确认扣牌与持久化逻辑均未改。未改 CSS。以本任务接手时源码快照为基准，移除这五行后与原文件逐字相同；差异见 [source-only.patch](source-only.patch)，哈希与检查结论见 [receipt.json](receipt.json)。

## 定向验证

- [新专测](../../../tests/sacrifice-scroll-stability.test.js) 在旧代码上 5 失败、1 通过；修复后 6/6 通过，见 [red.log](red.log)、[green.log](green.log)
- 使用真实 UI 点击委托、`showOverlay` 和延后焦点逻辑；鼠标 click detail=1、键盘激活对应 click detail=0 均验证 1229.899 浮点滚动保留
- 覆盖接近底部多选、选满三张后再点、取消选择和补选、确认前候选跨区导致的重绘、单张道具献祭数量上限、取消重开、过期回调不改新会话
- 新测试、献祭区域过滤、SYS03 事务、布局、撤离流程、contracts 与 architecture-boundaries 共 7 文件、84 测试通过，见 [tests.log](tests.log)
- 源码和新专测定向 ESLint 通过，两文件 Node 语法检查通过，见 [lint.log](lint.log)、[syntax.log](syntax.log)

jsdom 里的 scrollHeight=1952、clientHeight=592 是父任务实机数据夹具，不代表本任务做过布局测量。jsdom 不执行 Enter/Space 默认点击，新专测直接发送该默认动作生成的 click 形态；真实键盘输入仍待父任务的当前窗口实机复验。

本任务未使用浏览器、未起服务、未运行全量测试或构建、未提交。父任务负责实机复验。
