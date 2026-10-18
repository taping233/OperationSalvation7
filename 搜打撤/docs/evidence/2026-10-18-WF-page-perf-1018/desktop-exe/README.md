# Windows portable 测试版交付记录

2026-10-18 生成版本 0.60.0 的 Windows x64 单文件 portable EXE。程序和游戏资源包含在 EXE 内，目标机器无需另装 Node、Electron 或浏览器。未做原生窗口及玩法交互验收；本次性能预算有 5 项失败，交付按老板要求作为测试版保留该事实。

- 产物：仓库内 `.tmp/page-perf-1018/delivery/搜打撤-代号7.exe`，287,814,301 字节（274.48 MiB）。二进制不入 Git，原桌面 EXE 未覆盖。
- SHA256：`8f98a7a45de29988fd59a47b345eb30baa765b19b260905e0144b8d67991746d`。
- 获取方式：在本机工作区直接复制上述单个 EXE；可用 `Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp/page-perf-1018/delivery/搜打撤-代号7.exe'` 复核。
- 构建输入：冻结 index SHA256 `56961cf91a8e395727ade83ba9b562dd050da4470a2ad2c88b022685664a64f0`；HEAD `eb8d66901dc0fd0baa9f20bb8fd2e68cc9b44233`。独立副本从 14,348 个 Git 对象导出，逐一校验对象 SHA1；不包含工作区事件投骰在途增量。
- 唯一人工输入覆盖：`scripts/runtime-asset-redundancy.mjs`，SHA256 `8c84ca869399b79c2261768ce5255df4a7f2b581ff4d4139cd2f16242eece9d4`。父代理已批准修复静态 SVG raw 与 TXT URL 的工程守卫识别；手写游戏、桌面源码及素材保持冻结，构建按现有逻辑重写的两个清单生成物另列于下文。

## 构建与封装

独立副本位于 `.tmp/page-perf-1018/exe-build/project`。执行标准 `npm run build -- --configLoader native`，保留 prebuild 的叙事编译及数据检查、Vite 资源构建、postbuild 性能预算。Vite 构建成功，标准链最后由性能预算退出 1；未修改预算阈值，未声称标准 build 全过。按父代理转达的老板最新指示，随后单独对完整构建资源运行 portable builder。

性能预算原始结果见 [build-game.log](build-game.log)：

| 指标 | 实际值 | 上限 | 结果 |
| --- | ---: | ---: | --- |
| 启动预热 | 6 | 40 | 通过 |
| 游戏构建体积 | 202.84 MiB | 112.00 MiB | 失败 |
| 重复资源 | 9.94 MiB | 0.88 MiB | 失败 |
| 入口 JS gzip | 325.5 KiB | 270.0 KiB | 失败 |
| 首屏 JS gzip | 371.0 KiB | 310.0 KiB | 失败 |
| CSS gzip | 214.0 KiB | 136.0 KiB | 失败 |

封装使用现有 Electron 44.1.0、electron-builder 26.15.3 及本机 NSIS/7zip 缓存，不安装依赖、不联网。冻结副本版本一致检查通过，运行时 `--version` 与冻结依赖版本一致。显式设置 `npmRebuild=false`、`signAndEditExecutable=false`，本次不签名。父代理主聊天执行会话 18591 确认退出 0。封装命令及日志分别保存在 [run-exe-builder.ps1.txt](run-exe-builder.ps1.txt)、[check-release-inputs.cjs.txt](check-release-inputs.cjs.txt)、[build-portable.log](build-portable.log)。

对父代理确认对应冻结输入的代码提交 `173e998e731c482d68cc48b32ac11ee4b2629e71`，另读 Git 对象并核对副本 `game/**` 与 `desktop-app/**`：3129 个文件，3127 个逐字节相同，无缺失或意外差异。现有构建正常重写了 `art-manifest.js`（931→1023 项）及 `thumb-manifest.js`（336→315 项）；这是副本内的自动生成结果，未回写共享源码。精确对象、生成前后数量与核对方法见 [production-object-check.json](production-object-check.json)、[check-exe-production-objects.cjs.txt](check-exe-production-objects.cjs.txt)。初始导出方法见 [export-exe-index.cjs.txt](export-exe-index.cjs.txt)。

## 产物核对

`node .tmp/page-perf-1018/verify-exe.cjs` 退出 0，详见 [exe-verification.json](exe-verification.json) 与可复核脚本 [verify-exe.cjs.txt](verify-exe.cjs.txt)。

- 外层 NSIS portable 为有效 PE（x86 引导程序），内置 Electron 主程序为 x64 PE。
- ASAR 中入口、preload、启动窗口及相关 7 份桌面文件与冻结副本逐字节一致。
- 内置游戏 1526 个文件均与构建副本逐字节一致；仅 2 个 `.gitkeep` 未打包。
- 首页 13 个实际本地引用全部存在，核对时排除 HTML 注释；6 项 Electron 基础运行时文件齐全。
- 使用桌面现行 `app` 本地协议加载内置资源，生产包无额外 npm 依赖。冻结输入不含可选 `release-profile.json`，保持现行默认存档位置逻辑。

当前平台没有可用原生应用控制入口，未启动 EXE 做窗口、存档及玩法交互验收。PE、ASAR、资源和字节核对只证明程序封装完整，不替代原生交互验收。

来源留存：[source-provenance.json](source-provenance.json)、[build-overlay.json](build-overlay.json)。本目录不保存 EXE、Electron 运行时或临时构建输出。
