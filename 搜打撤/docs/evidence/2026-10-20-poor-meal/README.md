# 穷鬼套餐

新增古朴装备 `tt13-poor-meal`，0费，价值沿普通古朴装备为2。穿戴后手牌≤3时英雄技能0费，超过3张或移除装备恢复原费用，每回合使用次数不变。旧十三批播种标记保留，独立补种标记兼容旧卡库。

代码定向回归：2026-10-20，`npm run test:target -- tests/requested-card-integration.test.js tests/bag-slam-button.test.js tests/card-audit.test.js tests/contracts.test.js tests/architecture-boundaries.test.js` 最终5文件118项通过。覆盖穿戴、3/4张手牌切换、五职业、零能量实际施放、次数限制、移除装备、旧标记补种与随机池。首轮审计发现新增持续效果缺上下文记录，补充精确句式与执行入口说明后通过。

Codex内置浏览器：`http://localhost:5200/`，当前窗口1523×956，真实点击照相馆、搜索“穷鬼套餐”，确认古朴/装备/费用0与描述。页面error日志为空。此时仍是默认装备占位图；真实浏览器战斗施放未验，战斗行为由BattleSession集成测试覆盖。本会话未启动/停止服务。

老板追加NAI+内置生图：完整NAI请求与状态见`nai-request.json`，最终重绘词与接入结果见`request.json`和`receipt.json`。NAI默认1344×768，底稿曾有勺柄偏长与左右色带，内置重绘缩短勺柄、补成1:1整体背景。最终原图1254×1254，缩略图448×448，原图留项目`.tmp/`，不进Git。已接入本卡专属映射、revision与asset-manifest两条。生成索引由既有下次构建更新，当前新图走原图回退。美术接入后按快速卡面技能不追加测试/审计/浏览器/build。未提交。
