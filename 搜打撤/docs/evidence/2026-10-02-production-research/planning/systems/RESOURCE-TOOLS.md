# 资源在哪里、工具怎么用

2026-10-02。这里是工作包对应的精选入口，不是购物清单。已有资料库38条核心、24款游戏、四份深读与Brogue源码继续保留；本次没有重新搜索广网、安装、下载或调用付费生成。

先用项目已有资源和工具；许可允许、文件已拥有、依赖已安装、接线有效、玩家可听/可见是五件不同的事。当前package里的声明不被写成已经成功运行。

## 先取哪类资源

|要做什么|先用什么|不要误用|
|---|---|---|
|卡牌、人物、场景补图|项目Art清单、人物圣经、NovelAI当前脚本，先小样|不要把旧服务破图归咎素材；不要用历史手册反推参数|
|风险/背包/出口图标|已有3个Game-icons SVG，统一笔触并补归因|CC BY 3.0不是CC0，未渲染也不算可读性通过|
|按钮/操作短音|项目既有库和jsfxr，已有Kenney CC0包试听择少量|不先采购大包，文件存在不等于接通|
|UI组件材料|现有CSS/卡面语法；Kenney UI只作备选|Kenney UI包本机尚未下载，不能说随时可直接用|
|风险/奖励/结局设计|深读ITB/STS/Riot/Xbox、Cogmind/Backpack Hero、Brogue源码方法|参考作品不是可复制的美术/音频；未亲玩不写体验结论|
|保存/叙事/随机|现有journal、Ink与随机代码|Dexie/idb/fast-check/seedrandom/rot.js不作为新增依赖默认方案|

## 精选资源逐项

### fp-sts-metrics · 'Slay the Spire': Metrics Driven Design and Balance

- 用途：优先用于卡牌选取率、不同熟练度通关率及社区反馈的联合诊断；先定义要验证的卡牌问题，再收数
- 来源：['Slay the Spire': Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics%EF%BB%BF)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：页面声明 Informa 版权所有；free content 指观看访问，不代表可下载再分发或游戏资产复用
- 限制：本轮补读GDC官方讲义关键页文本与页码；截图接口未返回可检视像素，未读取图表数值。未观看完整演讲，不能补推视频讲解或时间码。讲义受版权保护，只保留索引与短自写摘要，不下载再分发为游戏素材。
- 对应工作包：SYS-01、SYS-05、SYS-08、SYS-11、SYS-17

### fp-itb-postmortem · Into the Breach Design Postmortem

