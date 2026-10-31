# 基地、菜单与存档源码对照（2026-10-31）

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

本片完成确证差异修复与冗余收拢；主会话已集中测试早期批次。末轮按当前仓库入口追加移除多余出售、修复未收录职业卡保护绕过，待主会话集中复验。此报告作者没有自行执行测试、编译或Unity，旧验收仅作定位。

## 已修复的当前差异

| 当前 Vite 来源 | Unity 原差异与触发条件 | 本次修改 |
| --- | --- | --- |
| `game/src/hub/base.js` 的 `seedStarterStash`（约360行） | 新档随机五张混入装备/道具/资源，读取静态表而遗漏当前自定义覆盖；随机数消耗默认 gameplay 流 | 改为 `CardLibrary.All()`、仅武术/法术、`card/reward` 流，克隆卡牌快照，保留原抽取次数、拒绝/回退和目录顺序 |
| `game/src/hub/stash-sale-price.js`、`hub.trade-shop-v5.js` 的 `sellableStack` | 交易台预览/成交误用局内收购价，并把没有“可出售”字样的普通招式禁售 | 独立 `BaseData.StashSalePrice` 提供古朴2/稀有3/史诗4/传说5口径，仅交易台接入；售卖资格沿交易所排除材料/蛋/补给包及保护，局内价格/资格保留 |
| `game/src/hub/game.hub.pages.js:49,105–141` 的活跃仓库特写footer | Unity保留仓库直接出售/整堆出售，是源端已统一交交易所负责的多余入口；初审误把交易所可售契约套到仓库 | 已移除仓库出售按钮与专用Sell方法，仓库只检视/使用/孵化/拆包/转化/保护；Standalone改验仓库无出售，再在交易所分别出售同名variant与基版 |
| `game/src/hub/game.hub.pages.js:125,225–231` 的保护动作 | Unity“收录并保护”让未收录职业/能力卡绕过消费转化，且材料/蛋/包也出现源端没有的保护 | 未收录职业/能力卡仅可消费转化，已收录才显示保护；材料/蛋/包不显示保护。普通卡保护不耗库存、不加经验，取消保护保留永久图鉴；领域入口补同一未收录拒绝守卫 |
| `base.js` 的 `sellStashCards(name,n,stackKey)`、`collection.commands.js` 的 `convert`、`base-departure.commands.js` 的 `departureStackKey` | 同 id/同名不同 variant 共存时，旧仓库弹窗按 id/name 查询、交易台用 id::name，导致选中和消费无法区分 | 复用 `GameRuntime.DepartureStackKey` 与唯一堆查找，特写/材料/出售/转换必传稳定标识；重复稳定标识拒绝消费；没有保留无现行调用的按名回退 |
| `hub/collection-conversion.js` | 活跃仓库转换面板显示理论每张XP，临近满级时忽略实际XP与末张溢出；UI与提交各自计算上限 | 增加 `PreviewCollectionConversion`，活跃仓库和提交复用；显示实际XP、溢出、前后等级，钳制过期数量，满级首次收录仅1张 |
| `hub/hub.warehouse.js` 约227行、`base.js` 的 `restore` | 复原按钮把仓库里尚未使用的钥匙卡也作为可用钥匙，实际命令只扣 `data.keys` | 复原展示及按钮可用性改为已入账 `Base.keys` |
| `base.js` 的 `keyCount` 约754行 | 基地HUD按旧卡名/“一串”计数，多把钥匙和改名材料数量错误 | 复用现行 `MaterialInfo` 的 `kind/amount` 乘库存张数，与已入账钥匙相加；不新增文字猜测或旧档兼容层 |
| `base.js` 的 `appendCards`、`stored-card-identity.js` | 成就/里程碑/购入奖励的 `AppendRewardCards` 只按 id 合堆，会混入旧 variant，且新堆直接引用目录对象 | 奖励按 id/variant 合堆并克隆；与普通入库复用 `SameStoredCard`，移除入库每次查找构造临时对象及重复局部比较 |

## 精简与明确性能问题

- `MetaProgress.ClsData` 每次读取等级或经验都重建所有人物进度对象和三份字典。现普通读取直接命中人物进度，只有缺少条目时才读取旧职业回填，保留已有对象身份。旧职业整合代码重复、无额外活跃职责的分支已收拢；多级经验增长只准备一次基地写入，事件仍由外层原子事务缓发。
- `BaseData.ParseRaw` 已执行 Adopt，Use/Peek 原先再次完整 Adopt。现只加载一次，新空档仍正常初始化完整人物进度。
- 奖励列表/里程碑页原先在每条记录、多处标题与进度条反复构造收藏池并扫描全目录。现每次页面构造取得一份 pool/total/progress，跨页面重建仍读取最新卡库与收藏。
- 庭院每帧重复拼接发现数/吃食数字符串，现仅数值变化时生成文字；动画和模拟节奏保持。
- `SaveSystem.Global.GetString` 原先读取标量也 DeepClone JValue，现返回不可变字符串，只读 GetJson 仍深复制隔离。新增 `GlobalStore.Revision` 供公共设置缓存使用：全局写入/删除、保存失败回滚、取消事务、失败提交、单档导入都会推进；不改变磁盘格式或原子写入行为。

