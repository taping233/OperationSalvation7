# R6：实际拒收反馈优先于容量预测

已修复 `grantCard=false` 后普通重绘立即校准并清掉拒收提示的边界。实际拒收记录现在保留到同一奖励打开背包、容量相关状态确实变化后再校准。

## 定位

R6 原红为 `tests/sys03-loot-shop-txn.test.js:205`：fixture 初始空背包，容量 10、`usedSlots=ownedCards.length`、`canReceiveCard` 默认恒 true，但 grant 硬编码 A 成功、B 失败。A 入包后状态是 1/10，生产纯容量规则确实允许 B，原 render 因此把“已入背包 1 张，1 张放不下”校准成“已入背包 1 张”。

fixture 的“满包”状态不真实，但它有效暴露了反馈优先级问题：容量预测不能擦除刚刚发生的真实拒收结果。因此没有改动该 fixture 或其任何断言，而是保留它作为实际拒收边界回归。

生产核对：`game.run.js:14` 唯一把 `game.grantCard` 绑定到 `grantEventCard`。该函数同步执行，false 只有空 tpl 或容量判定拒收两条路径；有效奖励卡非空。保存发生在 chests 更新 taken 后，保存失败不转为 grant=false、不撤销已发卡；异常抛出也不会变成 false。本次没有更改这些行为。

## 最小实现

- 模块内只记录当前 box 实例及原 notice 字符串，标记该提示来自真实 grant=false
- 单卡、三选一及批量真实失败后的同次/普通重绘保留原拒收事实；下一次真实发卡尝试先清旧标记，同样字符串再次失败也重新显示
- suspend 记录容量相关背包指纹；同一箱重复 suspend 保留首次指纹，覆盖按 B 关闭背包先再次 suspend 的真实调用顺序
- resume 仅在同一箱的背包容量状态发生变化后解除标记，之后使用现有只读顺序预估校准；背包没有变化则保留拒收
- open、next、成功 restore 清理临时上下文，不能跨箱或跨存档泄漏
- restore 旧快照仍仅校准两个明确的容量格式；普通成功消息和非容量错误保持原样

指纹仅在首次 suspend 与对应 resume 时计算，包含基础/总/已用容量、物资格数及卡牌 id/name/type/safe/stored。没有每次 render 序列化背包，也没有修改 `cur.notice` 或增加保存字段。

源码仅改 `game/src/run/chests.js`；专测仅改 `tests/chests-reward-capacity-notice.test.js`。顺序容量纯模块、bag/session、实际 grant 调用、领取状态推进、RNG 和存档 schema 均未改变。

## 验证结果

- 修前原 SYS03：25 通过、1 失败，失败与 R6 原记录相同
- 修前加入首批 4 条边界专测后的完整定向闭包：16 文件，177 通过、4 失败，总 181；见 `test-before.log`
- 修后另补按 B 二次 suspend、open/next 清理两条回归：最终 16 文件，183 项全部通过；见 `test-after.log`
- 新增 6 条专测；notice 文件现在共 18 条，真实容量预估的 27 条及 1215 组旧规则对照继续通过
- SYS03 原 26 条、notice、真实容量、附赠、多箱/点击/恢复、背包锦囊/资源格、出征分堆、会话/架构契约全部通过
- 定向 ESLint、两个变更 JS 的 `node --check`、相关 tracked diff 空白检查通过；`lint.log` 为空表示无报告

定向命令：

```sh
./node_modules/.bin/vitest run tests/sys03-loot-shop-txn.test.js tests/reward-capacity-preview.test.js tests/chests-reward-capacity-notice.test.js tests/chest-acquired-gift-cloud.test.js tests/chest-callback-lifecycle-audit.test.js tests/four-player-chest-reload.test.js tests/chest-click-flow.test.js tests/chest-multi-queue-regression.test.js tests/run-architecture.test.js tests/bag-pouch-capacity.test.js tests/four-player-capacity-text.test.js tests/departure-stack-lifecycle-review.test.js tests/game-session-browser-boundary.test.js tests/game-session-elapsed.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=verbose
```

## 原证据与交付

R6 原日志只读保留：`/workspace/shared/cloud-iteration-verification-r6-20261016/logs/test.log`，SHA256 `39b68e05df12e012dd5e7a954e502593451034aadb2cad02597f13106c494aed`，本批结束复核相同。

SYS03 测试未改，SHA256 `382b9feb15e6c21ccbbf9622452975ca1cbf41b56fef874bdea0ad60a05b1ff3`。完整本批增量见 `r6-only.patch`，前后源码/专测 SHA 见 `handoff.json`；补丁反向 `git apply --check` 精确匹配当前文件。

没有修改前两批证据、R6 冻结副本或资产指纹守卫；没有启动浏览器、服务、构建、全量测试、提交或推送。修后实页与最终 opaque 指纹由父任务审阅后接手。本批编辑已释放。
