# 战斗源码差异修复（2026-10-31）

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

状态：本线最新生产修改及专有回归入口已完成，等待主会话集中类型检查、领域断言、Unity 原生复验；本线没有自行运行测试或编译。

最终活跃入口更正：`battle.view.js:751` 的 `renderInfusionSelection` 实际没有传 `materialSelection`，`:753` 独立 `renderHandSelection` 才处理普通效果/payment。因此已删除上一版误接的 `MaterialProjection` 和普通效果共用大工作区：普通选手牌保持逐UID原位、9张/页、选中抬升42px金边，居中“取消/状态/确定”；真实 `snapshot.infusing` 才进入大源卡与独立已选区。先前可选参数本身不证明生产调用可达。上一轮通过证据对应旧工作区，不能替代这次新入口复验。

末轮 Standalone `player-2` 在进入普通复制选择时，`SyncHandSelection` 读取 `currentSelectedGameObject?.name` 触发 `UnityEngine.Object.get_name` 空引用：C# 空条件不识别 Unity 已销毁对象的托管残留引用。已改为先用 Unity `!= null` 判断 EventSystem 和焦点对象存活，再读取名称；恢复焦点时也先检查 EventSystem。同期战斗目标中 `_sceneForeground?.transform` 同类用法改显式存活判断。没有回退到旧控件。原生 probe 新增已销毁焦点残留、有效取消按钮重建后聚焦当前实例、旧取消回调不能取消新选择断言；旧布局和选择断言全部保留。等待 root 统一复跑，未自行测试。

集中验证反馈：root 已运行当前 Core 44 项全部通过、生产类型检查0错误/8既有警告。`native-battle-1` 在首次装备选材发现旧 UIKit.Scroll 固定 VerticalLayoutGroup，而工作区同帧 Destroy 再 Add HorizontalLayoutGroup，Unity 延迟销毁导致组件冲突和空引用。经 root 授权，本线仅给公共 Scroll 方法增加可选 horizontal=false 参数，从创建时配置唯一布局和轴，战斗改用 horizontal:true；旧调用默认保持垂直。原 probe 未弱化，修正后等待 root 统一复跑。

`native-battle-2` 原生编译成功，随后同帧撤选用的 probe 固定 Transform.Find 命中待帧末销毁的旧空选区，导致传入空按钮。生产按钮绑定当前UID且不使用该查找。Probe 改从所有同名区中选择当前 active 区，保留同帧输入、撤选、确认禁用和手牌不变断言；新增同名区/按钮/祖先 CanvasGroup 诊断，不加等待或修改生产。待 root 再次集中复跑。

## 已查证并修复

