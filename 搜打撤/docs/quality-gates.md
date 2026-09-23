# Vite 质量门

本页记录搜打撤 Vite 主线的本地检查与 GitHub Actions 检查。CI 定义在仓库根目录 `.github/workflows/vite-quality.yml`，只在 Vite 相关路径变更时，对 pull request 和 `master` push 运行。

## 本地检查

在 `搜打撤` 目录执行：

```sh
npm run check:syntax
npm run validate:data
npm test
npm run build
```

`npm run check:syntax` 使用项目已有的 Acorn，解析 `game/src` 和 `scripts` 下的 `.js`、`.mjs`、`.cjs` 文件；跳过生成目录、依赖和临时目录。它报告相对路径、行、列，并在发现语法错误时以非零状态退出。它只检查语法，不做类型检查、规则检查或 ESLint 分析。

`npm test` 会按文件串行运行 Vitest，并使用 dot reporter。现有 `pretest` 生命周期保持不变，会先编译剧情并校验数据；`npm run build` 同样保留现有 `prebuild` 数据/剧情检查和 `postbuild` 性能预算检查。

在可构建的干净工作区，可用 `npm run check:quality` 按语法、数据、测试、构建顺序执行完整本地质量门。该组合入口会运行测试和构建各自已有的生命周期钩子。工作区有其他会话半成品时，不运行包含 build 的组合入口，分别执行必要检查；当前本轮即遵循这一限制。

## 卡牌图鉴生成

普通 `npm test` 中的 `tests/compendium.test.js` 只在内存生成并比较图鉴，不会写回文档。需要有意更新 `docs/game-compendium.md` 时，运行现有入口：

```sh
npm run docs:compendium
```

该命令由 npm 提供的 `npm_lifecycle_event` 允许测试落盘生成结果；更新后应检查文档差异并随对应卡牌数据变更一并审阅。

## CI 状态

workflow 配置了 Node.js 22、从 `搜打撤/package-lock.json` 执行 `npm ci`，随后运行语法检查、数据校验、串行测试和 Vite 构建（含性能预算）。检查失败会直接使 job 失败。文档描述的是配置的流程；远端 GitHub Actions 是否实际运行及其结果，应以对应提交或 pull request 的 Actions 记录为准。
