# 最终验证与待验范围

两轮代码实施和自动检查已完成。两轮结束时14文件119项通过，0失败；8组类型配置、相关JS的ESLint与两份新增CSS的Stylelint通过；现行文档检查600个相对链接，0项问题。随后存档动效修复的8文件103项通过，报告输入变化说明与实际播放缺口见[修复记录](archive-regression.md)。以下119项是两轮结束时的历史基线，提交时另验实际暂存快照。

[最终定向原始报告](../2026-10-19-WF-ui-target-motion-1019/2026-10-19T13-51-34.857Z-076e5f0a.json)执行期间源码、状态与环境指纹稳定，结果为candidate；报告只证明列明范围，不自动证明美术质量或完整实页交互。

## 自动检查范围

- 公共目标过渡：中断续接、相同目标去重、停止后继续、旧回调隔离、自有原生动画识别、隐藏/卸载的cancel、原生渲染状态竞态、减少动态、原inline属性及优先级恢复。
- 卡牌与成功回执：鼠标/键盘、材质色、回位节奏、缩放坐标、连续领取、落点锚点替换、同DOM移动、scroll/resize合帧、剩余期限、合并落点与清理归属、缺端点回退、关闭清理。
- 菜单筛选与面板：单装饰底板、保留按钮/焦点/滚动、空选中与卸载；面板快速反向、单透明度拥有者、刷新或contentOnly后的关闭准备、专属编排保留。
- 邻近回归：reward-card-feedback、card-feedback-motion-integration、bag-pane-retained、navigation-motion、reward-picker-continuity、reward-save-interruptions，以及contracts/architecture-boundaries。

测试文件和逐项输出以原始报告为准。初始13文件88项、清理修复补验5文件35项、第一轮8文件58项与最终119项有重叠，不累加成独立通过数。

## 实页证据与版本

初始实现的当前Codex内置浏览器真实输入记录：卡牌聚焦、两次连续领取与飞行中DOM、设置连续切换，见browser/reward-focus、reward-claimed、settings-selection。首次出现的原生隐藏清理异常保留在 [初始错误](browser/initial-cleanup-error.json)，已修正并有回归。

第一轮后，同一平台当前窗口、独立内存隔离页真实执行背包“招式→装备→全部”，每组选中底板唯一，未出现原清理错误；见 [背包截图](browser/round1-bag.png) 与同名JSON。奖励键盘切到稀有卡后，材质边缘为rgba(52,124,192,.84)，终态scale1.02、y=-6；见 [第一轮奖励](browser/round1-reward-focus.png)。这些是第一轮证据，没有操作玩家档位、修改持久设置或主动调整窗口尺寸。

## 第二轮实页阻塞

记录时间：2026-10-19 21:52（UTC+8）。恢复执行时平台明确移除了 `mcp__cua_repl` 工具，当前没有可调用的Codex内置浏览器控制接口。按项目规则保留现场，不切外部浏览器、CDP或headless，不以命令行模拟真实输入，也不拿第一轮图片充作第二轮验收。

待复核地址：`http://localhost:5200/dev/bag-reward-slice-review.html`、`http://localhost:5200/dev/feedback-1018-review.html`。没有重新检查或重启他会话的5200服务。

剩余场景：340ms领取与较弱落点的实际节奏；连续领取时合并回执、滚动后落点跟随；刷新后关闭面板无先行跳位；最终设置分类颜色、系统减少动态偏好。自动测试覆盖对应逻辑，但不能替代本轮视觉与真实输入证据。已保存第一轮现场和截图；第二轮保持待实页复核，未宣称达到参考视频水准。
