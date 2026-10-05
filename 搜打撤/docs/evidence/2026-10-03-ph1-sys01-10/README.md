# 2026-10-03 PH1 第一批（SYS-01 + SYS-10）（WF-ph1-sys01-10）

老板令「一级一级自动开下一批」：改造计划第 2 级（账与规则事实）首两包。工作流 dwfrun-f2e6c27a（GLM-5.3-Flash ×2 并行+验证门+修复循环），交付报告见运行工件「PH1第一批交付报告」。

## SYS-01 探索奖励（堵安全刷经验）✅

- **落点**：撤离经验唯一按步数结算点 `game/src/hub/extraction.commands.js:94`（旧公式 `20+(turn-1)*2`，turn 由 moveTo 每步 ++，即研究时点 A=20/B=60 通路）。
- **方案**（两候选中选「首踏打标」弃「按 seen 结算」）：`explored` 首踏入格打标（幂等 key），撤离经验只统计首探量；弃 seen 是因它是雾 revealed 集（会为没踩过的相邻格计酬+经济翻倍扰动）。**不回头路的正常玩家经验与旧公式逐字节一致**——只拆刷经验溢价，不动正常经济。
- **旧档迁移**：restore 无 explored 置 null → 回退旧公式，存量在途进度不缩水（extraction-recovery xp=26 断言原样保住）。
- **测试**：新增 extraction-first-explore-xp（同路线±20 次往返 XP 相等=44、每新格恰 +2、旧档回退 26）+ first-explore-marking（真实 moveTo 链路打标/往返不涨/新格入账），定向 13 文件 65 例全绿。

## SYS-10 存档失败提示与重试幂等 ✅

- **先注入后动手**（QuotaExceededError 五场景实录）：幂等保护已完备（requestId 收据+journal 三相提交，既有矩阵测试钉死），**真实缺陷只在文案层**——「终局安全提交服务不可用」实现术语 + catch 透传英文异常裸露玩家。
- **修改**（terminal-settlement.js +15/-4）：失败页固定加人话说明行（进度保留在本档位/重试不重复扣牌发奖/退出再进能继续）；术语句改「结算通道暂时没有就绪，稍等片刻再点重试即可」；异常 message 不再上屏（console 留痕）。机制零改动。
- hub 命令层两条术语消息未动（属地纪律+恢复矩阵语义依赖），如需人话化另开小片。
- **测试**：新增 terminal-retry-copy 4 例，存储域定向 10 文件 128 例全绿。

## 验证门判定

- check:syntax / pretest / lint：exit 0。
- 全量 vitest：**277/278 文件绿（2379 tests passed）**，唯一红 = tests/boot.test.js:529 IME Esc 用例——**已知负载抖动复发，非本批回归**：单跑恒绿（15/15）、waitFor 已 45000ms 仍红、今天全量连红多轮，窗口放宽路线到头（前人 3000→15000→45000 两次放宽史在注释）。按 10 分钟纪律停止深挖，挂 [PENDING #36](../../PENDING.md) 专项（fake timers 直调 handler 或拆文件），全量判定以单跑复绿豁免。

## 未覆盖（如实）

- 实页复核未做：SYS-01 实机 A/B 撤离对照（单测已钉 44=44）；SYS-10 失败页实机截图（DOM 断言已覆盖，实机造配额满成本高）。留老板日常实机或下批顺路。
- SYS-01 玩法手感（首探经验是否偏紧）待老板实机定夺。

## 边界

cards-sync.json 未碰、未 build、无 git 写操作；并行会话在途（batch1-toolpages 的 terminal-settlement 相邻域）动前复核零冲突。
