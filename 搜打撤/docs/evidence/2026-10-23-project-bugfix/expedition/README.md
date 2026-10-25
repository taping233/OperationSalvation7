# 远征修复收据

已修 E1–E6 共6项：补给/营火保存迟到抢页、祭坛承接失败丢奖励、神秘货箱职业池越界、阿猫附赠漏发、资源领取通知异常重复发卡。
同路径补齐保存Promise拒绝后的重试和补给未保存完成态退出保护；未扩大到额外查漏。
最新定向验证：两份 project-bugfix-expedition 回归 + sys03-altar-restore-txn + shop-settlement-unification + e4-async-entry，单worker；5文件107测试通过，退出0，24.46秒（2026-10-23 23:40）。
新增专门回归14项；前一相邻7文件88测试亦通过。
命令：node_modules/.bin/vitest.cmd run tests/project-bugfix-expedition-1023.test.js tests/project-bugfix-expedition-shop-1023.test.js tests/sys03-altar-restore-txn.test.js tests/shop-settlement-unification.test.js tests/e4-async-entry.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot
未build、提交或覆盖他人增量；统一静态与实页由主会话完成。
