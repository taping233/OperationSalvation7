$ErrorActionPreference='Stop'
$researchRoot=Split-Path -Parent $PSScriptRoot
$researchRecords=@(Get-Content -LiteralPath (Join-Path $researchRoot 'catalog.json') -Raw|ConvertFrom-Json)
$researchManifest=Get-Content -LiteralPath (Join-Path $researchRoot 'download-manifest.json') -Raw|ConvertFrom-Json
$researchText=@'
# 代号柒制作资料库 · 第一版

2026-10-02；38 条人工筛选核心来源，八类全覆盖。范围是 Vite 单机四层节点探索、卡牌战斗和局外基地。研究只写本 library；未改游戏、存档、共享台账或服务，未安装、build、提交或执行下载的第三方代码。项目匹配核对当前 README、package.json 与 production 入口；根会话 handoff 基线 HEAD c6ee206840，本库不替代实时诊断。

先读 [catalog.json](catalog.json)，它是汇总正本数组；[download-manifest.json](download-manifest.json) 是真实文件拥有情况及失败记录；[validation.json](validation.json) 留下解析、覆盖、去重、路径、大小与 SHA256 验证。[selection-notes.json](selection-notes.json) 说明四条未计入核心目录的补充来源，原分组记录保留。

## 最值得先看 10 条

以下按本项目问题选阅读顺序，不是来源之间的硬评分。项目适用建议是研究者推论，尚未实施。

