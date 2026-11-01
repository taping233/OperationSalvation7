# 第七轮背包、发现与奖励链只读审计

结论：三项已按 Root 授权完成实施与检查源准备，等待集中验证；尚未测试、编译或启动 Unity。保留下面初始审计的源码行号与拟议说明，最终实现和验收入口见末节。未修改第六轮已修的发现卡池/回执持久化、正式使用/领取命令、UID或随机顺序。

## 基线与范围

- Vite 定向 handoff：HEAD `f966e85904`；所读背包/奖励路径没有工作树修改。沿正式 `game.bag.js` → BagDetail/use → `game.bag.rules.js` / `bag-item-use.js` / `bag-item-effects.js` 及 container/reward-organizer 消费链读取。
- Unity 以第六轮发布后 `source-freeze.json` / GUID `c3ee3347a03149de80bbb7fe3f0bb5c2` 为审计基线。初次只读审计时，11个目标源（BagScreen/CurrentView/CurrentCell/CardDetail/Discovery/Container、BagItemCommands/CardContainerCommands、RewardScene/Flow/CapacityOrganizer）的SHA均匹配该冻结清单；随后本片修改见末节和新冻结清单。
- 读过前轮 `parity-1101-round2/run.md`、`parity-1101-round6/run-audit.md` / `hub-audit.md` 和 R3奖励检查。没有覆盖或改写旧规划、证据、原WIP。

## 1. 背包发现页缺少 UI 归属与版本守卫

**确定代码缺口，建议 P2。** `Assets/Scripts/Sdt.UI/Screens/Bag/BagItemDiscoveryScreen.cs:15–36` 仅保存 `_uid` 与 `_selected`，没有 runtime/State/slot/seed/地点/当前Top、关闭标记或事件版本。候选和确认闭包从可变字段取当前选择，确认直接使用 `GameRuntime.I`。

可构造的明确路径：打开通行证C发现页，保留一个当前确认事件；选择候选使页内控件被替换，然后重放旧确认事件。旧事件仍读取新的 `_selected` 并调用当前 `TryChooseDiscovery`。覆盖该页或关闭后同帧重放也没有本页守卫。跨存档载入/导入使同一来源UID仍存在时，旧闭包同样未绑定原slot/run。这里陈述的是事件回放的源码结果，不声称已用物理输入复现。

正式命令 `BagItemCommands.cs:23–28,88–96` 的 runActive/非战斗、普通背包唯一UID、当前receipt与候选资格/容量检查仍有效，但它不承担页面归属。Vite `game.bag.rules.js:151–160,186–212,238–249` 显式约束同一上下文、owned来源、receipt、live根和ownsView；`discovery-selection.js:42–48,95–109` 再检查当前绑定和提交状态。当前Unity容器与奖励页也已有对应守卫。

最小编辑建议：只先持有 `BagItemDiscoveryScreen.cs`，捕获正式来源和页面身份，替换事件对象使旧版本失效，关闭时同步失效；提交/准备前后都核当前owner。I/O失败沿现有事务保留源与receipt，只有同State/slot/seed/地点和同UID/定义/候选的本页可窄重绑，不能用放宽后端或旧fallback恢复。成功后的关闭/背包刷新也应在原owner仍成立时执行。

## 2. 每次选择发现候选都会销毁整页卡面与控件

**确定重复绘制，建议与第1项合并实施。** `BagItemDiscoveryScreen.cs:17,29,34` 在选择、确认失败时遍历全部子树，先停用再Destroy，随后Build重建标题、全部候选CardFace、选择/确认/取消按钮。三个候选下，每次换选都重新创建三张大卡面的完整对象树，并移除当前被选控件，没有保留该控件或显式焦点交接。该页不是第六轮新增的战斗 DiscoverPanel。

Vite `ui/discovery-selection.js:48–62,84–92` 只patch选中标记和按钮状态；`:159–162`还让Enter选中后转到确认控件。最小实现应保留一次构造的候选树，换选只更新旧/新选框、文字及确认可用态；失败只更新错误说明并保留选择。只有候选或实际卡面数据变化才更新卡面。预计减少的是每次选择的C张CardFace重建（C≤3）及整个页控件创建，不声明整帧分配或FPS收益。

