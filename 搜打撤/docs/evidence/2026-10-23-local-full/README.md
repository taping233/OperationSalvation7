# 本地依赖、完整验收与生产构建

2026-10-23，老板授权同步本地依赖、完整验证和构建，实页暂不执行。本轮已完成，未提交、未推送。

## 输入与依赖

- 基底：`ed0cf08d3eab57d47e56eb003eeb991353ec68c5`，本地 master。
- Windows；Node `v24.13.0`、npm `11.6.2`。本地结果不替代使用 Node 22 的远端 CI。
- 最终原入口 `npm ci --no-audit` 成功，安装502个包；逐路径核对锁文件：502个已安装包版本一致，117个可选包未安装。`source-map-js` 为 `1.2.2`。
- `package.json` 与 `package-lock.json` 前后SHA256一致，见 `dependency-inputs.json`；最终版本检查见 `dependency-version-check-final.json`。

## 验证结果

| 检查 | 结果 | 原始记录 |
| --- | --- | --- |
| 原完整门 `node scripts/acceptance-gate.mjs --full --run` | exit0，815文件通过/1跳过；8507项通过/38跳过；Vitest442.21秒 | `full.log` |
| 完整门静态检查 | 剧情编译、621文件语法、内容数据、11项类型配置及覆盖审计、ESLint通过；implementation560/560、strict51/560 | `full.log` |
| 全局资产审计 | 0 errors，570条未变历史警告：unlisted533、ghost33、license-pending4 | `full.log`、`assets-postbuild.log` |
| 原生产构建 `npm run build` | 沙箱外重跑exit0，prebuild、Vite与postbuild预算全部通过；1422模块，Vite11.77秒 | `build-retry.log` |
| 构建生成差异补验 | 5文件通过/1跳过；105项通过/1跳过 | `generated-tests.log` |
| 文档守卫 | 通过 | `docs-check.log`、`docs-check-final.log` |

完整门针对构建前源码执行。构建自动为 `game/src/generated/art-manifest.js` 增加15条现有资源记录；该生成差异保留未提交，另补6个相关测试文件与构建后全局资产审计，未重新跑整轮FULL。详见 `generated-art-manifest.diff.txt`。

产物位于 `desktop-app/game/`，1615文件、174123545字节（166.06 MiB）。首屏JS gzip414.0 KiB，入口gzip365.5 KiB，战斗gzip68.7 KiB，剧情gzip31.0 KiB，CSS gzip228.0 KiB；预算通过。Vite保留静态/动态导入混用与大分块提示。产物逐文件SHA256见 `build-inventory.json`，日志SHA256见 `log-hashes.json`。

## 安装与构建中途结果

首次清装被运行中服务占用esbuild阻止；第一次增量恢复错误使用了不读取锁文件的参数，版本检查发现差异；改用读取锁文件的安装仍被Rollup文件占用阻止。随后老板明确允许临停并恢复原两个服务，按锁清装成功。失败记录与版本差异检查均保留，未当作成功。

首次沙箱内构建在创建产物目录时EPERM、exit1，postbuild未执行；按原命令在沙箱外重跑成功。`build.log`保留首次失败，成功记录独立存为 `build-retry.log`。

## 服务与未核验项

- 老板允许临停原5173/PID3224和5200/PID23304；已按原参数隐藏恢复为5173/PID40140、5200/PID20320。启动参数和PID见 `services-before.json`、`listeners-before.json`、`services-restored.json`。
- 5200首页HTTP200；5173确认仍监听原IPv6 ::1，但当前工具访问IPv6套接字被权限阻止，HTTP未核验。首次启动探活含启动时序失败，后续记录独立存为 `service-health-final.json`。
- 实页按老板要求未执行；本轮未刷新远端CI，也未提交、推送或发布。
- 完成未提交归属：本证据目录、`docs/PARALLEL-REGISTRY.md`自有条目与构建自动生成的 `game/src/generated/art-manifest.js`。原有未跟踪文件保留。
