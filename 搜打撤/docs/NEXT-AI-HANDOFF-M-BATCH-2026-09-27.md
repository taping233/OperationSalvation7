# M 批卡牌规则化 · 交接记录

日期：2026-09-27 21:35（Asia/Shanghai）。交接人：Friday（ZCode 会话）。接手人：待定。
基线：master `a8e91e6`（= 6f55166 + 三份盘点文档入库）。本任务全部改动**未提交**，在工作区。

## 一、任务使命

老板指令：「把所有卡都规则化，尽可能并行子代理（上限3）」。已拍板口径：

- **目标池 150 张**：生产 272 张卡中 201 张 legacy，排除 51 张（foe 敌人 18 / 召唤物配件 7 / 事件 19 / 资源 7——效果已由各自系统实现），见 [M-BATCH-EXCLUSIONS.md](M-BATCH-EXCLUSIONS.md)。
- **混合实现授权**：schema 无法纯数据表达的卡允许 `rules + hosted:<命名分支>` 宿主分支。
- 设计口径 5 条已裁决（含 2 条玩法变更），见 [M-BATCH-DECISIONS.md](M-BATCH-DECISIONS.md)，**实现时必须遵照**。

## 二、当前状态快照（交接时刻实测）

- **卡库**：生产 272 张，rules 结构化完成度 71（A3/E8 存量）+ 65（本批 m1-m6 预写）= **136 有 rules / 136 legacy**。注意：m3-m6 **尚未接线**（见待办①），生产运行时仍是 91 张生效。
- **测试健康度**：13 个核心文件定向（contract×3 + data×6 + schema + e6 + structured-onplay + e8-inventory）= **349 用例：343 绿 / 4 红 / 2 skip**。4 条红全部是预期翻转点，不是破坏：
  1. `tests/m5-data.test.js` 3 条「缺口锁定」断言（discoverPlus/doubleNextSpell/onAcquire 的契约已由拒转收，断言还锁着旧拒绝行为）；
  2. `tests/card-rules-schema.test.js` bag-mixed 1 条（旧"单 op"限制已被多 op 数组需求取代）。
- **既有回归**（a3-battle-rules / battle-resolution / m1/m2-contract / e6 / structured-onplay / e8-inventory / m1/m2/m3/m4/m6-data）交接前实测全绿。
- **全量 vitest 未跑过**（老板指令：全部弄完统一测）。**未 build**。**未做任何 git 写操作**。

### 工作区三个改动来源（提交时必须区分！）

| 来源 | 文件 | 处置 |
|---|---|---|
| ① M 批工程（本任务交付） | 下表「已交付清单」全部文件 | 待办⑦随本任务提交 |
| ② 外部并行会话（**不是本任务的，勿动勿提交**）——已确认为 onetake 动效补全会话（见其记忆条目 soudache-onetake-motion-gaps-2026-09-27） | `battle.core.js`、`battle.layers.js`、`camera.js`、`renderer.js`、`game.hub.depart.js`、`game.run.flow.js`、`game.run.shop.js`、`game.session.board.js`、新文件 `map-reveals.js`、`motion-primitives.js` | 留给该会话自行收尾 |
| ③ 更早的 untracked | `.codex/`、`.ui-art-loop-0925/`、`.ui-loop-0926/`、`AGENTS.md.bak-*`、`package.json`、`package-lock.json`、`game/shots/`、`docs/evidence/e2-*` | 与本任务无关 |

## 三、已交付清单（来源①）

### 执行器/契约（另一代理三轮交付，定向全绿）

