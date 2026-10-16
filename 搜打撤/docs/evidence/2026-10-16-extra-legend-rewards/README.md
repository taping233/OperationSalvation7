# 首脑/巨兽额外传说待领奖修复

## 结论

首脑保底与巨兽命中的额外传说先进入同一 Run 的固定待领奖快照，领取或明确放弃后才提交原有 Base+Run 胜利事务。背包满时不会静默吞卡；整理返回、刷新、保存失败重试均使用已确定的卡牌。已完成普通箱的卡、金币、消耗区和胜利教学顺序保留。

生产代码只修改 `game/src/hub/game.bag.settle.js`。新回归为 `tests/extra-legend-reward-persistence.test.js`，两个既有战后事务测试仅补固定领奖端口/显式领取步骤，原事务、失败恢复、去重断言仍保留。其他奖励源码未修改。

## 保存与续流

- 普通箱完成后，按原有 loot 骰顺序掷定原先数量的额外传说；没有新增宝箱内容掷骰、金币或宠物蛋判定
- 使用现有 `Chests.restore` 建立直接卡牌阶段的固定奖励页；`current.cards/taken/lost` 与 `context.battleSettlement.extraLegendaryPrepared:true` 一起进入既有 `chestReward` 和 RunStorage
- `extraLegendaryPrepared` 是可选的续流上下文字段。现有序列化/恢复与 RunStorage 对上下文整体 JSON 克隆，不存在丢弃此字段的白名单；真实主键字节、真实读盘/恢复测试均确认保留，无需修改恢复 schema
- 初次待领接收失败、接收后异常或明确保存失败均保持本次已掷结果，停留可重试状态，不完成 visited、宠物蛋战斗计数或首胜教学
- 普通箱关闭存在延时尾巴；进入固定领奖前同步收尾，避免 225ms 后旧关闭回调清掉传说页。真实 overlay 测试等待 250ms 后确认传说页与后续教学仍可见

## 旧档兼容边界

缺少准备标记的旧 `chestReward` 是普通箱未完成续流；旧直接 grant 在该箱队列清空后才执行。因此继续旧快照只准备一次额外传说，已领普通卡和金币不再发。旧式已完成节点没有 `chestReward`，有原胜利收据时重复结束会被拦截，不自动补发传说。

已经因旧 bug 丢失、且最终存档没有记录卡牌身份的历史奖励，本次不猜测卡牌或追溯补偿。修复前的两个错误行为探针见 [原审计](../2026-10-16-reward-atomicity-audit/README.md)。

## 已执行检查

- 13 个相关测试文件，148 项通过、0 失败、0 跳过；完整结果为 `target-tests.txt`
- 新专测 10 项：满16格首脑/巨兽、整理返回、未领/已领刷新、旧无标记快照与已完成收据、不误发/严格概率边界、传说空池、接收拒绝/接收后异常、初次待领写失败、最终事务 Run 写失败与同 attempt 恢复
- 新专测使用真实 Base、RunStorage、Chests、可恢复双键事务、真实 overlay；容量收卡端口、战斗呈现、背包呈现和 RNG 为窄测试端口，存储未使用成功桩
- 自有 4 文件 ESLint 通过；项目 8 份渐进类型配置通过；425 文件项目语法检查通过，自有源码/测试 `node --check` 通过；自有 `git diff --check` 通过
- docs 门检查 461 个现行根层相对链接，0 发现；该检查按工具既定范围不扫描 evidence 目录
- `source-verification.json` 记录基线、前后 SHA256、相关只读依赖 SHA256 与补丁 SHA256；`extra-legend-fix.patch` 是精确自有代码/测试补丁

`new-tests.txt` 和 `nearby-tests.txt` 是开发阶段中间记录；最终代码的验证结论以 `target-tests.txt` 为准。

没有运行浏览器、操作真实玩家存档、管理服务、build 或提交。不是全量质量门或真实实机通过；实机验证由父任务继续。
