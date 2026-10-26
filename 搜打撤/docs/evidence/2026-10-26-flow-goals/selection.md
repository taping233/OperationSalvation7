# 公共选卡操作连续性

## 问题与改动

同一 root 在确认或取消尚未结束时重新绑定，会重置 busy/submitted；旧请求结束后只刷新旧绑定。已成功提交后重绑也会重新开放确认，旧请求失败仍会触发过期错误回调。另有已选候选变成不可用后，重绑仍保留选中外观的问题。

新增 6 项行为回归，修改前全部复现失败：在途确认重绑、成功后重绑、在途取消重绑、旧确认成功后的当前显示、换候选后的旧错误隔离、失效选中清除。

`game/src/ui/discovery-selection.js` 现在用同一选择会话保存选中、在途状态、提交结果和反馈。相同的有效 root、操作名与候选 DOM 延续会话；新候选集合创建独立会话。异步完成只通知该会话当前的绑定，重绑后的旧控件句柄保持失效。选择和反馈原位更新，滚动、焦点及卡牌内容沿用现有节点。

确认/取消仍使用原 UI.act 和领域回调，支付、授予及持久化继续由调用方负责。成功取消继续沿用原选中清除与焦点返回行为。

## 定向结果

- 基线：新增 6 项均失败。
- 修复后：`tests/discovery-selection-rebind.test.js`、`tests/discovery-selection.test.js`、`tests/fast-bug-sweep-round2-discovery-input.test.js` 共 26 项通过，0 失败、0 跳过、0 异常。
- 上述生产文件与新增测试的 ESLint、语法、diff 空白检查通过。
- 实页由主代理在当前平台内置浏览器集中复验。

命令：

```text
npm run test:target -- tests/discovery-selection-rebind.test.js tests/discovery-selection.test.js tests/fast-bug-sweep-round2-discovery-input.test.js
node node_modules/eslint/bin/eslint.js game/src/ui/discovery-selection.js tests/discovery-selection-rebind.test.js
```

## 实际复验入口

- 开发样例：当前 Vite 的 `/dev/selection-family-review.html`，复用正式选卡组件，核对点击选中、确认、取消和键盘操作。
- 游戏入口：背包发现、战斗发现、安全格交换均消费该公共组件；录像 16:14–16:24 的背包/卡详情/三卡选择往返和 22:48–23:00 的战斗三卡发现可用于定位相同操作场景。
- 异步重绑场景：在当前内置页面使用正式 `bindDiscoverySelection`，确认返回一个可控 Promise，等待期间对同 root 再 bind；真实点击/Enter/取消均保持等待，Promise 返回 false 后同一候选可重试，返回成功后确认保持禁用。换候选集合后，旧 Promise 的成功/失败不改变新选择与反馈。
- 覆盖以对应场景为准，录像采样用于定位操作，画面切换的原因结合当前场景核对。
