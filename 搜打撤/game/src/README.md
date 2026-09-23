# src 模块说明

`index.html` 通过 `<script type="module">` 加载 `main.js`。所有模块都是 ESM；不得再依赖旧版普通 script 的共享词法作用域。

## 目录结构（2026-09-23 域目录化）

平铺布局已按功能域收进 8 个目录；架构守卫（`scripts/architecture-graph.mjs` + `tests/architecture-boundaries.test.js`）的分层判据与目录一致：

| 目录 | 域 | 内容概览 |
| --- | --- | --- |
| `core/` | 底座 | 随机、规则、输入、相机、渲染原语与聚合、事件总线、数据加载、诊断、SDT 门面 |
| `ui/` | 全局 UI | `ui.js` 工具、ui-scale、词条浮框、路线浮层、光标、标题菜单 |
| `battle/` | 战斗 | battle.* 全家、效果流水线（effect-steps.*）、伤害（combat.js）、符文、懒装载器 |
| `cards/` | 卡库 | 卡数据/同步/规则/schema/视图、备注、机制句式 |
| `run/` | 局内流程 | 对局会话、地图生成与快照、遭遇、宝箱、祭坛/商店/撤离 |
| `hub/` | 基地/局外 | 仓库、背包、存档、商店、整备、收藏、各类命令、照相馆呈现 |
| `home/` | 首页/叙事 | 首页场景五件套、ink 叙事、剧情命令 |
| `audio/` | 音频 | sound 策略/声景 |

根层只保留装配与入口：`main.js`（唯一入口，导入顺序即启动顺序）、`boot-order.js`（顺序唯一事实源，条目为带域前缀的路径）、`game.boot.js`（跨功能接线）、`r7a.qa.js`（QA 入口）、`generated/`（生成物，不手改）。

## 依赖层次

1. `core/rules.js`、`core/mapData.js`、`run/game.run.data.js`、`core/asset-url.js`：规则、授权数据和资源路径。
2. `core/art.js`、`core/icons-bitmap.js`、`audio/sound.js`、`core/camera.js`、`battle/combat.js`、`hub/base.js`、`hub/meta.js`、`core/renderer.primitives.js`：独立能力与纯工具。
3. `hub/game.store.js`、`hub/game.storage.js`、`run/game.session.js`、`battle/battle.core.js`、`battle/battle.effects.js`、`battle/battle.deck.js`、`battle/battle.rules.js`：状态、持久化和领域逻辑；`ui/game.menu.js` 是标题/选档/设置控制器。
4. `core/renderer.js`（聚合 `renderer.icons.js` / `renderer.fx.js`）、`battle/battle.view.js`、`ui/ui.js`：Canvas 或 DOM 表现层；`renderer.fx.js` 挂载的 `SDT.FX` 必须先于 `run/game.session.js` 求值（main.js 导入顺序不可调换）。
5. `run/game.run.js`、`run/game.run.shop.js`、`hub/game.hub.js`（基地壳）、`hub/game.hub.depart.js`（出征整备）、`hub/game.hub.pages.js`（六页签 HTML）、`hub/game.hub.bridge.js`（壳↔切片中立桥）、`hub/game.bag.js`、`hub/game.notes.js`、`hub/game.cardslib.js`：功能流程。
6. `game.boot.js`：输入、跨功能接线和启动；这是唯一允许了解多数功能模块的地方。

## 关键约束

- `run/game.session.js` 不得导入 `boot/run/hub/notes/cardslib`；页面跳转通过 `configureGameRuntime()` 注入。
- `battle/battle.core.js` 不得导入 `battle/battle.view.js`；视图通过 `configureBattleRenderer()` 注册。
- 战斗调用优先使用 `getSnapshot()` 和 `commands`，不要新增私有状态修改器。
- 新规则值进入 `RULES`，新效果文本时点进入 `battle/battle.effects.js`。
- `tests/contracts.test.js` 会检查整个目录的循环依赖；新增顶层目录须同步 `architecture-graph.mjs` 的分层判据。

完整接口和数据流见 `docs/architecture.md`。
