# 开发指南

## 环境与命令

需要 Node.js。首次安装运行 `npm install`；桌面运行时缺失时在 `desktop-app` 目录运行 `node node_modules/electron/install.js`。

```powershell
npm run dev
npm run narrative:compile
npm test
npm run build
node game/selftest.js
node scripts/check-version.cjs
npm run perf
npm run assets:audit
```

桌面开发态不能直接读取 `game`：原生 `app://` 不解析 `howler` 等裸模块导入。`desktop-app` 的 `prestart` 会先运行 Vite 构建，再从 `desktop-app/game` 加载，避免入口模块失败后首页按钮全部失效。桌面启动和发布统一使用 `desktop-app/node_modules/electron` 的运行时；`prestart` / `predist` 会先检查文件与版本。

## 修改约定

- 规则数值优先修改 `src/rules.js`，地图格子和卡牌数据使用各自数据文件。
- 新模块必须保持单向 ESM 依赖，并在契约测试中通过循环图检查。
- 事件叙事优先修改 `narrative/events.ink`；不要手改 `src/generated/narrative-events.js`，它会在开发、测试和构建前自动重新生成。
- 领域逻辑不直接操作 DOM；视图不直接修改其他模块的私有状态。
- 样式按页面职责放入 `css/base.css`、`cards.css`、`overlays.css`、`hub.css`、`battle.css` 或 `scenes.css`；主题覆盖文件保持在这些基础样式之后加载。
- 存档字段或键名如需变化，先添加迁移与固定旧档测试。
- 生成物写入已忽略目录，不提交 `dist`、`desktop-app/game`、性能输出或截图。
- CSS 与 `new URL(..., import.meta.url)` 可识别的资源交给 Vite 生成哈希文件；只有卡牌、立绘、图标和音效等运行时动态路径目录由构建插件原样复制。新增动态资源族时必须同步更新 `vite.config.js` 的 `RUNTIME_ASSET_DIRS`。
- `npm run assets:audit` 会报告源码/桌面产物体积、最大文件和内容完全相同的重复资源组；原始素材不因构建瘦身而删除。

## 发布检查

依次执行测试、源码自测、版本一致性检查、Vite 构建和 Electron 冒烟。版本唯一真源为 `game/version.json`。`npm run dist --prefix desktop-app` 会在唯一临时目录中完成 Electron 封装，成功后再替换 `desktop-app/dist/搜打撤-代号7.exe`，避免旧 `win-unpacked` 文件锁破坏发布。

## 原型纪律（2026-09-06，源自 gamedev skills / prototype-fast）

- 验证性玩法先做**抛弃式 spike**：一个问题一个原型 + 时间盒（机制级 30~90 分钟），灰箱素材、零打磨；验证"是否好玩"后再按工程规范进 `src/`。
- spike 代码不得直接进入主源码目录；落地时重写命名与结构（原型回答的是问题，不是交付物）。
