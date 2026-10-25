# 硬切与成就入场修复

2026-10-25，Friday。老板授权一起修复确认框退场、篝火恢复反馈、奖励“已收下”提示和成就奖章被遮幕消耗的入场。完成未提交。

## 实现

- `game/src/ui/confirm-dialog.js`、`game/css/review-ui.css`：原业务Promise即时返回，焦点与输入即时恢复；旧弹窗移除身份/动作标记并设为inert、aria-hidden，仅视觉壳淡出140ms。新确认框清理旧退场壳；旧回调只清自身，不影响新框。
- `game/src/ui/expedition-feedback.js`、`game/css/page-expedition-hud.css`：篝火反馈180ms淡入、140ms淡出；6秒后开始退场，点击关闭也退场。换页、替换和卸载立即清理旧层及旧完成监听，避免过期反馈覆盖新提示。
- `game/css/reward-completion-receipt.css`：保持既有1800ms生命周期，用前144ms淡入、最后180ms淡出；不修改结算、奖励发放或路由。
- `game/src/ui/achievement-gallery.js`、`menu-guide.js`、`game/css/title-achievements.css`：页面绑定时延后奖章入场，遮幕期间保留初态、隐藏并暂停自身CSS入场；冷入口外幕或热入口切幕移除后才播放一次。关闭、换页或主动筛选/打开详情会取消过期等待，不再迟到重播。
- 上述动效均保留减少动态模式的即时完成行为；未改玩家档案或玩法。

## 验证

- 7份定向测试68项：67通过，1项失败。通过文件为expedition-feedback、reward-completion-receipt、achievement-gallery-entry、achievement-gallery-close、save-management-review、overlay-dialog；ui-review-remediation有17项通过，顶栏结构用例期望`expeditionChapter`仍位于run-top-person，当前实现实际只有heroAva/hpHud，该项未通过。本轮未编辑其顶栏实现，未把它计为通过或扩展修复。
- 最终确认框增量后，单独运行ui-review-remediation的“确认层与输入所有权”：6项通过，12项按标题过滤跳过，不重复累计。
- 本轮4个JS、3个测试的ESLint和4份CSS的Stylelint通过。未build、全量或性能对照。
- 当前Codex内置浏览器、当前窗口、复用5200：真实打开成就总览，遮幕开始及600ms时奖章隐藏且waiting，无提前播放；约1150ms时切幕已移除、奖章可见且新入场正在播放，详见`gallery-runtime.json`。
- 真实进入城市、打开档位02覆盖确认并取消：逻辑确认层已移除、五档保留、焦点恢复；旧尾壳已在首次读取前结束，不能据这次浏览器快照单独证明退出中间帧。确认层退场存活、不可交互、新旧回调隔离与失败重试由新增及既有定向测试覆盖，见`confirmation-runtime.json`。
- 篝火与领取提示通过独立无存档预览 `.tmp/soft-surfaces-1025/preview.html` 的真实按钮调用同一生产UI实现；该预览不读取或写入玩家档案、不实际发放奖励，不作为完整营火/领奖玩法的实测。篝火计算动画为expeditionFeedbackIn，关闭后最终清理；领取提示1714ms时仍连接、透明度0.479，之后移除，见`notices-runtime.json`、`receipt-exit-runtime.json`。`notice-preview.png`仅为预览页截图。

无新服务或端口，原5200保留；临时内置标签页已关闭。未提交推送。
