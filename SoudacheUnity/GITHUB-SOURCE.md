# GitHub 源码与本地验收

Unity运行使用的图片直接包含在`Assets/Resources/`，与导入`.meta`一起随工程交付，不需要另下载图片包或运行图片生成器。`搜打撤/game`保留为开发时的原料来源；需要维护或重建原料时，保留`SoudacheUnity/`与`搜打撤/`的同级布局。

2026-11-02本批按老板授权提交战斗与新卡源码，并将此前遗漏的189张现役大图片直接纳入工程；正式图片不再受1MB过滤限制。交付清单覆盖1389张正式图片及原`.meta`，原因见[编辑器缺图修复](../搜打撤/docs/evidence/2026-11-02-unity-missing-art/README.md)，提交与远端同步状态见[本批交付记录](../搜打撤/docs/evidence/2026-11-02-unity-source-art-push/README.md)。旧`e40115e9`/`b512cf4`不包含这些大图，不能继续作为完整图片版本分发。

工程和最近已验收桌面包使用Unity2022.3.62f3c1，buildGUID为`4d33ec981819461295052942d67afeee`。该基线的2690领域、8个实际Source场景、1629原生及转场/正式终局/四层旅程通过；2560×1440正常Standalone完成102图，实看23图。完整输入、失败与元数据迁移见[2022降级验收](../搜打撤/docs/evidence/2026-11-01-unity-2022-downgrade/README.md)。第六轮Unity6包的历史GUID为`c3ee3347a03149de80bbb7fe3f0bb5c2`，原收据留在[第六轮](../搜打撤/docs/evidence/2026-11-01-unity-parity-round6/README.md)。源码提交行尾统一为LF，工作区原字节与Git对象指纹分别记录；EXE为Unity启动壳，其哈希不能单独识别代码版本。

2026-11-01至11-02的[战斗与卡牌调整](../搜打撤/docs/evidence/2026-11-01-unity-battle-cards/README.md)已纳入本批源码交付，按老板要求未编译、测试或重打桌面包。上述旧基线结果不覆盖这些改动。

2026-11-02新增的[无职业新卡](../搜打撤/docs/evidence/2026-11-02-wu-class-cards/README.md)同样纳入本批源码交付，桌面包尚未重新构建。

## 图片与资源交付

正式C#、Shader、配置、数据、现行图片和导入`.meta`属于工程内容。大图片直接保留在原`Assets/Resources/`路径，图像像素、尺寸、GUID和现有加载路径不变。交付清单必须包含全部现役图片，缺少图片或`.meta`会拒绝生成清单；不在启动时增加下载、替代图片或自动恢复流程。构建包、Library、bin/obj与构造存档继续作为本地产物排除。

音频、字体和压缩包仍沿既有原料恢复边界。本次只修正图片排除规则。[旧资源清单](_planning/github-sync-1101/resource-rebuild.json)保留为2026-11-01历史证据，其中原先需要恢复的241项包括189张现役图片及52项音频/字体；新版图片已改为直接交付。67项退役旧媒体和对应`.meta`仍不进入交付清单，本机文件不删除。

以下命令用于开发者从原料重建资源，不是新版工程显示图片的前置步骤。准备Python/Pillow、CairoSVG及可加载的原生Cairo库、NumPy、fontTools及WOFF2/Brotli支持、Node和ffmpeg，以Unity工程目录为当前目录执行。工具会重新生成图片映射或描述，重建前须保留2026-11-01至11-02新增的Unity专属卡牌定义和映射：

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

保留现役资源的`.meta`，用Unity Hub打开工程并恢复UPM依赖。各开发入口的来源、转换及副作用边界见[资源恢复说明](_planning/migration-1029/ui/README.md)。跨工具版本的转换输出不承诺字节完全相同；字体检查保留字形/度量验证，来源和输出收据分别记录。

新批次统一使用`python -B _planning/github-sync-1101/export_manifest.py --output <本批清单绝对路径>`生成交付列表。复制工程时按新列表包含图片原文件和`.meta`，不能复用旧发布清单或旧批次临时复制脚本中的1MB全局过滤。该命令仅生成清单，不暂存、提交或推送。

## 运行与复验

正常入口为`Assets/Scenes/Bootstrap.unity`。编辑器中打开场景后进入Play；Windows独立包由`Sdt.Editor.BuildGame.BuildWin64`生成至`Build/Desktop/代号柒.exe`。运行时依赖通过正式Packages恢复，临时第三方DLL和历史编译输出不作为依赖入口。

八个领域项目为`_planning/parity-1031/battle-check/BattleChecks.csproj`、`_planning/parity-1031/HubParityChecks.csproj`、`_planning/parity-1031/run-check/RunParityChecks.csproj`、`_planning/parity-1101-round2/run-check/RunRound2Checks.csproj`、`_planning/parity-1101-round3/archive-check/ArchiveRound3Checks.csproj`、`_planning/parity-1101-round5/export-check/PhotoStudioExportChecks.csproj`、`_planning/parity-1101-round6/run-check/RunRound6Checks.csproj`、`_planning/parity-1101-round7/bag-check/BagRound7Checks.csproj`。先由Unity恢复锁定的Newtonsoft包；除Archive外直接`dotnet run --project <项目>`，Archive项目依次传`-- export <全新输出目录>`、`-- import <同目录>`、`-- id-conflict <同目录>`和`-- name-conflict <同目录>`，四次为独立进程。

战斗领域检查先生成真实Vite来源向量并设置路径，再执行该项目；来源文件需要上述同仓布局：

```powershell
$discoverVectors = Join-Path $env:TEMP ('sdt-discover-source-' + [guid]::NewGuid().ToString('N') + '.json')
node _planning/parity-1101-round6/discover-source-oracle.mjs $discoverVectors
$env:SDT_DISCOVER_SOURCE_VECTORS = $discoverVectors
dotnet run --project _planning/parity-1031/battle-check/BattleChecks.csproj
```

本批原生入口为`Sdt.Editor.CurrentRound7Validation.Run`；相关回归为`CurrentRound6Validation.Run`、`CurrentRound5Validation.Run`、`CurrentRound4Validation.Run`、`CurrentRound3Validation.Run`、`CurrentRound2Validation.Run`、`CurrentParityValidation.Run`与`CurrentFilmFlowValidation.Run`（均在`Sdt.Editor`）。正式终局及四层旅程为`Sdt.Editor.CurrentMigrationFlowValidation.RunReceipts/RunJourney`。经`_planning/migration-1029/run_native_check.ps1 -Method <入口> -Output <全新绝对目录>`执行；默认按工程版本使用系统安装目录，可显式传`-UnityEditor <Unity.exe>`。各驱动使用隔离profile，离屏诊断与正常当前窗口播放器分开记录。项目已有正式SFX混音器，无需重跑一次性生成器。

照相馆开发工具导出完整本机卡库，以及底稿/已存手写/会话暂存合并备注。格式和原生说明字段的有意差异见[导出契约](_planning/parity-1101-round5/export-contract.md)；源空制作、导入、删除和Agent入口不迁入。

范围沿[MIGRATION.md](MIGRATION.md)。原生音频压缩比10对应源WebAudio的12，是已记录的后端适配；未作逐样本声学、物理键鼠、多尺寸或FPS/内存收益声明。
