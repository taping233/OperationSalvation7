# M7 装备规则回迁结果

- 时间：2026-09-27 22:41（Asia/Shanghai）
- HEAD：`a8e91e6`（`docs: add parallel engineering inventory reports (card migration, type contract, regression audit)`）；工作区有并行未提交改动，本记录只覆盖 M7 自有数据/测试和明确授权的 selection-flow 防双触发。远端 `origin` 本轮未 fetch，差异未知。
- 范围：新增 `game/src/cards/cards.sync.m7.js`、`tests/m7-data.test.js`、`tests/m7-battle.test.js`；按主指挥授权更新 `game/src/battle/battle.selection-flow.js`，让结构化 `onAcquire` 礼物卡不再同时走旧 `fireCatGift`。未改 `cards-sync.json` 或共享规则执行器。

## 已迁入（15 张）

| id | 规则 | 依据 |
|---|---|---|
| `tt3-longsword` | 被动攻 +1 | 装备 aura 消费点；规则接管描述效果。 |
| `tt3-staff` | 被动法伤 +1 | 装备 aura 消费点。 |
| `tt3-grass-armor` | 穿戴时按 canonical `armor` 加甲 | `resolveEquipOps` 消费。 |
| `tt3-light-mail` | 每场一次，按 canonical `draw` 抽牌 | 结构化装备技能入口消费。 |
| `tt3-holy-staff` | 每场一次，净化自身并按 canonical `heal` 回复 | 结构化装备技能入口消费。 |
| `tt2-treasuremap` | 每场一次：搜索大宝箱入牌库，再按 canonical `draw` 抽牌 | named acquire 与 draw 有消费点。 |
| `tt12-raygun` | 每场一次：发现射线牌并直接施放 | 射线池与 discover/play 有消费点。 |
| `tt7-talisman` | 开战按 canonical `draw` 抽牌 | 装备 battle-start 通道消费。 |
| `tt3-blooddrinker` | 击杀后攻 +1 | 结构化 kill runner 执行；equip 空 onEquip 标记抑制旧文本路径。 |
| `tt3-master-staff` | 回合开始法伤 +1 | 结构化 turn-start runner 执行；equip 空 onEquip 标记抑制旧文本路径。 |
| `tt3-twinwater-mail` | 冻结敌人后按 canonical `armor` 加甲 | freeze trigger runner 执行；equip 空 onEquip 标记抑制旧文本路径。 |
| `tt2-apollo` | 获取时能量 +1，并随机获取 1 张非自身卡 | `filter.exceptIds` 排除 `tt2-apollo`；selection-flow 跳过重复旧 gift 回调。 |
| `tt2-wreck` | 消耗时获取 2 张随机卡 | consume runner 消费，装备文本被结构化触发接管。 |
| `tt8-archdemon` | 攻 +1、获得 3 张「重斩」 | 当前 TABLETOP10 canonical 明示两项；不加入已不在当前描述中的「重衍」。 |
| `tt7-arcanescroll` | 消耗时按 canonical `draw` 抽牌 | consume runner 消费。 |

回填只读取当前 `TABLETOP10/11/12` canonical，要求存档与运行时卡库一致、无自有 rules、卡面与 canonical 整卡深相等；写入前经 schema 与 capability 双门，保存复读成功后才盖 marker。纯 trigger 装备使用 schema 接受的 `equip.onEquip: []` 作为单源抑制标记。`tt8-archdemon` 的生产 canonical 确认在 `TABLETOP10`，映射已据此修正。

## 验证

- `npx vitest run tests/m7-data.test.js --no-file-parallelism`：17 tests passed。
- `npx vitest run tests/m7-battle.test.js --no-file-parallelism`：3 tests passed；真实 `BattleSession` 验证 Blooddrinker 击杀 +1、Wreck 消耗获得 2 张、Arcane Scroll 消耗抽 3 张。
- `npx vitest run tests/m-batch-production.test.js tests/m7-data.test.js tests/m10-data.test.js --no-file-parallelism`：M7 数据测试 17 绿、M10 数据测试 3 绿；生产检查曾显示 M7 全部缺失，定位为 Archdemon canonical 表映射错误。映射修正后该检查的缺失清单只剩 11 张 M10 hosted 卡；主指挥随后已负责 M10 启动接线，本记录未复跑接线后的生产测试。
- Apollo 的 `exceptIds` 已由 runtime 完成 schema/capability/resolution 消费端；本次 BattleSession 用例没有直接覆盖 Apollo 的随机排除与发现礼物流程。
- 未跑全量 Vitest、build 或实页验收；首次沙箱内 Vitest 遇 esbuild `spawn EPERM`，定向命令获授权沙箱外运行通过。
