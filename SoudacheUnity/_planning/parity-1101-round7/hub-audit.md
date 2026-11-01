# Round7：基地、成就、交易与内容备注只读审计

结论：沿已发布 Round6（源码 d8a8a2eb、Player GUID `c3ee3347a03149de80bbb7fe3f0bb5c2`）确认三组问题，并按Root授权完成下述实现、专用原生检查源与五张正常播放器探针。源码已准备冻结，尚未运行测试、编译、Unity、Player 或浏览器。以下第1–3节保留修复前的来源、可达条件与完成标准，实际收口见末节；不能把R6通过数字当成本轮结果。

已复用 Round4 `hub-save-completion-audit.md`、Round5 备注保存/图库导出和 Round6 `hub-audit.md`，不把已闭合的准备页/照片/信箱旧事件、Global备注原子保存、归档自定义定义闭包、基地待领奖励按需汇总、人物单人投影、BGM失败重试再列一遍。Vite HEAD 为 `f966e859043b7ab3703839005029ef090a4677b5`；本次所读 Vite 文件无相关未提交改动。四个动作帧/idle在途路径未读取、未转译。范围内 handoff 已运行；Unity路径不属于该 npm 工具接受的项目内路径，随后仅用合法Vite路径完成交接读取。

## 1. 基地输入/下拉没有按钮已有的代次归属守卫

- Unity `Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs:59–60` 的 Command 已捕获 Hub owner/render revision；`:99` 的 InputField.onValueChanged 和 `:112` 的 Dropdown.onValueChanged 则直接调用 changed，没有 owner、启用、当前代次或索引边界检查。
- 实际消费者包括仓库搜索/类型/品质、人物卡池、收藏搜索/类型、成就搜索；它们写 HubScreen 的静态筛选状态后调用 Rebuild。成就例子在 `HubCurrentArchiveViews.cs:88`，收藏例子在 `HubModernPages.cs:101`。
- `HubScreen.cs:19,66` 的正式 guard 依赖全局 _renderSequence；`HubCurrentBrowse.cs:16–25`、`Kit/UiStack.cs:29–33` 的 Rebuild 没有关闭态短路。保存旧输入或下拉 UnityEvent，关闭旧 Hub 后同档打开新 Hub，再回放旧事件，可修改静态筛选，并在旧面板 Build 中递增全局序列，使新 Hub 的按钮归属不再匹配。另有“同页重绘后回放旧控件事件”的同类条件。
- 这指明确的旧事件重放边界；未声称普通鼠标能点击失活旧控件或已物理复现。
- Source `hub.archive.js:45–58` 的搜索监听随 AbortController dispose；`hub.archive-v3.js:216,252` 的当前页检查、`hub.trade-shop-v5.js:95–100,144` 的根连接/slot/generation共同限定旧绑定。Unity应沿现行正式guard补齐，不增加第二套页面状态框架。

**建议精确文件**：HubCurrentLayout.cs；必要时统一补 HubScreen.CurrentHub 的 owner/top/关闭语义，但先核对覆盖详情时哪些现有按钮应允许动作，不能仅靠禁止对象交互。不要顺带改公共 UiStack。

**完成标准**：真实当前输入/下拉仍筛选并保持焦点；同页重绘、关闭→同档新Hub、换档及覆盖页面后旧事件不改变筛选、当前render sequence或新页按钮可用性；旧非法下拉索引安全拒绝。原生构造旧UnityEvent与正常当前输入分别记证据。

## 2. 成就/奖励工作区仍有呈现缺口与重复重建

### 2.1 领取后缺实际奖励明细和去向

- 现行 Source `game.hub.runtime.js:395` 将 claimAch/claimColl 接到 `hub.reward-feedback.js:97–157` 的 runRewardClaim；`hub.archive-v3.js:174` 挂 bindRewardFeedback。成功按真实前后结果生成奖励物品/数量/目的地，`hub.reward-feedback.js:73–87` 提供仓库、对应卡背及关闭回执；资源显示“基地资源”去向，无专门资源跳转。失败显示未领取/容量不足及整理或扩建去向。
- Unity `HubModernPages.cs:121`、`HubCurrentArchiveViews.cs:43` 成功仅发“奖励已入账/收藏奖励已入账”Toast后整页Rebuild。成就领域另有日志，但没有本页结果工作区。收藏领域 `MetaProgress.Collections.cs:36–57` 抽卡后只返回bool/reason；UI没有实际抽中卡名。
- 正常可达例子：首次撤离成就 firstExtract 发木材×2；收藏45的 m45 发随机传说×2。当前界面只给预览“传说卡×2”，成功后无法在领取结果查看实际两张卡与去向。这是反馈缺失，不是重做已正确的容量、原子事务或领取资格。

