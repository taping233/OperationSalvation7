# 奖励容量预估与真实发卡共用规则

奖励页现在按真实批量领取的卡牌顺序，在独立副本中逐张推进容量；顶部预估和容量 notice 共享该结果。实际收卡规则保持原样。

## 实现与接口

- 新增纯模块 `game/src/core/card-capacity.js`：共享叠放上限、珍珠盒常量、新格准入、普通背包同名收卡判定和顺序预估；无会话、门面、浏览器、存储或随机依赖
- `game.session.bag.js` 使用共享新格规则，原 `PEARL_BOX_ID`、`stackCapOf` 导出继续可用；珍珠盒容量、背包分堆与占格计算未改
- `game.session.js` 保留现有 `canReceiveCard(card)` 入口及绑定，仅改为共享纯判定的薄包装
- `chests.js` 按原顺序过滤已领取/已放弃卡，使用同一预估更新容量提示；三选一只对 `choiceCount` 范围内尚未决定的原候选做独立可收检查，原选择解决后的已掷附赠走普通批量预估

接口：

```js
previewCardRewards(pendingCards, { ownedCards, usedSlots, baseCap, totalCap })
// => { canTake, cant, acceptedIndices, blockedIndices, usedSlots, totalCap }
```

`acceptedIndices`、`blockedIndices` 指向传入的 filtered pending 数组，不是原始奖励索引。调用方目前仅消费计数；专测另验两种索引的区别。

预估先复制 owned 数组，只将模拟成功的卡加入副本并推进占格/珍珠盒扩容；失败不推进。不会调用真实 grant、领取回调、保存或 RNG，也不预抽尚未生成的附赠。

## 原样保留的规则

- 物资数组每项占一个背包格；普通卡按同名分堆，普通 3 张、初始攻击/火球 5 张一格
- safe、stored 同名卡不参与普通背包叠放余量，stored 卡不占普通背包格
- 已有未满同名堆可在满包并入；堆已满则需要新格
- 基础格可收所有卡；额外资源格只收资源卡
- 珍珠盒扩容按所有 owned 里的盒子计数，包括 safe/stored 盒子，每张 9 格；新盒子模拟成功收下后，后续资源立即获得相同扩容，盒子拒收则不扩容

## 验证

最终定向结果为 15 文件、151 项全部通过，原始输出 `test-after.log`。新专测 `tests/reward-capacity-preview.test.js` 共 27 项：

- 真实 `grantEventCard` 与真实背包容量逐卡对照：普通 1/3、2/3、满 3 堆，初始攻击/火球 1/5、满 5 堆及跨堆；多个奖励争同一空格；前卡失败后后卡仍可收
- safe/stored 同名卡排除、普通同名余量不受容器计数干扰；safe/stored 珍珠盒仍按现行规则扩容
- 基础/资源特殊槽、越过基础容量后普通同名并堆；新收珍珠盒带来的后续空间；拒收珍珠盒不产生虚假扩容
- 每个预估先断言 actor 全部可序列化状态、存储和 RNG 保持不变，然后在同一输入上逐次执行真实 grant，对照成功/失败索引和最终占格/容量
- 冻结输入不被修改；过滤后的 pending 索引不被误用为原奖励索引；领取/放弃排除、choiceCount 已掷 gift，不重抽、不重发
- 新 live 薄包装与抽取前分支规则作 1215 组状态的独立对照，全部相同

同时通过既有 notice、附赠、普通宝箱点击/多箱/重载、背包锦囊/资源格、出征分堆、会话与架构契约测试。四源码和四测试文件的 ESLint、`node --check` 及相关 tracked diff 空白检查通过；`lint.log` 为空表示无报告。纯模块另在无 `window` 的 Node 中独立导入成功。

最终定向命令：

```sh
./node_modules/.bin/vitest run tests/reward-capacity-preview.test.js tests/chests-reward-capacity-notice.test.js tests/chest-acquired-gift-cloud.test.js tests/chest-callback-lifecycle-audit.test.js tests/four-player-chest-reload.test.js tests/chest-click-flow.test.js tests/chest-multi-queue-regression.test.js tests/run-architecture.test.js tests/bag-pouch-capacity.test.js tests/four-player-capacity-text.test.js tests/departure-stack-lifecycle-review.test.js tests/game-session-browser-boundary.test.js tests/game-session-elapsed.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=verbose
```

## 容量分配体验边界，未在本批修改

现行 `docs/rules.md:47,74` 规定珍珠盒额外格只收资源，并支持玩家主动把资源整叠存入盒中，存入后不占背包格。没有写资源自动优先搬到专用格。

当前 live 和显示一直按“总占格 >= 基础容量时拒绝新的非资源卡”处理。例如 17 个非资源格与 2 个资源格共占 19/27，会显示通用 18/18、资源 1/9，拒绝新的普通剑；本批原样保留。若要自动重排资源释放通用格，那是新的分配规则，不能由本次纯抽取擅自引入。

父任务另提出后续体验改进：奖励页基础格满、持有珍珠盒且有未存资源时，可以准确提示“打开珍珠盒存入资源腾格”，但必须结合真实盒内剩余容量、可操作盒子与待存资源核验，不能无条件建议。本批只记录，未添加提示或修改容器交互。

## 交付边界

完整本批增量为 `preview-only.patch`，文件前后 SHA256 见 `handoff.json`。补丁基线包含已交付 notice 修复及其他任务的既有改动；没有修改第一批 notice 证据，也没有改 grant、领取动作、RNG 或存档 schema。

未启动浏览器、服务、全量测试、构建、提交或推送。修后实页由父任务复核；opaque consumer 指纹留给父任务审阅增量后更新。本批编辑已完成，可释放占用。
