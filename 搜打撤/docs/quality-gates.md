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

## 卡牌效果审计

`tests/card-audit.test.js` 对战斗卡遍历六种职业上下文，按稳定卡 id 和完整未识别句式去重。新增未识别项会失败；已识别的旧例外也会失败，提醒删除过期记录。已知项集中在 `tests/fixtures/card-effect-audit-known.json`，每条必须说明逐句解析尚未识别，或审计缺少真实战斗上下文的原因。例外不代表玩法已验证，也不能通过只放行整个卡 id 来覆盖新句式。

`allowMissingCardIds` 仅列出当前工作区已有、但独立工程提交尚不包含的五张 TT12 卡。该卡存在时照常检查未知项和过期例外；缺少其他已记录卡牌仍会失败。TT12 正式合入后应删除这五个缺席许可，保留仍有证据支持的精确句式记录。

## CI 状态

workflow 配置了 Node.js 22、从 `搜打撤/package-lock.json` 执行 `npm ci`，随后运行语法检查、数据校验、串行测试和 Vite 构建（含性能预算）。检查失败会直接使 job 失败。文档描述的是配置的流程；远端 GitHub Actions 是否实际运行及其结果，应以对应提交或 pull request 的 Actions 记录为准。

2026-09-23 本地独立提交 `89e46fa` 验收：隔离 Vite checkout 使用锁定依赖，语法检查 148 文件、数据校验、109 个测试文件 / 622 项、生产构建与原性能预算全部通过。首屏 JS gzip 227.7 KiB，入口 186.1 KiB，重复资源 0.52 MiB。基地首次加载、照相馆、战斗检查点恢复、胜利收取战利品及战后刷新读档已在内置浏览器验证。远端 Actions、长期运行性能及完整撤离/死亡分支仍未验收；详细证据与边界见 `architecture-alignment-plan-2026-09-23.md`。
