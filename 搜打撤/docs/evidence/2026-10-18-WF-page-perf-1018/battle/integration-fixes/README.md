# 冻结门战斗测试接入修正（2026-10-18）

七份定向测试的失败均已核实为夹具与现行契约不一致。本片只改这七份测试，没有修改生产源码、索引、共享文档或其他域文件。原字节保存在 `baseline/*.txt`。

## 原问题与修正

| 测试 | 原问题 | 保留或补强的校验 |
| --- | --- | --- |
| battle-all-cards | 扰敌只有一名敌人且未提交第二目标；星陨之力、龙焰射线直接给目标，合法地被必注能守卫拒绝，未进入夹具已有材料流程 | 扰敌改给两名敌人并完成不同目标选择，精确核对两敌各受1点伤害及扣费；必注能卡从材料入口提交，核对实际消耗2/1张材料、能量、目标状态收口及18/13点法术伤害。无前置条件零效果仍为硬失败 |
| battle-decision-readability | 固定命中区域上线后，阅读选择器由裸hover切为旧布局回退及 `.hand-reading`/键盘焦点两路；原精确CSS选择器已不存在 | 同时钉住两路当前完整选择器，继续核对阅读抬起、不缩放、拖拽变换、桥接和全部原CSS边界 |
| battle-effect-feedback | ui-scale替身缺少当前手牌命中控制器依赖的 `scale`，首次挂载异常再引发后续reset连锁失败 | 补单位缩放，不替换反馈模块；原32项聚合、飞行、计数、生命周期、图标与资源指纹断言全部保留 |
| battle-engine-facade | 精确导出清单少了已实现的四个接口 | 明确列入 `settlePendingSelections`、`emitBattlePresentation`、`emitRecast`、`handUnplayableReason`；精确集合与76项数量守卫保留 |
| battle-tools-lifecycle | 二级页仍假设销毁战场、返回销毁旧工具栏；注能仍假设后台工具必须disabled | 改验同一战场和工具栏保留、inert/aria-hidden遮罩与返回恢复；遮罩下点击不扣费。现有一次派发、分页、技能扣费/used/下回合复位、完整重建去重断言保留 |
| skull-sword-effective-session | 把后台保留手牌当作当前注能材料交互层 | 改验注能材料条目禁用、原因、不合法材料不入选，实际调用生产 `showCardZoom` 核对不朽斩规则与关闭后父页保留；能量、手牌不变继续校验 |
| ui-accessibility-regression | 仍用逐次setAttribute源码串断言，未适应差分setter | 钉住当前group/face角色、tabindex、aria-disabled和Enter/Space入口，并补验setter确实写入变化属性 |

## 验证

- 初次独立复现：7文件85项，41通过、44失败，见 [before-vitest.json](before-vitest.json)。其中反馈文件32红来自同一个缺失mock导出。
- 修正后其余6文件84项全部通过，见 [iteration-vitest.json](iteration-vitest.json)。
- 最终全卡审计1项通过，实际逐张执行268张卡，硬失败0，原条件环境的5条零效果提示保留，见 [all-cards-vitest.json](all-cards-vitest.json)。
- 合计七文件85项全部通过。测试没有新增skip、any匹配或绕过生产校验，也没有将三张卡改为条件豁免。

两个必注能卡的第一版新增正向断言曾错误期待普通战材料进入BOSS墓地；核对 `battle.exec-play.js` 后改验材料实际离手。之后精确伤害、能量和材料断言全部通过，生产逻辑未改。

```powershell
node node_modules/vitest/vitest.mjs run tests/battle-all-cards.test.js tests/battle-decision-readability.test.js tests/battle-effect-feedback.test.js tests/battle-engine-facade.test.js tests/battle-tools-lifecycle.test.js tests/skull-sword-effective-session.test.js tests/ui-accessibility-regression.test.js --maxWorkers=1 --minWorkers=1
```

本片未运行全量、build或浏览器，生产行为没有改动，不需要新增素材指纹或实页基线。源码与测试原/现字节指纹、报告计数见 `verification.json`。
