# 项目状态快照 · 2026-09-27

核对时间：2026-09-27 08:10～08:15（Asia/Shanghai）。范围仅为 `D:\素材\代号柒\搜打撤` Vite 版。本轮更新文档与记忆，不修改游戏代码。

## 1. 当前基线与证据口径

- 包版本：`package.json` 为 **0.60.0**，不据此推断所有工作已经发布。
- 分支：`master`；HEAD：`dd5ac7f4a161079e3a41183ea1cdc89cc70158b0`（2026-09-26 18:12:33 +08:00）。
- 本地远端跟踪引用 `origin/master` 为 `2e3e80c`，HEAD 相对它 **ahead 2 / behind 0**。本轮未 fetch，服务器端是否另有更新未核实。
- 文档修改前工作区：**62 个已跟踪路径修改，29 个未跟踪条目**。未跟踪目录按条目计，不能当作文件总数。
- 已提交：由本地 Git 历史及当前源码接线核实。历史测试或浏览器结论均标为“原记录”，本轮没有重跑游戏测试、构建或页面验收。
- 在途：UI 大修和 Agent 后续迭代并存。`NEXT-AI-HANDOFF-2026-09-20.md` 与 `agent-iteration-playbook.md` 都已存在未提交改动，本轮保留原文，避免覆盖并行记录。

## 2. 09-24～26 已提交的主要更新

| 方向 | 当前核实内容 | 提交与入口 |
| --- | --- | --- |
| 战斗执行与拆分 | 执行会话、串行动作调度、逐拍播放、选择流程均已被引擎导入；装备、背包、生命周期、exec-play 已独立成模块 | `a85b857`、`0d9c552`、`c387e62`；`game/src/battle/` |
| 运行态与公共模块 | runtime 为 session/piles/interaction/effects/presentation 五域兼容导出；会话拆六片、卡牌库拆五片、UI 拆 overlay/cinematics/hud；命令公共管件和存储访问收口 | `0fa8fbf`、`7c35b56`、`fd72af8`、`abeeb94`、`8a711c0`、`1687d78`、`2460bc5` |
| 卡牌规则 A2/A3 | schema v2 增量键位与 pending 守卫已落地；A3 四批按提交记录新增 **47 张**结构化迁移（23+8+12+4），不是全卡库迁移完成 | `5daed46`、`bc9bce8`/`ee517e2`、`d75bb5a`/`dfae4b0`、`8e6687d`/`2e3e80c` |
| 卡库可靠性 | 同步脚本 carried 保留链修复、石榴弹珠退池播种兜底；注能选择改 per-uid 并补视图轮转 | `b3846cf`、`99daf74`、`9aa74ed` |
| 照相馆与 UI | 卡库窗口挂载和选择优化；返回键、页面视觉、NAI 素材接入；拖牌尺寸、砸击遮挡、死亡演出修复 | `47c8914`、`5495a21`、`5f0da12`、`8611a59`、`f25b7bd` |
| Agent 基础链路 | 结构化观察/动作、快进、LLM 适配、记录统计、数据页、快捷键与控制台、无头批跑 | `7b708af` |
| Agent 实验工具 | 速度与停因/错误记录、策略迭代；权重向量、前瞻否决、ES 进化与配对比较工具 | `3a79a5f`、`dd5ac7f` |

卡牌源码入口：`cards/cards.sync.js` 中 `ensureA3BattleRules`、`ensureA3CurseRules`、`ensureA3AcquireBlessingRules`；执行入口为 `battle/battle.resolution.js`。**schema v2 是设计代次，数据字段 `rules.version` 仍必须为 1**，不能直接改成 2。剩余未接线的操作/参数由 pending 守卫拒绝，文本回退和混合目标等边界仍须逐族处理；A3 不应标记完成。

制作坊写开关 `CARD_DESIGNER_WRITES_ENABLED = false`。09-25 决策记录为停止制作坊开放/A4，以 A3 迁移收尾为终点；历史待拍板项不能自行恢复实施。

## 3. 未提交的 UI / 美术 / 体验大修

主要证据：[大修终报](../../.ui-loop-0926/FINAL-REPORT.md)、[任务书](ui-experience-overhaul-brief-2026-09-26.md)及对应截图/议题记录。