- 修改：`card-rules.schema.js`、`card-rules.capability.js`、`card-rules.capability.types.d.ts`、`battle.resolution.js`、`battle.engine.js`、`battle.exec-play.js`、`battle.equipment.js`、`battle.card-cost.js`、`battle.enemy-phase.js`、`battle.lifecycle.js`、`combat.js`（atkDown 枚举）、`battle.bag.js`（结构化分派 useStructuredBattleBag）、`game.bag.js`（useStructuredBagRule 多 op）——均为注册点/挂点级 diff。
- 新建：`battle/effect-steps.m1.js`、`battle/effect-steps.m2.js`、`battle/battle.triggers.m2.js`（七时点触发器 runner）、`tests/m1-contract.test.js`、`tests/m2-contract.test.js`、`tests/m3-contract.test.js`。
- 能力覆盖：onPlay 全 op 族（cleanse/loseHp/randomRange/untilHandN/handOps/draw.range/filter/perCurseKinds/acquire.filter/混合目标放行/注能动态源/墓地计数/onKill 奖励/stealAtk/atkDown/foeFight/copyRandom/execute.what+cap/summon/pick:'new' 点选/registerRule 白名单含 discoverPlus、doubleNextSpell、bleedAmp、meleeCost1/spellCost1/schedule 延迟/noDrawNext/extraTurn/keepInHand/onAcquire/onFreezeDealt/vsFreeze 数值化/七时点触发器+容器 duration/replay 容器/infused 打出门/深相等运行时注入豁免）。**装备文本抑制三缺口已结构性收编**（rules.equip 存在即文本单路径化）+ **bag.use 11 op 消费端就绪**（battle+地图两侧）。权威清单：[M-BATCH-CONTRACT-SPEC.md](M-BATCH-CONTRACT-SPEC.md)（实现状态已逐节标注 ✅/⏸）。

### 数据批（6 个回填器，均未接线、各自测试绿）

| 文件 | 函数 | 张数 | 内容 |
|---|---|---|---|
| `cards/cards.sync.m1.js` | ensureM1OnplayRules | 4 | 初始攻击/穿刺/青龙偃月斩/圣光之源（**已接线** cards.js:275） |
| `cards/cards.sync.m2.js` | ensureM2OnplayRules | 16 | 箭系/混合目标放行组（**已接线** cards.js:276） |
| `cards/cards.sync.m3.js` | ensureM3OnplayRules | 24 | B-M2 onPlay 扩展批 |
| `cards/cards.sync.m4.js` | ensureM4EquipRules | 2 | 深海咒印/深海印记 |
| `cards/cards.sync.m5.js` | ensureM5DelayedRules | 6 | 破浪斩/正午决战/禁咒I-IV |
| `cards/cards.sync.m6.js` | ensureM6BagRules | 13 | 药水9+TNT+通行证3（bag.use） |

全部采用保守回填器语义（指定 ID、整卡与 canonical 深相等才回填、marker 一次性、异常不标记、双门先校验后保存）；bag 消费端已就绪，m6 可安全接线。对应测试 `tests/m1~m6-data.test.js`。

### 文档（全部在 搜打撤/docs/）

[M-BATCH-CONTRACT-SPEC.md]（契约规格+实现状态）、[M-BATCH-MATRIX.md]（150 张逐卡矩阵：草案/依赖/复杂度/批次/陷阱）、[M-BATCH-EXCLUSIONS.md]（51 张排除+消费入口）、[M-BATCH-HOSTED-DESIGN.md]（XL 21 张宿主图纸：H0-H4 串行链+冲突分组）、[M-BATCH-DECISIONS.md]（老板拍板）、M1/M2/M3/M4/M5/M6-RESULT.md（各数据批迁/跳清单）、`evidence/e8-card-migration-2026-09-27/legacy-201-scratch.json`（201 张 legacy 底表）。

## 四、待办（按顺序，验收标准在内）

