# 献祭选择页独立审查

2026-11-01。结论：审查发现背包保存失败后地图停在modal的生产链，以及seed可空类型不匹配，Battle均已作窄修；本报告绑定的最终版本未再发现必须退回的确定生产问题。三个检查夹具问题也已纠正。未运行测试、编译或Unity。生产由Battle编辑；本代理仅获委派在最终原生检查中补背包失败返回一段，未改已冻结Run93领域源。

| 文件 | 本次最终审查SHA256 |
| --- | --- |
| `Assets/Scripts/Sdt.UI/Screens/Run/CardSacrificeScreen.cs` | `0dc04aea2dcdcca1a9b27290d067d81495a5e1b059fe169aa79a2deca5f2de4f` |
| `Assets/Scripts/Sdt.Run/GameRuntime.Map.cs` | `f2eae354115b2f11402ffbe58e18af040b477e16246d2c309e2a4691ec1dbc11` |
| `Assets/Editor/CurrentSacrificeRound6Checks.cs` | `3dcaee5bc165070a133bd8dd68b8e5a29720041706132e63f2267e6e31af58cc` |

## 生产审查

- **资格/身份**：Vite `game/src/hub/sacrifice-policy.js:2–4`要求普通随身、非safe/stored/pouch；Native `GameRuntime.Map.cs:115–121`将同一谓词供候选查询和支付复检复用，仍按三个不同物理UID支付。UI按UID建槽，完整CardDef序列化指纹变化才重建对应Face；同ID不同variant/cost/desc不会被按名字合并。非法重复UID仍由正式档案读入校验拒绝，没有为坏档放宽付款。
- **种子类型**：初稿将_seed声明为int，直接赋值RunState.cs:48的int?不能编译。最终`:31`已与_slot同为int?，保留完整可空身份，没有用默认种子掩盖差异；这是静态声明核对，未冒称执行过编译。
- **保留树/选择/滚动**：CardSacrifice `:80–150`保留每UID按钮、Face、grid及父ScrollRect，选/撤仅更新本槽标记、计数和确认状态。返回整理时`:118–138`按当前资格prune、补新UID、重绑版本；内容相同时Face保留。每次输入仍创建GetSacrificeCandidates快照并校验单卡序列化，确认/返回也会遍历候选；这些是实际O(N)/分配，不能描述为零派生或零分配，也未测毫秒/FPS。
- **覆盖返回与旧事件**：`:59/183–194`同时订阅UiStack.Changed和Update。正式Bag/Settings关闭时Changed同步prune并提升revision，旧Tile和旧Confirm事件被拒绝；不是等下一帧才失效。Current另检查State/slot/seed/layer/node、Map身份、Top和SuggestionBox，关闭后_closed/revision清理会挡住历史回调。
- **保存失败**：本页Confirm失败后`:162–164`只在原State/slot/seed/layer/node、当前Top且无留言覆盖时接纳本次事务回滚后的Map；随后重绑当前快照，旧确认事件不能重放。没有把其它来源或替换State当成本页失败继续。
- **取消/成功**：`:172–180`取消及Escape回到实际Altar或Emergency入口，并检查关闭后下层owner与位置没有改变。紧急撤离成功的生产ExtractStashChanged会先关闭旧页/打开结算；`:166–170`只关闭自身，且只在非emergency和原owner仍有效时打开祭坛，不会Pop新结算页。`:181–182`也不把已结束run的settlement阶段改成idle。
- **按钮声音**：候选按钮`:82–85`直接创建Button，`:115–116`事件仅调用Toggle；没有经过 `UIKit.Btn:69`的默认click。因此`:150`只有一次显式PlaySfx调用，未重复。Footer才由UIKit创建，但不调用Toggle。AudioService对子页通用click/hover另有既有门控，本结论不声称该调用在子页必定可听见。

## 已发现并闭合的卡死链

真实入口为献祭页`:75`打开Bag → `BagScreen`中的公开丢弃/移动/排序命令保存失败 → `GameRuntime.Persistence.cs:54–57`同State回滚并BuildDerived替换Map → `BagScreen.OnClose:216`不改Phase → 献祭页StackChanged因Map身份不同关闭。

最初OnClose要求OwnsSource才回idle，故最后一个页面关闭后栈空却留下modal，`CanMoveToNode:80`持续拒绝。Battle现将`:182`的收尾条件改为SamePlace，并仍要求栈空；它只恢复原State/slot/seed/layer/node的运行阶段，不重绑未知Map、不复活旧事件，也不改替换State或新结算页的阶段。

本代理在检查源`:101–123`新增正式BagScreen覆盖，调用公开BagCardDetail.DiscardOwnedCard精确UID并用真实profile文件锁制造写失败；验证State/slot/seed/layer/node不变、Map确实替换、卡牌/RNG/磁盘不变，CloseBag同帧使旧页失效且栈空/idle并有可前往地点，再调用旧pick/confirm确认不献祭、不重新开页、不写磁盘。新增本段4条直接Check、三次Submit的6条Check及一次完整Fixture；按Fixture两张补给静态计为增加15条成功断言。仍待Root统一执行。

## 检查源审查与边界

已纠正：原offer-8的任意pouchOf且stored=false违反SaveSystem.RunValidation:19；现在用正式PouchId、stored=true，每次Fixture另用独立SaveSystem.ReadSlot验证9张库存可读。覆盖夹具改为正式SettingsScreen，移除Editor自定义Panel。返回时已在任何yield之前验证prune/旧Confirm；后续滚动检查直接保存仍存活Button引用，避免遍历已Destroy的offer-0旧数组读取name。

其余检查覆盖真实CardFace费用/描述、三个不同UID和上限、撤选、Face/Scroll引用与偏移、原入口返回、替换State/层/节点拒绝、本页I/O失败/重试、紧急成功路由与旧事件防重。夹具直接定位全层真实altar/emergency节点，库存是受控同名变体；Submit使用实际ISubmitHandler，过期路径显式调用保存的UnityEvent。新增Bag失败调用公开生产背包命令，未声称物理点击丢弃确认或自然旅程。截图、实际布局观感、自然帧耗时、所有CardDef组合及跨进程恢复均不由此静态审查证明。