| 当前可达差异 | 现行 Vite 依据 | Unity 修改 |
| --- | --- | --- |
| 深红丝袋、自然法杖、剑荡妖邪选手牌仍点击即执行；缺确认前撤选和可取消 | `battle.view.js:751-753`、`battle/view/battle.hand-material-selection.js:11`、`battle.hand-selection-view.js`；`battle/core/battle.selection-flow.domain.js:173`、`:191` | `BattleRuleInputs` 统一草稿；普通手牌逐UID原位保留，中央取消/状态/确定，按钮220×88，满额不把其他合法候选染灰。所有材料使用 token/id/剩余数/卡面指纹守卫。payment 原子提交且取消始终可见但禁用；其他效果按源顺序逐张提交，play 每次只确认一张，子选牌完成后续接。Core 填齐契约，取消只跳过当前可选效果；选牌目标采用共享 MatchesHandSelectKey。 |
| 普通手牌选择时拒绝分页；真实注能控件缺宽度/提示/页数及arena滤镜 | `battle.view.js` 的普通9张分页、`battle-hand-selection.css`；真实 `battle-infusion.css` | 普通选择可按9个UID翻页，不排除仍在手中的payment源UID。真实注能单独按204px候选分页（公式含22px gap），返回154/确认290右靠、已选金边↙和上一页/页数/下一页；同UID源卡保留以免阅读重置。真实注能接公共 CurrentArenaFilter 的7px局部合成和.72alpha，普通手选不开滤镜；退出先还原arena再卸帧。 |
| 新增取消暴露装备准备选牌时提前丢失本场次数 | 独审复核 `battle/bag/battle.equipment.domain.js:213` 的 handSelectionOnly/onHandSelectDone | 深红丝袋、自然法杖及同类纯选牌技能完成选择后才标记 oncePerBattle；取消、空池保留次数，重新打开可用，最终确认才消耗。Core 与原生入口均补断言；本项由独审指出后闭合。 |
| 后备能源按历史“被牺牲法术数”减费；忽略已施放法术且取回后不还原 | `battle/effects/battle.card-inspection.domain.js:122`，读取当前 getConsumedPile 并按 UID 去重 | `StructuredCost` 动态读取当前 `BattleConsumedPile` 中的法术。删除无其他消费者的 ruleConsumedSpells 字段和四处重复累计。 |
| 合法多 costModifiers 被全部相减，缺 movesPlayedDiscount；runtimeCost 绝对早返压过指定回合0费和宇宙形态 | `battle/effects/battle.card-cost.js:38`、`:53`；`battle.cost-modifiers.js` | 按源固定优先级判定而非按数组累加，补招式折扣；生成、交换、逐回合降费修改战斗实例 cost，与源相同。指定回合费用/形态仍按源优先级生效。保留 CardDef 的现存字段供公共消费者读取，本线不扩大删除范围。 |
| 每次不可打判定/每名敌人免伤都构造全量快照和 forecast；缺牌时又为兜底投影重建快照 | `BattleViewApi` 实际消费者只读 mode/turn/FindCard；源门面读取实例字段 | Core 暴露只读 Mode/Turn/GetInfusionNeed；门面直接调用现有 FindCard，不再为单字段/缺牌重算整场快照。删除已失效的 snapshot fallback 和未接线 TODO。 |
| 每帧无按键也构造存活敌人匿名对象和 LINQ 列表；每次高亮遍历整张卡组件 | `BattlePresentation.Update`、`HandPanel.SetTargeting` 活跃调用链 | Enter 确认时才遍历敌人，免临时列表；卡面重建时缓存 Outline。分组用字典，稳定槽匹配在搜索时跳过已占槽，与 `battle/core/battle.hand.js` 一致。 |
| 真正注能的数字键错误跟随可见堆代表，不能按原键撤回已选副本 | `battle.infusion-view.js` 的 onKey 使用完整 `infusionHandCards` 物理UID列表；同名隐藏副本仍保留键位 | 新纯 `BattleHandProjection` 按源分组/排序投影真实UID，不删除已选项；仅检测到数字按键才计算。UI仍同名视觉合叠；原键切回同一真实UID，不会改选后续代表。源身份排序也纠正为优先实际 starter-attack ID。Core与真正注能原生probe补同名/已选/原键撤回断言。 |
| 真正注能的可见候选仍沿入手原序，与已按类别排序的数字键不一致 | 独审复核 `infusionHandCards` 先 `orderHandGroups` 再展开实际UID | 可见候选合叠后按共用 Rank 稳定排序，保持同类先出现顺序；只改真实Infusing，不改普通原位选牌。原生夹具加入后入手的初始攻击与装备，断言初始攻击/招式的首屏图序与键序、末页装备及键序均一致，再保留原同名隐藏副本选取/撤回断言。等待主会话集中复跑。 |
| 击杀喝彩消耗 battle 流，能改变后续战斗随机结果 | `battle/core/battle.foe-lifecycle.domain.js:32` 明确读取 visual 流 | 两处旧 battle 调用改 visual，纯表现不推进玩法随机流。 |
| 活跃数字/emoji飘字及 Boss 竖纹为旧效果；当前源已换为十六格图集 | `battle/view/battle.vfx.js:228` 明确不创建浮字/贴纸；`battle.fx-art.js:7`、`:62`；`css/battle-fx-art.css` | 原 `BattleFx.cs` 内删除旧数字渲染及 Boss 竖纹动画，接现行 4×4 atlas。共享16 Sprite，临时效果上限36，减动效/低画质短生命周期，缺图仅明确警告，无旧图/数字回退。Root 导入原图无损转换 `Art/Current/BattleFxAtlas.png` 并维护收据。 |
| 战斗伤害、敌前摇及阶段大多静音 | `battle.vfx.js:187`、`:203`、`battle.attack-cues.js:24`；`battle.turn-feedback.js:61`；`battle.enemy-phase.domain.js:292`、`:376`、`:489`；`battle.lifecycle.domain.js:176`、`:306` | 现有单调 Sequence 队列消费已结算声音事实；敌前摇在减动效也响，2倍节奏使用源1.5倍率；受击hurt、材质/法术命中按源优先级，普通hit按伤害档倍率、护盾破碎、确证格挡、阶段与状态到期分别接线。入场/初始玩家回合每 token 一次，结果每 result 一次，保存重试不复播。support/death 动作本身没有臆造音效；结果音由宿主结算边界触发。Root 提供三参 PlaySfx 与音频策略。 |
| Boss 出场效果在编组弹层背后提前播放并设置已播放 | 源 battle.view 先返回编组页，实际战场阶段才触发登场效果 | `BattleScreen.BuildStage` 等 DeckSelection 结束再标记和播放现行 Boss 图集。 |

