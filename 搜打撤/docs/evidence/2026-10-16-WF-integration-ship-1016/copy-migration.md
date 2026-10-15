# 文案与迁移契约集成收尾

本组原 7 项失败均是已批准规则或文案变化后的旧测试契约，不涉及生产回归或缺少默认值的夹具。6 个测试文件定向结果为 49 通过、0 失败、1 个既有显式证据生成用例跳过；没有新增跳过、降低阈值或删除行为断言。

## 依据与修复

- `docs/evidence/2026-10-15-xingyue-skill-toggle/README.md` 记录老板要求“消耗口袋”统一称“消耗区”。背包复原剩余数量和基地复原前数量漂移提示沿此更新；仍断言确切数量、提示级别和不调用复原命令。
- `docs/evidence/2026-10-15-consumption-guide/README.md` 首段及“用后去向统一修正”记录后续纠正：用过的牌统一进入消耗区，不分初始攻击、职业与衍生。与现行 `docs/rules.md` 一致。整备说明测试改为精确检查统一去向、可复原、背包复原入口、撤离结果提示，并实际验证说明在出发按钮之前。
- `game/src/ui/cinematics.js` 当前提示“点击收起 · 稍后自动收起”，且点击关闭和 2200/2800ms 自动关闭均存在。发卡队列测试对齐此文案；上下文、稀有度和战斗/地图布局断言保留。
- `git diff -- game/src/cards/cards.data.js game/src/cards/card-description-text.js` 确认 `tt12-backupcell` 原始描述仅把“消耗口袋”改为“消耗区”；不是新增规则迁移。现有 `rules` 在 E8 历史快照中已存在，原 E8/M 批迁移批准范围不扩张。`isApprovedBackupcellRename` 只接受该 ID、唯一旧描述与唯一新描述，并要求替换后整卡深相等。E8/M 批检查共用该谓词，原有 rules 迁移、神灯精确删除 armor、CARDS_SYNC 不变检查全部保留。
- 新增负向断言拒绝任意描述扩展、费用变化、规则数值变化、新增字段、其他 ID 和不匹配的旧描述；并从 E8 总比较入口验证非法费用变化仍失败。没有手改 `cards-sync.json`。

## 修改文件

`tests/bag-structured-use.test.js`、`tests/base-hub-business-lifecycle-audit.test.js`、`tests/departure-stack-lifecycle-review.test.js`、`tests/nightshift-u10-teardown-guards.test.js`、`tests/e8-card-inventory.test.js`、`tests/m-batch-production.test.js`、`tests/helpers/e8-card-inventory.js`。

这些文件原有其他会话完成未提交增量保留；本组仅修改上述断言和精确谓词，没有暂存、提交、推送、改共享登记或启动服务。

## 验证

```powershell
npx vitest run tests/bag-structured-use.test.js tests/base-hub-business-lifecycle-audit.test.js tests/departure-stack-lifecycle-review.test.js tests/nightshift-u10-teardown-guards.test.js tests/e8-card-inventory.test.js tests/m-batch-production.test.js --reporter=json --outputFile=docs/evidence/2026-10-16-WF-integration-ship-1016/copy-tests-after.json
```

退出码 0，50 项共 49 通过、1 项既有跳过。执行前 7 项失败复现记录在 `copy-tests-before.json`；最终结果在 `copy-tests-after.json`。剩余全量与冻结门由主任务统一执行，本组无待决事项。
