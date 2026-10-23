# 公共动作执行准入

2026-10-23：普通弹窗、卡牌特写 footer、agent UI 命令已共用执行瞬间准入。修复已观察动作随后禁用仍执行，以及旧观察对象在换页后误击同名新按钮；未改变 Escape 规则、交易幂等、执行锁或防抖。

## 事实与复现

本地参考 `D:/素材/杀戮尖塔2源码/sts2-decompiled/` 的 `NClickableControl.cs:390/404/596` 统一检查启用、可见与输入状态；`ActiveScreenContext.cs:41` 决定活动层。这仅作为机制参考，未复制其实现。

项目修复前 agent 清单扫描过滤 disabled，而 `findUiElement` 执行反查与 router 回调调用没有再次准入，也未保留观察对象对应的原按钮身份。

在实际 agent 路由上新增两条断言：先观察后禁用；先观察后用含同名按钮的新页替换。修复前两例均实际失败：收到 `{ok:true}`，期望 `UI_ACTION_UNAVAILABLE`。证据 `action-admission-before-main.txt`，退出码1。首次误用了副本固定 root 配置，`action-admission-before.txt` 只有29例跳过；该份保留作过程记录，不作为复现或通过证据。

## 实现边界

- 新增 `game/src/ui/action-dispatch.js`，执行时核对当前活动容器、连接状态、disabled/aria-disabled、hidden/inert、退出中状态及 CSS 可见性；保留同步结果、业务 false、Promise、异常传播和 photo-source 元素参数。
- `ui/ui.js` 的 ovBody 委托和卡牌特写 footer、`agent/agent.action-router.js` 的 UI 路由均调用 `invokeUiAction`。普通弹窗仍允许基础动作回退，特写 footer 保持仅页面动作的契约。
- 从 `ui/overlay.js` 提取原焦点可用性判断到同一文件，原焦点/返回语义不变。agent 清单、反查、动作签名复用同一准入，删除原重复 disabled 判断；扫描内共享样式缓存。
- 观察对象通过 WeakMap 保留原按钮身份，不扩充序列化动作协议。agent 执行时核验原节点仍可用且动作名/参数仍匹配，阻止脱离页面或节点原地改绑后的旧引用。新鲜 JSON 命令仍按现行协议解析当前页面；没有宣称序列化丢失身份后仍能辨认历史来源。

修改/冻结清单仅为下列7文件，SHA256 见 `action-admission-source.json`：

```text
game/src/ui/action-dispatch.js
game/src/ui/ui.js
game/src/ui/overlay.js
game/src/agent/agent.action-router.js
game/src/agent/agent.surface.js
tests/action-dispatch.test.js
tests/agent-command-results.test.js
```

## 验证

主线执行：

```text
node node_modules/vitest/vitest.mjs run --config vite.config.js --maxWorkers 1 tests/action-dispatch.test.js tests/agent-command-results.test.js tests/overlay-dialog.test.js tests/agent-channel-pump-lazy.test.js
```

最终4文件79例全部通过，退出码0，见 `action-admission-final.txt`。覆盖实际普通弹窗和特写 footer 的执行入口、agent 观察后失效、同节点动作名/参数改绑、特写覆盖来源页、有效连续调用、返回值和 photo-source 参数，以及原焦点/取消、agent lazy 调用契约。

7文件定向 ESLint、逐文件 `node --check`、`jsconfig.runtime.json` 实现类型检查、定向 `git diff --check` 均退出码0，见 `action-admission-static.txt`。Git 的 CRLF→LF 提示没有改变检查退出码。

未全量测试、构建、提交或推送。未实施统一 Escape 所有者、异步动作锁或节流。实页与副本同步由主代理协调；当前按其消息暂缓同步，避免打断5357导航对照，待通知后按冻结SHA精确同步。