## 已写、尚未运行的定向验证

在 `SoudacheUnity` 目录，等待主会话统一测试阶段执行：

```powershell
node _planning/parity-1031/hub-source-vectors.mjs
dotnet run --project _planning/parity-1031/HubParityChecks.csproj
```

向量脚本直接导入当前 Vite 的转换/售价/随机/资格函数，提取当前 `base.js` 原始 `seedStarterStash` 函数体执行；72个转换条件、4档售价、8个种子比较卡序与下一次 reward/gameplay 随机值。C#检查链接生产 Core/Run，补稳定variant出售、奖励合堆/快照隔离、真实文件写失败回滚、设置修订号取消失效、GetJson深复制隔离。该路径使用 Unity 资源/音频 stub，不宣称原生UI、真实键鼠或画面验收。

原生集中回归需覆盖：新档仓库仅五张招式；仓库特写没有出售，普通卡保护不耗库存/不加XP且解除后永久图鉴保留；未收录职业/能力卡无保护入口；交易台普通卡可售，分别出售同名variant/基版不串堆；转换末张溢出和满级首次收录；待复原区只有未使用钥匙卡时禁用；收藏里程碑列表/切换人物；庭院发现/投喂计数；设置写入后立即生效、失败回滚与菜单往返。

## 保留与边界

菜单输入重绑定已有冲突确认/捕获取消与页面归属检查，单档归档已有校验/目标确认/陈旧文件拒绝，本片没有据旧版计划另建系统。运行中的新 Unity 档可靠保存和恢复仍保留；Web旧档、Agent、第二地图、关闭制作坊按迁移范围排除。

老板追加清理历史冗余后，已移除零生产调用的旧 `CollectToggle`（删除收藏记录语义）、`TakeStashCards`、`SellRaw`、`TakeReserveCoins`、旧Web基地搬运、旧安全格升级别名，及未使用的成就构造器/共享`_seen`字段。`SaveSystem`空迁移壳和无调用透传也已移除，GameRuntime空壳调用由局内属地同步清理。`MenuShared.MakeBtnRow`没有调用已删；`MakeOverlayCard`仍被战斗设置/日志/道具与教学消费，保留。

移除六个无生产入口的旧类型：`StashItemModal`、`RawItemModal`、`CollectionConversionScreen`、`CharacterAppearanceScreen`、`CardBackPickerScreen`、`StoryArchiveScreen`。当前职责已在 `HubInventoryCardScreen` 与 `HubScreen`现行人物/卡背/见闻页实现。源码和场景/预制体/资产文本均无外部名称引用，四份独立`.meta` GUID也无挂载；文件与`.meta`原位保留，没有删除文件。HubScreen/HubModernPages已是当前实现，没有假定其活跃内容为旧骨架清除。

历史检查器若需要再跑，三处入口需改传稳定key：`_planning/migration-1029/fresh-scope-audit/Program.cs:43`、`save/HubChecks.cs:26`、`run-finish/Program.cs:54,56`。本轮`HubParityChecks`已使用必传key，不为旧测试另留生产wrapper。反射检查未发现使用上述退役类型/接口的生产字符串。

本片未做覆盖穷举或全页面视觉一致声明；待集中验证失败项如实保留。没有提交、推送、发布、删除文件或触碰用户档案。

## 末轮现行入口与声音补修（2026-11-01，待集中验证）

- `game.hub.pages.js:61–76` 的 `currentDetail` 同时检查来源与当前特写身份。Unity详情现要求对象存活、启用、栈顶归属和原Base/slot一致；所有业务与数量/转换模式入口先通过统一守卫。Standalone保存旧保护/转换事件，在关闭同帧和新详情打开后重放，要求Base/State/Rng/当前面板全部不变；构造回调记录与射线命中的玩家按钮路径分别登记。
- `player-3` 的保护已成功，但同一Guard立即点重建后的取消保护只命中mask；`player-4`进一步确认截图协程在EndOfFrame完成后当帧重建，单次yield null只到下一Update，仍早于新Canvas首次绘制。QA现使用局部SettleControls等待下一Update、ForceUpdateCanvases、真实EndOfFrame与再下一Update，并记录起止帧；射线检查、所有副作用断言、关闭同帧旧事件检查保留。此处只修QA时序，未改生产布局。
- `hub.trade-shop-v5.js:195–202` 只对整堆、单价至少5币或只剩一张要求确认。Unity已移除低价多堆单张出售的额外确认；整堆与高价/末张仍走原确认。Standalone两次2币单卖立即分别扣variant/基版并各仅增加一次声音序列；随后剩一张只武装，库存/币/声音序列不变，切页不成交。
- 当前详情保护、转换、材料、孵化、拆包及正常复原成功，交易购入/出售成功都按活跃源调用补一次`ding`；失败、过期回调、确认武装及`sha`初始攻击直接处理不响。音频正式子页边界、倍率消费和尚未移植的总线效果见[音频补充记录](audio-followup.md)。

上述新增生产与QA尚未由本片运行；由主会话冻结后集中执行，不沿用旧播放器通过结论。
