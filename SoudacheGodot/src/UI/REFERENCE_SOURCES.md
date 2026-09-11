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
- 本工程五名核心角色显示名以 data/characters.json 为唯一来源（2026-09-12 批次 6b 起 UI 全部读数据，不在代码写死人名）。

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

## wave3 批次 6c 战斗表现组件 ↔ 参数来源对照（2026-09-12）

> 真源=网页版 `搜打撤/game/src/battle.view.js`（渲染/指向/飞牌）、`battle.hand.js`（扇形/拖拽）、
> `battle.core.js`（takeCardAnims/takeFloats 动画事件产出）、`pixi-effects.js`（burstAtElement 粒子）、
> `css/battle.css`（战斗关键帧）与 `_planning/sts2-reference.md`（STS2 参数库）；实现全部 Godot 重写。

| 组件/逻辑（6c） | 参数来源（文件:选择器/函数） | 关键参数 |
|---|---|---|
| 拖拽出牌状态机（BattleScreen.OnDragBegin/UpdateDrag/OnDragEnd） | sts2-reference §1 NMouseCardPlay/NCardPlay.CenterCard + battle.view.js startAim(6px 阈值)/aimHoverAt | 出牌区=屏高 75% 以上；动态阈值：起点在线下→起点-100px、线上→min(75%线, 起点-50px)；举卡锚位=(W/2, H-手牌区高·0.375)+0.75 缩放；取消区=95% 以下且须先离开过一次；拖拽不旋转（Rotation 速率 delta*10 归零） |
| `AimArrowLayer` 19 节贝塞尔目标箭头 | sts2-reference §1 NTargetingArrow + battle.view.js aimArrowUpdate/AIM_COLOR | 19 节、节点 scale 0.28→0.42；控制点 cx=from.x-(head.x-from.x)·0.25、cy=from.y>半高? head.y+(head.y-from.y)·0.5 : head.y·0.75+from.y·0.25；敌 #e0523c / 友 #4ecf8e / 空地金 #d9c07a；z=60 |
| `HitBurst` 三层打击粒子 | pixi-effects.js burstAtElement（tint/重力/count）+ sts2-reference §2 NHitSparkVfx（速度分层） | 主火花 1500-2500 速度/spread 180°/无重力/0.3-0.5s/amount 24；碎屑 400-600 与 200-800（一层反重力 -100 漂浮，网页 gravity 300 沉坠）；one-shot explosiveness=1；tint 命中 #ffb34d / 我方 #ff6659 / 治疗 #61d69b（amount 10）；alpha 0.95→0 |
| `FloatingText`（数值接入 BattleScreen diff） | battle.view.js spawnFloats（'-N'/'+治疗'/'免伤' 文本口径）+ sts2-reference §2（运动参数） | 伤害 -N/治疗 +N/格挡 盾+N；喷点=单位中心偏上（figure rect 0.42 高） |
| `HitShake` 接受击目标 | battle.css stsShake/stsSelfHit + sts2-reference §2 | 抖受击者（敌人横抖、我方受击叠加全屏红闪） |
| `HurtFlash` 全屏红闪 | battle.css `.sts-hurtflash`+stsHurtFlash 关键帧 | 径向暗角 transparent 42%→rgba(168,26,26,.5) 边缘、600ms ease-out、连续受击不叠层、z=70 |
| `EnergyOrb` 能量球 | battle.css `.sts-energy`（88px 圆/白 35% 边/暗金底）+ sts2-reference §3 NEnergyCounter + battle.view.js 能量脉冲 | 差速旋转每层 delta·30·(层号+1)°/s、能量 0 降速 5·(层号+1)；增减脉冲 brightness 1→1.9(饱和 1.3)→1 共 380ms；能量 0 红字 outline #501717 |
| `IntentFloat` 敌人意图浮动 | sts2-reference §3 NIntent | Y 偏移=-(sin(t·π+phase)·10+8)，振幅 10px/基线 8px/周期 2s/随机相位 |
| 手牌敌方回合下沉/恢复（BattleScreen.BeginEnemyPhasePresentation） | battle.css `[data-phase="enemy"] .sts-hand` + battle.view.js animateBattleTransition + sts2-reference §1 NPlayerHand | 下沉 100px+变灰 0.2s CubicOut；回合一恢复 0.38s cubic-bezier(.2,.8,.3,1) |
| 结束回合按钮隐藏/出现+呼吸光 | sts2-reference §5 NEndTurnButton | 隐藏 +250px 下滑 0.5s ExpoOut；出现 0.5s BackOut；呼吸光 glow alpha 循环 0.75/0.8s（BreathingFx.StartGlow） |
| 洗牌飞卡+牌库旋光（BattleScreen.ShuffleFly） | battle.css pileShuffleKf/pile-fly 关键帧 + battle.view.js shuffles 飞行关键帧 | 1.2s 三段：rotate -14°→160°→346°、中途上抬 -70px、alpha .25→1→.05、scale 1→0.82→0.35；到点牌库 bump |
| 飞牌（BattleScreen.LaunchCardGhost→CardFlyVfx） | battle.view.js exitSinkFor（去向：指向→目标立绘/常规→弃牌堆/消耗→消耗堆）+ sts2-reference §1 NCardFlyVfx（运动） | 出手/弃牌→弃牌堆按钮、消耗→消耗堆按钮、指向打出→目标立绘中心；二次贝塞尔+变加速+切线旋转+前 1/3 白→黑（组件 6a 已备） |
| 牌堆 bump（BattleScreen.PilePulse） | sts2-reference §5 NCombatCardPile bump 模式 | 0.05s 弹起 1.15×→0.5s ExpoOut 回落 + 亮度闪 |
| 击杀灰化塌缩（UpdateEnemyVisuals Defeated 分支） | battle.css fx-die 关键帧 | 1s 灰化+轻旋 6°，意图隐藏 |
| `PlayableGlow` 可打出高亮 | sts2-reference §5 稀有度视觉③（可打高亮 shader width 参数体系） | 显示 width→0.075/0.5s CubicOut；点击闪光 0.1s→0.15 再 0.35s CubicOut 回 0.075；可打色 (0,0.957,0.988,0.98)；不可打卡=battle.css `.off` 压暗+下沉 12px+缩 0.97 |
| 音频接线（ApplySnapshot SfxRequests 消费 + SetDucked） | sound.js 逐键清单（audio-inventory §3）+ setDucked(0.45) | BattleUiSnapshot.SfxRequests 逐键 GameAudio.PlaySfx；进战斗 SetDucked(true)、离场 false；BGM 切曲由 AppMain.SetContext 既有链路 |