该页当前SHA：`8a7d245f4cb915422acd05ce4ff9e1e52702f57e72bf307222f5fda653114fc9`。

## 3. 背包恢复道具徽标反复复制并扫描完整库存

**确定显示热点，建议 P2，需协调共享容量属地。** `BagCurrentView.cs:74–102` 已为一次刷新构造 `Query` 与分组；但每个 `BagCurrentCell.Bind:47` 又调用 `BagCardDetail.UseStatus`。其 `BagCardDetail.cs:125` 对每个消耗区目标调用 `CanReceive(game,target,ownedCards.Where(uid!=source))`。`CardContainerCommands.cs:81–85` 每次将该投影ToList、计数并可能再Query全包。

触发条件是普通背包中存在恢复道具，消耗区有多个候选，且前面的候选放不下。T个可见恢复道具堆、P个消耗区候选、N张库存时，显示派生最坏O(T×P×N)，即使只是筛选/排序刷新。源 `game.bag.js:210,362–377` 传同次renderState；`game.bag.rules.js:64–66,90–103` 复用分组、来源索引与容量的常数预检。

最小建议编辑路径：由容量属地在 `CardContainerCommands.cs` / `BagCapacityQuery` 提供窄只读“移除一张普通来源再接收一张目标”预览；`BagCurrentView.cs` 每次真实刷新取一份，`BagCurrentCell.cs` / `BagCardDetail.cs` 传入该快照。保留当前id+variant分组、源堆最后一张是否腾格、资源扩容来源消失、普通/总容量、装备1/其它3及未占满已有堆可继续加入的现行语义。不得跨库存变化缓存，正式 TryUse/TryChoose 仍实时投影校验。静态复杂度目标为O(N＋T×P)，不是把执行端查询改成陈旧预览。

## 保留的当前实现与验收边界

- `BagItemCommands` 权威 `CardLibrary.All`、合法receipt只读重开、完整receipt资格验证、首次持久化/RNG回滚：第六轮已修，不再提为缺口。
- `ContainerScreen` 当前已按观察到的UID集合提交、以generation替换事件、保留两列滚动和卡面指纹；`TryTransferStack` 再校验来源/容量。未证实新的交易规则错误。Transfer调用背包刷新和本页Build属于进一步可测开销，尚未因底层背包在遮罩后仍可能可见而直接断言可删。
- `CurrentRewardCapacityOrganizer` 的安全格批量预览、行/确认控件保留、版本守卫、默认失败回滚与焦点已有R2/R3直接断言。`TryPersistMutation` 使用 `SaveJson.Populate(state,State)`，保留State对象；没有把“保存失败替换State导致全部按钮失效”作为问题。
- `CurrentRewardFlow` 已复用Row对象，R3检查覆盖，未重复提出。奖励回执/领取防重仍走正式命令；本轮未发现必须修改的当前领取规则。
- 在现有Editor源检索未找到 `BagItemDiscoveryScreen` 引用；RunR6的93项是命令层检查，战斗Discover/Grave的156项不是该背包页的直接验收。本轮需补该页的原生控件/归属/失败重试检查，不能沿用战斗页绿灯替代。

## 建议统一补验（本次未执行）

1. 真实 `BagCardDetail.UseOwnedCard` 打开通行证发现；重复选择保留根/三卡面/按钮实例，选择与可用态正确，构造Submit焦点可转向确认；普通取消保留来源/候选/RNG且不额外保存。
2. 旧pick/confirm/cancel事件在重绑、覆盖、同帧关闭、替换页、切slot、载入/导入同UID来源后均不得授奖或关闭新页。首次生成/领取I/O失败后只允许原身份重试；最终只消耗来源一次、授奖一次。
3. 恢复徽标以正式替换容量为oracle，覆盖源堆1/2/3/4张、同目标部分堆、资源格和普通格边界、移除扩容来源、装备、variant和失败回滚。用可观测计数证明一次render不再按每个目标重跑Query；不写镜像测试或性能数字。

