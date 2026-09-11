# STS2 可参照参数库（提取自 .tmp/sts2-reverse 逆向源码，2026-09-11）

> 合规边界：以下全部是**数值/曲线/时序等参数事实与手法描述**，落地时用 Godot Tween/GPUParticles2D/shader 重新实现；不搬 MegaCrit 代码文本，不用其贴图/音频/场景。涉及文件路径与数值已登记进 `src/UI/REFERENCE_SOURCES.md` 追溯。
> 基准坐标系：官方 1920×1080。路径前缀省略为 `…/ = .tmp/sts2-reverse/decompiled/`。

通用工具：
- `…/MegaCrit.Sts2.Core.Helpers/Ease.cs`：30 种缓动函数，可映射 Godot Tween.TransitionType/EaseType。Back 过冲系数 1.70158（InOut ×1.525）；Elastic 频率 20.420353 rad + 2^10 衰减；Bounce 分段点 0.3636/0.7272/0.9。
- `…/MathHelper.cs`：`BezierCurve(v0,v1,c0,t) = (1-t)²v0 + 2(1-t)t·c0 + t²v1`（二次贝塞尔，卡牌飞行与目标箭头共用）。

## 1. 手牌交互（最高优先级）

- **指数平滑三通道**（`…/NHandCardHolder.cs`，整个手牌"跟手又柔"的根源）：位置 `lerp` 权重 `delta*7`（吸附阈 1px）、缩放 `delta*8`（阈 0.002）、旋转 `delta*10`（阈 0.1°）。所有布局变化改 target 后靠它收敛，不用固定时长 tween。
- **hover 推挤**（`…/NPlayerHand.cs`）：hover 卡角度/缩放瞬时归零/到 1.0，Y=-(hitbox高)*0.5+2；两侧卡推开 `push = Lerp(100, 0, min(1, |hoverIdx-i|/4))` px，方向 = sign(hoverIdx-i)。
- hover 进入瞬时放大（无 tween），退出 0.5s ExpoOut 回 0.8（`NCardHolder.smallScale=0.8`）；hover 置 ZIndex=1。
- **拖拽**（`…/NMouseCardPlay.cs`）：每帧 SetTargetPosition(mouse) 仍走 delta*7（滞后跟随）；拖拽中不旋转、缩放瞬时 1.0；出牌区=屏高 75% 以上；动态阈值：起点在阈值下则阈值=起点-100px，上则=起点-50px；取消区=屏高 95% 以下且须先离开过一次。
- **举卡待选**（`NCardPlay.CenterCard()`）：无目标时飞到 (屏宽/2, 屏高-holder高*0.375)、缩放 0.75；确认打出落点=(屏宽/2, 屏高-holder高)。
- **飞牌**（`…/Vfx/NCardFlyVfx.cs`）：二次贝塞尔，控制点=起终点中点 Y 偏移 arcDir（目标在上半屏 -500，下半 +500+rand(100,400)）；变加速 `t += speed*dt; speed += accel*dt`，speed 初始 rand(1.1,1.25)、accel rand(2.0,2.5)（实际约 0.5-0.6s 到达）；旋转沿路径切线 `LerpAngle(rot, tangent, delta*12)`；前 1/3 路程 scale 1→0.1 且 modulate 白→黑，后 0.1→-0.15（负 scale 翻转视觉缩没）；25% 处尾迹淡出；终点=对应牌堆按钮中心（`PileTypeExtensions`：Hand=(w/2-cardW/2, h-cardH/2)，Play=容器中心-卡半尺寸-(0,100)）。
- 多卡连打排队第 n 张左移 300*n px（`NCardPlayQueue`）。
- **抽牌**：新卡直接生成在牌堆处再 RefreshLayout，靠 delta*7 平滑滑入，无专门 tween。
- **洗牌飞卡**（`NCardFlyShuffleVfx`）：同款贝塞尔，控制点偏移 rand(-300,400)，到点后 0.8s 淡出，到点瞬间才回调（时序同步点）。
- 手牌回合进出（`NPlayerHand`）：入场 0.8s ExpoOut 滑到 (0,0)；离场 0.8s BackIn 滑到 (0,500)；敌方回合禁用：0.2s CubicOut 下沉 100px+变灰同时进行。
- 选牌容器：>3 张 scale 0.8/上移 75px；>6 张 scale 0.55/上移 150px；0.5s QuadInOut。
- 卡状态提示 Flash：白闪 alpha→0.6 用 0.15s，再→0 用 0.3s；回手 scale→1 用 0.25s。

