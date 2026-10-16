# 免注能牌效果结算修复

2026-10-16，Friday，聊天 01a144bf。

老板反馈：通过卡牌效果获得无需注能的牌后，不消耗材料直接打出，注能效果未触发。

## 原因与改动

`battle.card-inspection.js` 已识别实例上的 `_noInfuse`，因此不进入材料选择；但 `battle.exec-play.js` 原来仅凭实际燃料或全局“均已注能”状态传递已注能标志。结果免注能实例在结算器中仍被当作未注能牌，纯注能句被跳过，加伤和重复施放也不生效。

出牌执行器现在将 `_noInfuse` 一并纳入已注能判定。正常费用支付、实际材料消耗及累计材料计数路径保持原行为。规则说明同步至 `docs/rules.md`。

## 验证范围

- 新增 `tests/infuse-free-play.test.js`，真实 BattleSession 执行现役灵能召唤获取规则、临时卡置入及出牌链；仅将发现候选池固定为测试牌。覆盖纯注能治疗、可选注能加伤、注能重复施放，并检查扣能量、材料留手、无材料消耗、累计材料数不变和模板不被标记。
- 定向 Vitest：`infuse-free-play`、`battle-card-inspection`、`battle-resolution`、`abyss-sovereign`、`contracts`、`architecture-boundaries`，6 文件、110 项全部通过。
- ESLint：本轮执行器及新增测试文件通过；自有源码差异为注能标志判定及对应注释。
- Codex 内置浏览器当前 tab2、`http://127.0.0.1:5200/` 实见主菜单；未开新局或操作存档，战斗实页效果未核验。

未 build、暂存、提交、推送；未启动、停止或重启服务。
