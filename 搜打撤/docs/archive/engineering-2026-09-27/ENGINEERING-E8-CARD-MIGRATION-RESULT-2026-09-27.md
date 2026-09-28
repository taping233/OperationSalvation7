# E8 全卡清单与首批规则迁移结果

最终实施记录：2026-09-27 18:02（Asia/Shanghai）。E8 主指挥单写本文件；PLAN、范围裁决、Git index、全量门禁与提交由 Friday 持有。

**结果：bag-only 首批迁移实施完成，定向验证、清单独审及代表性实页链路通过，待 Friday 收尾门禁。** 三张 canonical 道具仅新增地图背包 `rules.bag.use`，没有新增 onPlay。全卡总数 272 不变，rules 68→71、legacy 204→201；onPlay 仍 56。未提交、未推送，未跑全量或 build。

## 基线与交付边界

- HEAD：`7c8e3836663fd650785a0b402cc18d5a55e8591a`。17:59 复核本地 upstream 引用 ahead 17 / behind 0，未 fetch。
- 接管时 tracked/index 干净；当前 tracked 变更仅两个生产文件及 E6 适配。既有未跟踪内容保留，未清理、删除或操作 index。
- 范围以 [PLAN](ENGINEERING-E8-CARD-MIGRATION-PLAN-2026-09-27.md) 的“第二窗口修订：按真实地图背包入口迁移”为准。此前 onPlay 提案已撤销。
- after 写入曾被自动审批拒绝，原因为根对话旧暂停授权尚未解除。老板随后直接回答“批准恢复并生成 E8 迁移后清单”；原成员同一工具、原命令再次正常审批通过，17:56 成功生成。没有换成员或绕过工具重试。

## 迁移对象与行为

同一固定治疗道具家族，实际规则统一为：

```js
rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } }
```

| 精确 ID | canonical 来源 | 保持的字段 | 本次消费入口 |
| --- | --- | --- | --- |
| `tt-jinchuangyao` 金疮药 | TABLETOP10[11] | heal=20，cost=0，dmg=0，epic，value=4 | 地图背包 |
| `tt4-woodify` 能量饮料 | TABLETOP10[108] | heal=6，cost=0，dmg=0，common，value=2 | 地图背包 |
| `starter-emergency-bandage` 应急绷带 | TABLETOP11[25] | heal=12，cost=0，dmg=0，rare，value=0，sellable=false | 地图背包 |

真实地图路径是 showBackpack → inspectStack → useDetailCard → useOwnedCard，沿用现有结构化 bag 消费器。三张旧描述治疗数字分别等于 heal 字段；新规则只在该入口不依赖治疗文案。普通/BOSS 战斗背包仍走文本；不能宣称整卡或所有入口脱离描述。schema、capability、执行器、战斗及地图背包代码均未改。

`Cards.ensureE8FixedHealRules()` 在 ensureTabletop 末尾接线，新一次性 marker 为 `sdt-cards-e8-fixed-heal-bag-rules-v1-seeded`：

- 只处理三个指定 ID，canonical 来自现有 TABLETOP10/11 定义。仅无自有 rules 属性、整卡与 canonical 深相等时新增规则；对象键顺序无关。自定义字段、描述、数值、名称、元数据、已有 rules 和缺卡均保守跳过。
- marker 读取异常、KEY 缺失/空/无效数组/无效卡/重复 ID，或原始库与 Cards.all 缓存不一致时退出且不标记。迁移不修改热缓存原对象。
- 先构造并校验，再单次 saveAll；false/抛错均不标记。成功后复读 KEY 精确等于保存内容才写 marker。全跳过分支也须复读原串未变。
- marker 写失败后的重试会跳过已有规则，不再次保存卡库。marker 存在后不反复修复，保留后续用户删除/编辑规则的意图；它表示一次保守判定完成，不表示三卡全被迁移。
- STARTERS 同 ID 旧 2 点绷带，以及既有 run/ownedCards/口袋/安全格/玩家存档副本不升级。后续导入旧卡、同步移除 rules 不自动修复，属于已接受取舍。

## 全卡清单与差异证据

