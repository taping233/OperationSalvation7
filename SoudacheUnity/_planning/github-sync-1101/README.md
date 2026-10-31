# GitHub 同步范围审计

新分支以父仓库安全完成提交后的 HEAD 为基底，保留 `SoudacheUnity/` 与 `搜打撤/game/` 的相邻布局。目标为 `OperationSalvation7` 的 `codex/unity-validated-20261101`；不推 Unity 本地旧历史，也不复用旧未验证快照的文件全集。

- `commit-candidates.json`：正式工程候选3617个，逐项SHA；政策排除Assets媒体308个、403,739,481字节，逐项SHA；28个旧已跟踪编译产物/日志列为不复制。规则采用大于1,000,000字节，音频、字体和压缩包单独排除。保留对应 `.meta` 供恢复GUID。
- `inventory.json` 是5.3MB本机审计中间物，不提交。其广义planning候选含私有编译副本、构造存档和历史中间结果，不能直接作为拷贝清单。
- 正式候选包括所有现行Assets文本/允许的小图、Packages与ProjectSettings；`_planning` 按资源恢复脚本、领域检查源与必要小收据选择，排除bin/obj、typecheck、compile-private、snapshot副本、构造profile和log。264张独立帧图均小于1MB，可进入源码快照。
- 当前Unity `.gitignore` 没有媒体和planning编译产物的完整屏蔽；`*.csproj` 又会忽略活动的领域检查工程。干净分支应保留选定的手写检查项目，避免整体复制或整体忽略planning目录。
- Hub/Run领域检查依赖先由Unity恢复锁定Newtonsoft包；Run检查还引用 `migration-1029/current-departure/Stubs.cs`。Unity编辑器版本由 `ProjectSettings/ProjectVersion.txt` 锁定为6000.6.7f1。

媒体来源与恢复边界见 `resource-rebuild.json`。恢复工具沿相邻Vite原料转换，需Python/Pillow、Node，字体另需fontTools，Opus转Vorbis需ffmpeg；现行小图已跟踪时无需重新生成全部图形。Harmony正式字体复制缺口由本轮最小工具修复补齐，Assets现行产物及收据保持冻结。

资源来源核对必须以父HEAD或本轮安全完成候选为准，不能把本机有文件当成克隆可取得。初核发现7张当前卡面源图相较父HEAD已变化，须随父仓本轮完成内容一起同步，才能重建当前Unity输出。完整映射、旧素材原料和剩余边界由资源审计JSON逐项列出。

旧记录 `搜打撤/docs/evidence/2026-10-31-unity-github-snapshot/snapshot.json` 对应9072文件、396媒体排除和 `73c145f` 未验证快照，且复制时两份Hub源发生变化；仅作历史追溯。Unity本地HEAD为 `0bdcb66`、无remote；已发现旧快照临时仓库的origin为正式OperationSalvation7，但其状态不能替代本轮已验证输入。

本审计未stage、commit、push或启动Unity。正式文件SHA冻结于读取时点；Root后续修改说明或忽略规则后须刷新最终快照指纹。实际原生复验与构建由Root统一执行，不能由本文件扩称已做干净克隆重建。