## 清理范围

删除的是旧代码文本及冗余状态，没有删除文件，没有修改 Vite、存档恢复、随机算法或用户存档。除上述项，还移除 SyncPrompt 中被选材工作区提前返回拦截的旧注能按钮/重复 prompt 分支、无调用的 OnCardAimCancel 与固定为0的 FanRotDeg。必要的写失败恢复沿用原有实现。

## 集中验证入口

1. `_planning/parity-1031/battle-check/BattleChecks.csproj`：直接包含当前生产 Core，覆盖共享选牌键、可取消/不可取消、stale ID、n张复制续接与源卡保全、动态消耗区折扣/去重/取回、费用优先级、注能豁免、visual 流不影响 battle 流、结算cue事实和序列唯一性。由 root 运行 `dotnet run --project ...`。
2. `Sdt.Editor.CurrentBattleMaterialValidation.Run`：沿现有后台 Unity 验收框架、隔离 profile，真实 BattleScreen + 构造 native pointer/submit；覆盖普通选牌原位选中/撤选/取消、同名同面两个UID分别选择/撤选、payment源UID保留可见、自然法杖确认、payment翻页/去重/一次提交/取消禁用、旧确认回调拒绝；另真正进入Infusing验证独立工作区、尺寸/金边/↙/页数、源卡实例保留。图集和声音键仍回归。使用 `SDT_UNITY_CHECK_OUTPUT` 写 result.json。
3. 原有 `CurrentBattlePileValidation` / `CurrentUnitFrameValidation` 与主会话选择的四层旅程，回归长期手牌、图形替换、ActorPresentation 播放与战后保存接线。

没有“全卡任意组合穷举”、物理键鼠、实际听音、独立播放器清晰度或多尺寸验收声明；新入口当前仍待执行。音效样本输出与资源导入由 root 专项覆盖。

## 继续审查边界

本线重查了实际内置卡的手牌选择、费用和视图门面、回合/命中/受击/敌前摇、消耗区与现代图形入口；没有重做全部291卡及其每个自定义 schema 组合的完整玩法审计。现行特殊项（门类、发现、注能、首脑等）的旧证据只作定位，不能把本轮覆盖扩称为穷举一致。更广的领域/视觉差异以主会话统一矩阵和独审为准。

## Standalone 已选注能卡遮挡修复（待集中验证）

独审 `player-3/player-infusion-picked.png` 确认已选材料只剩米金实心矩形与撤回箭头。根因是透明 White Image 的 `Outline.useGraphicAlpha=false` 复制整张矩形并赋不透明描边色，覆盖其前面的 CardFace。仅真正 Infusing 已选区改为空心边框，按现行 `game/css/battle-infusion.css:31` 的3px金边、3px间距绘制窄边；原卡面与↙交互保留，普通 RuleHandSelection 不变。

原生 `CurrentBattleMaterialValidation` 增加呈现性质检查：布局更新后读取装饰的实际 CanvasRenderer 三角网格，中心不应有非透明几何覆盖；原卡名、带资源的卡框仍启用，并沿已有撤回按钮断言验证交互。未运行测试或编译，由 root 集中原生与下一版 Standalone 实绘复核。

同范围补齐真正 Infusing 满额候选的 `.6` 透明度（`battle.infusion-view.js:128`、`battle-infusion.css:54`），悬停和重排保持该状态，撤回后恢复；不改变 Off 资格语义。普通 RuleHandSelection 满额仍保持合法未选卡明亮。原生断言覆盖满额、悬停、撤回恢复和普通手选不受影响。
