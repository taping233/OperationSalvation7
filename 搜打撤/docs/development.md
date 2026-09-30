# 开发指南

## 环境与命令

当前仅开发 Vite，Codex / ZCode 共用根 AGENTS.md 与 [双端工作流](README.md#双端工作流)。优先现有 Node.js/依赖；确需首次安装时按任务授权处理，命令示例不授权安装、改全局配置或启动冻结的桌面线。

```powershell
npm run dev
npm run narrative:compile
npm test
npm run typecheck
npm run build
node game/selftest.js
node scripts/check-version.cjs
npm run perf
npm run assets:audit
```

`npm run perf` 是启动 Electron 的历史基准，当前冻结范围不执行。性能历史与方法参考 [全场景账本 PERF-LEDGER-2026-09-29](PERF-LEDGER-2026-09-29.md)；其中工具先核对浏览器实现，仅当前平台内置浏览器可用于复验，外部 CDP 脚本不沿用。开发地址加 `?perfProbe=1` 的探针方法与首次有限范围结果见 [Vite 内置浏览器性能记录](archive/records-2026-09-28/VITE-IAB-PERFORMANCE-2026-09-28.md)，受控平移 drawHz 不能代替真实移动的交付帧率。

CI 在 master 的 push 和 pull request 上依次运行 `check:syntax`、`typecheck`、`lint`，再经 `npm test` 的 pretest 编译剧情与校验数据后运行完整 Vitest；Vite 路径变更另由构建 workflow 检查产物预算。日常定向入口和提交快速门见[质量门](quality-gates.md)。依赖方向与按需加载边界可定向运行 `npm run test:target -- tests/architecture-boundaries.test.js tests/contracts.test.js`；照相馆页面 `game.cardslib.page.js` 只允许由轻门面 `game.cardslib.js` 动态加载。

历史桌面技术说明（冻结，须老板另行解冻与授权才能执行）：原生 `app://` 不解析 `howler` 等裸模块导入；`desktop-app` 的 `prestart` 先构建 Vite，再从 `desktop-app/game` 加载，`prestart` / `predist` 检查文件与版本。此说明不作为当前开发/验收入口。

## 修改约定

- 跨模块规则数值优先修改 `game/src/core/rule-config.js`，由 `core/rules.js` 提供兼容门面；地图格子和卡牌数据使用各自数据文件。概率和容量校验须通过 `tests/rule-config.test.js`，不得让预估和实际结算各维护一份常量。
- 新模块必须保持单向 ESM 依赖，并在契约测试中通过循环图检查。
- 事件叙事优先修改 `narrative/events.ink`；不要手改 `src/generated/narrative-events.js`，它会在开发、测试和构建前自动重新生成。
- 领域逻辑不直接操作 DOM；视图不直接修改其他模块的私有状态。
- 基地购买、拆包、领奖使用 `Base.purchase/openCardPack/grantReward`；复合命令在一个草稿中准备并只持久化一次。不要在 UI 先扣资源、再调用入库、最后忽略保存结果。
- `npm run typecheck` 汇总七个配置；结算（含经验推进、胜利快照和研究所撤离事务）、战斗快照、基础事务、随机工具、卡牌稀有度/渲染上下文、基地离场、宠物蛋与累计游玩时间命令采用严格检查。第六个 selection 配置只编译战斗选牌工厂的新增外部端口调用契约与正反例，不严格检查该工厂的内部战斗运行态。第七个 hand-selection 配置严格检查纯选牌规则、发现候选/状态 builder 和独立发现流程实现；`battle.selection-flow` 的其余旧战斗交互状态仍未严格检查，runtime/engine 接线也不代表整个战斗域已严格覆盖。一次临时全体 `@ts-check` 探测发现 163 项内部类型诊断，主要来自旧运行态状态和回调；类型检查按边界覆盖，不表示全项目已开启 strict。新端口应补具体 JSDoc 和编译正反例，不能用忽略诊断代替契约。
- 样式按页面职责放入 `css/base.css`、`cards.css`、`overlays.css`、`hub.css`、`battle.css` 或 `scenes.css`；主题覆盖文件保持在这些基础样式之后加载。
- 存档字段或键名如需变化，先添加迁移与固定旧档测试。
- 构建/实验产物写入已忽略目录，不提交 `dist` 或 `desktop-app/game`；验收报告/截图集中 `docs/evidence/<日期>-<任务>/`，是否提交仍需老板明确授权。
- CSS 与 `new URL(..., import.meta.url)` 可识别的资源交给 Vite 生成哈希文件；只有卡牌、立绘、图标和音效等运行时动态路径目录由构建插件原样复制。新增动态资源族时必须同步更新 `vite.config.js` 的 `RUNTIME_ASSET_DIRS`。
- `npm run assets:audit` 会报告源码/桌面产物体积、最大文件和内容完全相同的重复资源组；原始素材不因构建瘦身而删除。

## 界面实现约定

- 全局缩放由 `ui-scale.js` 管理；新增 UI 坐标通过 `uiRect()` 换算。`position: fixed` 的视口坐标需按缩放比例换算，详见 `architecture.md` 的样式级联说明。
- 启动时会移除原生 `title` 属性，提示使用自绘文字层。输入框事件不能触发整页重建；处理 Escape 前先判断 `isComposing`，避免中断中文输入。
- overlay 背景由 inert 隔离；新增常驻层时同步更新排除名单。图片挂载后调用 `SDT.Art.decodeIn(el)`，避免内置浏览器合成黑窗。
- 同一候选选择面板内卡牌不得重复。动画与空闲态性能规则见 `performance.md`；卡牌规则和数据来源见 `rules.md`、`architecture.md` 与生成的 `game-compendium.md`。

## 发布检查

发布须老板明确授权；当前范围仅 Vite，按质量门完成相关测试、自测、版本核对与构建，内置浏览器验收后再执行已授权发布。版本唯一真源为 `game/version.json`。历史 Electron 封装流程保持冻结，不因“收官”自动运行。

## 原型纪律（2026-09-06，源自 gamedev skills / prototype-fast）

- 验证性玩法先做**抛弃式 spike**：一个问题一个原型 + 时间盒（机制级 30~90 分钟），灰箱素材、零打磨；验证"是否好玩"后再按工程规范进 `src/`。
- spike 代码不得直接进入主源码目录；落地时重写命名与结构（原型回答的是问题，不是交付物）。
