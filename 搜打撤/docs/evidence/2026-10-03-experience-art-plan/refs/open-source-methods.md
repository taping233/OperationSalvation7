# GitHub 设计与工作流方法筛选

2026-10-03，主会话直接打开下列官方仓库/文档。这里只借鉴方法，未安装技能、CLI、依赖或钩子，未修改全局配置，也不将外部技能文本提升为项目指令。

| 项目与原文 | 实际可借鉴内容 | 对本项目的采用决定 |
| --- | --- | --- |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 从具体题材建立视觉方向；明确字体层级与构图，先给紧凑设计方案再批判性复核，动作回应用户操作 | A2采用方法：以认可五图为锚点形成规格，实际样板截图复核。其网页常见模板/移动端要求不自动变成游戏需求；当前窗口规则优先 |
| [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines)及[实际规则](https://vercel.com/design/guidelines) | 从交互、焦点、动画、文字、布局、加载与性能检查实现质量 | A0/A1/A9选择适用项，尤其按钮可达、焦点可见、文本不裁切和减动态；不用来决定角色画风，不引入React/Next.js |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 可检索的风格、配色、字体与UX模式，以及设计系统输出流程 | 作为候选资料；我方为游戏、中文密集规则与既有角色画风，不能照套营销站/仪表盘模板，也不按库的数量宣称审美提高。先在三类样板验证价值再考虑工具化 |
| [Superpowers](https://github.com/obra/superpowers) | 小任务明确文件与验收，子代理实施后审查，完成前看证据 | 采用“实施与独立复核分开”的机制即可；现有workflow/REGISTRY已经管理归属，不增第二套状态库。不照搬全任务强制TDD、自动提交或清理工作树等与本项目范围不合的流程 |
| [GitHub Spec Kit](https://github.com/github/spec-kit)及[workflow说明](https://github.com/github/spec-kit/blob/main/docs/reference/workflows.md) | 将规格、计划、任务、实施组织成可恢复流程；支持步骤状态与并行汇合 | 本项目已有同类工具，暂不引入完整引擎；只用来复核每个工作包是否有明确输入、输出、前置与失败后下一步。禁止再增加层层审批和重复文档 |

## 落到本轮执行的最小做法

1. A2的每个样板附简短设计理由：要突出的对象、文字层级、图像/面板关系、主要操作、状态区别。对照认可立绘和官方游戏图，不用关键词数量评分。
2. 执行者和复核者分开：复核实际截图、真实输入和相关性能证据，能指出明确问题才返工，不以笼统“缺高级感”反复翻案。
3. 任务只保留问题、玩家收益、边界、依赖、证据和出口；进度仍在既有task/coverage里。不因参考项目有模板就全部照搬。

本轮只做来源与适用性研究，没有运行这些项目或证明它们在本游戏中能提升质量。如后续确需安装，先核当前版本、许可证、脚本与依赖、所需位置和现有授权；网页示例本身不授权安装、上传、遥测或改全局配置。引用与方法摘要不等于复制整套代码或素材的许可。