## 2. 战斗反馈

- **受击抖动**（`…/NCreature.AnimShake`，抖受击者非相机）：`offset.x = 10·sin(4t)·sin(0.5t)`，t: 0→2π 历时 1.0s，CubicOut 包络；有 hurt 动画时跳过。
- **伤害飘字**（`…/Vfx/NDamageNumVfx`）：生成位=喷点+(0,-100)+rand(±10,-5..5)；初速 (rand(-100,100), rand(-800,-700))，重力 (0,2000) 抛物线；Label 初始 scale rand(1.2,1.3)、旋转 ±5°；并行：颜色→奶油色 0.5s CubicOut、alpha→0 2.0s QuadIn、scale 2.5→1.0 1.2s QuadOut。
- 治疗数字：scale→1.0 0.5s QuadOut（从放大态），alpha 延迟 1.0s 后 0.3s 淡出。
- 格挡数字：上浮 -250px/2.0s QuadOut，scale 1→0.6/2s，白→#21C0FF。
- **打击粒子**（`NHitSparkVfx` + hit_spark_vfx.tscn）：一次打击叠 5 个 one-shot 粒子：主火花 initial_velocity 1500-2500、spread 180°、无重力、lifetime 0.3-0.5s、amount 2-24；碎屑层 400-600 与 200-800（一层带反重力 (0,-100) 漂浮）；lifetime_randomness 0.25-1.0。
- **目标箭头**（`NTargetingArrow`）：19 节 Sprite 贝塞尔；节点 scale 沿线 0.28→0.42；控制点 `cx = from.x-(head.x-from.x)*0.25`，`cy = from.y>540 ? head.y+(head.y-from.y)*0.5 : head.y*0.75+from.y*0.25`；箭头锚点偏移 (0,88) 随朝向旋转；悬停敌人时箭头头 0.95→1.05 用 1.0s ElasticOut；敌/友分色；手柄模式 lerp delta*14。
- 血条：掉血白条追真血条 `offset_right` 1.0s CubicOut，受伤时延迟 1.0s；格挡图标弹入 alpha 0.5s SineOut + 位置 0.5s BackOut（从 (0,20) 回落）。
- buff 图标：alpha→0.5 0.25s SineOut 后 1.0s 淡出、scale→0.8 1.25s ExpoOut；文本上浮 1.25s CubicOut；移除上浮 -160px 2.0s QuartOut。

## 3. 能量球与意图

- 能量球（`NEnergyCounter`）：待机每层 `RotationDegrees += delta*30*(层号+1)`（能量 0 时降速 5）——多层差速旋转；入场 (-480,128) 0.6s ExpoOut，出场 0.6s BackIn；增减时重启 front/back 两个粒子；能量 0：暗材质+DarkGray+红字 outline #501717。粒子：radial_velocity 300-1200、lifetime 0.3/0.4s。
- 意图（`NIntent`）：上下浮动 `Position = Up*(sin(now_s*π+phase)*10+8)`——振幅 10px、基线 +8px、周期 2s、随机相位；图标 15fps 逐帧；执行时 CpuParticles2D 爆发 amount=4。

## 4. 地图