**建议精确文件**：HubCurrentArchiveViews.cs、HubModernPages.cs，以及必要的 MetaProgress.cs/MetaProgress.Collections.cs 专用结果接口。优先把正式成功结果作为短期本页回执，复用现有导航；可复用领取前后最小库存/资源差量或正式命令产生的精确结果，不创建另一套保存/领奖框架，不在UI重新抽随机卡。失败不能生成成功回执。

**完成标准**：固定成就、随机两传说、钥匙/蛋/卡背均能展示实际到账项和现有去向；I/O失败仍未领取，回执不谎报、不二次抽卡/入账；回执关闭/导航正确还焦点，旧回执事件不跨slot/owner生效。提交时仍正式重新验证资格/容量。

### 2.2 三项已展示成就漏进度；状态重复求值，点详情重建整Hub

- Source `hub.archive.js:8–16` 每次render一次派生unlocked/claimed/status及四分类计数，`:23–36` 同步一次构造进度读取器。包括 runeFan x/5、beautifulVase x/1、savior x/2。
- Unity `HubCurrentArchiveViews.cs:63–77` 的 AchievementProgress 没有上述三项，default返回空字符串，但 `:99` 无条件创建“当前进度”一行，因此普通打开相应目标即见空进度；无需实现研究所或符文获取新玩法也能正确显示现有零/已有值。savior仅呈现已有stats，仍不搬Nest第二图。
- `:85` 四个分类分别枚举目标并反复求 IsUnlocked/IsClaimed；`:89` 筛选、排序再次求值，`:97,100` 行和详情再算状态。runeFan/beautifulVase等条件本身还遍历符文。Base状态在一次同步Build内没有变化，没有必要重复派生。
- `:88,95` 每个搜索字符或勋章选中都Rebuild整Hub：重建背景/资源条、所有勋章行/详情、导航，再次走Round6已经精简为一次的CollectionSummary/PendingAch。Source `hub.archive.js:47–58` 在现存行上过滤；`hub.archive-v3.js:190–211` 只更新选中行和详情并还焦点。当前不足不否定Round6的“每Build一次”，而是仍有不必要的Build触发。

**建议精确文件**：HubCurrentArchiveViews.cs，必要时HubModernPages.BuildCollectionRoom仅传入该次派生数据。局部只读snapshot供计数、筛选、排序、列表、详情共用；普通选择/搜索维护现有列表与详情，不跨库存、定义、领取变更长期缓存，不增加通用虚拟列表或全场景刷新框架。

**完成标准**：26目标的状态/进度与正式谓词一致，四类计数和稳定排序不变；一次派生只评估各目标一次；选择/搜索保持当前行、滚动/输入焦点且不重建Hub根/勋章列表；领取成功后重新读真实数据，失败保留当前输入/错误。性能证据只写静态少做工作和真实对象身份/调用次数，不宣称FPS或整帧零GC。

## 3. 伙伴“逗一逗”逐帧创建曲线数组，视觉结束后继续做动画工作

- 正常入口：`HubPets.cs:30–37` 已拥有伙伴详情的按钮调用 HubPartnerPlay.Play，未拥有伙伴不挂该交互。
- Source `ui/partner-interaction.js:25–39` 点击时选反应，1400ms后清气泡；`css/base-personnel-v12.css:83–85` 三个视觉动画分别620/560/620ms，期间没有JavaScript逐帧新建曲线数据。
- Unity `HubCurrentInteractions.cs:36–45` 的Update在气泡的整个1.4秒内重置并写 Art.position/rotation/scale，且每次Frame调用都写new float[]。hop分支每活跃帧三次Frame，显式创建六个数组；其他两分支各两个。620/560ms视觉归零后，直到1400ms仍继续相同计算、数组创建和Transform写入。减少动效分支仍每帧先写三个Transform并读取Global标记。
- 这是代码可见的重复分配/无用尾段工作，未运行分配计数或帧率测试。

**建议精确文件**：仅HubCurrentInteractions.cs。曲线数组改共享只读静态数据，或等价固定参数；保持现有插值结果。动画进度与气泡超时分开：视觉到期只归零一次，其后只等待气泡清空；复用正式ReducedMotion偏好读取，保留连点替换、失焦/禁用清理。无需新调度器或音频/资源系统。

**完成标准**：三次顺序反应、连点替换、减少动效、失焦/禁用清理与Source现行语义一致；气泡1400ms不缩短，视觉620/560/620ms不被拖长；稳定动画段不再创建曲线数组，视觉完成后不再写Art变换。可用真实组件断言/窄分配检查验证，不声称整帧收益。

## 已核而不追加功能

