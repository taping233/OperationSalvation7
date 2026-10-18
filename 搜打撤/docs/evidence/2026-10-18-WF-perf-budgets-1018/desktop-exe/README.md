# 更新 Windows portable 测试版

更新 EXE 已生成；主会话 builder 会话 22931 退出 0，独立产物校验退出 0。仍作为 portable 测试版：标准构建末端保留原 5 项性能预算失败，没有原生 EXE 窗口或玩法交互验收。

- 产物：仓库内 `.tmp/perf-budgets-1018/delivery/搜打撤-代号7.exe`，287,822,081 字节（274.49 MiB）。原 EXE 未覆盖，大二进制不入 Git。
- SHA256：`cd6ff02a0030d59b57f0aa08a2c2e84920e0788348da9c50acbf480c2041f5b1`。
- 获取方式：从本机上述路径直接复制单个 EXE。可用 `Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp/perf-budgets-1018/delivery/搜打撤-代号7.exe'` 核对。
- 冻结覆盖输入 SHA256：`28fd0ccad1771831804802cb5eda98e60a74c60b020ad43685e99e8d5fe421c8`，输入预检、builder 结果与验证报告三处一致。

输入副本为 `.tmp/perf-budgets-1018/exe-project`，底本提交 `4f27eae68e665dd55c6c56fae3520077476c5f01`，另有 [build-inputs.json](build-inputs.json) 中精确冻结的 5 份生产/工程文件和 4 份测试。只读复用现有 Electron 44.1.0、electron-builder 26.15.3、NSIS 与 7zip 缓存；不安装、下载、签名或发布，不覆盖上次 EXE。

主会话已运行标准 build：Vite 1262 模块、9.61 秒完成，195 项资源排除和 3 份字体许可证正常；末端原性能预算仍有 5 项失败并退出 1，见 [build-game.log.txt](build-game.log.txt)。包体 202.84 MiB、重复 9.94 MiB、入口 gzip 325.6 KiB、首屏 JS gzip 371.1 KiB、CSS gzip 214.0 KiB；没有放宽阈值，不能称标准链全部通过。

封装命令（由主会话执行，工作目录为 `搜打撤`）：

```powershell
& .tmp/perf-budgets-1018/run-exe-builder.ps1
exit $LASTEXITCODE
```

新产物为 `.tmp/perf-budgets-1018/delivery/搜打撤-代号7.exe`。封装前逐字核对 9 个覆盖文件、版本、实际 Electron `--version` 与原 5 项预算阈值；[builder-result.json](builder-result.json) 绑定输入 SHA256 和退出码。过程见 [release-input-check.log.txt](release-input-check.log.txt) 与 [build-portable.log.txt](build-portable.log.txt)。

builder 成功后已执行：

```powershell
node .tmp/perf-budgets-1018/verify-exe.cjs --build-log=.tmp/perf-budgets-1018/build-game.log
```

校验结果见 [exe-verification.json](exe-verification.json)：

- 外层 NSIS portable 为有效 PE（x86 引导），内置 Electron 主程序为 x64 PE；版本与游戏均为 0.60.0。
- ASAR 中 7 份启动源码/图标与冻结副本逐字一致；使用 `app` 本地协议，生产包没有额外 npm 依赖。
- 13 份 Electron 根运行时文件及 55 份语言包逐字一致。
- 全部 1526 个游戏文件、212,695,253 字节与独立构建输出逐字一致；仅 2 个 `.gitkeep` 未发布，没有额外文件。
- 13 个 HTML、170 个 CSS、69 个 JS 本地静态引用均存在，校验排除注释和外部 URL。
- 重新核对 9 个覆盖文件与原预算阈值，保留标准 postbuild 的实际 5 红；产物校验通过不等于标准 build 全链通过。

脚本留存：[run-exe-builder.ps1.txt](run-exe-builder.ps1.txt)、[check-release-inputs.cjs.txt](check-release-inputs.cjs.txt)、[verify-exe.cjs.txt](verify-exe.cjs.txt)。来源留存：[source-provenance.json](source-provenance.json)、[release-source.json](release-source.json)。`source-provenance` 描述最初 HEAD 导出，`release-source.project` 与 `build-inputs.releaseProject` 明确指向本次独立 EXE 副本；未访问浏览器 5319 副本内容。`release-source` 的覆盖状态文字保留准备时原样，最终 9 项覆盖及成功状态以已关联输入 SHA256 的 `build-inputs`、`builder-result` 和校验报告为准。

本次校验没有启动原生 EXE；PE/ASAR/资源检查不替代原生窗口、存档或玩法交互验收，也不推断实际 FPS、RSS 或显存。主会话的内置浏览器游玩检查单独记录，不当作原生 EXE 实测。
