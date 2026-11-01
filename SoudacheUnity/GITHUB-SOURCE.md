# GitHub 源码与本地验收

Unity 工程使用同仓的 `搜打撤/game` 作为现行资源来源。克隆仓库后保留 `SoudacheUnity/` 与 `搜打撤/` 的同级布局；只下载 Unity 子目录不包含完整原料。

当前桌面包使用Unity6000.6.7f1，buildGUID为`c3ee3347a03149de80bbb7fe3f0bb5c2`。第六轮通过1483项领域、8个实际Source场景、369项新增与943项相关回归原生（合计1312）及FilmFlow、正式终局和四层旅程；当前2560×1440正常Standalone流程83图，实看21图。完整输入、失败历史、UI补验与依赖复用边界见[第六轮验收](../搜打撤/docs/evidence/2026-11-01-unity-parity-round6/README.md)。源码提交行尾统一为LF，工作区原字节与Git对象指纹分别记录；EXE为Unity启动壳，其哈希不能单独识别代码版本。

## 恢复资源

仓库保留正式C#、Shader、配置、数据、小图和导入`.meta`。大于1MB的导入副本、音频和字体由原料恢复；构建包、Library、bin/obj与构造存档属于本地产物。排除项和精确源SHA见[资源清单](_planning/github-sync-1101/resource-rebuild.json)。其中241项为当前资源，原料均已在同仓提供；67项退役旧资源没有运行调用或序列化GUID引用，不作恢复。

准备Python/Pillow、CairoSVG及可加载的原生Cairo库、NumPy、fontTools及WOFF2/Brotli支持、Node和ffmpeg。以Unity工程目录为当前目录，先作只读来源检查，再按现有专有导入入口恢复：

```powershell
python -B _planning/migration-1029/ui/sync_fonts.py --check-sources
python _planning/migration-1029/ui/sync_assets.py
python _planning/migration-1029/ui/sync_fonts.py
python _planning/migration-1029/current-node-rooms/export_assets.py --output Assets/Resources
python _planning/migration-1029/current-slot-achievement/sync_assets.py
python _planning/migration-1029/current-home/sync_home.py
python _planning/migration-1029/current-photo/sync_photo.py
python _planning/migration-1030-fidelity/shop/import_assets.py
```

保留现役资源的`.meta`；67份退役媒体的对应`.meta`仅从新分支导出清单省略，当前工作区及本地Unity旧文件不改。然后用Unity Hub打开该工程并恢复UPM依赖。各入口的来源、转换及副作用边界见[资源恢复说明](_planning/migration-1029/ui/README.md)。跨工具版本的转换输出不承诺字节完全相同；字体检查保留字形/度量验证，来源和输出收据分别记录。

## 运行与复验

正常入口为`Assets/Scenes/Bootstrap.unity`。编辑器中打开场景后进入Play；Windows独立包由`Sdt.Editor.BuildGame.BuildWin64`生成至`Build/Desktop/代号柒.exe`。运行时依赖通过正式Packages恢复，临时第三方DLL和历史编译输出不作为依赖入口。

七个领域项目为`_planning/parity-1031/battle-check/BattleChecks.csproj`、`_planning/parity-1031/run-check/RunParityChecks.csproj`、`_planning/parity-1031/HubParityChecks.csproj`、`_planning/parity-1101-round2/run-check/RunRound2Checks.csproj`、`_planning/parity-1101-round3/archive-check/ArchiveRound3Checks.csproj`、`_planning/parity-1101-round5/export-check/PhotoStudioExportChecks.csproj`及`_planning/parity-1101-round6/run-check/RunRound6Checks.csproj`。先由Unity恢复锁定的Newtonsoft包；除Archive外直接`dotnet run --project <项目>`，Archive项目依次传`-- export <全新输出目录>`、`-- import <同目录>`、`-- id-conflict <同目录>`和`-- name-conflict <同目录>`，四次为独立进程。

战斗领域检查先生成真实Vite来源向量并设置路径，再执行该项目；来源文件需要上述同仓布局：

```powershell
$discoverVectors = Join-Path $env:TEMP ('sdt-discover-source-' + [guid]::NewGuid().ToString('N') + '.json')
node _planning/parity-1101-round6/discover-source-oracle.mjs $discoverVectors
$env:SDT_DISCOVER_SOURCE_VECTORS = $discoverVectors
dotnet run --project _planning/parity-1031/battle-check/BattleChecks.csproj
```

新增原生入口为`Sdt.Editor.CurrentRound6Validation.Run`，既有回归为`CurrentRound5Validation.Run`、`CurrentRound4Validation.Run`、`CurrentRound3Validation.Run`、`CurrentRound2Validation.Run`、`CurrentParityValidation.Run`与`CurrentFilmFlowValidation.Run`（均在`Sdt.Editor`）。正式终局及四层旅程分别为`Sdt.Editor.CurrentMigrationFlowValidation.RunReceipts/RunJourney`。经`_planning/migration-1029/run_native_check.ps1 -Method <入口> -Output <全新绝对目录>`执行，驱动使用隔离profile；原生离屏诊断与正常当前窗口播放器分开记录。项目已有正式SFX混音器，无需重跑一次性生成器。

照相馆开发工具导出完整本机卡库，以及底稿/已存手写/会话暂存合并备注。格式和原生说明字段的有意差异见[导出契约](_planning/parity-1101-round5/export-contract.md)；源空制作、导入、删除和Agent入口不迁入。

范围沿[MIGRATION.md](MIGRATION.md)。原生音频压缩比10对应源WebAudio的12，是已记录的后端适配；未作逐样本声学、物理键鼠、多尺寸或FPS/内存收益声明。