[迁移前 JSON](../../evidence/e8-card-migration-2026-09-27/catalog-before.json) / [逐卡 Markdown](../../evidence/e8-card-migration-2026-09-27/catalog-before.md)，生成于 `2026-09-27T09:30:39.851Z`。

[迁移后 JSON](../../evidence/e8-card-migration-2026-09-27/catalog-after.json) / [逐卡 Markdown](../../evidence/e8-card-migration-2026-09-27/catalog-after.md)，生成于 `2026-09-27T09:56:21.116Z`。

| 指标 | before | after |
| --- | ---: | ---: |
| 生产总卡数 | 272 | 272 |
| 有 rules / legacy | 68 / 204 | 71 / 201 |
| bag 域卡数 | 3 | 6 |
| battle 域 / triggers 域 | 57 / 56 | 57 / 56 |
| onPlay 卡数 | 56 | 56 |
| CARDS_SYNC 独立口径 | 55，全部 legacy | 55，全部 legacy |

完整原卡逐 ID 对比严格只有上述三 ID 增加精确 bag 规则，其他字段及其他卡全部相等。单口径重复 ID、遗漏、计数差、缺分类字段均为 0，schema invalid/pending 为 0。清单来源是运行时导出定义的稳定 ID 匹配，记录五个外层初始化阶段，不能视为完整内部覆盖来源链。

主清单采用 game.boot 实际顺序：ensureStarters → ensureSha → ensureTabletop → ensureDmgTypes → ensureEffectFields。旧 E6 前两步相反，两套全新内存初始化最终逐 ID 完全相等而阶段轨迹不同；结论不外推到任意旧存储。E6 已对齐真实 boot 顺序。

after 只对三候选补充经核实的地图 bag consumer/text/testReferences，明确 battleBag 仍文本、wholeCardDescriptionIndependent=false；其余生产 269 与 sync 55 张的这三类证据均保留 unknown。有 rules 或 capability supported 不等于效果完整结构化。

| 证据 | SHA256 |
| --- | --- |
| before JSON | `c8016a81a58add42b484b3f8045714d8bde01238896f07f1984bcd31038a7d07` |
| before Markdown | `6730c9696fa79c9cb2d5bbec5d685c3af9383bb30aaf753af15ba3f0d3ceb706` |
| after JSON | `cf539798285c0f70f65c3e1078ac761ec5251c22c34e6a1a3655da915628a9a3` |
| after Markdown | `b2fc46cb77c60db73ea6f1e894c7ce8730483f5dc0d78d7cc7140d658fe1007a` |
| cards-sync.json 原始文件 | `d2f38387dd0c49ca90628aeea5334790286de906838b34e6c7aece0652511244` |

sync 原始 hash 是第二窗口起点 `2026-09-27T09:38:49Z` 的基线，独审复核未变；不是第一窗口历史留存值。生成器现在只接受显式 `SDT_E8_WRITE_INVENTORY=after`，不提供覆盖 before 的写路径，普通测试无文件写入。

## 定向验证与独立复核

所有命令在 `D:\素材\代号柒\搜打撤` 执行，没有运行全量。

| 时间（本地） | 命令 / 范围 | 实际结果 |
| --- | --- | --- |
| 17:44:47 | `npx vitest run tests/e8-card-migration.test.js --no-file-parallelism -t 'recorded legacy real map backpack UI baseline'` | 1 文件，4 passed / 34 skipped；修改前地图基线 |
| 17:48:01 | `npx vitest run tests/e8-card-migration.test.js tests/e6-card-rules-capability.test.js --no-file-parallelism` | 2 文件 49 passed（43+6），9.77 秒 |
| 17:56:19 | `$env:SDT_E8_WRITE_INVENTORY='after'; npx vitest run tests/e8-card-inventory.test.js --no-file-parallelism` | 1 文件 5 passed，生成 after |
| 17:58:59 | 独审普通 `npx vitest run tests/e8-card-inventory.test.js --no-file-parallelism` | 1 文件 4 passed / 1 generation skipped；四清单前后 hash 一致 |
| 17:59 | `git diff --check` | 通过；仅 Git LF/CRLF 提示 |

49 项证据覆盖：

