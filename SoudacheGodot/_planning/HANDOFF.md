# 搜打撤 → Godot 完整移植 · 总计划（HANDOFF）

> 唯一事实源：本文件（计划/协议/验收标准）+ `PROGRESS.md`（实时状态板）。
> 接手任何批次前，必读本文件 §0/§2/§3 对应小节。最后更新：2026-09-11（批次 0 完成，Wave 1 开工）。

## 0. 已拍板口径（2026-09-11 老板，不再讨论）

1. **不兼容网页版旧存档**。Godot 存档沿用骨架 v3 自由演进；RNG 不必与网页版逐位一致，只需 Godot 内部确定性（同 seed 同结果）。
2. **遗留已清理**：过时「英雄卡→能力卡」未提交批次已撤销（由批次 0 重导出自然覆盖）；`.render-check/` 79MB 录屏产物已删除并加入 .gitignore。
3. **Godot 版 = 桌面版**（Windows 先行，保留将来 Steam 可能）；Vite 网页版冻结功能、只保构建。
4. **UI 一致度**：布局/交互/动画时序 1:1 对齐网页版；字体渲染容忍亚像素级差异。
5. **参照合规**：`.tmp/sts2-reverse` 只参照数值/曲线/时序等参数事实（见 `sts2-reference.md`），**不搬代码文本、不用其美术/音频资源**——Steam 上架的合规底线。
6. **最终完整验收（2026-09-12 老板补充，总 gate）**：Godot 版**体验画面与网页版基本一致**。过程保障=每屏 `--write-movie` 录屏帧与网页版截图并排（`_planning/evidence/`）+ 老板过目；最终=老板拿 exe 实玩一轮完整局确认。

## 1. 真源与参照

- **行为真源** = `搜打撤/`（v0.53.3 + 09-11 架构批次，只读）。机制分歧一律以网页版代码+vitest 行为为准；卡数以 `C.all()` 实跑为准（当前 **245**）。
- **动画手感参照** = `_planning/sts2-reference.md`（STS2 官方参数库：指数平滑三通道、hover 推挤、贝塞尔飞卡、飘字、震屏、地图圆点连线等，含优先级排序）。
- **方法论参照** = `SoudacheUnity/_planning/HANDOFF.md`：编译驱动、错误簇拆包、真源参照（先 grep 源 js 再动手）、每文件头 `// ported from src/xxx.js`。
- **网页版 37 个 vitest = 行为规格**，按 §5 映射成 C# 断言。

## 2. 工程底盘与并行领地

底盘：Godot 4.7.2 Mono / .NET 8 / gl_compatibility，1440×900。分层：`src/Core`（纯 C# 领域层，零 Godot 依赖）→ `src/App`（组合根 CoreGameAdapter + 快照契约 CoreUiPort）→ `src/UI`（快照驱动屏幕）。

**文件领地矩阵（并行 agent 防冲突，绝对遵守）：**

| 领地 | 批次 | 拥有文件 |
|---|---|---|
| A 核心 | 1/2/3/5 | `src/Core/**`、`src/App/**`（除 GameAudio.cs）、`data/**`、`tools/**`、`tests/**`（除 Narrative） |
| B 表现 | 6 | `src/UI/**`、`scenes/**`、`assets/fonts|images/**`、`project.godot` |
| C 音频 | 7 | `src/App/GameAudio.cs`、`assets/sfx/**`、`assets/*.mp3` |
| D 叙事 | 4 | `src/Core/Narrative/**`（新建）、`tests/Narrative/**`（新建）、`tools/ink/**`（新建）、`data/narrative-events.ink.json`（新增） |
| 公共 | 全部 | `_planning/PROGRESS.md`（状态板，人人可写）；`_planning/` 其余文件只读 |

- 新建文件原则上放自己领地；必须动他人领地时，在 PROGRESS.md「接口需求」登记，由该领地下一批实现。
- **禁令（所有 agent）**：不跑任何 git 写操作（add/commit/checkout/reset/clean/stash 全归主控）；不修改 `搜打撤/`（只读，允许从里面复制资产）；不动他人领地。
- 并行 agent 共用 obj/bin，构建/测试撞锁时：等 60-120s 重试，先 `git status` 确认不是他人半成品文件导致的编译错。

## 3. 批次表（内容 / 验收标准 / 依赖）