- 终报统计为 **47 项总计：39 closed、7 open 移交、1 gameplay 待定**。旧交接开头的“闭环 47 单”容易误读，本快照采用终报明细，不能写“47 项全部修复”。
- 玩家可见改动包括局末熟练度成长与顶栏 XP、战斗击败反馈、闸门方位与定位、返回件和术语统一、金色 token 等值替换、启动误报处理、徽记等素材接入。
- 原记录：累计 **241 项相关用例通过**；W7 七个复测靶位通过。不是本轮实测，也不是当前整个工作区全量验收；终报明确未 build、未提交。
- 未完成：W5-05 启程补给入包演出（祭坛文件交叠）；前台 FPS 对照、反 inert Observer 长局内存和徽记预热；alpha 归一与双 `:root` 合并；LEG 美术/双语言等余项；W3-04 牧师初始卡组 L1→L2 难度问题等待玩法决定。
- 记录冲突：`.ui-loop-0926/STATE.md` 的阶段表仍写 W1 进行中、后续未开始；晚出的 FINAL-REPORT 已记录 W7 结论。后续应以终报及议题证据核对，不能直接把旧 STATE 表作为最新进度。本轮保留原始现场。

## 4. 未提交的 Agent 后续迭代

当前门面 `SDT.Agent` 提供 `observe/act/step/autoRun/waitSettle/stopRun`、`greedy/random/strategic`、LLM、记录统计和数据页。协议见 [agent-protocol.md](agent-protocol.md)；迭代过程见 [agent-iteration-playbook.md](agent-iteration-playbook.md)。

- 工作区仍修改 `game/src/agent/` 多文件、`game/tools/agent-{batch,compare,evolve,ledger}.mjs`，新增未跟踪 `agent-supervise.mjs`；并关联 `battle.lifecycle.js`、`ui/overlay.js` 和部分终局/宝箱/祭坛代码。不要把 HEAD 当成最新实验态。
- 手册当前 champion 记为 **strategic DEFAULT**；早期“R3 最优、撤离率 4%”属于旧实验，不能继续作为当前基线。
- 09-27 手册记录 probe 开关曾造成同 seed 批次结果显著分歧。当前方法约束：正式统计默认关闭 probe，变体与 champion 必须同轮、同代码、同 probe 设置配对运行；champion 用权重注入复现，不复用跨轮历史分母。绝对成功率仅作该环境下的参考。
- 源码核实：批跑 `--probe-ui` 默认关闭；清理对局档调用 `RunStorage.remove()`，维护写入基线，不能改回裸 `removeItem`；`--weights` 支持注入实验权重。
- 批跑设置 VITEST 并缩短/归零演出。**策略统计不能证明真实演出时序、卡死边界或浏览器操作体验通过**。
- 待核实：真实 LLM 一局和巢穴最终撤离记录的后续实测。旧交接说待 key/策略能力，本轮没有新证据将其销账。boss 选牌与战斗内观测仍是手册中的后续方向；失败实验和 hold 记录不是已采用改进。

## 5. 生图默认的更正

当前 `tools/nai_gen.py`（已提交 `a0389b0`）默认 **`nai-diffusion-4-5-full` + 小图**，常用竖版 832×1216 / 横版 1344×768；V5 须显式指定 `nai-diffusion-5-full`。超免费档像素面积的大图按自然日最多 20 张，脚本维护计数。早期记忆中的“默认 V5”已被这一后续本地实现与决策记录替代。本轮未调用生图服务，未验证服务端模型可用性。

## 6. 证据入口与后续接手

| 需要了解的内容 | 优先入口 |
| --- | --- |
| 当前约束 | 根目录 `AGENTS.md`、用户最新指令 |
| 当前状态 | 本快照 + 实时 `git status --short` / `git log -1` |
| 历史提交与验收边界 | [原交接记录](NEXT-AI-HANDOFF-2026-09-20.md)，按时间和主题核对 |
| 模块边界 | [architecture.md](architecture.md)、`game/src/README.md`、`scripts/architecture-graph.mjs` |
| 卡牌迁移 | [schema v2 规格](card-rules-v2-taxonomy-2026-09-25.md)、`cards.sync.js` 与解释器守卫 |
| UI 大修 | `.ui-loop-0926/FINAL-REPORT.md`、议题单与 `SHOTS/w7/`；旧 STATE 进度表滞后 |
| Agent | 接口协议、迭代手册、同轮输出数据；不得拿历史统计替代当前配对 |

接手时优先核对在途文件归属。保留 `.rv-*`、`.review-*`、`_mine*.patch`、根目录未跟踪 package 文件、截图与临时目录，未经授权不清理。提交/推送/删除/发布仍需老板明确指示。游戏验收默认 Codex 内置浏览器、当前窗口尺寸；旧报告中的其他驱动或多尺寸记录不改变这条当前约束。

本轮仅核对 Git、代码接线与文档一致性，并验证新增文档链接和补丁格式；未运行游戏测试、构建、Agent 实验或浏览器验收。现有历史验收数字没有升级为当前全项目通过结论。
