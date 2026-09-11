# PROGRESS · 实时状态板

> 心跳协议：开工先把批次条目改 `claimed` + 时间戳 + 负责人；每完成一个子步骤更新本条目（≤15 分钟一次）；完工改 `verifying` 并附验收证据摘录。
> 主控：验收 verifying 批次 → 过则 pathspec commit + 标 done；不过写「失败项/修复单」并派修复 agent；claimed 心跳 >45 分钟视为中断可重派；pending 且依赖满足 → 按 HANDOFF §4 波次派工。
> 最后巡检：2026-09-11（Wave 1 派工）

## 批次状态

| 批次 | 状态 | 心跳 | 负责 | 摘要/证据 |
|---|---|---|---|---|
| 0 数据管线 | done | 2026-09-11 | 主控 | 245 卡：validate OK、C.all()=245 互证、Combat 108 checks / Run 89 / Core 26 全绿、dotnet build 0 警告 |
| 1 数据进运行时 | claimed | 2026-09-11 wave1-A | wave1-A | 消除 RunState/CoreGameAdapter 硬编码数据表，接 data/*.json |
| 4a ink spike | claimed | 2026-09-11 wave1-D | wave1-D | ink C# runtime + inklecate 编译 events.ink 跑通 10 结点 |
| 6a 表现基础库 | claimed | 2026-09-11 wave1-B | wave1-B | 字体/主题色板/STS2 动作库/扇形手牌补全 |
| 7a 音频管线 | claimed | 2026-09-11 wave1-C | wave1-C | 53 SFX 清单化 + 双 BGM 交叉淡化 + 设置键 |
| 2 战斗对齐 | pending | — | — | 依赖 1 |
| 3 四层地图 | pending | — | — | 依赖 2 |
| 4b 商店/宝箱/碎片 | pending | — | — | 依赖 1 |
| 4c 事件整合 | pending | — | — | 依赖 4a+2 |
| 5 宠物+收藏室 | pending | — | — | 依赖 4b |
| 6b 屏幕对齐 | pending | — | — | menu/run/map 先行；battle/hub 部分依赖 2/5 |
| 6c 战斗动画+地图渲染 | pending | — | — | 依赖 6a |
| 7b 设置+性能 | pending | — | — | 依赖 7a |
| 8 发布链+总验收 | pending | — | — | 依赖全部 |

## 接口需求（跨领地登记）

（空）

## 失败项/修复单

（空）
