# Vite 卡牌美术覆盖审计（2026-09-12）

本审计只读核对了 `game/data/art-mapping.json`、`game/src/cards.js` 和 `game/src/art.js` 的实际回退链，并检查了 `game/assets` 中的文件。卡牌库当前界面口径为 245 张；代码种子中可抽取到 254 个去重对象候选，差异来自多批次定义、覆盖项和内部对象，不能把它们直接当作额外缺卡。

## 结论

- 显式专属映射：当前核到的路径全部存在（0 条“映射存在但文件不存在”）。
- 事件映射实际落在 `assets/scenes/event-*.webp`；生物卡按 `art.js` 的规则使用 `assets/portraits/enemies/<id>.webp`，这些路径也存在。
- 没有显式专属映射的卡，会按类型/家族使用已存在的通用图（如 `cards/spell.webp`、`cards/martial-melee.webp`、`cards/equipment-utility.webp`、`cards/healing.webp`）。这是“资源已覆盖、审美仍是通用占位感”，不是路径缺失。
- 按当前候选去重结果，共 89 张卡走通用家族图；它们是下一批重绘的主要对象。不要把这 89 张记录成“加载失败”。

## 下一批优先重绘（前 12）

| 卡牌 ID | 卡名 | 当前真实回退路径 | 原因 |
| --- | --- | --- | --- |
| `tt2-pouch` | 神秘口袋 | `assets/cards/equipment-utility.webp` | 装备通用图 |
| `tt2-greenarrow` | 青箭 | `assets/cards/martial-ranged.webp` | 武术通用图 |
| `tt3-pindown` | 制敌 | `assets/cards/martial-melee.webp` | 武术通用图 |
| `tt3-hop-strike` | 跳击 | `assets/cards/martial-melee.webp` | 武术通用图 |
| `tt3-plate` | 铠甲 | `assets/cards/martial-melee.webp` | 当前类型归类后的通用图 |
| `tt3-ice-arrow` | 寒冰矢 | `assets/cards/spell.webp` | 法术通用图 |
| `tt3-heal-potion` | 治疗药水 | `assets/cards/healing.webp` | 治疗家族通用图 |
| `tt3-fish-out` | 摸底 | `assets/cards/spell.webp` | 法术通用图 |
| `tt3-freeze` | 冰冻药水 | `assets/cards/spell.webp` | 法术通用图 |
| `tt3-arcane-wisdom` | 奥术智慧 | `assets/cards/spell.webp` | 法术通用图 |
| `tt3-fate-potion` | 命运药水 | `assets/cards/spell.webp` | 法术通用图 |
| `tt3-holy-shield` | 圣盾 | `assets/cards/spell.webp` | 法术通用图 |

## 本轮拟重绘 6 张的映射键

这些是给下一批生图使用的真实键，代码会按以下专属文件优先命中：

- 初始攻击：`builtin-sha` → `martial-builtin-sha.webp`
- 火球：`tt3-fireball` → `spell-tt3-fireball.webp`
- 穿刺：`tt3-skewer` → `martial-tt3-skewer.webp`
- 法杖：`tt3-staff` → `equip-tt3-staff.webp`
- 木材：`tt-wood` → `resources/wood.webp`
- 口粮：`tt-rations` → `resources/ration.webp`

本轮未修改映射和运行时代码，也未调用生图。后续应优先消除通用家族图的占位感，再统一全部敌人和卡面审美。

## 本轮覆盖收口

本轮实际已接入 9 张专属卡面资源，并补齐 2 张资源卡（木材、口粮）的专属资源路径；审计只确认映射和文件覆盖，不代表已经逐张进行视觉审美验收。其余 89 张通用家族图仍保留，后续应按优先级继续重绘。

本轮未修改映射和运行时代码，也未调用生图。后续优先级：先替换前 12 张通用图，再完成其余通用卡、敌人和卡面风格统一。
