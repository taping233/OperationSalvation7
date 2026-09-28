# 开发指南

## 环境与命令

需要 Node.js。首次安装运行 `npm install`；桌面运行时缺失时在 `desktop-app` 目录运行 `node node_modules/electron/install.js`。

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

CI 在 master 的 push 和 pull request 上依次运行 `check:syntax`、`validate:data`、`typecheck`、`lint`，再运行完整 Vitest。依赖方向与按需加载边界可定向运行 `npx vitest run --no-file-parallelism tests/architecture-boundaries.test.js tests/contracts.test.js`；照相馆页面 `game.cardslib.page.js` 只允许由轻门面 `game.cardslib.js` 动态加载。

桌面开发态不能直接读取 `game`：原生 `app://` 不解析 `howler` 等裸模块导入。`desktop-app` 的 `prestart` 会先运行 Vite 构建，再从 `desktop-app/game` 加载，避免入口模块失败后首页按钮全部失效。桌面启动和发布统一使用 `desktop-app/node_modules/electron` 的运行时；`prestart` / `predist` 会先检查文件与版本。

## 修改约定

- 跨模块规则数值优先修改 `game/src/core/rule-config.js`，由 `core/rules.js` 提供兼容门面；地图格子和卡牌数据使用各自数据文件。概率和容量校验须通过 `tests/rule-config.test.js`，不得让预估和实际结算各维护一份常量。
- 新模块必须保持单向 ESM 依赖，并在契约测试中通过循环图检查。
- 事件叙事优先修改 `narrative/events.ink`；不要手改 `src/generated/narrative-events.js`，它会在开发、测试和构建前自动重新生成。
- 领域逻辑不直接操作 DOM；视图不直接修改其他模块的私有状态。
- 基地购买、拆包、领奖使用 `Base.purchase/openCardPack/grantReward`；复合命令在一个草稿中准备并只持久化一次。不要在 UI 先扣资源、再调用入库、最后忽略保存结果。
- `npm run typecheck` 汇总七个配置；结算、战斗快照、基础事务、随机工具、卡牌稀有度/渲染上下文、基地离场及宠物蛋命令采用严格检查。第六个 selection 配置只编译战斗选牌工厂的新增外部端口调用契约与正反例，不严格检查该工厂的内部战斗运行态。第七个 hand-selection 配置严格检查纯候选/支付规则实现和选牌状态契约 fixture；runtime 的状态接线与 selection-flow、exec-play、view 消费处不因此自动计入严格覆盖。一次临时全体 `@ts-check` 探测发现 163 项内部类型诊断，主要来自旧运行态状态和回调；解决这些真实边界前，不将 selection-flow 实现计作 strict 覆盖。类型检查按边界覆盖，不表示全项目已开启 strict。新端口应补具体 JSDoc 和编译正反例，不能用忽略诊断代替契约。
- 样式按页面职责放入 `css/base.css`、`cards.css`、`overlays.css`、`hub.css`、`battle.css` 或 `scenes.css`；主题覆盖文件保持在这些基础样式之后加载。
- 存档字段或键名如需变化，先添加迁移与固定旧档测试。
- 生成物写入已忽略目录，不提交 `dist`、`desktop-app/game`、性能输出或截图。
- CSS 与 `new URL(..., import.meta.url)` 可识别的资源交给 Vite 生成哈希文件；只有卡牌、立绘、图标和音效等运行时动态路径目录由构建插件原样复制。新增动态资源族时必须同步更新 `vite.config.js` 的 `RUNTIME_ASSET_DIRS`。
- `npm run assets:audit` 会报告源码/桌面产物体积、最大文件和内容完全相同的重复资源组；原始素材不因构建瘦身而删除。

## 界面实现约定

- 全局缩放由 `ui-scale.js` 管理；新增 UI 坐标通过 `uiRect()` 换算。`position: fixed` 的视口坐标需按缩放比例换算，详见 `architecture.md` 的样式级联说明。
- 启动时会移除原生 `title` 属性，提示使用自绘文字层。输入框事件不能触发整页重建；处理 Escape 前先判断 `isComposing`，避免中断中文输入。
- overlay 背景由 inert 隔离；新增常驻层时同步更新排除名单。图片挂载后调用 `SDT.Art.decodeIn(el)`，避免内置浏览器合成黑窗。
- 同一候选选择面板内卡牌不得重复。动画与空闲态性能规则见 `performance.md`；卡牌规则和数据来源见 `rules.md`、`architecture.md` 与生成的 `game-compendium.md`。

## 发布检查

依次执行测试、源码自测、版本一致性检查、Vite 构建和 Electron 冒烟。版本唯一真源为 `game/version.json`。`npm run dist --prefix desktop-app` 会在唯一临时目录中完成 Electron 封装，成功后再替换 `desktop-app/dist/搜打撤-代号7.exe`，避免旧 `win-unpacked` 文件锁破坏发布。

## 原型纪律（2026-09-06，源自 gamedev skills / prototype-fast）

- 验证性玩法先做**抛弃式 spike**：一个问题一个原型 + 时间盒（机制级 30~90 分钟），灰箱素材、零打磨；验证"是否好玩"后再按工程规范进 `src/`。
- spike 代码不得直接进入主源码目录；落地时重写命名与结构（原型回答的是问题，不是交付物）。
