# 公共切换与关闭稳定

2026-10-26，`WF-flow-goals-1026` 的目标 1。修改完成，交主代理集中做当前窗口内置浏览器复验。

## 问题与修复

先补行为回归，修复前有效基线为 3 文件、14 通过、5 失败、0 异常：

1. 保存旧 `UI._finishHide`，新页面打开后再次调用旧函数，会清空新页面。
2. `sdt-overlay-close` 的同步监听中打开新页面，旧关闭逻辑随后继续解绑并清空新页面。
3. 关闭广播中再次关闭，会重复广播、建立第二次关闭。
4. 闸门子元素冒泡的 `animationend` 会提前结束整个闸门。
5. 公共完成器读取全局 document 的减少动态偏好，目标属于另一个 document 时漏掉其设置。

`overlay.js` 现在按 UI 实例保留关闭会话：重复关闭复用当前会话，立即关闭可结束该会话，新页面替换时取消旧会话。清理前核对会话身份及 overlay 实例，业务动作在关闭广播前解绑；广播或清理钩子中打开新页后，旧关闭退出。保留现有页面 revision、焦点恢复与输入归属机制。补充检查了被拒绝的 battle-body 替换：没有提交新页面时，原关闭仍能完成。

`overlay.js`、`interface-motion.js` 和独立宿主闸门复用 `completeSurfaceMotion` 的完成、取消与超时清理。完成器按目标 document 读取减少动态设置，过滤子元素事件，取消后迟到回调直接返回。新增可选 `slack` 和 timer-only 入口；默认调用仍保留原有 60ms 容差。旧窗口的 160/225ms、公共退出时长和闸门 700ms 兜底保持。普通页面在关闭请求时立即解除业务动作；原房间短退场仍按既有时点调用底层关闭。

## 修改范围

- `game/src/ui/motion-completion.js`
- `game/src/ui/overlay.js`
- `game/src/ui/interface-motion.js`
- `game/src/ui/transitions-director.js`
- `tests/motion-completion.test.js`（新增）
- `tests/transition-gate-lifetime.test.js`
- `tests/tools/overlay-lifecycle.property.test.js`

现有普通重开、重复关闭、立即关闭、闸门两条完成路径、独立宿主、设置/详情焦点回返用例均复用。

## 定向结果

- 有效修复前基线：3 文件、14 通过、5 失败、0 异常。报告 `node_modules/.cache/test-reports/2026-10-26T06-58-23.530Z-72e5ec32.json`。
- 修复后：8 文件、77 通过、0 失败/跳过/异常。报告 `node_modules/.cache/test-reports/2026-10-26T07-00-42.537Z-54215f14.json`。
- 最后将关闭归属固定为会话身份，并增加被拒绝的 battle-body 替换回归后，重跑受影响的 overlay、对话框、焦点三文件：48 通过、0 失败/跳过/异常。报告 `node_modules/.cache/test-reports/2026-10-26T07-04-07.102Z-2842647d.json`。其余五文件沿用前次结果。
- 四份源码和三份测试 ESLint 通过；对应 `git diff --check` 通过。

8 文件定向命令：

```text
npm run test:target -- tests/tools/overlay-lifecycle.property.test.js tests/transition-gate-lifetime.test.js tests/motion-completion.test.js tests/motion-ownership.test.js tests/surface-motion.test.js tests/overlay-dialog.test.js tests/global-ui-completion.test.js tests/comm-demo-lazy-entry.test.js
```

## 主代理实页复验

使用当前窗口正式 `window.SDT.UI` 构造窗口，选择 `glass` 模式并放入 `.glass-panel`，覆盖房间内轻弹层路径。下面是构造方法；实际点击与构造检查分别记录。

```js
const ui = window.SDT.UI;
const show = text => ui.showOverlay(text,
  `<section class="glass-panel"><button data-act="probeNext">${text}</button></section>`, 'glass');
// 旧完成句柄在新页打开后调用：新页保持可见，按钮动作仍有效。
show('旧页'); ui.hideOverlay(); const oldFinish = ui._finishHide;
show('新页'); ui.act('probeNext', () => window.__motionProbeHits = (window.__motionProbeHits || 0) + 1);
oldFinish?.();
// 等待至少350ms后检查新页，再真实点击“新页”。
```

另分别检查：

1. 一次性 `sdt-overlay-close` 监听中 `show('新页')` 并注册新按钮动作，再关闭旧页；等待至少 350ms 后新页及按钮仍有效。
2. 一次性关闭监听中再次 `ui.hideOverlay()`；同次关闭只广播一次，最后正常隐藏。
3. 关闭后立即再次关闭、关闭后打开设置/详情、减少动态下关闭，确认焦点、按钮和动画时序。

本子任务未操作浏览器、启动服务、运行 build/全量测试、安装依赖或提交；实页结果由主代理补入总记录。
