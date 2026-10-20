# 手牌旧手势失效验证

结论：结算期间被拒绝的拿牌会留下固定命中层的按下记录；在同一手牌恢复后，迟到 click 可以触发真实目标选择。现已让记录随交互模式变化失效，仍复用原 view/aim 和核心命令。

## 复现与修复

- 基线为 9b0fe799 同步副本；隔离目录 `work-hand-input-9b0fe79`，没有改动基线或集成目录。
- 在 `battle-hand-content-diff.test.js` 使用真实 BattleSession、render 和生产输入链：busy=true 渲染→牌上 pointerdown→busy=false 渲染→同一 DOM 上 click。原实现 7 项通过、1 项失败，实际 `clickSelectedUid` 为 `card-0`，预期 null。此证据确认的是错误选牌，不声称已经造成扣费出牌。
- `battle.hand-hit.js` 同步场次、回合、阶段、busy、选择/目标/查看模式及可见 UID；任一变化使旧按下失效。`battle.layers.js` 读取真实快照，避免背景渲染临时清空选择字段导致漏同步。
- 能量不纳入失效条件，能量不足仍可阅读；新 pointerdown 仍可以正常开始新手势。没有新增自动出牌或绕过权威命令。

## 已执行验证

- 定向 Vitest：6 文件、98 项全部通过：battle-hand-hit-input、battle-hand-content-diff、hand-fixed-hit、battle-hand-layout、battle-hand-keyword-interaction、battle-selection-ui。
- 新增回归覆盖：按下→14 类结算/阶段/选择/查看模式→恢复→click；新手势恢复可用；仅能量变化保持阅读；生产结算恢复和牌库叠层恢复不复活旧按下。
- 两份源码和两份修改测试的 ESLint 通过。
- handoff 在无 Git 元数据的隔离副本中报错，已人工核对根 AGENTS 和 PARALLEL-REGISTRY。没有声称流程简报生成成功。

## 验证边界

以上为 DOM 合成事件和真实生产模块定向回归，未做内置浏览器实页或真实鼠标体验验收；未跑全量 CI、build，未提交、推送或发布。未编辑 battle.equipment.js、battle.engine.js、battle.lifecycle.js、battle.overlays.js。

## 集成与保护边界

本批集成排除了原补丁中的 `docs/PARALLEL-REGISTRY.md`，该文件有本地暂存及未暂存增量，不覆盖。新条目单独保存在集成目录外的待合并补丁，需主任务结合本地现状合并。其余六文件按主任务提供的保护路径摘要核对无重叠；本环境未取得全部 190 项原始清单，不宣称逐项机器核对全部暂存内容。原始工作副本与集成副本均不改写纯基线。
