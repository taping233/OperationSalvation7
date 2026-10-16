# 已核实界面文案小批

状态：父会话已批准四文件最小呈现修补；编辑与定向验证完成，完成未提交，生产/测试编辑占用可释放。本记录只描述当前实现与已确认实页现象，不新增玩法规则。

## 已核实来源

- `game/src/run/game.run.scenes.js:470`：`FIRE_RESTORABLE` 排除道具和装备；`openPocketRestore` 候选与领取均使用该判断
- `game/src/battle/view/battle.view.js:474`、`game/src/battle/view/battle.piles.view.js:22`、`game/src/battle/core/battle.exec-play.js:172`：当前提示仍概括所有材料可在火堆复原，需明确例外
- `game/src/battle/core/battle.resolution.js:316-323`：首脑牌库底发现先取出真实 UID，用 raw `findCard` 提供候选，并透传 `explicitUids`
- `game/src/battle/effects/battle.discover-state.js`：上述 UID 作为 `deckBottomUids` 提供给发现面板
- `game/src/battle/view/battle.view.js:419-427`：发现面板直接显示 raw options，未按对应 UID 查询既有有效卡面，且各来源统一显示临时牌说明
- `game/src/battle/effects/battle.discover-flow.js:168-172,212`：未选牌库 UID 归还牌库底，选中候选仍调用 `addTempCard`
- `game/src/battle/core/battle.draw.js:97-100`：`addTempCard` 创建新 `bts` UID，加入 `granted` 与手牌。故当前选牌结果是临时副本，而非原 owned UID 直接入手；本轮不改此机制
- `game/src/battle/effects/battle.card-inspection.js:47-74`：现有 `findEffectiveCard` 能按真实 owned/granted UID 投影初始攻击转换，并保留原来源数据
- `game/src/run/game.run.altar.js:745`：智能整理按钮文案过长；父会话真实输入截图 [87-terminal-extraction-overcapacity.png](../2026-10-16-WF-cloud-play-eight-hours/screenshots/87-terminal-extraction-overcapacity.png) 可见末字单独换行
- `game/src/run/game.run.altar.js:777-795`：智能整理已有按 `sellPrice` 降序、仓库空格内入库行为，不需修改
- `game/src/hub/extraction.commands.js:107-108`：`lostNotable` 只包含传说/史诗，最多六项；`game.run.altar.js:832` 当前括号未说明是部分卡牌。父会话真实结算的未入库总数 3 张与只列迷之匣 1 张可以同时成立，范围文案应明确

## 已实施边界

仅四个生产文件：`battle.view.js`、`battle.piles.view.js`、`battle.exec-play.js`、`game.run.altar.js`；配套定向测试。不改变材料消耗、复原资格、发现队列、UID 流转、排序、入库、损失确认、回执与存档。保留各文件现有有效卡、注能布局和药水监听改动。

本轮不使用浏览器、不启停服务、不构建、不操作真实存档。修改后的外观需父会话补实页验收；jsdom/静态检查仅作为定向逻辑与文案反馈。

## 编辑前 SHA256

- battle.view.js：18a09f8477bfec2e922bfcf526a95ec3358ca69db588a6f5ff2fc182011c25ba
- battle.piles.view.js：19a10816ebd278af40d36cc4b4c9864e648272d3fb44cee775b16322218452ed
- battle.exec-play.js：5e07adb2cd15fb79e7b485ab1804dcb027431f241c091f4bb7caae0aab1ade35
- game.run.altar.js：b9073fc2f55bd4d10ef645a4d7535b801e5304e6fbb7c3ade5e098d7525bd87a


## 完成内容

- 注能栏、普通战墓地提示及普通战注能日志：明确道具、装备不可在火堆复原
- 牌库底发现：仅按既有 `deckBottomUids` 查询有效卡面，用于卡面、aria、title；owned 与本场临时牌来源在 title 区分。无法解析来源 UID 时沿用候选卡面且不臆造所有权
- 牌库底发现说明：`来自当前牌库底 · 选中牌以本场临时副本入手，战后消散`；随机发现保留原说明及原候选卡面
- 智能整理：短 label `优先入库高价值卡`；title/aria 保留 `按仓库剩余空格，优先入库价值最高的卡牌`
- 成功结算损失：括号改为 `其中传说/史诗包括：…`，明确重点卡列表是子集，不改总数与回执
- 保留现有注能布局、有效卡、药水监听、消费/复制/排序/损失/存储代码

## 验证

- [定向测试日志](targeted-tests.log)：2 文件 25 项通过，覆盖注能提示与既有操作、日志、owned/临时发现来源、有效卡面、未知 UID 回退、随机发现不变、无来源/状态/原卡数据改写、短入库按钮/可访问说明、损失总数与重点子集
- [相邻测试日志](adjacent-tests.log)：10 文件 117 项通过，覆盖 contracts、architecture-boundaries、battle-architecture、battle-effective-card、battle-selection-flow-boundary、battle-discover-state、potion-tip-lifecycle、skull-sword-effective-session、extraction-flow、extraction-receipt-idempotency
- 6 个编辑源码/测试文件 `node --check` 全通过；[定向 ESLint 日志](targeted-lint.log) 无诊断，退出码 0；相关 `git diff --check` 通过
- 合计 12 文件 142 项通过；这属于 R7 后定向反馈，不表示本轮全量/构建/实页已覆盖
- 未运行 build、服务、浏览器，未读取/修改真实存档。父会话负责资产 guard 审查和新增实页验收；本轮不修改 opaque 记录

## 完整自有差分与指纹

- [基线到最终完整差分](baseline-to-final.patch)：以本轮编辑前的工作树字节为基线，包含全部 4 个生产文件和 2 个测试文件的自有差分，不用 HEAD 差分混入已存在改动
- [逐文件 before/after SHA256](source-manifest.json)：6 个最终文件指纹均已重新读取核验
- 生产最终 SHA256：
  - battle.view.js：02e26b459984afd66ca2e9d3513aeb2fd44c573323767a2b36e223492cc984e1
  - battle.piles.view.js：5a5bb0cb5038bd0d51dc7eb1b9ba69534761ce3c03a3bd97e942d1e90b5bb424
  - battle.exec-play.js：8c69483d20985d5486ff3f8fb4b42df2f25b8f68ad3697e9f39c57909eef9a9d
  - game.run.altar.js：c9d7e3eac775c415ae30c9a96cd5997d71bc77c6261c284ddaa70aafd56e0a44
