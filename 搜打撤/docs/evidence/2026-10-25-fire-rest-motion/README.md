# 营火恢复演出

2026-10-25，Friday，WF-fire-rest-motion-1025。完成未提交。

营火的回复生命和复原卡牌在结算后立即播放演出，结束后回到既有结果页。回血用绿色光环、上升光点、实际回血数字和生命条填充，时长1.4秒；复原用本次实际卡牌快照逐张显现，时长1.7秒，并补上复原音效。演出参数维护于 motion-presets，表现模块不授予奖励或改存档。

演出与保存并行，期间拒绝重复操作和离开；切页时移除旧演出，保存或动画迟到结束不得重画替换页。满血、空池和背包容量守卫沿用原流程。减少动态效果时直接显示结果，重进不重播已使用操作。仅改营火这两个操作。

## 验证

- 定向7文件113项通过：fire-rest-feedback、project-bugfix-expedition-1023、full-review-regressions-world、sys03-altar-restore-txn、rooms-review-remediation、contracts、architecture-boundaries。覆盖实际回血差、重复卡和强化快照、动画结束与超时、连点/退出、切页取消、减少动态效果、存档失败和原营火业务。
- 本轮源码和测试 ESLint 通过；新样式 Stylelint 通过；docs:check 通过；自有路径 diff 空白检查通过。
- `jsconfig.runtime.json` 类型检查失败，共14条，位于本轮未改的 base-page-motion-v7、event-branch-choice、game.run.class-choice.page、camp-entry、map-passage、page-visual-ready、silent-node-film、transition-handoff。本轮涉及的源码未出现在诊断中；不声称完整类型检查通过，未扩范围修复。
- 当前 Codex 内置浏览器、当前1280×720窗口，复用 localhost:5200。`game/dev/fire-rest-motion-review.html` 只构造内存营火，实际调用生产 openFireRest、生产卡库、UI委托和演出；无玩家档位、不读写玩家对局。真实点击回血/复原，确认18→26、成功取回冰刺和圣盾、结果区保留查看入口、使用后按钮禁用。正常回血自然播放后出现“继续探索”；页面 error/warn 记录为空。
- 截图为生产动画由验收按钮定格620ms的中间帧；定格仅用于取证，生产超时收尾仍正常。截图证明视觉结果，定向测试证明重复输入、存档和切页边界；未将隔离内存场景写成正常读档流程验收。

## 文件

- 实现：`game/src/ui/fire-rest-feedback.js`、`game/css/fire-rest-feedback.css`、`game/src/ui/motion-presets.js`、`game/src/run/game.run.altar.js`。
- 测试：`tests/fire-rest-feedback.test.js`、`tests/project-bugfix-expedition-1023.test.js`。
- 现行说明：`docs/modules/secondary-ui-style.md`。
- 隔离入口：`game/dev/fire-rest-motion-review.html`、`game/dev/fire-rest-motion-review.js`。
- 图像：[回血](heal.png)、[双卡复原](restore.png)。

本轮未build、提交或推送，未创建服务，未停止复用的5200服务。
