# 战斗意图与对象反馈定向记录

2026-10-12。C 线，仅记录本线改动与检查；实页操作由主会话统一执行。

- `battle.intent.view.js`：保留复合意图各项；攻击力为 0 时仍显示 0，蓄力/防御不显示伪伤害；摘要包含实际流血加算层数。敌方意图容器及复合项节点由 A 线在 `battle.layers.js` 接入。
- `battle.vfx.js`：数字保留目标单位锚点，连续反馈按当前活跃文字占四个错位槽；文字只短距上浮。普通命中去掉全屏震动，火花和命中贴图缩小；治疗和自伤反馈不再铺全屏色闪。重击及击败仍有短强调。原反馈入队、血条阶段更新、场次失效、取消、倍速和局部渲染路径保持。
- `combat-feedback.css`：伤害、受击、治疗、格挡以颜色加边框和文字区分；减动效时文字静显并由原清理时钟移除。

定向验证：`npx vitest run tests/battle-feedback-view.test.js tests/battle-architecture.test.js --reporter=dot`，2 文件 15 测试通过；目标 ESLint、`node --check`、`git diff --check` 均通过。游戏实页的多段命中、治疗、格挡和敌方复合意图仍待主会话当前内置窗口复核。
