# 2026-10-03 PH1 第二批（SYS-02 结算真源）（WF-ph1-sys02）

工作流 dwfrun-b7e3963e（GLM-5.3-Flash 单包+验证门+修复循环），交付报告见运行工件「PH1第二批交付报告」。

## 交付内容 ✅

- **数据层**：buildExtractionReceipt 挂既有事务收据 output 位（extractFinish attempt→commitBaseAndRun successReceipt 持久化进 base._m01.requests），journal/幂等语义原样沿用，未碰 game.storage。字段：version/outcome(clear|extract)/bossKilled/layersReached/actions/firstExplore{moves,xp}/netTake{cardsStashed,pocketKept,wood,rations}/losses{lostCount,lostNotable,pocketLost}/runCoins/durationSec。
- **口径**：首探经验公式抽成单源（SYS-01 公式未动）；cardsStashed=开局持卡−整理后未入库（持久态可重算，刷新重建 attempt 结果一致）；币如实记 runCoins 并注明不带回；关键损失=整理时未入库散失卡（传说/史诗 notable 上限 6）+口袋散失。
- **消费方**：结算页 exFinish 改读回执（异常态兜底同一构造器现场重算，不从 UI 反推）；showExtractDone 按结局区分主体——clear=「首脑突破·满载而归」突出击破+关键收获，extract=「保本返回·撤离成功」；仓库行改「总持有（含往局）」消除 2 张 vs 20 张混计。agent.recorder 接收回执（冲突回执赢，原始回执留档），exportCSV 表尾追加 8 列对账。
- **scope 决策**：死亡链（terminal.commands/game.session.death）维持既有口径（回执定义 clear/extract 两结局；SYS-11 接收益时再扩 death 链），nest clear 不动。
- **测试**：新增 extraction-receipt（9 例：字段完整/clear 与 extract 主体互斥/页面与记录同源/两键事务台架 replay 幂等）+ extraction-receipt-idempotency；结算域定向 8 文件 32 例+terminal 域 9 文件 28 例全绿。

## 验证门判定

- syntax/pretest/lint exit 0；全量 vitest **279/280 文件绿（2390 例）**。
- 唯一红 workflow-staged.test.js:256：quotepath 断言失败（git ls-files 输出带引号八进制转义 vs 期望裸路径），**单跑稳定红=他人在途半成品**——scripts/workflow-staged.mjs+test 等 6 文件在 2336355 之后被无登记会话修改中（已登记无主表，勿动）。与 SYS-02 改动零交集，不阻塞本批判定。
- 前一轮全量红项 boot.test.js:529 本次自愈绿（PENDING #36 抖动随机性的又一实证）。

## 未覆盖（如实）

- 实页复核（clear/extract 结算页实机观感、CSV 导出对照）未做——结算页需真实撤离到第三层献祭或首脑终局，实机成本高；页面 DOM 断言已钉死两主体互斥。留老板实机或下批顺路。
