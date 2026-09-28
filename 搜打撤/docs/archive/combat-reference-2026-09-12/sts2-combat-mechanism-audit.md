# 战斗界面机制对照审计

> 目的：阅读 `D:\素材\代号柒\.tmp\sts2-reverse` 中的反编译 C# 与 Godot 场景，提炼战斗 UI、卡牌交互和动画机制，转译为搜打撤自己的实现。
>
> 边界：只借鉴行为、职责划分、状态流和动画节奏；不复制代码、素材、类实现或资源路径。

## 一、已确认的总体结构

参考代码把战斗拆成四层：

```text
CombatState / PlayerCombatState
        ↓ 状态变化事件
GameAction / PlayCardAction
        ↓ ActionQueueSet / ActionExecutor
NCombatUi / NPlayerHand / NCardPlayQueue
        ↓ Tween、逐帧插值、VFX
屏幕上的卡牌、单位、牌堆和反馈
```

关键证据：

- `MegaCrit.Sts2.Core.Combat\CombatState.cs` 保存 allies、enemies、round、current side，并以事件通知 creatures 变化。
- `MegaCrit.Sts2.Core.Combat\CombatStateTracker.cs` 订阅卡牌、牌堆、Creature、PlayerCombatState 等变化，并延迟合并通知，避免每个底层字段变化都立即重绘。
- `MegaCrit.Sts2.Core.GameActions\PlayCardAction.cs` 负责等待目标、验证卡牌与目标、扣除资源、调用卡牌效果；它不是 UI 点击处理器。
- `MegaCrit.Sts2.Core.GameActions\ActionExecutor.cs` 串行取出可执行动作，并等待动作完成后继续处理下一项。

## 二、卡牌交互机制

### 1. 点击和拖拽是两条输入入口，共用一个出牌结果

`NMouseCardPlay.cs` 同时支持：

- 点击手牌：无目标卡直接提交；单目标卡进入目标选择；可自动选目标的卡使用首个合法目标。
- 拖拽手牌：卡牌向鼠标位置插值移动，进入出牌区域后提交，进入取消区域后取消。
- 键盘/手柄取消：释放卡牌、取消快捷键、鼠标/手柄模式切换都会取消当前交互。

可转译为我们的统一 API：

```js
beginCardInteraction(cardId, mode) // click | drag | controller
resolveCardInteraction(targetId)
cancelCardInteraction(reason)
```

UI 只负责产生这三个意图，真正的费用、目标和效果验证放到 battle core。

### 2. 目标选择是独立模式，不是卡牌的临时布尔变量

`NMouseCardPlay.cs` 有单目标、多目标、鼠标点击目标等不同路径；目标管理通过 `NTargetManager` 的 hovered/unhovered 信号更新反馈。`PlayCardAction.cs` 最终只接收 `TargetId`，再在执行前二次验证目标。

搜打撤应改为单一状态：

```js
interaction: {
  mode: 'idle' | 'targeting' | 'dragging' | 'resolving',
  cardUid: null,
  targetIds: [],
  hoveredTargetId: null,
  invalidReason: ''
}
```

必须保证：取消目标选择不会扣费、不会移动卡牌、不会产生半完成的 pending 状态。

## 三、手牌布局和动画机制

### 1. 手牌 holder 维护“目标值”，动画可取消

`NHandCardHolder.cs` 暴露 `SetTargetPosition`、`SetTargetAngle`、`SetTargetScale`，内部使用独立的取消令牌驱动位置、角度和缩放插值。重新布局时，旧动画被取消，不会出现多个动画同时争夺同一张牌。

参考参数：

- 位置插值速度约为 `7`
- 角度插值速度约为 `10`
- 缩放插值速度约为 `8`
- 位置误差小于 `1` 时吸附
- 角度误差小于 `0.1` 时吸附
- 缩放误差小于 `0.002` 时吸附

我们不照搬数值，但应保留“目标值 + 可取消动画 + 最终吸附”的结构。

### 2. 悬停不是重建整套手牌

`NHandCardHolder.cs` 在 focus/hover 时提升 Z 顺序并创建 hover tips；`NSelectedHandCardHolder.cs` 将选中的卡牌复制到独立容器，并用约 `0.15s` 的 cubic-out 动画移动到预览位置。

搜打撤应把悬停和选中改为局部更新：

- 只改变当前卡的 `is-hovered`、`is-selected`、`z-index`、预览层。
- 其余手牌只接受必要的位置目标更新。
- 不再通过整段 battle overlay 重建来实现 hover。

## 四、出牌队列和动画时序

### 1. 出牌动作与视觉卡牌分离

`NCardPlayQueue.cs` 内部为每张待执行卡牌保存：

- 视觉卡牌节点
- 对应 GameAction
- 当前移动 Tween

