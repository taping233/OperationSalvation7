# 庭院离场生命周期补修（已实施，待父实页）

暂停或减少动态效果的庭院，经全页面快捷入口切到设置/照相馆后，宿主 DOM 已被替换，但原先仅在 RAF `loop` 中检查断连。此时 RAF 已停止，ResizeObserver、document visibility / media 监听、画布与雨声上下文仍存活。下一次基地自身重绘/关闭才会清理；这是离场释放缺口，不是声称每次重进都线性累积。

## 原始复现与影响

- `game/src/hub/hub.courtyard-runtime.js` 原 `loop` 检查宿主断连，`sync` 不检查归属，motionObserver 仅看 body class
- 支持的实际入口：`ui/quick-nav.js` Alt+0 设置 / Alt+7 照相馆可在局外直接替换基地，不调用基地自身 `closeBase` / `renderHub`
- 隔离复现使用真实 courtyard runtime、真实雨台/锦鲤引擎及真实 overlay.showOverlay，仅 Canvas、AudioContext、RAF、ResizeObserver 是浏览器 API 替身
- 修前3项证实现状，见 `courtyard-test.log`；原断言保存在 `courtyard-lifecycle.before.js`，该档案只说明修前行为，不能作为修后通过契约
- 暂停/减少动态场景中，换页后900px画布未归1、观察器未断开、document/media监听仍在；减少动态下开雨声，换设置后 AudioContext 未关闭，后续 visibilitychange 仍调用 resume

## 最小实施

仅修改 `game/src/hub/hub.courtyard-runtime.js`：统一 departed 判定覆盖断连、离开原 overlay、overlay hidden/closing/data-ui-closing。复用原 motionObserver，观察宿主每级祖先的直接 childList 与必要属性，不观察整个页面 subtree。离场可靠调用原幂等 dispose，自身 observer 也一起断开。雨/锦鲤算法、动效、音量、游戏状态均未修改。

正规新增 `tests/courtyard-lifecycle-deep-audit.test.js` 10项：暂停/减少动态/后台/普通换页、音频仅关闭一次、overlay隐藏/关闭标记/直接移除、在场偏好/暂停/可见性往返，确认两个观察器及document/media监听释放、所属RAF取消。证据配置仅导入该正规专测。

## 验证

- 修后10项全过：`courtyard-after.log`
- 新专测 + hub-courtyard-v3 + courtyard-koi + courtyard-rain-tableau + contracts + architecture-boundaries：6文件76项全过，`courtyard-regression.log`
- 精确源码与新专测的 Node语法、ESLint、diff whitespace 检查全过，`courtyard-lint.log` 为空表示 exit 0
- 本子任务未操作浏览器、实际玩家存档、服务、build或提交；当前窗口实页由父任务负责，不能用隔离通过替代

生产属地仅上述 runtime；正规新专测独占同名新文件。本批与照片原图后续补修分开记录。
