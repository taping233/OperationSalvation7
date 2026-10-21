# 公共控件与战斗装备实现记录

## 现状与改动

原有普通按钮按页面分别实现悬停、按下、聚焦、禁用反馈；帮助、背包、商店详情与对话按钮缺少一致的状态轮廓。`base.css` 引入 `public-controls.css`，仅给普通按钮叠加不改变尺寸和 transform 的轮廓反馈；主动作、危险动作沿原语义色。战斗舞台、手牌详情和战斗决策控件排除在通用规则之外。减少动态时取消这些状态过渡。

现有说明单例在长内容时有滚动容器，但 `pointer-events:none` 使鼠标无法阅读滚动；指针越过锚点与浮框间隙会关闭说明。`term-tips.js` 对已显示浮框保留 120ms 跨越窗口、进入浮框后可继续阅读，浮框内部滚动不触发全局关闭，转入新锚点时立即切换，离开、遮挡、卸载与懒加载取消沿现有生命周期。`data-term` 的输入隔离和 `data-ui-tip` 的原点击/拖动路径未改。`term-tips.runtime.js` 是本轮前已有的懒加载文件，本轮未编辑。

原战斗装备只在角色名牌显示小型名称标签。首轮大文字装备卡在当前窗口实页遮挡、溢出，老板要求改成 StS2 战斗 Buff 式图标。参考本地 `NPower.cs` 的单图标与悬停说明、`NPowerContainer.cs` 的成组排列，本轮把装备挂载点从角色头顶名牌移到血条容器下方。`battle-equipment.css` 固定横向不换列，每件 48 设计像素，仅在主动技能图标角落显示可用/已用状态。卡图复用现有 `Art.cardIcon(card,{low:true})`；无图时回退项目工具图标。名称与完整效果通过原 `data-ui-tip` 显示，主动图标仍是 `data-act=btEquipSkill` 与原 UID 的按钮；禁用按钮外层可聚焦读说明。血条尺寸、角色位置、手牌与选靶层未改。

## 静态接线与验证

- 接线：`base.css → public-controls.css`；`battle.layers.js` 在原装备创建处把装备容器挂在 `parts.vitals`；`equipment-info.js → battle-equipment.css`；装备说明仍由 `term-tips.js → term-tips.runtime.js` 提供。
- 覆盖：现行对话与迷你按钮、帮助按钮、商店/出发的 `.ui-control`、商店整理的紧凑控件、背包排序/整理图标、背包按钮与关闭按钮；战斗中被动、可发动、结算中、本场已使用装备图标。顶部退出/静音及共享返回图标沿现有 `navigation-feedback.css`；标题主菜单已走专用 `home-plate` 动效。
- 大卡片首轮：`public-controls-tooltip`、`public-controls-equipment`、`term-tips-lifecycle`、`term-tips-lazy-boundary` 35/35 通过；战斗装备实际技能用例 1/1 通过；contracts/architecture 62/62 通过。Buff 图标改版后装备/说明/契约/架构合计 75/75 通过，`typecheck`、语法、目标 ESLint、Stylelint、`git diff --check` 通过。新测试核对装备图标尺寸、血条下挂载点及横向不换列；改版实页尚待父会话复核。
- 并行运行的完整 `battle-hand-inspector` 有 10 项注能工作区失败；失败点均不在本轮装备用例，另一个活跃任务持有战斗源码，本轮未调整其属地。当前平台内置浏览器实页由父会话负责，尚待回填视觉与输入结论。

## 混树边界

本轮开始时 `term-tips.js`、`equipment-info.js` 和 `battle.layers.js` 已有其他未提交增量；本轮在 `battle.layers.js` 仅改装备挂载一行及对应注释，不触碰同文件他人类型注解。`main.js` 与 `term-tips.runtime.js` 未编辑。最新 SHA256：`base.css` C6D3F9DFADB88C44C79E4F90B2479F3825EC113C3D8E278EC6B84FA52559268C；`public-controls.css` 710F79FA7A0FCD55C120A107C91D21A2B132FD8ABAF264B7E90C1E1C32ADC340；`battle-equipment.css` C98D1161B6B1AB8DA791F0EB7CDC9680160EACCF6CF6DB028B92CA3E450D21B9；`term-tips.js` 2863ECDC0ED44412209603D6C88253E1F923B3ED2AE180C649DD998AC7264E08；`equipment-info.js` A8FD72BC091304A346E9A1AEB52F0E93382579AA55192181E1874E9FC8396544；`battle.layers.js` 6D2C31DC0A213E62952BE53392ADCA4C07D18E46749A825F4CB7C118660714F4。
