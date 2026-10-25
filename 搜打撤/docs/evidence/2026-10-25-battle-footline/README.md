# 战斗主角脚线修正

2026-10-25，Friday。完成未提交。

当前窗口黑像与三名普通敌人对峙时，单位槽位底部同为屏幕 y=562.60，但主角动画画布的透明脚边为16.28逻辑像素（当前缩放约13.72屏幕像素），导致可见脚底悬在敌人脚线上方。

`game/css/battle-stage.css` 将主角 figure 按已有 `--battle-actor-foot-inset` 下移，头顶信息同步去掉原脚边偏移。接地影原有反向补偿保留；体型、敌人数量缩放、血条及技能位置不变。修改后figure底部为576.32，减去透明脚边后可见脚底回到562.60。

验证：Stylelint通过；battle-hand-layout与battle-card-results合计20通过、1失败。失败位于battle-card-results.test.js:103，仍要求旧顶栏选择器包含 `.sts-options`，当前源码此前已改为 `.sts-encounter,.bt-potions`，本次未修改该规则。未扩大修复。

Codex内置浏览器 http://localhost:5200/ ，当前1617×956窗口，通过标题节点测试入口及出发按钮真实点击进入不保存的战斗。黑像对步兵、弓手及拾荒者的脚线外观已观察，最终截图见[after.jpg](after.jpg)。页面error/warn采样为空。未验证其他角色、皮肤、减少动态模式及完整存档跑局；无新服务、build或提交。
