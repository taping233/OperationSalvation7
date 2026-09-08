# 表现层参考来源

本工程只参考 `.tmp/sts2-reverse` 中与卡牌栏视觉布局直接相关的结构；没有复制其资源、文本、规则、数值或 Core 类型。

| 参考文件 | 用途 | 本工程处理 |
| --- | --- | --- |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Helpers/HandPosHelper.cs` | 1–10 张手牌的弧形位置、边缘下沉、悬停空间 | 经用户授权，将位置表直接适配为 `ReferenceHandGeometry.cs`，并在 `CardHandLayout.cs` 中做响应式缩放；不带入玩法代码 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Helpers/HandLayoutHelper.cs` | 观察手牌顺序与插入位置应分离于渲染 | 当前只保留布局职责；卡牌顺序留给未来 Core 快照 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Nodes.Combat/NCombatCardPile.cs` | 观察牌堆计数、点击打开、悬停反馈与入场/离场职责 | `BattleScreen.cs` 用本项目占位按钮和信号，不依赖其 `CardPile`、提示系统或战斗管理器 |
| `.tmp/sts2-reverse/decompiled/MegaCrit.Sts2.Core.Nodes.Screens/NCardPileScreen.cs` | 观察牌堆查看层的独立屏幕边界 | 当前用“等待 Core 处理”的状态文本占位，未来可替换为独立 PackedScene |

## 明确未复用内容

- 除上表明确记录的手牌位置表外，未引入 `MegaCrit.*` 命名空间、反编译程序集、原作场景、卡牌名称、敌人文本、战斗规则或数值。
- 未复制 `.tmp/sts2-reverse` 的二进制、Godot 资源包、贴图、字体、音频或场景资源。
- 本工程五名核心角色概念保持为：霜翎、白契、栗团、玄砾、灯葵。
