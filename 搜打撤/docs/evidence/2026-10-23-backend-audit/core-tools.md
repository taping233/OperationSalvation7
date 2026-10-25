# 底层与工程工具静态核查

本轮将非前端范围按纯规则、数据、状态、存储和工程工具理解。在查看的入口中未发现独立业务 HTTP 服务：`package.json` 的开发入口是 Vite；`scripts` 中命中的 `createServer` 仅用于性能采样工具探测端口。桌面打包副本与冻结引擎未纳入。

## 已精简

| 位置 | 静态证据与变化 |
| --- | --- |
| `scripts/impact-query.mjs:25` | `extractRegistryTokens` 在本模块没有本地引用，公开出口已由下一行直接 re-export 提供；删除重复本地导入，公开出口保留。 |
| `scripts/esm-convert.mjs:19`（修改前） | `simple`、`base` 没有使用；删除整条 `acorn-walk` 导入，不改变迁移工具逻辑。 |
| `scripts/workflow-status.mjs:168` | `--year` 修改的局部变量不再被读取；改为 `year - 1` 并将声明收紧为 const，日期计算数值相同。 |

这三份脚本修改前的定向 `git diff --stat` 无输出，未夹带其他任务未提交修改；修改后差异为 3 行新增、4 行删除。

## 核查范围与限制

- 对 `scripts/**/*.mjs`、`scripts/**/*.cjs` 用既有 ESLint 静态检查查找未用变量与无用赋值；此次临时启用这两条规则，没有修改项目配置。静态调用退出 0，逐项人工判断后只改上表三份非前端脚本。其余命中在浏览器驱动/性能采样脚本，本轮排除。
- 定向阅读 `core/random-core.js`、`random-service.js`、`random-streams.js`、`random.js`、`rule-config.js`、`shared.js`、`event-bus.js`、`run-checkpoint.js`、`card-capacity.js`、`data-loader.js`，以及台账解析/任务输入/记忆检索相关工具。未发现可直接删除且不影响现行契约的整文件。
- `shared` 的公开转发、随机流版本、旧地图随机序列、数据加载的冻结边界均保留；不能因为实现相似或主要由测试引用就判定废弃。
- 一次 Knip 静态扫描未取得可解析输出，`.tmp/backend-audit-knip.json` 长度为 0，运行会话随后不可恢复；没有将它计作通过，也未拿空结果认定无冗余，未再次盲跑。
- 三份修改后的脚本通过 `node --check` 语法解析；这是静态检查，未运行测试、构建、实页、网络或发布。

本报告只陈述实际核查范围，不表示整个非前端代码无缺陷。
