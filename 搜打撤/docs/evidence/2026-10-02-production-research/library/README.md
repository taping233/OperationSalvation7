# 代号柒制作资料库 · 第一版

2026-10-02；38 条人工筛选核心来源，八类全覆盖。范围是 Vite 单机四层节点探索、卡牌战斗和局外基地。研究只写本 library；未改游戏、存档、共享台账或服务，未安装、build、提交或执行下载的第三方代码。项目匹配核对当前 README、package.json 与 production 入口；根会话 handoff 基线 HEAD c6ee206840，本库不替代实时诊断。

先打开 [index.html](index.html) 离线分类检索；[catalog.json](catalog.json) 是汇总正本数组，[download-manifest.json](download-manifest.json) 是真实文件拥有情况及失败记录，[validation.json](validation.json) 留下解析、覆盖、去重、路径、大小与 SHA256 验证。[selection-notes.json](selection-notes.json) 说明四条未计入核心目录的补充来源，原分组记录保留。

本轮补深优先读 [DEEP-READS.md](DEEP-READS.md)：Into the Breach设计约束、Riot原型判定、Xbox问题与测法、GameDevBench验收方法四卡，每卡有页/段落、方法、项目映射、反例和拟议小实验。综合三项制作问题：深入/撤离取舍、卡牌与意图是否增加深度、Agent/UI/音效交付如何实证。38条数量不变；只读建议，不表示游戏缺陷已确认或实验已执行。

完整系统源码另读 [Brogue CE 1.15.1](source-study/README.md)：已拥有固定commit完整仓库ZIP，另展开9份阅读文件，给出地图生成/重访、消耗品扣除/回合推进、资源供给/饥饿、持目标返程、价值结算/终局门禁的函数与行号。独立source-study，不混入原38条；源码AGPL、美术tiles.png为CC BY-SA 4.0，其他素材未逐个批准；不运行或直接移植。

[独立游戏对照](indie-games/README.md)另有24款分群比较与[6份作者资料深例](indie-games/DEEP-CASES.md)，用于查机制组合、卡牌/资源风险、局外成长与体验收束；全部未亲玩，官方说明与作者文字证据独立于38条方法来源，不冒充画面/音效/手感验收。

## 最值得先看 10 条

以下按本项目问题选阅读顺序，不是来源之间的硬评分。项目适用建议是研究者推论，尚未实施。