| 顺序 | 来源 | 如何帮助本项目 | 已核验范围 |
| --- | --- | --- | --- |
| 1 | [Slay the Spire：Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics%EF%BB%BF) | 用卡牌选取/胜率和不同熟练度反馈同时判断平衡；先找具体问题再收数 | 官方简介，未观看全视频 |
| 2 | [FTL 制作方复盘](https://gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL) | 校准继续深入、承受损失、带资源撤退的体验目标 | 官方简介，未观看全视频 |
| 3 | [Riot：Prototype](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance) | 新撤离规则/新卡牌先构造一个可玩决策窗口，写明要回答的问题 | 官方正文 |
| 4 | [GameDevBench v1](https://arxiv.org/html/2602.11103v1) | Agent 制作结果要有状态断言、窗口画面及交互证据，不能只接受代理完成声明 | 固定版本论文；不外推Godot成功率到Vite |
| 5 | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | 三个已下载点击/确认/错误样例可用于下一轮建立动作到声音的接线表 | 官网与OGA同包镜像、包内CC0许可；未试听 |
| 6 | [howler.js](https://github.com/goldfire/howler.js) | 项目已有依赖；优先检查首次真实输入解锁、播放ID、音量/淡入淡出和错误处理 | 2.2.4固定commit源码与MIT |
| 7 | [Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | 把玩家行动、敌方意图、风险与资源收益按决策顺序排列，降低战斗屏竞争 | 原作者正文，自写短摘要 |
| 8 | [WCAG Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | 危险、稀有度、禁用、费用不能只靠颜色；文字/形状与图标配合 | W3C解释页；不等同完整游戏质量标准 |
| 9 | [fast-check](https://github.com/dubzzz/fast-check) | 撤离/死亡互斥、战利品守恒、动作序列合法性可用不变量和缩小反例 | 原仓库与MIT；未安装 |
| 10 | [Game-icons.net 具体图标](https://game-icons.net/) | 已下载背包、危险、出口三个SVG；适合给风险收益与撤离动作加辅助识别 | 各作者页及CC BY 3.0；署名要求随文件保留 |

## 接入优先级与诊断关联

**第一优先：现有音频链路与决策 UI。** 先核对现有音效清单 → 动作名 → 参数/采样 → howler播放调用 → 当前窗口真实输入与试听。已下载 CC0 短音只是候选，不能以文件存在证明运行期有声。风险与撤离标签先明确文案/数值含义，再加图标；Game-icons 只是辅助线索，不替代文字。视觉层级、颜色编码、对比和点击目标分别验证，不能用一张漂亮截图代表可用性。

**第二优先：平衡和玩家体验评估。** 针对“何时继续/何时撤离”“哪些卡牌长期没有价值”“通关后如何收束”各写一个问题，结合新玩家观察和现有 Agent 结构化跑局。固定规则版本/seed/动作日志与策略配置；在同源规则下做配对实验。论文中自动试玩只证明特定代理/模拟下的表现，不代替真人理解、音频听感与真实存档恢复。

**第三优先：必要时评估小工具。** fast-check可补规则不变量与状态序列；seedrandom/rot.js用于对照随机状态和回合推进。项目已有剧情编译器，inkjs先比较能力再考虑引入。Dexie与idb为存档事务阅读候选，先确认实际需求，不同时引入两套包装器。Vite/Chrome文档只辅助现有工程；当前平台内置浏览器缺少相关面板时记录能力边界，不改用外部浏览器。

**完整代码参考。** 已下载原作者2048完整源码归档，供输入→规则→持久化→渲染→终局门禁阅读。它不是卡牌或搜打撤模板，也不是引擎替换建议；原始全局JS和历史兼容代码不应直接移植。静态核验的游戏管理器保留won/over/keepPlaying，终局时阻止新移动，可帮助根会话讨论通关收束。未运行或宣称实机通过。

## 已下载的实物与边界

| 实物 | 完整性/用途 | 许可与拥有情况 |
| --- | --- | --- |
| howler 2.2.4 原始core + package + LICENSE | 已有项目依赖的阅读对照，不包含整个插件仓库 | MIT，固定commit，各文件SHA256 |
| jsfxr 1.4.0 合成器 + RIFF封装 + package + UNLICENSE | 小原始源码集合；未生成声音、未执行 | Unlicense；不覆盖Pro商业产品 |
| seedrandom 3.0.5主源码 + Alea + package | 局部随机流/状态源码阅读；授权内嵌源码头 | MIT，保留版权头 |
| rot.js 2.2.1随机/引擎/事件队列/调度子集 | 阅读摘录；MinHeap.ts传输失败，因此不独立可运行 | BSD-3-Clause；三个失败保留，禁止误报拥有 |
| 2048完整固定commit源码ZIP + 可读源码 | 完整原始仓库归档；源码阅读，不执行 | 游戏代码MIT；归档字体/品牌图像复用未核实，本轮不批准 |
| Kenney Interface Sounds 1.0 ZIP + 许可 + 3音效 | 完整小音效包；仅展开click/confirmation/error样例 | CC0，未试听 |
| 3个Game-icons SVG + ATTRIBUTION.txt | 原始SVG小候选；未接入、未视觉渲染验收 | CC BY 3.0，Lorc/Delapouite；须署名、保留许可链接并标修改 |

原素材/音频/归档与下载源码均受本目录 .gitignore 排除，不进git；JSON及短索引可供根会话读取。下载失败不是已拥有。下载清单逐文件列URL、大小、SHA256、固定commit/版本或资产来源；可据此重新获取。本轮没有下载整篇版权文章或视频，也没有为展示限制下载远程图片。

## 许可和证据分层

- **reference-only**：只读索引和自写短摘要。GDC免费访问、厂商文章、NNG网页/PDF并不授权把原图、整文或视频放进游戏。
- **evaluate**：明确开源许可的小源码/工具，可研究，仍需确认依赖、架构兼容和测试。已下载不等于已独立运行或可无条件接入。
- **usable**：资产来源明确允许使用；仍要满足具体条款。CC0无需作者署名；Game-icons CC BY 3.0需要Lorc/Delapouite归因、许可链接与修改说明。useStatus描述许可/候选用途，downloaded描述实际拥有，二者分开。
- 标准规范检查网页可访问性；好玩、平衡与完成度需要另用玩家目标和整局证据判断。
- AI证据：GameDevBench是受任务/模型配置限制的制作基准；Grounded NPC是小样本探索研究；Xbox工作流文章是观点/推广；Genie 2是研究演示。没有把厂商愿景换成受控效率结论，也没有把短视觉世界等同可维护游戏代码。
- GDC四条仅验证原始官方简介，未观看演讲；两篇旧自动试玩论文只验证摘要与元数据。需要演讲具体结论/时间码或论文方法复现时另做定向深读。
- 所有核心来源由所属研究者逐条web打开。整合者核对分组记录、项目匹配、全部JSON与全部下载文件；未谎称整合者再读每篇全文。

## 分类索引

'@
$researchLabels=[ordered]@{
'art-audio'='美术/音效资源';'open-source'='开源原始代码';'developer-retrospective'='开发者一手访谈/复盘';'studio-process'='大厂公开流程';'game-evaluation'='游戏与Agent评估';'ui-accessibility'='UI版式与可访问性';'ai-production'='AI游戏制作经验';'tools'='Vite/JS可直接评估工具'
}
foreach($researchCategory in $researchLabels.Keys) {
 $researchGroup=@($researchRecords|Where-Object category -eq $researchCategory)
 $researchText+="`n### "+$researchLabels[$researchCategory]+"（"+$researchGroup.Count+"）`n`n"
 $researchText+="| ID | 原始来源 | 用途状态 | 已下载 |`n| --- | --- | --- | --- |`n"
 foreach($researchRecord in $researchGroup) {
  $researchText+='| '+$researchRecord.id+' | ['+$researchRecord.title.Replace('|','/')+']('+$researchRecord.url+') | '+$researchRecord.useStatus+' | '+$(if($researchRecord.downloaded){'是'}else{'否'})+" |`n"
 }
}
$researchText+="`n## 体积与验证`n`n"
$researchText+='远程实际下载 '+$researchManifest.stats.downloadedBytes+' 字节（约 '+[math]::Round($researchManifest.stats.downloadedBytes/1MB,2)+' MiB）；已保存实物及展开/署名文件 '+$researchManifest.stats.storedPayloadBytes+' 字节；40 个实际文件，3 个失败记录。完整资料库体积见最终 validation.json；远低于建议300MB与硬限20GB。哈希/路径/大小全部校验通过；JSON解析、必填字段、2–4条摘要、ID/URL去重与八类覆盖检查通过。仅内部资料静态验收，无游戏测试或build。`n'
[System.IO.File]::WriteAllText((Join-Path $researchRoot 'README.md'),$researchText,(New-Object System.Text.UTF8Encoding($false)))