## 最终实施与待集中验证

### 生产

- `BagItemDiscoveryScreen.cs` 保留一次构造的根、候选按钮、卡面、确认/取消控件。选择只patch边框、提示、可用态与导航，并聚焦同一确认按钮；不会批量改卡面Text颜色。只在候选完整定义实际变化时重建对应卡面。
- 正式入口要求当前BagScreen持有当前State且置顶、普通背包唯一来源UID和真实discover规则。页面捕获runtime/State/slot/seed/layer/position/Map、Bag owner、完整来源定义和receipt。每轮事件对象替换并固定候选ID，选择/确认/取消检查当前版本；覆盖、禁用、关闭同步失效。覆盖返回只读准备当前候选，保留同ID选择与相同卡面；过期来源不得以相同UID重定向。
- 首次准备和最终确认仍只调用原 `TryPrepareDiscovery` / `TryChooseDiscovery`。失败时仅在原State/slot/seed/地点、当前Top及同一Bag、唯一UID、完整来源和原receipt都一致的条件下，重绑该同步失败命令回滚出的OwnedCard与Map；不写档、不重抽。准备失败不会使旧候选继续可提交，保留同一确认控件作“重试”。I/O错误页显示简短保留/重试说明，原始错误仍由原命令日志和通知提供。
- 提交成功后先核原页面归属；SaveCompleted观察者打开的新页不被旧回调关闭。合法取消/ESC不产生额外候选保存；过期页仍可由当前显式ESC安全退出，不改变新存档状态。
- `CardContainerCommands.cs` 新 `CreateRestorationPreview(game, query=null)` → `BagRestorationPreview.CanReplace(sourceUid,target)`。显示快照私有持有普通来源、分组和容量；拒绝缺失/歧义UID。完整保留正式CanReceive的部分堆短路，以及移除源后的首堆类别/上限变化、资源扩容减少与普通/总容量判断。常规Query热路径未新增UID字典。
- `BagCurrentView/BagCurrentCell/BagCardDetail` 仅在当前有消耗区目标和确定性恢复道具徽标需要时惰性构造同次刷新快照。详情页单次状态派生自行构造，快照不存入组件或跨事务缓存。正式TryUse/TryChoose仍实时检查。

### 静态成本依据

- 三候选页换选：从销毁/重造整个页面和三张CardFace，变为更新现有边框/文案/导航；完整来源/receipt序列化仍在输入资格复检发生，未声称零分配。
- 恢复徽标：原最坏O(T×P×N)的逐目标完整投影/Query，改为本次Query复用＋一次O(N)只读索引，随后O(T×P)常数替换判断。空消耗区/无确定性恢复道具不建立该索引。没有帧耗时、分配量或FPS实测。

### 检查与正常播放器探针（均未执行）

- `Assets/Editor/CurrentBagDiscoveryRound7Checks.cs`：全局 `Run()`/`Assertions`，当前固定分支静态预期138项（首次冻结92项，补审后新增46项）。使用真实员工C规则、正式Bag-use入口、真实uGUI按钮和构造ISubmitHandler；覆盖根/卡面/按钮/墨色/焦点保留、实际几何、旧版本/覆盖/禁用/同帧关闭/替换页、slot/State/地点/同UID对象/receipt变化、满包、首次与领取I/O失败及窄重绑、重开无SaveCompleted、独立SaveSystem重读、成功保存观察者覆盖不误关新页。静态数量不是通过记录。
- `_planning/parity-1101-round7/bag-check/BagRound7Checks.csproj` / `Program.cs`：复用既有Core/Run/stub编译集合；以正式CanReceive完整私有投影为独立oracle，覆盖1/2/3/4源堆、同ID variant、装备/资源/安全格/容器、超包/有空间/散装物资、移除扩容来源、首堆元数据变化、快照不读后续库存和下次刷新恢复实时性；补审新增恰好满包等号、普通/资源双界和bagUp后重建。当前未升级BagCap16的静态预期1175项（一般式727＋28×BagCap；首次冻结为1160项），未执行。
- `Assets/Scripts/Sdt.Boot/NativeDisplayReview.Round7Bag.cs`：`IEnumerator ReviewRound7Bag()`，Root接主播放器流程。明确构造单张真实员工C库存，正式BagScreen/UID详情入口；随后use/选择/确认均复用严格RaycastAll接收者检查与现有有界等待。预备四张实际Capture：候选、保留选择、受控写入失败可重试、真实领取返回。故障只占用隔离profile的`.writing`路径，归属确认后移至唯一留证目录；不删档，不用OS输入，不替换截图坐标或绕过射线。
- 已做定向源码/调用检查和 `git diff --check`；未运行上述项目、原生或播放器。旧R6/其他领域不因本说明变成已验，Root将统一冻结输入并选集验证。

