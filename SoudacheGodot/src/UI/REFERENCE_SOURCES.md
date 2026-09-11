# 表现层参考来源

本工程只参考 `.tmp/sts2-reverse` 中与卡牌栏视觉布局直接相关的结构；没有复制其资源、文本、规则、数值或 Core 类型。

| 参考文件 | 用途 | 本工程处理 |
| --- | --- | --- |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Helpers/HandPosHelper.cs` | 1–10 张手牌的弧形位置、边缘下沉、悬停空间 | 经用户授权，将位置表直接适配为 `ReferenceHandGeometry.cs`，并在 `CardHandLayout.cs` 中做响应式缩放；不带入玩法代码 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Helpers/HandLayoutHelper.cs` | 观察手牌顺序与插入位置应分离于渲染 | 当前只保留布局职责；卡牌顺序留给未来 Core 快照 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Nodes.Combat/NCombatCardPile.cs` | 观察牌堆计数、点击打开、悬停反馈与入场/离场职责 | `BattleScreen.cs` 仅复用交互结构，不依赖其 `CardPile`、提示系统或战斗管理器 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Nodes.Screens/NCardPileScreen.cs` | 观察牌堆查看层的独立屏幕边界 | 牌堆查看由本地 Core 信号承接，后续可替换为独立 PackedScene |

## 明确未复用内容

- 除上表明确记录的手牌位置表外，未引入 `MegaCrit.*` 命名空间、反编译程序集、原作场景、卡牌名称、敌人文本、战斗规则或数值。
- 未复制 `.tmp/sts2-reverse` 的二进制、Godot 资源包、贴图、字体、音频或场景资源。
- 本工程五名核心角色概念保持为：霜翎、白契、栗团、玄砾、灯葵。

## wave1 批次 6a 组件 ↔ sts2-reference.md 条目对照（2026-09-12）

> 依据 HANDOFF §0.5：只参照**数值/曲线/时序参数事实**（见 `_planning/sts2-reference.md`），实现全部用
> Godot Tween/_Process 重写；不含 MegaCrit 代码文本，不使用其美术/音频资源。

| 组件（src/UI/Fx/） | sts2-reference.md 条目 | 参照源文件（仅参数事实） | 关键数值 |
|---|---|---|---|
| `Sts2Fx` 平滑/推挤/贝塞尔/缓动 | §1 手牌交互 + 通用工具 Ease.cs/MathHelper.cs | NHandCardHolder.cs、NPlayerHand.cs、Ease.cs、MathHelper.cs | delta*7/8/10；吸附 1px/0.002/0.1°；push=Lerp(100,0,min(1,\|Δi\|/4))；Bezier=(1-t)²v0+2(1-t)t·c0+t²v1；Back 过冲 1.70158 |
| `SmoothFollower` 三通道跟随 | §1 指数平滑三通道 | NHandCardHolder.cs | 位置 delta*7、缩放 delta*8、旋转 delta*10；hover 退出 0.5s ExpoOut 回 0.8 |
| `CardFlyVfx`/`CardFly` 贝塞尔飞卡 | §1 飞牌（NCardFlyVfx） | Vfx/NCardFlyVfx.cs | speed rand(1.1,1.25)、accel rand(2.0,2.5)；控制点中点 Y±500（下半 +rand(100,400)）；切线 LerpAngle delta*12；前 1/3 scale 1→0.1 白→黑，后段→-0.15；到点瞬间回调 |
| `FloatingText.Spawn(Damage)` | §2 伤害飘字（NDamageNumVfx） | Vfx/NDamageNumVfx.cs | 喷点+(0,-100)+rand(±10,-5..5)；初速 (rand(-100,100), rand(-800,-700))；重力 2000；scale 2.5→1.0/1.2s QuadOut；颜色→奶油 #FFF6E2 0.5s CubicOut；alpha→0 2.0s QuadIn；旋转 ±5° |
| `FloatingText.Spawn(Heal)` | §2 治疗数字 | NDamageNumVfx 同族 | scale 放大态→1.0 0.5s QuadOut；alpha 延迟 1.0s 后 0.3s 淡出 |
| `FloatingText.Spawn(Block)` | §2 格挡数字 | NDamageNumVfx 同族 | 上浮 -250px/2.0s QuadOut；scale 1→0.6/2s；白→#21C0FF |
| `HitShake`/`HitShakeDriver` | §2 受击抖动（NCreature.AnimShake） | NCreature.cs | offset.x=10·sin(4t)·sin(0.5t)，t:0→2π/1.0s，CubicOut 包络 |
| `BreathingFx.StartScale`/`BreathingScaleDriver` | §4 可走节点呼吸（NNormalMapPoint） | Screens.Map/NNormalMapPoint.cs | scale=1.2+0.25·sin(4t)，随机初相位 |
| `BreathingFx.StartGlow`/`BreathingGlowDriver` | §5 结束回合按钮呼吸光（NEndTurnButton） | NEndTurnButton.cs | glow alpha 循环至 0.75、0.8s 循环（本件简化为正弦蓄放） |
| `PanelPopIn` | §5 面板弹入通用 | NMapScreen 入场等 | 面板 0.2s alpha 渐入+CubicOut 位移；子元素 0.1s 延迟阶梯 |
| `ButtonFeedback` | §5 牌堆按钮/结束回合按钮 | NCombatCardPile.cs、NEndTurnButton.cs | hover 0.05s 弹起（Pile 1.25x）、回落 0.5s ExpoOut、按压 0.25s CubicOut+变暗、Sink 下沉 8px |
| `CardHandLayout`/`ReferenceHandGeometry`（手牌改造） | §1 手牌交互 + wave1 任务书 scale 分段 | NCardHolder.cs（smallScale=0.8） | hover 瞬时 1.0/ZIndex 置顶；分段 ≤7→×1.0、8→×0.95、每张-0.05（0.85 封底，任务书口径） |

未在本波实现（属批次 6b/6c 范围）：拖拽状态机、目标箭头、打击粒子、能量球/意图、地图圆点连线、Tooltip 固定宽、气泡、稀有度 shader、洗牌飞卡。
