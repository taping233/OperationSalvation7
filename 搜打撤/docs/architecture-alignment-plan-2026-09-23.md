# 架构对齐实施计划 · 第二轮 · 2026-09-23

老板要求：先给具体计划，参考优秀商业项目的代码架构，再交给 Luna 并行实施。
负责人 Friday；执行模型 GPT-6-luna。范围仅 Vite。开始时 HEAD 为 9c08255，工作区包含首轮工程改进和已有 TT12、战斗效果改动；所有已有改动须保留。

## 参考依据与本项目的应用

只借鉴职责和接口设计，本项目代码自行实现。以下是 2026-09-23 查阅的开发者公开源码，不是对参考项目完整质量的评估。

1. DOOM 3 的 [Game.h](https://github.com/id-Software/DOOM-3/blob/master/neo/game/Game.h) 在游戏接口上分别提供逻辑推进 RunFrame 与渲染 Draw。应用：战斗结算通过领域端口运行，快照负责产生视图数据，渲染仍由既有视图处理。
2. Mindustry 的 [ContentLoader.java](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/core/ContentLoader.java) 集中管理内容分类、名称/ID 查询、重复注册检查和旧映射。应用：定版卡牌按稳定 id 取定义；历史批次表达成员和仓库元数据，不再抄写重叠的定版字段。这里的迁移策略是针对本项目的设计，非照搬其 ID 实现。
3. Amnesia / HPL2 的 [Updater.h](https://github.com/FrictionalGames/AmnesiaTheDarkDescent/blob/master/HPL2/core/include/engine/Updater.h) 提供更新容器与模块注册接口。应用：明确战斗模块的装配位置和允许依赖，用可执行约束保护职责边界。

## 本轮目标

- `battle.engine.js` 不再内联完整出牌结算和视图快照构造；两个新模块不直接依赖全局战斗状态或 DOM。
- TT10/TT11 中已在 cards-sync 定版的内容改为 id 引用；新增定版字段能自然到达对应批次，不再要求重复手抄。
- 架构检查依据 JavaScript AST 构建实际模块依赖，覆盖动态字面量 import、子目录和新的独立模块，并限制运行时状态模块的导入范围。
- 保持卡牌/存档 id、迁移 key、规则数值、结算顺序、公开接口和当前 UI 不变。

## 模块与文件所有权

| 编号 | 负责人 | 独占文件 | 工作内容 | 验收条件 |
| --- | --- | --- | --- | --- |
| R1 | Luna / battle_modules | `game/src/battle.engine.js`；新增 `game/src/battle.resolution.js`、`game/src/battle.snapshot.js`；新增对应单元测试 | 抽出 resolveCard 的完整职责；显式注入读取状态、伤害、抽牌、回复等所需端口；抽出 getSnapshot 的构造逻辑，签名缓存仍由引擎管理 | 新模块不 import runtime/engine/core/view，不读 window.SDT 或 document；每次读取最新状态，避免闭包陈旧值；结果顺序与原先一致，原导出接口不变 |
| R2 | Luna / card_catalog | `game/src/cards.data.js`；新增 `game/src/cards.catalog.js`；`tests/cards-sync-snapshot-guard.test.js`；新增目录/迁移测试 | 将 TT10/TT11 中有定版的行改成稳定 id 引用；保留 sync 未提供的仓库元数据；无定版的行仍保留；重复/缺失定版 id 明确报错 | 不编辑 cards-sync.json、不升 key、不更改 TT12；记录改动前后完整现役卡库，分别核对新档与迁移重播，语义一致；元数据不覆盖现有定版字段 |
| R3 | Friday | 新增 `scripts/architecture-graph.mjs`、`tests/architecture-boundaries.test.js`；`tests/contracts.test.js` 的依赖图断言；`docs/architecture.md`；本文 | 用已有 acorn/acorn-walk 解析 import/export-from/import()；构建完整源码依赖图；检查循环、运行时状态依赖边界和新模块纯度；修正文档样式列表 | 不新增依赖；负面样例证明循环和越层导入会失败；动态非字面量不能默默忽略；同一检查可在现有 Vitest/CI 执行 |
| R4 | Friday | 必要的集成修正，仅在相应 Luna 结束后接管文件 | 审查原工作区改动保留情况，运行定向测试与一次串行全量回归，内置浏览器检查启动与交互 | 失败先定位归属，不通过 skip/扩大白名单掩盖；结果记录明确区分已执行与未执行 |

## 并行和依赖

R1、R2 并行，文件范围不重叠；Friday 同时做 R3。R3 最终模块清单在 R1/R2 完成后核准。
R4 必须等所有源码写入停止后执行。同一文件不允许两个执行者同时改。
若抽取发现大量回调只是把共享状态换一种写法，执行者应先报告具体依赖，再缩小端口设计，不引入新的万能 context 或可写全局桥。

## 测试矩阵

- R1：出牌结算、时点/注能/伤害顺序、快照只读与隔离；battle-architecture、battle-restart、direct-cast、hero-cards、现有 TT12 回归。
- R2：cards、hero-cards、cards-sync-snapshot-guard、cards-replay、save-compat；新档、已迁移档、旧批次重播三种情况；id/顺序/语义/元数据保留。
- R3：ESM 静态导入、重导出、动态字面量、子目录、循环、允许与禁止方向的负面样例；新模块无 DOM/全局运行时依赖。
- 集成：`npm run check:syntax`、数据检查、`npx vitest run --no-file-parallelism --reporter=dot`。局部任务只跑定向测试。
- 生产构建、远端 CI、生产产物浏览器验收仍需干净可复现版本。本轮不在混有其他任务半成品的工作区 build，不提交或推送其他任务内容。

## 本轮之外仍需完成的商业化条件

这些阶段须在本轮集成验收之后按依赖展开，不计入 R1–R3 的完成声明。

| 顺序 | 模块/文件 | 具体改法 | 通过条件 |
| --- | --- | --- | --- |
| 后续 1 | `battle.runtime.js`、`battle.state.js`、`battle.core.js`、`battle.engine.js`、`battle.enemy-phase.js` | 将当前约 90 个运行时字段按战斗实例、牌区、交互选择、回合效果归组；逐组替换零散 setter，由命名命令变更；每次仅迁一组 | 重新开始战斗不泄漏上一局状态；异步取消、敌方回合、出牌队列和存档回归通过；不保留第二份可写状态副本 |
| 后续 2 | `battle.resolution.js`、`battle.effects.js`、`effect-verbs.js`、`effect-steps.*.js`、`tests/card-audit.test.js` | 按伤害/抽牌/状态/持续时点逐族缩小文本解释范围；先把审计中已知不支持项列为精确卡 id + 条件，再使新增未识别效果导致失败；结构化字段沿用现有卡牌数据入口 | 每一族保留前后效果差分样例；未识别的新效果不再只打印告警；不同时改文案和规则，不制造第三份卡牌规则表 |
| 后续 3 | `game/index.html`、`winter.css`、`expedition-library.css`、`expedition-battle.css` 及对应页面视图 | 先建立标题/照相馆/战斗的宽窄屏截图基线，再按页面收拢覆盖、减少重复选择器与 `!important`；分页面交付 | 内置浏览器检查布局、悬停/焦点、遮罩、中文输入和缩放；未验收页面不一起重排级联 |
| 发布闭环 | `.github/workflows/vite-quality.yml`、`package.json`、`vite.config.js`、`scripts/perf-budget.cjs`、`scripts/perf-benchmark.cjs` | 确定各套未提交改动归属后形成可复现提交；在干净版本执行 CI/构建/性能预算并用实际产物走流程 | 对应提交的远端 CI 通过；生产产物走完开局→出征→战斗→撤离→存读档；记录加载、内存和持续运行实测，不用 dev 页代替产物验收 |

本轮仅限制状态依赖并抽离职责，不能宣称整个状态模型已迁移，也不能以测试数量代替商业发行验收。

## 实施记录

- R1 已派发 GPT-6-luna / battle_modules，R2 由既有 GPT-6-luna / card_replay 接手（目录任务名 card_catalog）；两者文件所有权不重叠。
- R3 AST 依赖与边界检查已落地；定向 `architecture-boundaries` + `contracts` 共 24 项通过。全量验收待 R1/R2 停止写入后执行。
- R1 已完成结算/快照提取；新模块端口与快照测试 5 项通过。复核修正了模块求值时捕获卡牌元数据的问题，采用调用期查询；副作用之后的玩家状态也重新读取。
- R2 第一次转换因替换位置错误造成文件截断，已停止写入并恢复。恢复来源为本任务早期保存的完整 TT12 输出与 Git 中其余未修改内容；原差异 `23 新增 / 0 删除` 恢复，272 张运行时卡库的新档、TT10 重播、TT11 重播三组摘要均与修改前完全一致。恢复快照已另存临时目录，后续转换改为在 Node 内用 AST 位置从文件末尾一次性替换。
- R3 增补视图切片反向依赖负面样例后，定向测试共 25 项通过。
- R2 最终转换 46 行：TT10 为 31/176 行，TT11 为 15/50 行。转换前后新档、TT10 重播、TT11 重播三组完整卡库摘要完全一致；TT12 源片段逐字不变。定向 6 个文件 / 46 项测试通过，临时基线探针已移除。
- 集成实机：内部浏览器在独立测试地址 `127.0.0.1:5197` 新建档位，走通基地整备→人物选择→物资点→遭遇战→胜利→收取战利品→返回地图。观察到法力光波 5 点法术伤害、初始攻击 4 点攻击伤害、连射两段各 2 点固定伤害击杀，以及敌方两次各 3 点伤害、下一回合费用恢复；未记录浏览器 error。旧测试地址同时验证照相馆与 TT12 冷冻射线检索。
- 集成检查：语法 148 个项目文件通过；数据校验通过。最终串行全量测试 **108 个文件 / 621 项全部通过**（2026-09-23 10:34:40 开始，204.98 秒，退出码 0），日志位于 `%TEMP%/soudache-architecture-round2-20260923.log`。
- Friday 额外核对：除 TT10/TT11 外，数据对象中的 11 个属性与恢复基线源码逐字一致。R1–R4 本轮完成，所有 Luna 已停止写入；未执行生产构建、远端 CI、提交或推送。不能把本轮完成等同于上表所有商业化阶段完成。

## 后续执行：独立提交与发布验证

老板随后授权继续，耗费较多上下文的工作仍交给 GPT-6-luna 并行执行。本节接续上面的第二轮记录，提交状态以本节为准。

| 工作 | 负责人 | 本次交付和边界 |
| --- | --- | --- |
| 分离工程基线 | Friday + Luna / battle_modules | 逐文件复核归属，已混合的引擎从 HEAD 构造架构候选，只暂存候选；工作区中的 TT12 和冷冻射线等玩法改动保持原样。费用、意图、结算、快照的提交不得依赖这些玩法改动。 |
| 效果审计守卫 | Luna / card_replay | 精确记录已知未识别的卡 id、句式和原因；新增未知项及已过期的例外必须失败；缺少对应卡牌的提交基线不强行要求存在 TT12。该清单是审计债务，不是玩法实现证明。 |
| 干净版本验证 | Friday | 在临时 Vite 专用稀疏 worktree 安装锁定依赖，对独立提交执行串行全量测试、生产构建和静态产物预算，再用内置浏览器检查实际生产产物。主工作区不 build。 |
| 生命周期下一切片 | Luna / battle_modules，只读规划 | 定位普通战斗/BOSS 战重复初始化，列出跨战斗泄露回归场景；本次先完成独立基线验收，再实施状态命令归口。 |

- 已形成独立提交：备注测试 `8395176`；CI、语法检查和显式文档生成 `5cbce28`；卡牌定版引用和重播保护 `656fa78`。
- 卡牌提交的干净 checkout 定向验证：5 个文件、18 项通过；没有将 TT12 数据加入提交。
- 生产产物验证及最终提交清单在完成后追加；远端 CI 未执行，未推送。