最终自有源码/检查/说明SHA见同目录 `bag-freeze.json`；本片不修改主NativeDisplayReview或Root验证驱动。

## 补审闭包：详情页实例入口与直接检查

Hub独审 `bag-independent-review.md` 确认：原详情页按钮没有实例归属检查。关闭旧详情并重新打开背包，或换成同UID的新State后，保留的use事件仍能按当前库存准备发现；Browse关闭旧详情后，旧非发现道具事件仍可直接使用原UID。Vite `game.bag.js:232–239,245–254` 已有sourceView、根、zone/filter和browseCurrent检查。Root授权同片最小修，未修改正式命令或存档框架。

- `BagCardDetail` 在正式Mount捕获runtime、State、slot、可空seed、地点、Bag实例/代次/zone、原opener及来源引用、卡牌完整定义和stored/safe/pouchOf。实例按钮的共同绑定固定当时revision，当前Top、原owner仍挂载且来源一致时才执行；关闭、禁用、覆盖立即使旧事件失效，覆盖返回只给现有按钮换事件。use、移动、丢弃等闭包固定来源UID/集合，不读取当前页面或库存替代原指令。
- Browse仍关闭旧实例、按当前可见顺序新开另一实例。接受的CloseThen动作在关闭回调后再次核原Bag、State和来源，避免关闭观察者打开新页面或切换来源时继续命令。静态正式`UseOwnedCard`入口保持不变。
- `ShowReadOnly`的container表示只读呈现模式，两列都正式调用它，不能等同于stored来源。复核时修正初稿对此的过窄限制，允许当前owned中实际未存来源，仍固定真实实体UID/引用和原位置；新增珍珠盒右列未存资源的正式inspect及返回同容器检查。
- 当前丢弃确认及合成失败只允许自身同步命令在原State/slot/seed/地点/Top、相同唯一UID/卡牌/位置/堆组成下，接回保存回滚重建的OwnedCard和Bag代次；失败只换事件，不重造卡面或布局。输入资格复检仍会查询来源堆和序列化定义，未声称零查询或零分配。
- 新原生检查构造关闭后同档新Bag、Settings覆盖并返回、同UID新State、Browse新实例后的旧普通治疗道具事件，逐项要求库存/随机/写入/授牌/声音不变；同时证明当前重绑按钮仍能进入正式发现、丢弃写失败后当前确认可重试。使用真实纯治疗卡规则，Browse结果明确是新实例。测试采用构造ISubmitHandler和旧UnityEvent回放，不声称物理键盘或OS输入。
- 音频检查读取正式AudioService的实际voice序号和clip，保持正式子页click/hover抑制。选择只读、写失败、旧事件不增加授牌或成功声；当前成功要求`CardGranted`恰一次且实际`ding` voice/clip恰一次。未为检查修改正式声音门控。
- 新容量oracle显式要求`used==totalCap`和`ordinarySlots==baseCap`，覆盖源堆1/2/3张、匹配部分堆/不同variant、珍珠盒资源扩容和移除扩容来源；bagUp后旧render快照保持旧事实，新render与正式CanReceive一致。

首次冻结清单保留为`bag-freeze-1.json`；最终清单`bag-freeze.json`记录补审版本及前版指纹。此处所有新增断言仍待Root统一执行，未将静态审读计为通过。