- **交易规则**：当前Unity单卖低价多堆立即成交；all/price≥5/count≤1才二次确认，稳定ID+variant/源售价/保护/失败回滚仍沿正式领域。该片未发现新的经济规则差异；Source本身选商品也redraw，因此不将它泛称新的源不一致。未重复Round1031/R2交易断言。
- **自定义内容写入**：Source `game.cardslib.designer.js:1–3,36–38` 明确写入关闭，创建/导入退回图库。Unity CardDesignerScreen只有退休说明，与MIGRATION“关闭制作坊”一致，不实装旧编辑器。
- **照片备注/导出**：继续沿R5的单一ReadPhotoNotes/PhotoNotesKey、Global原子写、pending重试和纯导出服务；没有复报已修全局备注顺带保存整局/失败标记、搜索/导出闭包。
- **格子开发备注**：Unity NotesEditorScreen虽然保留旧环形文本，却无生产Open调用；Settings危险区清空NotesStore仍是现役消费者。Source有开发模式不可达格子编辑链，当前层图语义与旧静态MAP坐标还需Root决定是否属于实际迁移工具范围；本片不把它直接当普通玩家缺项，不恢复旧环形编辑器，也不为这个疑点扩做新的地图工具。

## 已实现、待集中验证

- `MetaProgress.Achievements.cs` 增加只读 `AchievementStatuses()`：一次同步构建各目标的解锁/领取/已有计数进度。成就页Build直接用这份数据派生待领奖励，状态、四分类计数、稳定排序、列表和详情共用；补齐runeFan/beautifulVase/savior进度，已领取优先归入已领取分类。没有修改正式成就谓词或领取事务。
- `HubCurrentArchiveViews.cs` 的成就搜索/筛选与勋章、奖励记录选择保留Hub根、列表、滚动及输入，选择仅改旧/新两行样式和详情。被替换详情的claim闭包带局部代次/选中记录守卫；不可见旧行不能选回。页面只读快照复用前检查正式Global revision；发生已存Base/自定义变化则重新Build，不跨该变更继续沿用旧派生。
- `HubScreen.cs`/`HubCurrentLayout.cs` 将输入、Dropdown和按钮统一到启用、栈顶、Base、slot及render代次；输入还核自身启用/可交互，下拉核合法索引。没有新增通用页面状态或改公共UiStack。
- 新 `HubRewardFeedback.cs` 在原Claim/TryClaimCollection之前只记录资源、稳定堆键数量与已解锁卡背；正式成功后展示真实差量、目的地与仓库/指定卡背导航。m45不在UI抽卡。提交之后日志观察者异常，按同一Base的claimed转换识别已提交，不再重发。成功后重建真实状态并按Source `game.hub.runtime.js:398`请求一次ding；失败仅更新本页“尚未领取”及错误，不重建/失焦/发成功音，容量失败复用扩建入口。回执关闭/去向也有当前owner和回执对象守卫；返回定位只预览卡背，不自动应用。
- `HubCurrentInteractions.cs` 把固定曲线改静态数组；620/560/620ms时只复原一次并停止动画变换，1400ms气泡独立清除，闲置/超时后禁用组件Update。复用正式减少动效读取，保留顺序反应、连点替换、失焦/禁用清理；未另造驱动。

正式原生入口：`Assets/Editor/CurrentHubRound7Checks.cs` / `Sdt.Editor.CurrentHubRound7Checks.Run()` / `Assertions`，meta已补。源码覆盖一次谓词派生/只读性、26目标状态/排序/进度、真实输入焦点与挂载身份、保存变化失效、旧输入/下拉/详情claim、真实文件锁原子失败与一次成功、提交后日志异常、卡背只预览、m45实际两张不同传说及RNG回滚、不重复授奖、容量失败去向、钥匙/蛋实际结果，以及真实伙伴组件的有限时长、失焦/减少动效和窄范围warm Advance分配检查。全部待Root运行。

正式正常播放器探针：`Assets/Scripts/Sdt.Boot/NativeDisplayReview.Round7Hub.cs` / `ReviewRound7Hub()`，meta已补；Root另接主流程。本片不改主NativeDisplayReview.cs。Guard/Capture/ClickNamed/ClickButton与Round6WaitForButton复用；另等待当前HubRegionMotion结束和实际Canvas周期，真实raycast点击：符文2/5、彩虹1/1、m45领取两张传说、仓库去向、伙伴一条回复，共5个Capture。只有初始库存/计数/资源是fixture，领取走正式事务；finally恢复偏好并NewPresentationFixture恢复后续流程。无OS输入，尚未执行或生成本轮图。

当前实现与检查源已收口；编译、领域/原生和正常Player均由Root统一开始。冻结清单见 `hub-freeze.json`，无测试通过声明或FPS/整帧分配收益声明。