- 用途：用作战斗预告、随机节点与四层难度讨论的复盘入口；下一次设计评审先写清应保留的体验约束
- 来源：[Into the Breach Design Postmortem](https://www.gdcvault.com/play/1026333/-Into-the-Breach-Design)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：页面声明 Informa 版权所有；free content 指观看访问，不代表可下载再分发或游戏资产复用
- 限制：官方49页讲义关键页文本，未读图表像素或看完整视频；不照搬网格推怪、全确定性和三种攻击。 小实验为研究者建议，未实施；详见DEEP-READS.md。
- 对应工作包：SYS-04、SYS-06、SYS-08、SYS-09

### fp-riot-prototype · Prototype: Building a Game's Substance

- 用途：为新卡牌/新撤退规则建立最小可玩场景；每轮只回答明确玩法问题，不先批量生产完整美术内容
- 来源：[Prototype: Building a Game's Substance](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：未见开放复用许可；仅索引和自写摘要，原文/视频/图像不得作为本项目素材再分发
- 限制：完整官方文章正文；大团队原型流程不是修bug阶段门；骨架必须保留影响判断的上下文。 小实验为研究者建议，未实施；详见DEEP-READS.md。
- 对应工作包：SYS-04、SYS-18

### fp-xbox-user-research · How Xbox Research is Shaping the Future of Game Development

- 用途：用于首局引导、卡牌理解、基地界面可用性评估：观察目标玩家边玩边想，按问题选访谈/试玩/问卷
- 来源：[How Xbox Research is Shaping the Future of Game Development](https://developer.microsoft.com/en-us/games/articles/2024/09/how-xbox-research-is-shaping-the-future-of-game-development/)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：未见开放复用许可；仅索引和自写摘要，原文/视频/图像不得作为本项目素材再分发
- 限制：完整官方采访正文；原文讨论开发者工具，不提供本游戏样本量/量表；边做边说会改变节奏。 小实验为研究者建议，未实施；详见DEEP-READS.md。
- 对应工作包：SYS-04、SYS-16、SYS-18

### fp-gamedevbench · GameDevBench: Evaluating Agentic Capabilities Through Game Development

- 用途：为本项目 AI 美术与 UI 修改制定双重验收：机器状态/规则断言加实际窗口截图和交互；不能仅接受代理文字说已完成
- 来源：[GameDevBench: Evaluating Agentic Capabilities Through Game Development](https://arxiv.org/html/2602.11103v1)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：论文 HTML 标注 CC BY 4.0；不自动覆盖基准仓库和第三方教程资产
- 限制：固定v1关键方法与误差段落；Godot教程基准不能代表Vite整游戏。正文与Table 2个别数值不一致，不借成功率宣传。 小实验为研究者建议，未实施；详见DEEP-READS.md。
- 对应工作包：SYS-03、SYS-08、SYS-11、SYS-16

### kenney-interface-sounds · Interface Sounds

- 用途：适合评估卡牌选择、节点交互、战利品确认和基地按钮反馈的轻量音效；可先做少量试听筛选。
- 来源：[Interface Sounds](https://kenney.nl/assets/interface-sounds)
- 本地：`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/kenney_interfaceSounds.zip`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/selected/License.txt`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/selected/click_001.ogg`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/selected/confirmation_001.ogg`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/selected/error_001.ogg`
- 拥有/状态：已拥有所列本地文件；不等于已安装/集成；usable
- 许可：Creative Commons CC0 1.0；官方说明可用于商业项目且不要求署名。
- 限制：页面播放器未被当前浏览工具支持，未试听样例；已下载源包并核验包内License.txt为CC0。OpenGameArt镜像页提供同一个2020 Interface Sounds包；本目录OGA 2012条目是另一个独立素材包。风格仍需结合项目统一。
- 对应工作包：SYS-14

### kenney-ui-pack · UI Pack

- 用途：可用于原型阶段对按钮、面板、滑条的素材密度与状态覆盖做评估，也可择件评估实际使用。
- 来源：[UI Pack](https://kenney.nl/assets/ui-pack)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；usable
- 许可：Creative Commons CC0 1.0；官方支持页说明资源可商用且无需署名。
- 限制：页面未展开逐项预览；该套件是通用风格资源，不能替代项目自己的视觉语言和状态设计。
- 对应工作包：SYS-13

### wcag-contrast-minimum · Understanding Success Criterion 1.4.3: Contrast (Minimum)

- 用途：适合核查战斗文字、资源数值、状态标签、按钮文字与暗色背景之间的可读性。
- 来源：[Understanding Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：W3C说明性文档，仅作规范解释参考，不作为游戏素材。
- 限制：解释文档明确属于informative，不是额外强制准则；大字阈值与例外须按原定义判断。
- 对应工作包：SYS-12

### wcag-use-of-color · Understanding Success Criterion 1.4.1: Use of Color

- 用途：适用于稀有度、伤害类型、危险节点、卡牌费用和禁用状态的视觉编码。
- 来源：[Understanding Success Criterion 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：W3C说明性文档，仅作规范解释参考，不作为游戏素材。
- 限制：该条款针对颜色作为唯一信息载体；不限制使用色彩作为辅助强调。
- 对应工作包：SYS-12

### nng-visual-hierarchy · Visual Hierarchy in UX: Definition

- 用途：适用于控制战斗屏信息竞争：玩家行动、敌方意图、资源与牌面效果应有明确优先级。
- 来源：[Visual Hierarchy in UX: Definition](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：版权文章，仅使用自写摘要，不复用原文或示例图。
- 限制：文章以网页和产品界面为例；具体信息顺序需结合本游戏战斗决策和玩家测试确定。
- 对应工作包：SYS-06、SYS-12

### game-icons-net-risk-extraction-inventory · Backpack, Hazard sign, and Exit door icons

- 用途：可作为搜打撤背包/库存入口、风险警告与撤离出口的图标候选，补充现有按钮类资源。
- 来源：[Backpack, Hazard sign, and Exit door icons](https://game-icons.net/)
- 本地：`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/game-icons/backpack.svg`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/game-icons/hazard-sign.svg`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/game-icons/exit-door.svg`、`docs/evidence/2026-10-02-production-research/library/assets-ui/downloads/game-icons/ATTRIBUTION.txt`
- 拥有/状态：已拥有所列本地文件；不等于已安装/集成；usable
- 许可：Creative Commons Attribution 3.0 Unported (CC BY 3.0)，需署名作者和标题、链接来源及许可，注明是否修改；不暗示作者背书。
- 限制：只作为小规模候选素材；白色透明版，需在项目配色和明暗背景中检查可辨识度。未抄用竞品素材。若投入游戏发行，必须保留作者、图标标题、来源页和CC BY 3.0许可链接；若制作衍生版本需标注改动。 本轮未做SVG视觉渲染验收。
- 对应工作包：SYS-12、SYS-13

### howler · howler.js：项目既有音频依赖的原始实现

- 用途：优先追踪点击/确认/失败音效从动作到播放ID的接线、淡入淡出及解锁；减少额外音频依赖
- 来源：[howler.js：项目既有音频依赖的原始实现](https://github.com/goldfire/howler.js)
- 本地：`docs/evidence/2026-10-02-production-research/library/downloads/howler/LICENSE.md`、`docs/evidence/2026-10-02-production-research/library/downloads/howler/package.json`、`docs/evidence/2026-10-02-production-research/library/downloads/howler/src/howler.core.js`
- 拥有/状态：已拥有所列本地文件；不等于已安装/集成；evaluate
- 许可：MIT
- 限制：已有依赖不代表全部资产已接线；源文件下载未执行、未试听，需本项目真实动作验收
- 对应工作包：SYS-14

### jsfxr · jsfxr：小型程序化音效生成源码

- 用途：对照项目已有sfx:gen脚本，为卡牌点击、获得战利品、危险提示建立一致短音色
- 来源：[jsfxr：小型程序化音效生成源码](https://github.com/chr15m/jsfxr)
- 本地：`docs/evidence/2026-10-02-production-research/library/downloads/jsfxr/UNLICENSE`、`docs/evidence/2026-10-02-production-research/library/downloads/jsfxr/package.json`、`docs/evidence/2026-10-02-production-research/library/downloads/jsfxr/sfxr.js`、`docs/evidence/2026-10-02-production-research/library/downloads/jsfxr/riffwave.js`
- 拥有/状态：已拥有所列本地文件；不等于已安装/集成；evaluate
- 许可：Unlicense
- 限制：8-bit音色可能不合当前视觉气质；本轮不生成或试听声音；Pro商业产品不在此开源许可范围
- 对应工作包：SYS-14

### inkjs · inkjs：互动叙事运行时与分支选择参考

- 用途：评估四层事件的条件、访问次数与分支选择表达；可借鉴作者内容与运行状态分离
- 来源：[inkjs：互动叙事运行时与分支选择参考](https://github.com/y-lohse/inkjs)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；evaluate
- 许可：MIT
- 限制：本项目已有剧情编译脚本，先对照表达能力再决定是否值得新增依赖；未确认当前版本日期，未下载
- 对应工作包：SYS-07

### dexie · Dexie：IndexedDB事务与版本化数据参考

- 用途：仅当确有存档体积或多实体原子写需要时评估；可参考局外仓库与跑局结果一次提交的事务边界
- 来源：[Dexie：IndexedDB事务与版本化数据参考](https://github.com/dexie/Dexie.js)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；evaluate
- 许可：Apache-2.0；集成时核对NOTICE与依赖许可
- 限制：不授权改现行存档，不建议仅为包装API迁移；await非数据库异步工作会影响事务生存期；日期未确认
- 对应工作包：SYS-10

### idb · idb：轻量IndexedDB Promise包装与事务陷阱

- 用途：作为现有存档原子性诊断的阅读材料；可帮助区分写入请求完成与事务已提交
- 来源：[idb：轻量IndexedDB Promise包装与事务陷阱](https://github.com/jakearchibald/idb)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；evaluate
- 许可：ISC
- 限制：仅候选且未下载；不能与Dexie同时盲目引入；存档机制当前事实由工程诊断确认；日期未确认
- 对应工作包：SYS-10

### vite-features · Vite官方特性：动态导入与资源组织边界

- 用途：为四层场景/卡牌说明/音效配置懒加载评审提供事实，不先重写项目入口
- 来源：[Vite官方特性：动态导入与资源组织边界](https://vite.dev/guide/features.html)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：文档参考；Vite仓库MIT不自动替代第三方素材许可
- 限制：在线文档随版本更新；应和当前锁定Vite版本匹配，未确认页面更新日期；本轮不build
- 对应工作包：SYS-15

### mdn-autoplay · MDN：浏览器音频自动播放阻止与真实输入解锁

- 用途：检查标题页进入、刷新读档和首次卡牌行动是否真正有声；配合已有howler，不只核验素材存在
- 来源：[MDN：浏览器音频自动播放阻止与真实输入解锁](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- 本地：`docs/evidence/2026-10-02-production-research/library/catalog.json`
- 拥有/状态：仅本地索引与摘要；未下载原文/素材；reference-only
- 许可：文档参考；MDN内容许可依官方说明，本轮不复制原文或代码
- 限制：不同浏览器策略不同；本轮仅资料，未做真实点击试听；不能用合成事件宣称真实解锁通过
- 对应工作包：SYS-14

### 2048-reference · 2048 原作者完整浏览器游戏源码归档（状态与结局流程参考）

- 用途：仅对照输入→规则→存档→渲染→胜败/继续的分离；与根诊断的通关收束和结局后动作边界相关
- 来源：[2048 原作者完整浏览器游戏源码归档（状态与结局流程参考）](https://github.com/gabrielecirulli/2048)
- 本地：`docs/evidence/2026-10-02-production-research/library/downloads/2048/2048-source.zip`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/LICENSE.txt`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/README.md`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/index.html`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/animframe_polyfill.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/application.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/bind_polyfill.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/classlist_polyfill.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/game_manager.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/grid.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/html_actuator.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/keyboard_input_manager.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/local_storage_manager.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/js/tile.js`、`docs/evidence/2026-10-02-production-research/library/downloads/2048/readable/style/main.css`
- 拥有/状态：已拥有所列本地文件；不等于已安装/集成；evaluate
- 许可：MIT（源码）；归档内第三方字体和品牌图像的复用未核实
- 限制：不是卡牌/roguelike或搜打撤玩法模板；历史全局JS非现行ESM架构；未运行。完整ZIP含Clear Sans字体等资产，此轮只核验代码MIT，不批准字体/logo/图像复用；需要另核第三方授权
- 对应工作包：SYS-02、SYS-10

### indie-cogmind · Cogmind

- 用途：人读结算与机器事件共用事实；保留峰值、关键拐点和损失原因。
- 来源：[Cogmind](https://www.gridsagegames.com/cogmind/)；作者深例附链：[原文](https://www.gridsagegames.com/blog/2015/10/morgue-files/)、[原文](https://www.gridsagegames.com/blog/2020/06/audio-accessibility-features-roguelikes/)
- 本地：`docs/evidence/2026-10-02-production-research/library/indie-games/records.json`、`docs/evidence/2026-10-02-production-research/library/indie-games/DEEP-CASES.md`
- 拥有/状态：仅索引与自写分析；未拥有可复用游戏美术/音频/代码，未亲玩；reference-only
- 许可：reference-only; copyrighted source; no redistribution or asset reuse permission inferred
- 限制：未亲玩、未核视频/图表像素；官方介绍只支持写明机制。分析建议不证明玩家效果。未核项目代码与页面现状。；不复制庞大终端数据墙；音效字幕不能变成隐藏情报透视。
- 对应工作包：SYS-02、SYS-05、SYS-09、SYS-14

### indie-backpack-hero · Backpack Hero

- 用途：奖励限制和容量展示共同形成取舍；量测终局前多余步骤。
- 来源：[Backpack Hero](https://store.steampowered.com/app/1970580/Backpack_Hero/)；作者深例附链：[原文](https://thejaspel.itch.io/backpack-hero/devlog/347904/backpack-hero-version-2-hotfix-2)、[原文](https://thejaspel.itch.io/backpack-hero/devlog/361238/backpack-hero-archery-update)、[原文](https://thejaspel.itch.io/backpack-hero/devlog/636026/backpack-hero-10-is-available-now)
- 本地：`docs/evidence/2026-10-02-production-research/library/indie-games/records.json`、`docs/evidence/2026-10-02-production-research/library/indie-games/DEEP-CASES.md`
- 拥有/状态：仅索引与自写分析；未拥有可复用游戏美术/音频/代码，未亲玩；reference-only
- 许可：reference-only; copyrighted source; no redistribution or asset reuse permission inferred
- 限制：未亲玩、未核视频/图表像素；官方介绍只支持写明机制。分析建议不证明玩家效果。未核项目代码与页面现状。；不直接把矩形背包与相邻触发加入现有同名堆叠格；层数不同不能照搬9层。
- 对应工作包：SYS-04

### indie-cultist-simulator · Cultist Simulator

- 用途：不可施放原因解释结构规则，同时保留事件发现。
- 来源：[Cultist Simulator](https://store.steampowered.com/app/718670/Cultist_Simulator/)；作者深例附链：[原文](https://weatherfactory.biz/the-labyrinth-under-the-skin/)
- 本地：`docs/evidence/2026-10-02-production-research/library/indie-games/records.json`、`docs/evidence/2026-10-02-production-research/library/indie-games/DEEP-CASES.md`
- 拥有/状态：仅索引与自写分析；未拥有可复用游戏美术/音频/代码，未亲玩；reference-only
- 许可：reference-only; copyrighted source; no redistribution or asset reuse permission inferred
- 限制：未亲玩、未核视频/图表像素；官方介绍只支持写明机制。分析建议不证明玩家效果。未核项目代码与页面现状。；模糊交互不是未知玩法的必要条件；不能用神秘文本替代合法性提示。
- 对应工作包：SYS-07

### indie-citizen-sleeper · Citizen Sleeper

- 用途：让玩家在节点前知道今日/本层资源预算，成功也能带可解释代价。
- 来源：[Citizen Sleeper](https://www.fellowtraveller.games/citizen-sleeper)；作者深例附链：[原文](https://www.gamedeveloper.com/business/how-citizen-sleeper-was-inspired-by-tabletop-rpgs-and-gig-work)
- 本地：`docs/evidence/2026-10-02-production-research/library/indie-games/records.json`、`docs/evidence/2026-10-02-production-research/library/indie-games/DEEP-CASES.md`
- 拥有/状态：仅索引与自写分析；未拥有可复用游戏美术/音频/代码，未亲玩；reference-only
- 许可：reference-only; copyrighted source; no redistribution or asset reuse permission inferred
- 限制：未亲玩、未核视频/图表像素；官方介绍只支持写明机制。分析建议不证明玩家效果。未核项目代码与页面现状。；剧情体量与贫困主题并非搜打撤可直接套用的内容。
- 对应工作包：SYS-07

### brogue-source · Brogue CE 1.15.1完整固定提交源码研究

- 用途：学习地图进入/重访、资源消耗顺序、目标取得/撤离/终局冻结分离
- 来源：[Brogue CE 1.15.1完整固定提交源码研究](https://github.com/tmewett/BrogueCE/tree/1ba4240b7a928ddf0ffb772717bf1d433cd63804)
- 本地：`docs/evidence/2026-10-02-production-research/library/source-study/README.md`、`docs/evidence/2026-10-02-production-research/library/source-study/downloads/BrogueCE-v1.15.1-source.zip`、`docs/evidence/2026-10-02-production-research/library/source-study/downloads/readable`
- 拥有/状态：已拥有完整固定提交归档和9个阅读文件；不是已安装可运行发行包；reference-only
- 许可：源码AGPL-3.0-or-later；tiles.png CC BY-SA 4.0；其它资源未逐项核
- 限制：只借鉴方法，不复制源码或图块；未build/运行/亲玩；不可照搬饥饿或26层返程
- 对应工作包：SYS-01、SYS-02、SYS-03

### local-art-pipeline · 现有NovelAI与人物/美术真源

- 用途：按既有角色、厚涂配方和资产语义补小批缺口，保留实际生成参数与SHA
- 来源：本地项目入口
- 本地：`tools/nai_gen.py`、`tools/nai_style.py`、`tools/nai_guard.py`、`docs/character-bible`、`game/assets/asset-manifest.json`、`docs/asset-audit-debt.md`
- 拥有/状态：已拥有脚本、已有图片和人物说明；外部服务可用性未核；现有管线优先
- 许可：本项目已有资产逐项来源/授权见清单；已有授权文本不等于本轮核真，未登记或授权待确认项不声明商用通过
- 限制：未核凭据/付费额度/第三方当前条款；本计划不调用服务，不用历史手册反推当前模型，也不自动重画全库
- 对应工作包：SYS-13

## UI制作请求与真实资料的对应

UI-R编号是要制作或调整什么，不是素材文件或下载包。

|制作请求|内容|工作包|可用参考/来源ID|性质|
|---|---|---|---|---|
|UI-R01|token字阶|SYS-12|nng-visual-hierarchy、wcag-contrast-minimum|制作请求，不是下载素材|
|UI-R02|共享壳|SYS-12|nng-visual-hierarchy、kenney-ui-pack|制作请求；Kenney只作备选，不套整包|
|UI-R03|卡摘要|SYS-06、SYS-08、SYS-12|fp-itb-postmortem、fp-sts-metrics|制作请求，不是下载素材|
|UI-R04|风险确认|SYS-03、SYS-04、SYS-12|fp-itb-postmortem、fp-xbox-user-research|制作请求，不是下载素材|
|UI-R05|终局摘要|SYS-02、SYS-07|indie-cogmind、brogue-source|制作请求，不是下载素材|
|UI-R06|图标|SYS-12、SYS-13|game-icons-net-risk-extraction-inventory、local-art-pipeline|制作请求；来源素材须独立查许可与归因|
|UI-R07|首脑身份|SYS-09、SYS-13|local-art-pipeline|制作请求；优先现有角色资产|
|UI-R08|收藏|SYS-05、SYS-12、SYS-13|local-art-pipeline、nng-visual-hierarchy|制作请求；保留暖纸收藏语义|
|UI-R09|地图|SYS-04、SYS-12|fp-itb-postmortem、brogue-source|制作请求；不直接移植地图代码|
|UI-R10|cue|SYS-14|howler、jsfxr、kenney-interface-sounds、mdn-autoplay|制作请求；现有cue接线优先|

## 工具分工与实际可用性

|ID|工具/入口|现状|负责什么|边界|
|---|---|---|---|---|
|T-VERIFY|现有workflow/质量门：npm run workflow；docs/WORKFLOW-TOOLS.md；docs/quality-gates.md|项目已有脚本|按范围verify留证；混树staged --plan，遵守index与依赖守卫|本计划不执行全量gate/build；实际命令参数先看现有help/文档|
|T-VITEST|Vitest与jsdom：package.json；npm run test:target；tests/|package声明现有依赖；本计划不核整套运行环境|收益、命令幂等、故障注入、cue和Agent状态定向测试|模块测试不等于实页/试听/好玩；不写镜像实现测试|
|T-BROWSER|Codex当前内置浏览器：当前平台浏览器工具；docs/quality-gates.md|下一轮实际验收时确认可用|当前窗口真实输入、恢复、图像、信息与行为消费点|禁替换Edge/CDP/headless；不主动多尺寸；状态造档/调试须标干预|
|T-AGENT|现有SDT.Agent：game/src/agent/；现有Agent runner/record导出入口|项目源码已有|固定输入配对、轨迹、停止原因、策略比较|未核具体命令前不编造CLI；不替代真人理解或平衡|
|T-DATA|现有数据/牌效/类型检查：npm run validate:data；npm run typecheck；npm run docs:compendium|package已有入口|变更相关schema、迁移、过滤、图鉴一致性|不手改cards-sync；类型通过不等于玩法正确|
|T-NARRATIVE|现有Ink编译链：npm run narrative:compile；scripts/compile-narrative.mjs|inkjs在现有dependencies声明，已有编译入口；未另安装|事件与短收束内容编译、稳定ID和命令提交对账|资料库inkjs未下载不代表项目没有依赖；不另换引擎|
|T-ASSET|增量资产审计：npm run assets:audit；scripts/asset-audit.cjs --check；docs/asset-audit-debt.md|项目已有且本次相邻工作已补强|文件/清单/许可状态/路径/SHA检查，实际资源请求另验|不能重新冻结新债以绕过；通过不代表商业授权核真或美术质量通过|
|T-NAI|现有NovelAI Python工具：tools/nai_gen.py；tools/nai_style.py；tools/nai_guard.py|脚本存在；凭据、服务/额度未核|保持人物身份与厚涂配方，小批图像变体与生成记录|不安装/付费调用；美术方向确认与实施授权分开；不输出token|
|T-AUDIO|Howler+现有音频库+jsfxr：game/src/audio/；npm run sfx:gen；game/scripts/jsfxr-generate.cjs|howler/jsfxr在package中声明，既有运行代码；本计划不安装|统一cue接线、合成短反馈、样本试听与音量时序|离线howler源码只作参考；资产库存与可听结果分别验|
|T-WEB|现有web-up：npm run web；scripts/web-up.mjs|服务修复已有37测试/32图片证据|身份明确的Vite服务和资源健康|本计划不再开进程；无主进程勿杀，按端口约定|
|T-OPTIONAL-PBT|fast-check（可选）：https://github.com/dubzzz/fast-check|资料库仅索引；未在当前package依赖中声明，未安装|仅当复杂状态序列确有难复现失败时再评估性质测试|不是这轮必要前置；安装另依授权与范围|
|T-OPTIONAL-IDB|idb/Dexie（保留方案）：https://github.com/jakearchibald/idb；https://github.com/dexie/Dexie.js|仅索引；当前package未声明，未安装|实际跨键缺陷且当前journal方案不足时比较事务迁移|不为架构整齐重做存档；需迁移回退与旧档设计|

资产获取顺序：先检查现有映射与文件，再选现有合法素材，仍缺才生成小样或评估外部包；每份新资产记录来源、许可、实际参数、大小与SHA。大文件与二进制按项目规则仅登记相对路径/哈希/获取方式，不擅自入库。外部可选工具不构成安装授权。