- 整图 1050×2325，滚动 y∈[-600,1800]（`…/Screens.Map/NMapScreen`）；节点位置抖动 ±(21,25)；**连线=22px 间距圆点串**（map_dot 实例）：每点 ±3px 抖动、随机水平翻转、旋转=路径角+90°+高斯(0,0.1rad)；行进动画：逐点变已走色 #241F1A 并 scale 1.7→1.2 0.4s CubicOut；拖拽 lerp delta*15、边缘自动滚 delta*12；幕间整图 y→-600 ExpoInOut（快速 1.5s/正常 3.0s）；入场：背板 alpha→0.85 0.25s、元素 0.1/0.2s 延迟阶梯。
- 可走节点呼吸（`NNormalMapPoint`）：`scale = 1.2+0.25·sin(4t)`（随机初相位）；hover 0.05s 到 1.45x；移出 0.5s CubicOut；按下 0.3s 到 0.9x；选中：容器 scale→1 0.3s CubicOut + 图标 BackOut + 颜色 0.3s ExpoOut。
- BOSS 节点 hover 仅 1.05x；不可走显示红色。
- 玩家棋子（`NMapMarker`）：挂节点上方 (-宽/2,-72)；出现 scale (0,-1)→1 用 0.2s + 上跳 25px 0.2s SineIn + 回落 0.75s **ElasticOut**（最值得抄的落点弹跳）；消失 0.2s scale→0。

## 5. UI 通用

- **Tooltip**（`NHoverTipSet`）：无延迟无位移，hover 即建；固定宽 360px、条目间距 5px；每帧同步 owner 全局位置；溢出校正。卡牌/文本双容器。最小 400×118。
- 结束回合按钮（`NEndTurnButton`）：锚 1604,846（1920×1080）；隐藏 +250px 下滑 0.5s ExpoOut，出现 0.5s BackOut；hover 下沉 8px 0.5s CubicOut+文字变暗；可用时呼吸光：glow alpha→0.75 & scale→0.5 各 0.8s BackOut 循环 + 外层 scale 0.5→0.7/alpha 0.4→0 1.5s。
- 牌堆按钮（`NCombatCardPile`）：hover 1.25x 0.05s；移出 0.5s ExpoOut；按下 0.25s CubicOut+变暗；通用 bump 模式=0.05s 弹起/0.5s ExpoOut 回落。
- 面板弹入通用：0.15-0.25s alpha 渐入+CubicOut 位移，子元素 0.1/0.2s 延迟阶梯；背板黑 80% (0,0,0,0.8)。
- 气泡（`NSpeechBubbleVfx`）：scale 0.25→0.75 0.5s Out + 旋转 7°→0 0.3s + visible_ratio 0.4s 打字机。
- 稀有度视觉：①标题描边色 `StsColors`：Common #4D4B40 / Uncommon #005C75 / Rare #6B4B00 / Curse #550B9E / Quest #7E3E15；②稀有卡 GPUParticles2D 光晕 scale→92% 1.0s CubicIn + alpha→0.9、随机延迟 0-0.2s、关闭 0.25s 淡出；③可打高亮 shader `width`：显示→0.075 0.5s CubicOut，点击闪光 0.1s→0.15 再 0.35s CubicOut 回 0.075；可打色 (0,0.957,0.988,0.98)、金 (1,0.784,0,0.98)、红 (0.83,0,0.33,0.98)。
- 色板：cream #FFF6E2（主文字）、aqua #2AEBBE、gold #EFC851、red #FF5555。
- 卡牌标准尺寸 **300×422**，手内缩放 0.8 → 实际 240×337.6。
- 官方缓动偏好：入场几乎一律 ExpoOut/BackOut；0.05s hover 弹起、0.25s 按压、0.5s 默认回落、0.8s 手牌整体进出；弹性只用于箭头悬停与棋子落点，克制使用。

## 移植优先级（对还原手感贡献最大）

1. delta*7/8/10 指数平滑三通道（一个 _process 搞定回位）
2. hover 推挤公式 + 瞬时放大/0.5s ExpoOut 回落
3. 拖拽状态机（75% play zone/动态阈值/0.75 举卡锚位/95% 取消区）
4. 贝塞尔飞卡+变加速（speed 1.1-1.25/accel 2-2.5/arcDir ±500）
5. 伤害飘字全套（重力 2000+scale 2.5→1+双段淡出）与受击抖动（10px 双正弦 1s）
6. 能量球差速旋转 30°/s、意图浮动 sin(t·π)·10+8
7. 目标箭头（19 节贝塞尔+控制点公式+ElasticOut）
8. 可打卡光效 shader width 参数体系
9. 地图 22px 圆点连线+棋子 ElasticOut 落点+节点呼吸 1.2±0.25
10. 按钮 0.05s/0.5s 双段反馈+呼吸光