1. **接线 m3-m6**：cards.js `ensureTabletop` 末尾仿 m1/m2 各加一行调用（import + 调用），跑 13 文件定向确认无回退。注意 m4（装备）与 m6（bag）依赖的执行器已就绪，可一起接。
2. **翻转 4 条预期红**：m5-data 3 条断言改为断言契约放行（discoverPlus/doubleNextSpell/onAcquire 键位已实现）；schema bag-mixed 1 条按多 op 现实更新。
3. **回迁批（数据代理活，约 30+ 张）**：收编解锁的全部跳过卡。跳过清单及根因在各 RESULT 文档；E 收编后解锁情况——装备 25 张大部分（文本抑制已收编）、tt7-goldencicada（深相等豁免）、tt3-grope/tt7-abysscurse（declaresField 豁免）、tt7-meteorstrong/tt3sp-silverthorn/cmtn0pbkmnvc（execute.what+infused 门）、tt7-marchrush（replay 容器）、黑暗形态/元素风暴（registerRule 扩白名单）、阿猫的礼物（onAcquire）、刀剑形态（copyRandom）、扰敌（foeFight）、剑仙形态（空 onPlay 豁免）、tt3-firm-barrier 已迁等。**新回填器文件建议 m7/m8 起**，模式照抄 m1。花瓣法阵被卡面 heal:2 与描述「回复3」矛盾阻塞（定版问题，问老板后才迁）。
4. **H 链（XL 大招与机制卡）**：严格按 [M-BATCH-HOSTED-DESIGN.md] 的 H0（hosted 契约基建，串行）→ H1/H2（旗标/登记批，串行）→ H3（宿主保持 9 张，可并行）→ H4（侠客链按留白拍板仅做数据标记）。**两条玩法变更在此实现**：元素符印改持续监听、不变应万变-改持续重变形（DECISIONS #3/#5）。
5. **B-M5 能力卡 12 张大招**（矩阵第四章，全部 XL/L，hosted 为主）。
6. **统一全量测试**：`npx vitest run --no-file-parallelism`，修复至全绿（药水/mana-surge/ nest 有已知历史 flake，别当改坏）。
7. **落库**：须老板明确指示后提交。**只提交来源①文件**，来源②外部会话文件绝不混入。commit message 风格照 git log 先例（feat(cards): ... / docs: ...）。
8. **遗留尾巴**（可选，SPEC 标 ⏸）：lifecycle `deckCapBonus()` desc 读法收编（chaos-eye 编组侧）、handMorphZeroFee、acquire hand/deck 直发 play、acquire.untilHandN、onPlayCardFilter。

## 五、硬约束与坑（接手必读）

- `game/data/cards-sync.json` 是生成同步源，**绝对禁手改**；删卡/改卡走 sync 退役层。
- 共享热点（schema/capability/battle.resolution/effect-steps/battle.engine/exec-play/bag 消费端）**只能单会话串行写**；数据回填器必须独立新文件，最后统一接线——这是本批多代理无冲突的关键，接手后继续遵守。
- 回填器保守语义（深相等+marker+双门先校验）是防坏档的核心，新批次逐字照抄 m1 模式。
- 已知 flake：药水/mana-surge 抖动、nest 负载 flake 已根治（新战斗测试禁裸 tick 判闲）。
- `foe-*` 敌人卡、事件卡、资源卡已拍板排除，**不要**试图规则化它们。
- tt8-hero-sealer 的 cards.data.js:358 是过时基线（「邪渊主宰」带火球文本），已被 cards.sync.js 覆盖为「受缚之残影」，配规则以运行时为准。
- 双「员工通行证A」（cmtmvq6ss84l 与 tt-token-color）同名不同 id 不同链路，不可合并。
- 外部会话仍在改 camera/renderer/run 域（来源②），热文件先 `git status` 核对再动。
- 语义陷阱 Top 12 条见 [M-BATCH-MATRIX.md] §七。

## 六、进度口径

目标池 150 = 已预写 65（接线后生效）+ 回迁批约 30 + H 链 XL 21 + B-M5 大招 12 + 花瓣等定版阻塞若干。全部完成并全量绿后，生产 legacy 应仅剩：51 张排除 + 少量定版阻塞卡（逐张列入交付报告交老板）。
