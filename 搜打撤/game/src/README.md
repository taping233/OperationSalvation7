# src 模块说明

`index.html` 通过 `<script type="module">` 加载 `main.js`。所有模块都是 ESM；不得再依赖旧版普通 script 的共享词法作用域。

## 依赖层次

1. `rules.js`、`mapData.js`、`game.run.data.js`、`asset-url.js`：规则、授权数据和资源路径。
2. `art.js`、`icons-bitmap.js`、`sound.js`、`camera.js`、`combat.js`、`base.js`、`meta.js`、`renderer.primitives.js`：独立能力与纯工具。
3. `game.store.js`、`game.storage.js`、`game.session.js`、`battle.core.js`、`battle.effects.js`、`battle.deck.js`、`battle.rules.js`：状态、持久化和领域逻辑；`game.menu.js` 是标题/选档/设置控制器。
4. `renderer.js`（聚合 `renderer.icons.js` / `renderer.fx.js`）、`battle.view.js`、`ui.js`：Canvas 或 DOM 表现层；`renderer.fx.js` 挂载的 `SDT.FX` 必须先于 `game.session.js` 求值（main.js 导入顺序不可调换）。
5. `game.run.js`、`game.run.shop.js`、`game.hub.js`（基地壳）、`game.hub.depart.js`（出征整备）、`game.hub.pages.js`（六页签 HTML）、`game.hub.bridge.js`（壳↔切片中立桥）、`game.bag.js`、`game.notes.js`、`game.cardslib.js`：功能流程。
6. `game.boot.js`：输入、跨功能接线和启动；这是唯一允许了解多数功能模块的地方。

## 关键约束

- `game.session.js` 不得导入 `boot/run/hub/notes/cardslib`；页面跳转通过 `configureGameRuntime()` 注入。
- `battle.core.js` 不得导入 `battle.view.js`；视图通过 `configureBattleRenderer()` 注册。
- 战斗调用优先使用 `getSnapshot()` 和 `commands`，不要新增私有状态修改器。
- 新规则值进入 `RULES`，新效果文本时点进入 `battle.effects.js`。
- `tests/contracts.test.js` 会检查整个目录的循环依赖。

完整接口和数据流见 `docs/architecture.md`。