| 顺序 | 来源 | 如何帮助本项目 | 已核验范围 |
| --- | --- | --- | --- |
| 1 | [Slay the Spire：Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics%EF%BB%BF) | 用卡牌选取/胜率和不同熟练度反馈同时判断平衡；先找具体问题再收数 | 官方简介与[官方讲义](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf)第7/13/16/21页文本，未观看全视频；[核验说明](first-party/sts-reading-note.json) |
| 2 | [FTL 制作方复盘](https://gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL) | 校准继续深入、承受损失、带资源撤退的体验目标 | 官方简介，未观看全视频 |
| 3 | [Riot：Prototype](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance) | 新撤离规则/新卡牌先构造一个可玩决策窗口，写明要回答的问题 | 全文方法卡：Playtesting与代表性骨架；见DEEP-READS |
| 4 | [GameDevBench v1](https://arxiv.org/html/2602.11103v1) | Agent 制作结果要有状态断言、窗口画面及交互证据，不能只接受代理完成声明 | §2.2–2.4/3.2/4.1–4.3与G.1深读；正文/表部分数值不一致，不外推到Vite |
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
| Brogue CE 1.15.1完整固定commit源码ZIP + 9阅读文件 | 地图/消耗品/生存压力/返程/结局系统研究；独立source-study清单 | 源码AGPL-3.0-or-later；tiles.png另CC BY-SA 4.0；未运行，其他素材复用未核 |

原素材/音频/归档与下载源码均受本目录 .gitignore 排除，不进git；JSON及短索引可供根会话读取。下载失败不是已拥有。下载清单逐文件列URL、大小、SHA256、固定commit/版本或资产来源；可据此重新获取。本轮没有下载整篇版权文章或视频，也没有为展示限制下载远程图片。

## 许可和证据分层

- **reference-only**：只读索引和自写短摘要。GDC免费访问、厂商文章、NNG网页/PDF并不授权把原图、整文或视频放进游戏。
- **evaluate**：明确开源许可的小源码/工具，可研究，仍需确认依赖、架构兼容和测试。已下载不等于已独立运行或可无条件接入。
- **usable**：资产来源明确允许使用；仍要满足具体条款。CC0无需作者署名；Game-icons CC BY 3.0需要Lorc/Delapouite归因、许可链接与修改说明。useStatus描述许可/候选用途，downloaded描述实际拥有，二者分开。
- 标准规范检查网页可访问性；好玩、平衡与完成度需要另用玩家目标和整局证据判断。
- AI证据：GameDevBench是受任务/模型配置限制的制作基准；Grounded NPC是小样本探索研究；Xbox工作流文章是观点/推广；Genie 2是研究演示。没有把厂商愿景换成受控效率结论，也没有把短视觉世界等同可维护游戏代码。
- GDC四条中《Slay the Spire》补官方讲义关键页文本与页码，Into the Breach补49页官方讲义的设计约束/UI/战略层/难度关键页方法卡；其余两条仍仅官方简介，均未观看完整演讲。两篇旧自动试玩论文仍只有摘要与元数据，不能用于方法复现。原分组记录保留，catalog内originalTakeaways保留升级前摘要；补读说明见first-party/sts-reading-note.json及DEEP-READS.md。
- 所有核心来源由所属研究者逐条web打开。整合者核对分组记录、项目匹配、全部JSON与全部下载文件；未谎称整合者再读每篇全文。

## 分类索引

### 美术/音效资源（3）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| kenney-interface-sounds | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | usable | 是 |
| kenney-ui-pack | [UI Pack](https://kenney.nl/assets/ui-pack) | usable | 否 |
| game-icons-net-risk-extraction-inventory | [Backpack, Hazard sign, and Exit door icons](https://game-icons.net/) | usable | 是 |

### 开源原始代码（8）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| rot-js | [rot.js：Roguelike 调度、事件队列与可复现随机源码](https://github.com/ondras/rot.js) | evaluate | 是 |
| howler | [howler.js：项目既有音频依赖的原始实现](https://github.com/goldfire/howler.js) | evaluate | 是 |
| jsfxr | [jsfxr：小型程序化音效生成源码](https://github.com/chr15m/jsfxr) | evaluate | 是 |
| seedrandom | [seedrandom：局部随机流与状态回放源码](https://github.com/davidbau/seedrandom) | evaluate | 是 |
| inkjs | [inkjs：互动叙事运行时与分支选择参考](https://github.com/y-lohse/inkjs) | evaluate | 否 |
| dexie | [Dexie：IndexedDB事务与版本化数据参考](https://github.com/dexie/Dexie.js) | evaluate | 否 |
| idb | [idb：轻量IndexedDB Promise包装与事务陷阱](https://github.com/jakearchibald/idb) | evaluate | 否 |
| 2048-reference | [2048 原作者完整浏览器游戏源码归档（状态与结局流程参考）](https://github.com/gabrielecirulli/2048) | evaluate | 是 |

### 开发者一手访谈/复盘（4）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| fp-sts-metrics | ['Slay the Spire': Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics%EF%BB%BF) | reference-only | 否 |
| fp-itb-postmortem | [Into the Breach Design Postmortem](https://www.gdcvault.com/play/1026333/-Into-the-Breach-Design) | reference-only | 否 |
| fp-ftl-postmortem | [Designing Without a Pitch - FTL Postmortem](https://gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL) | reference-only | 否 |
| fp-dd-postmortem | [Darkest Dungeon: A Design Postmortem](https://www.gdcvault.com/play/1023089/Darkest-Dungeon-A-Design) | reference-only | 否 |

### 大厂公开流程（3）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| fp-ubisoft-process | [Creative Process / How We Make Games](https://www.ubisoft.com/en-us/company/how-we-make-games/creative-process) | reference-only | 否 |
| fp-riot-prototype | [Prototype: Building a Game's Substance](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance) | reference-only | 否 |
| fp-riot-patch | [The Life of a 2XKO Patch](https://2xko.riotgames.com/en-us/news/game-updates/the-life-of-a-2xko-patch/) | reference-only | 否 |

### 游戏与Agent评估（3）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| fp-xbox-user-research | [How Xbox Research is Shaping the Future of Game Development](https://developer.microsoft.com/en-us/games/articles/2024/09/how-xbox-research-is-shaping-the-future-of-game-development/) | reference-only | 否 |
| fp-sims-ai-playtesting | [Exploring Gameplay With AI Agents](https://arxiv.org/abs/1811.06962) | reference-only | 否 |
| fp-active-learning-tuning | [Automatic Playtesting for Game Parameter Tuning via Active Learning](https://arxiv.org/abs/1908.01417) | reference-only | 否 |

### UI版式与可访问性（9）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| wcag-22 | [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/wcag/) | reference-only | 否 |
| wcag-contrast-minimum | [Understanding Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | reference-only | 否 |
| wcag-target-size | [Understanding Success Criterion 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | reference-only | 否 |
| wcag-use-of-color | [Understanding Success Criterion 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | reference-only | 否 |
| material3-typography | [Material Design 3 in Compose: typography and accessibility](https://developer.android.google.cn/develop/ui/compose/designsystems/material3?hl=en) | reference-only | 否 |
| material-accessibility | [Material Design: Accessibility](https://m1.material.io/usability/accessibility.html) | reference-only | 否 |
| nng-visual-hierarchy | [Visual Hierarchy in UX: Definition](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | reference-only | 否 |
| nng-visual-principles | [5 Visual-design Principles in UX](https://media.nngroup.com/media/articles/attachments/Principles_Visual_Design-A4.pdf) | reference-only | 否 |
| game-usability-model | [From Playability to a Hierarchical Game Usability Model](https://arxiv.org/abs/1004.0256) | reference-only | 否 |

### AI游戏制作经验（4）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| fp-grounded-npc | [Grounded Conversational Characters: In Depth](https://www.microsoft.com/en-us/research/project/grounded-conversational-characters/in-depth/) | reference-only | 否 |
| fp-ai-workflow-claims | [Fortifying Teams with AI and Optimized Workflows](https://developer.microsoft.com/en-us/games/articles/2024/08/fortifying-teams-with-ai-and-optimized-workflows/) | reference-only | 否 |
| fp-genie-worldmodel | [Genie 2: A large-scale foundation world model](https://deepmind.google/blog/genie-2-a-large-scale-foundation-world-model/) | reference-only | 否 |
| fp-gamedevbench | [GameDevBench: Evaluating Agentic Capabilities Through Game Development](https://arxiv.org/html/2602.11103v1) | reference-only | 否 |

### Vite/JS可直接评估工具（4）

| ID | 原始来源 | 用途状态 | 已下载 |
| --- | --- | --- | --- |
| fast-check | [fast-check：规则不变量、状态序列和缩小失败案例](https://github.com/dubzzz/fast-check) | evaluate | 否 |
| vite-features | [Vite官方特性：动态导入与资源组织边界](https://vite.dev/guide/features.html) | reference-only | 否 |
| chrome-performance | [Chrome Performance：运行期主线程与帧耗时诊断](https://developer.chrome.com/docs/devtools/performance/overview) | reference-only | 否 |
| mdn-autoplay | [MDN：浏览器音频自动播放阻止与真实输入解锁](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) | reference-only | 否 |

## 体积与验证

原38条远程实际下载1328762字节；已保存实物及展开/署名1402774字节，40文件、7条已有文件、31条未下载、3失败。Brogue独立源码研究新增1份完整ZIP（1411387字节）与9展开文件，source-study/download-manifest.json逐项留SHA。validation分别列原库与补充实物、合并下载/拥有字节，完整资料库精确体积递归包含indie-games与source-study及忽略源码/ZIP/音频/SVG、展开副本、署名、元数据、脚本、HTML和validation自身；ZIP内未展开虚拟条目不额外计体积。硬限按更保守的20000000000 bytes核对。原38条用途仍26参考、9评估源码、3素材候选。

## 离线使用与重复核验

用户可自行双击本目录index.html，不需服务。输入“撤离”“音频”“MIT”等关键词，可组合类别、用途状态和已有文件筛选；清除筛选恢复38条。展开单条查看要点、固定版本、来源状态、本地路径和逐文件SHA256。本地文件链接供保存/打开，不会由入口自动执行第三方代码；外部原文需要联网。页面使用原生输入、select和details，预期可用Tab导航，但真实浏览器键盘行为未验。

本平台内置浏览器尝试直接打开file URL时，被URL安全策略拒绝：仅允许HTTP/HTTPS；因此本地页视觉、真实输入与文件链接行为未验。未启动服务、借端口、换浏览器或绕过限制。现有项目jsdom完成纯内存DOM/筛选核验，覆盖默认38、art-audio3、usable3、已有文件7、MinHeap唯一rot.js、清除38、组合筛选/无结果和本地引用路径；这不是渲染或浏览器验收，证据见[index-memory-validation.json](index-memory-validation.json)。

在搜打撤目录执行：

```powershell
node docs/evidence/2026-10-02-production-research/library/tools/generate-index.mjs
node docs/evidence/2026-10-02-production-research/library/tools/verify-index-memory.mjs
node docs/evidence/2026-10-02-production-research/library/tools/validate-library.mjs --write-report
```

省略--write-report为只读核验。脚本只读本地元数据/字节及git忽略规则，不访问网络或执行下载代码；检查40文件SHA、版本、两份ZIP目录、展开样例哈希、原分组ID/来源/摘要保留、内嵌数据同步、失败未拥有和全库体积。catalog.bytes统一为localFiles总和，sha256统一逐路径映射；未下载为0/null。reference-only的licenseUrl允许null，表示未找到开放复用许可链接，入口明确显示。历史assemble-library.ps1与write-index.ps1保留为首次汇总记录，当前重复核验使用上述入口，避免覆盖接班补读和字段。

本轮定向重开具体素材/源码许可和GDC简介/讲义，其他来源复用研究者证据；未声称所有关联链接实时可达。音频未试听、SVG未渲染、下载代码未运行，2048字体/品牌资产复用未核，rot.js子集不独立可运行。无游戏测试或build。
