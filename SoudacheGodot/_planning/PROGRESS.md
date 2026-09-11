# PROGRESS · 实时状态板

> 心跳协议：开工先把批次条目改 `claimed` + 时间戳 + 负责人；每完成一个子步骤更新本条目（≤15 分钟一次）；完工改 `verifying` 并附验收证据摘录。
> 主控：验收 verifying 批次 → 过则 pathspec commit + 标 done；不过写「失败项/修复单」并派修复 agent；claimed 心跳 >45 分钟视为中断可重派；pending 且依赖满足 → 按 HANDOFF §4 波次派工。
> 最后巡检：2026-09-12 01:50 主控（批次 1/4a/7a 验收通过并提交；批次 2 已派 wave2-A；6a-B 进行中待录帧）

## 批次状态

| 批次 | 状态 | 心跳 | 负责 | 摘要/证据 |
|---|---|---|---|---|
| 0 数据管线 | done | 2026-09-11 | 主控 | 245 卡：validate OK、C.all()=245 互证、Combat 108 checks / Run 89 / Core 26 全绿、dotnet build 0 警告 |
| 1 数据进运行时 | done | 2026-09-12 01:50 主控复验 | wave1-A | 主控复验通过（重跑 validate+三测试项目+硬编码 grep 全过）。原证据：①validate OK；②Core 26 / Run 777 / Combat 108 全绿、主工程 build 0 错；③grep 证据：OuterPool/MiddlePool/InnerPool/LootTable、CreateEnemy 怪名 switch、CardPrice 稀有度 switch、CharacterClass/Name/Index 角色 switch、RunMap 旧 BOSS 名、RunRules const 数值组全部 0 命中，改读 GameData（data/map.json+rules.json+characters.json+cards.json price）；④新增 RuntimeTablesMatchDataFiles 688 断言：五张表逐项==data/*.json + 200 seed 遭遇/开箱行为抽查。改动：新增 src/Core/Run/GameData.cs；改 RunState.cs/RunMap.cs/CoreGameAdapter.cs/RunSmokeTests.cs |
| 4a ink spike | done | 2026-09-12 01:50 主控复验 | wave1-D | 主控复验通过（编译链重跑幂等、Narrative 160 绿——主控顺手修 LoadStoryJson 为三 cwd 兼容、回归三项目绿）。选型=vendor 官方 ink-engine-runtime 1.2.1（nuget 无 inkle 官方现行包，Inkle.Ink.Engine 最新 0.7.4 读不了 v21）。证据：①tools/ink/compile-narrative.mjs（复用搜打撤 inkjs@2.4.0）→ data/narrative-events.ink.json 与网页版 generated 字节级一致、重跑幂等；②NARRATIVE_TESTS_OK checks=160（10 结点 intro/选项/effect/detail/tone 逐项对齐网页版实跑 + 全分支 BFS 无死路）；③回归 Combat 108 / Run 89 / Core 26 全绿；④主构建 Narrative 相关 0 错 0 警（vendor 34 文件头注入 #nullable disable+溯源注释）。注：7a 心跳提到的 InkEventCatalog 2 错已在本批修复（缺 using，主 csproj 无 ImplicitUsings） |
| 6a 表现基础库 | claimed | 2026-09-12 01:12 wave1-B | wave1-B | 全部代码完成：字体（全量 VF 0 缺字+默认字体）· ThemeTokens · Fx 库 8 组件 · 手牌 scale 分段/hover/推挤 · fx-lab 场景；ui-smoke 绿、.godot 导入完成；阻塞项：dotnet build 被他人领地 2 编译错挡住（src/App/GameAudio.cs:430 ThresholdDb、GameAudioSettings.cs:80 Math 缺 using，wave1-C 半成品），C 修后即跑 录帧+四屏 smoke |
| 7a 音频管线 | done | 2026-09-12 01:50 主控复验 | wave1-C | 主控复验通过（资产 diff -rq 一致仅 .import 元数据差异、主工程 build 绿、三测试 26/108/777 绿、清单在）。原证据：①资产=网页版 49 wav/ogg+2 BGM mp3 逐字节一致（diff -rq 通过；任务口径 53 实为 51，见清单 §0）；②`dotnet build SoudacheGodot.sln` 0 警告 0 错误（6a 心跳提到的 GameAudio.cs:430 ThresholdDb→已改 Godot 4.7 的 Threshold、GameAudioSettings.cs:80 Math→已补 using System，B 线阻塞已解除）；③三测试项目全绿：CORE_SMOKE_OK checks=26 / RUN_SMOKE_OK checks=777 / COMBAT_TESTS_OK checks=108（从仓库外层跑，Path.Combine("SoudacheGodot",...) 基准）；④清单 _planning/audio-inventory.md：30 音效键全覆盖+触发点对照表（sound.js 调用点逐条 文件：行）+音量键语义（sdt-muted/music-off/sfx-off/music-vol/sfx-vol→user://audio.cfg，dbGain(k)=10^((k-1)×30/20)，BASE_MUSIC 0.45/BASE_SFX 2.5，ducking×0.45）。改动文件：assets/sfx/**（49 资产+3 license/README）、assets/bgm-*.mp3、src/App/GameAudio.cs（重写）、src/App/GameAudioSettings.cs（新）、src/App/GameAudioSfxSynth.cs（新）、_planning/audio-inventory.md（新）、本板 |
| 2 战斗对齐 | pending | — | — | 依赖 1 |
| 3 四层地图 | pending | — | — | 依赖 2 |
| 4b 商店/宝箱/碎片 | pending | — | — | 依赖 1 |
| 4c 事件整合 | pending | — | — | 依赖 4a+2 |
| 5 宠物+收藏室 | pending | — | — | 依赖 4b |
| 6b 屏幕对齐 | pending | — | — | menu/run/map 先行；battle/hub 部分依赖 2/5 |
| 6c 战斗动画+地图渲染 | pending | — | — | 依赖 6a |
| 7b 设置+性能 | pending | — | — | 依赖 7a |
| 8 发布链+总验收 | pending | — | — | 依赖全部 |

## 接口需求（跨领地登记）

- [7a→A] 战斗细粒度音效信号：sound.js 的 parry/curse/strike/card/flee/dice 触发点（对照表 _planning/audio-inventory.md §3）在 BattleUiSnapshot（HP/StatusText）中无信号。请 A 线在批次 2 的快照契约中补充（如 BattleUiSnapshot.SfxRequests[] 或 ICoreUiPort 事件）。GameAudio.PlaySfx("<key>") 公开 API 已就绪，届时一行接线。
- [7a→B] UI 层接线提示：checkbox/开关切换应播 PlaySfx("switch")，弹窗开/关播 PlaySfx("open")/PlaySfx("close")（对照清单 §1.5）；click/hover 已由 GameAudio.BindButtons 全局委托覆盖。
- [7a] 无需总线布局文件：Music/SFX/Click 总线全部经 AudioServer 代码配置（含 click 压缩器链），project.godot 未动。
- [1→B] 角色显示名已接 data/characters.json（数据=无/常无欲/白塔/玄砾/灯葵，rulesetId=侠客/降临者/法师/战士/牧师）；RunUiSnapshot.CharacterDisplayName 已随数据。UI 自绘花名册（src/UI/MenuScreen.cs:52、RunScreen.cs:48）仍硬编码旧名（霜翎/白契/栗团…），请 6b 屏幕对齐时改读快照或 characters.json，避免两套名字。

## 失败项/修复单

- [低优先][归批次2-A 顺手] 测试加载器 cwd 兼容统一：批次 1 的 GameData.LoadDefault 已向上探测 data/ 大幅缓解，但 tests/Combat 个别直读路径（原 CardCatalog.LoadFile 调用点）仍偏好仓库根 cwd。请批次 2 统一为 NarrativeTests.LoadStoryJson 的三候选写法；验收命令口径暂按「仓库根执行」。