### 批次 0 ✅ 数据管线修复（done 2026-09-11）
export_data.mjs 适配 data-loader/cards-sync 新架构，重导 245 张卡；validate/Combat/Run/Core 四套全绿。证据见 git log 批次 0 提交。

### 批次 1 · 数据进运行时（A）
把 `data/*.json` 静态表真正接进 C# 运行时，消除硬编码：RunState 的怪物池/精英池/祭坛 BOSS/宝箱表、CoreGameAdapter 角色 switch、商店价格（→ cards.json price 表）、RunRules 常量（→ rules.json）。三环 RunMap 拓扑**保持现状**（四层归批次 3）。
**验收**：① `node tools/validate_data.mjs` 绿；② 三个 dotnet 测试项目绿（计数断言随新数据更新）；③ 留 grep 证据：上述硬编码点已删除、改为读 data/*.json；④ 新增一组断言「运行时读到的表 == data/*.json 内容」。

### 批次 2 · 战斗引擎对齐 v0.53.3（A，依赖 1）
牌效动词注册表 + **未识别子句哨兵**（对齐网页版架构批次 3：识别不了的子句显式失败，不许静默丢弃）；随从位/容器（锦囊）/碎片合成/注能完整语义；BOSS 编组+开战装备勾选；敌方意图数据。
**验收**：① C# 全卡实打审计（等价 `battle-all-cards.test.js`，245 张逐张开战逐张打出）零硬失败；② 哨兵对未知子句抛错，且现有 245 张全部子句被覆盖（零哨兵报错）；③ 8 个单卡回归测试移植全绿；④ `tests/Combat` 全绿。

### 批次 3 · 四层地图 + 跑图流程（A，依赖 2）
map-generator 移植：TARGETS=[13,15,17,15] 四层 60 节点、8 次候选、13 条质量校验、保底火堆/补给站/搜刮点/战斗、禁三连战、L3 紧急撤离、L4 祭坛→首脑→终局；内部确定性 RNG（不必复刻网页算法，可沿用骨架 DeterministicRng，但**必须 snapshot/restore 进存档**）；map-graph 连通性校验移植为测试；移动事务/落脚结算/门/祭坛/撤离。
**验收**：① 2000 seed 生成复验：无崩溃、每层保底规则断言全过、连通性全过；② RunTests 拓扑断言更新为四层并全绿；③ 存档含 RNG 快照，读档续跑结果一致。

### 批次 4 · ink 事件 + 商店/宝箱/物资（D→A 整合，4a spike 可先行）
4a：让 `搜打撤/game/narrative/events.ink` 在 Godot C# 里跑通（官方 ink C# runtime + inklecate 编译，或直接读 inkjs 编译产物 JSON），@@effect=@@ 解析对照网页 `narrative.js`。
4b：商店进货/价格表、宝箱四箱型+分层掉落+宠物蛋 0.7%+保底、开箱队列挂起/恢复、碎片合成落地。
4c：事件效果落地进 run flow（迁回 A 领地）。
**验收**：① 10 事件全分支走查测试绿（口径对齐 `narrative-coverage.test.js`）；② 商店价格与 cards.json price 一致断言；③ 开箱 suspend/resume 测试绿；④ 游戏内事件有正文演出（非硬编码选项）。

### 批次 5 · 宠物 + 收藏室 + hub（A，依赖 4b 的蛋掉落）
pets.json / achievements.json 进运行时；孵化（蛋+储备币）/升级（口粮）/携带；收藏池（职业卡+10/能力卡+50）与 5/15/30/45/全收集里程碑。
**验收**：孵化→升级→收藏转化全流程测试绿；数值与 pets.json/achievements.json 断言一致。

### 批次 6 · UI/表现对齐（B，6a/6b/6c 分波，贯穿全程）
- **6a 表现基础库**：Noto Sans SC 字体接入（检查子集缺字）；winter.css 色板/主题常量提取；STS2 动作库（读 sts2-reference.md：平滑三通道/hover 推挤/贝塞尔飞卡/飘字/抖动/呼吸光，做成可复用组件+dev 演示场景）；扇形手牌补 scale 分段表。
- **6b 屏幕对齐**：menu/run/map/battle 四屏按网页版截图对齐布局与交互时序；新增 hub 五页签/留言信箱/图鉴/制作坊（依赖批次 5）。
- **6c 战斗动画+地图渲染**：capture→克隆节点+Tween 的飞牌/沉浮/震屏/洗牌旋光、GPUParticles2D 打击粒子（抄 STS2 参数）、地图 canvas→`_draw()`（节点/圆点连线/棋子/金色选中箭头）。
**验收**：每屏 `--write-movie` 录屏帧与网页版截图并排存 `_planning/evidence/<批次>/`，主控初验 + 老板过目；`tests/UI/ui-smoke` 绿；AppMain 四屏路由不回退。

### 批次 7 · 音频 + 设置 + 性能（C，7a 可先行）
7a：音频管线——53 个 SFX 清单化（jsfxr 预生成 wav 直接用）、双 BGM 交叉淡化、音量/静音多键语义（→ Godot 配置文件）、战斗音效触发点对照 sound.js 清单。
7b：设置项全量（按键/画质/减少动态/提示条等）持久化；性能三铁律 Godot 对应（失焦即暂停、常驻动画只动 transform/调制、启动 idle 预热资产）；退出前强制落盘（替代 beforeunload）。
**验收**：SFX 清单逐一可触发；设置全项重启后保留；失焦暂停验证；导出包退出不丢档。

### 批次 8 · 发布链 + 总验收（A+主控，依赖全部）
export preset 更新（版本/图标/中文 exe 名）、便携版目录结构对齐现有桌面版习惯、全量回归（validate+三测试项目+ui-smoke+全卡审计+Narrative）、**总 gate：老板拿 exe 实玩一轮完整局，确认体验画面与网页版基本一致（§0.6）**。

## 4. 波次与并行

- **Wave 1（进行中）**：批次 1（A）∥ 批次 6a（B）∥ 批次 7a（C）∥ 批次 4a ink spike（D）
- **Wave 2**：批次 2（A）∥ 批次 6b 之 menu/run/map 三屏（B）∥ 批次 4b 商店/宝箱（D）
- **Wave 3**：批次 3（A）∥ 批次 6c 战斗动画+地图渲染（B）
- **Wave 4**：批次 4c 事件整合（A）∥ 批次 5（A 内串行）∥ 批次 6b' hub/信箱/图鉴新屏（B）
- **Wave 5**：批次 7b（C）∥ 批次 8（主控主导）

## 5. 测试与验收策略

| 网页版规格 | Godot 等价 | 批次 |
|---|---|---|
| battle-all-cards.test.js 全卡实打 | tests/Combat 全卡审计组 | 2 |
| 8 个单卡回归 test | tests/Combat 单卡组 | 2 |
| narrative-coverage | tests/Narrative | 4 |
| layered-map-generator / map-connectivity / encounter-count | tests/Run 生成器组 + 2000 seed | 3 |
| contracts（规则数值冻结/依赖方向） | tests/Core 契约组随批更新 | 随批 |
| save-compat | 不需要（口径 0.1） | — |
| 表现层 | --write-movie 录屏帧 vs 网页版截图并排 → `_planning/evidence/` | 6/8 |

## 6. 协调协议（主控循环）

PROGRESS.md 条目：`批次 | 状态(pending/claimed/verifying/done/failed) | 心跳时间 | 负责 | 摘要/证据`。
- **agent**：开工先把条目改 claimed+时间戳；每完成一个子步骤更新条目（心跳 ≤15 分钟一次）；完工改 verifying+附验收证据输出摘录。
- **主控（cron 每 25 分钟触发 + 主会话验收）**：跑 verifying 批次的验收命令 → 过则 pathspec commit（`git add <路径>` + `git commit -m "Godot批次N：..." -- <路径>`，绝不 add -A）并标 done；不过则把失败项写入 PROGRESS「失败项/修复单」并派修复 agent（只修失败项）。claimed 心跳 >45 分钟视为中断，派新 agent 接手（先看 git diff 评估残留）。pending 且依赖满足 → 按波次派工，一个 agent 一个领地。
- 全部批次 done：只汇报「等待老板验收」，不再派工。

## 7. 风险清单

1. .NET 正则与 JS 正则语义差（卡牌文本即逻辑）→ 哨兵显式失败 + 全卡审计兜底。
2. WOFF2 子集字体缺字（Godot 新增文本）→ 6a 先做覆盖检查，缺字换全量字体。
3. inklecate 与 inkjs 2.4.0 编译器版本差异 → 4a spike 先行验证。
4. 并行 agent 构建/编辑冲突 → 领地矩阵 + 撞锁重试 + 主控循环自愈。
5. 动画手感丢真 → STS2 参数库 + 录屏帧对比，最终老板拍板。

## 8. 经验教训（随批次沉淀）

- 批次 0：cards.js 沙箱求值必须内联 data-loader 的 import 并把 `Date.now` 钉为 0（「新兵操典」upsert 按 `Date.now().toString(36)` 铸 id，不钉则每次导出不同）。
- 批次 4a：nuget 无 inkle 官方现行包（Inkle.Ink.Engine 0.7.4 读不了 inkVersion 21）→ vendor ink-engine-runtime 1.2.1，文件头注入 `#nullable disable`（主 csproj Nullable=enable 下约 980 警告）；主 csproj 无 ImplicitUsings，产品代码必须显式 using；inkjs exports 不含 ./package.json，版本校验直读包目录；`Ink.Runtime.Path` 与 `System.IO.Path` 冲突需别名；ink Story 选中选项后 currentChoices 即清空，逐选项验证须独立 session。
- 批次 1：cards.json 的 price 是顶层稀有度定价表（非逐卡字段）；map.json 外层有 `{map:{...}}` 包装且内嵌 rules（与网页源 sha 不同是预期）；layerChests 字段歧义（`types[].w`=权重、`fixed[].n`=数量、`count[]` 兼有）；网页遭遇语义=per-entry size+elite 概率（L3 仅 3%），「bandit 保底补 3」被数据 size 取代；GameData.cs 放 src/Core/Run（不能进 Content，会破坏 Combat 测试项目的 Compile Remove 隔离）。
- 批次 7a：音效实盘 51=49 wav/ogg+2 mp3（任务口径 53 有误，清单 §0 已标注）；Godot 4.7 C# 改名：AudioStreamWAV→AudioStreamWav、AudioEffectCompressor.ThresholdDb→Threshold；ogg 无法运行时改采样率→由 BATTLE_GAIN 合并补偿；wav 池加载时峰值归一化 95%；.import/.uid 由 Godot 编辑器首次打开生成，属入库文件。
- 批次 6a：网页版 Noto 子集（1692 字形）缺 38 字（国/蛋/雪/马/驯/猫/狗等宠物成就期新增字）→ 换本机 OFL 全量 NotoSansSC-VF.ttf（30890 字形 0 缺字）设默认主题字体，粗体=FontVariation wght 700；结论与样本口径在 assets/fonts/README.md。后续新增中文文本无须再担心子集缺字。
- 批次 2：网页版异步结算队列移植为**同步化引擎**（终态与 drain() 后快照一致，动画信号走快照 SfxRequests）；两个移植真 bug=临时卡 uid 计数器未自增撞号、天启剑「抽到时额外抽」递归加深度 16 护栏防栈溢出；RNG 用骨架 DeterministicRng（口径 §0.1 只保内部确定性），mana-surge 类「可观测变化」断言按同等意图放宽（RNG 组合不同时任意结算日志均算可观测）；碎片 2 合 1 落 RunState.Fragments+SaveGameDto.Fragments。
- 批次 3：**唯一记录在案的网页版行为偏离**——map-generator.js 兜底池可把火堆/补给站贴着功能房补（seed 1412 L0，`isConvertible` 缺邻接过滤、quality 不校验），移植版 `EnforceFacilityGuarantees` 尾部追加相邻降级收敛，保证「功能房互不相邻」恒成立（修网页自身 bug，终验时老板裁断）；网页 v0.53 已实停用掷骰（按钮=选相邻节点）与事件连锁移动，体力为遗留显示字段移动不消耗、层间门一律不提供撤离——均已按行为对齐；2000-seed harness 使 Run 套件基线变为 RUN_SMOKE_OK checks≈1.45M。
- 批次 4b：**待老板终验裁断项 #2——背包容量口径**：骨架=逐实例计数（旧冻结测试），网页=同名堆叠占 1 格（上限 3、初始攻击/火球 5）；牵动背包/撤离/仓库整链，未擅改。网页坑四条：神秘货箱兜底 lib 过滤很宽（按真源移植）；中箱开出蛋时变「4 张选 1」（网页原语义）；KEY_NEEDED 实为 base.js 局部常量未进 rules.js（已补进导出契约）；DROP_EQUIP_DISCOUNT=0.8 网页硬编码（按祭坛常量先例落 LootTables）。另：tests/*/csproj 视角 BattleEngine.cs:420 有 CS8601 警告（sln 全量构建不出现，留 4c 顺手修）。
- （后续批次在此追加）