动作进入队列时，卡牌移动到队列位置；队列顺序改变时，所有卡牌重新计算目标位置；动作取消时，卡牌淡出并回到手牌或被释放；动作真正执行前，还会更新卡牌模型和预览目标。

这说明我们不能只在 `play()` 里立即改 `hand` 和 `played`。应增加自己的 `battle.actionQueue` 和 `battle.animationQueue`，让逻辑完成与画面完成各有明确边界。

### 2. 统一出牌结算顺序

搜打撤目标顺序：

```text
输入确认
→ 冻结同一张卡的重复输入
→ 验证阶段、费用、目标
→ 进入 actionQueue
→ 扣费并从 hand 移出
→ 执行效果
→ 播放卡牌/VFX/飘字
→ 根据 exhaust/discard 进入目标牌堆
→ 发布一次战斗状态变更
→ 解锁下一动作
```

所有阶段必须可测试；动画失败或被跳过时，不能让逻辑卡在 resolving。

## 五、牌堆 UI 机制

`NCombatCardPile.cs` 是抽牌堆、弃牌堆、消耗堆的共同基类：

- 牌堆是可交互按钮，而不是单纯数量文本。
- hover、按下、释放分别有反馈。
- 数量变化有 bump 动画。
- 牌堆进出场有独立 show/hide 位置和可取消 Tween。
- 点击牌堆时，如果当前正在目标选择，会先取消目标选择。

搜打撤需要将 draw/discard/consumed 的点击、hover、数量变化统一到 `battle.piles` 组件，禁止各牌堆各写一套交互。

## 六、对当前项目的直接映射

当前 `game/src/battle.core.js` 把牌堆、目标、注能、发现、墓地和 busy 等状态集中在多个变量中；`battle.view.js` 同时负责手牌 HTML、目标条、拖拽箭头和整屏 overlay 更新；`battle.rules.js` 还通过描述文本推断目标类型。第一阶段不改卡牌数值，先做结构收敛。

### P0：战斗状态和动作队列

新增：

- `game/src/battle.state.js`：唯一战斗状态与 phase。
- `game/src/battle.actions.js`：验证、入队、执行、取消。
- `game/src/battle.animation.js`：可取消的动画 Promise/队列。

保留 `battle.core.js` 作为兼容门面，逐步把旧变量迁移进去。

### P1：统一卡牌交互

- 删除 `pendingTarget` 的多重语义。
- click/drag/controller 都调用统一 interaction API。
- 合法目标统一由卡牌数据的 targeting 字段提供。
- 目标选择取消必须是幂等的。
- 出牌按钮、手牌点击、拖拽释放共享同一条 action pipeline。

### P1：拆分战斗视图

建议拆为：

- `battle.shell.js`：战斗舞台和稳定层级。
- `battle.hand.js`：手牌布局、hover、选中、拖拽。
- `battle.targets.js`：目标高亮、预览、取消。
- `battle.units.js`：玩家、敌人、意图、状态图标。
- `battle.piles.js`：抽牌堆、弃牌堆、消耗堆。
- `battle.feedback.js`：飘字、受击、卡牌飞行、回合提示。

视图更新改为订阅状态快照的局部变化，不再每次 hover 都重建整个 battle overlay。

### P2：动画表现

先实现结构动画，再补美术 VFX：

1. 手牌扇形布局和悬停抬升。
2. 卡牌从手牌飞向出牌队列/目标。
3. 队列中的卡牌依次结算。
4. 伤害、格挡、治疗、死亡反馈。
5. 牌堆 bump、抽牌、弃牌和消耗动画。
6. 回合开始、敌方意图变化、回合结束过渡。

## 七、验收标准

- 普通战斗和 BOSS 战使用同一套 click/drag/target/action/animation 管线。
- 一张卡不能同时存在于手牌、弃牌堆、消耗堆和出牌队列多个区域。
- 连续快速点击不会重复扣费或重复结算。
- 目标选择可点击、可拖拽、可取消，非法目标有明确反馈。
- 动画中途切换回合、死亡或关闭界面不会留下卡牌幽灵节点或锁死 busy 状态。
- 16:9、宽屏和窄窗口下，手牌、牌堆、意图和结束回合按钮仍在稳定区域内。
- 现有 `npm test`、`node game/selftest.js`、`npm run build` 和浏览器战斗流程全部通过。

## 八、当前执行状态

- 已完成：反编译目录盘点与战斗关键模块初读。
- 已完成：UI、目标选择、手牌动画、出牌队列、牌堆动画机制映射。
- 本轮未修改游戏代码，仅新增本审计文档。
- 下一步：从 P0 开始实现状态/动作队列，并为现有核心逻辑补契约测试；完成后再迁移视图。
