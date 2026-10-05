# 2026-10-03 PH1 第三批（SYS-11 干预履历）（WF-ph1-sys11）

工作流 dwfrun-e92320a3（GLM-5.3-Flash 单包+验证门+修复循环），交付报告见运行工件「PH1第三批交付报告」。验证门：**四门全绿**（syntax/pretest/lint/全量 vitest exit=0，前两批的豁免项本轮均未复发）。

## 四个工作项（全部「只加记录不改行为」）

1. **干预履历与真源**：recorder 新增 noteIntervention(source/action/detail)，recordRun 落 provenance={driver: human|agent|mixed, interventions[]}。6 处打标点：battle.core devCommand 漏斗（含调试胜利 dev:win、boot 调试按钮）、devc 系资源/发卡（dev-console）、devJumpNode（scene-inject）、devForceBattle 两分支。核心取舍=**粘滞 runDriver**：结算确认晚于 autoRun finally 还原 human 是研究缺陷①（辅助局标 human）的真正根因，setDriver 非 human 粘住到记录落盘。局限如实：真人手点不可观测，人手半局+agent 记 agent 非 mixed。
2. **死亡链收益接回执**：buildDeathReceipt 与撤离回执完全同形；死亡口径=只有安全抢运清单计入 cardsStashed、口袋/物资全散失、firstExplore.xp=0；快照进 token.receipt 重试同份事实；未动 terminal.commands（避免动幂等语义）。
3. **停止原因结构化**：noteStopReason+classifyStop 四类（completed/stalled/aborted/error），卡死疑似点带当前场景+最后等待动作。
4. **兼容**：旧记录不炸显示「未记录」，CSV 追加 3 列，数据页「驱动」列读 provenance 三态。

## 越属地申报（待老板复核）

agent.data.js 严格说不在属地清单，但「旧记录显示未记录」唯一显示面是数据页，做了一列内容级最小改动（无新列无布局变化）。

## 测试

新增 agent-provenance-stopreason 15 例（mixed/粘滞/停止三态/死亡回执同形/旧记录兼容/autoRun 集成）；agent 域余量+死亡链+首探回归定向 13 文件 133 例全绿。

## 未覆盖

实页复核（开发者控制台发起带干预跑局看记录呈现）未做——留主会话/老板实机。