- 使用真实地图背包绑定回调和真实 grantEventCard 获取副本，不 mock 规则解释器；只替代 session/UI 周边适配。
- 三卡旧/新/无治疗文案/误导 99 文案 × HP 50/98/100：正常与近满血一致，治疗一次、移除一次、save 一次；满血不消费不 save，重复同 uid 不二次治疗。旧 2 点定义与已有 run 副本保留。
- 普通/BOSS 战斗背包仍保留文本、禁疗相关旧行为；BOSS 测试经过实际 confirmDeck 进入。旧手牌契约调查保留，不能算成新增 onPlay 收益。
- canonical 自定义/已有 rules 跳过；保存 false/throw/quota，marker 读写异常，KEY 读错，坏库/空库/重复 ID/缓存不等，保存后复读 throw/替换，全跳过复读竞态均覆盖。故意触发的错误日志属于故障测试。

独审无阻断：重新计算 327 条清单诊断/摘要，Markdown 逐字等于 render(JSON)，核对三卡治疗数字、精确差异、未知边界及存储保护。49 项迁移验证沿用作者已通过证据，独审未重复运行；独审不代替实页或全量。

## 当前窗口实页证据

经单独批准，使用新的独立 origin `http://e8-01a0e225.localhost:51983/` 与 Codex 内置浏览器新标签，空档案槽创建测试局。没有访问旧页面或现有玩家档。已有开发者 UI 经正常 grantCard 获取三张 canonical 实卡；这是受控获取，不是自然随机掉落证明。随后正常结束一回合承受三个敌人攻击，从 35/35 降至 20/35，用已有手牌正常获胜并返回地图。

| 卡 | 本次实际页验 | 页面结果 |
| --- | --- | --- |
| 金疮药 | 满血使用 | 35/35 保持，提示生命已满，卡 ×1 保留，背包 6/16 不变；未页验正向 20 点治疗 |
| 能量饮料 | 普通受伤后的地图使用 | 20/35→26/35，日志恢复 6；卡移除，背包 5/16→4/16 |
| 应急绷带 | 同场景近满血使用 | 26/35→35/35，日志恢复 9，正确截断；卡移除，背包 4/16→3/16 |

只验当前窗口，没有设置多尺寸或展开布局整改。剩余逐卡数值、状态和重复 uid 依赖上述定向证据。最终浏览器捕获的 error 日志为空。

证据：[满血不消耗](../../evidence/e8-card-migration-2026-09-27/ui/02-full-hp-preserves-card.png)、[受伤回地图](../../evidence/e8-card-migration-2026-09-27/ui/03-map-injured.png)、[饮料 +6](../../evidence/e8-card-migration-2026-09-27/ui/04-energy-drink-heal.png)、[绷带截断 +9](../../evidence/e8-card-migration-2026-09-27/ui/05-bandage-capped-heal.png)。UI 动画期间首次抓图可能早于控件稳定，最终治疗证据以 04/05 及对应 AX 血量/日志为准。

独立 Vite 服务使用既有依赖直接启动（端口 51983，exec session 64713），标签保留供复核；未 build/install/改配置，未关闭其他服务或清理测试档。

## 文件归属与未完成项

- 生产：`game/src/cards/cards.sync.js` 新迁移方法，`game/src/cards/cards.js` 一处初始化接线。
- 测试：`tests/e8-card-migration.test.js`；`tests/e6-card-rules-capability.test.js` 仅 boot 顺序和 71/201 期望。
- 清单：`tests/helpers/e8-card-inventory.js`、`tests/e8-card-inventory.test.js`、四份 catalog 文件。
- 主指挥：本 RESULT 与自有 ui 证据；PLAN 归 Friday。README、共享 PROJECT-STATUS、cards-sync.json 未写。

实施成员、清单成员、测试成员与独审均已停止写入。全量门禁、index/commit/push 未执行，交 Friday 按老板后续授权处理。没有把定向与代表性实页通过写成全量验收。E7 hover 仍按老板选择未验，旧 04/05 仍未归因；本批没有重开 E7。

调查说明：早期 onPlay 候选验证发现普通/BOSS 开局手牌过滤道具，后改为当前真实地图背包入口。保留的 hand fixture 测试只说明原手牌契约，不证明自然开局可达，也不证明所有未来获取途径绝对不可入手。
