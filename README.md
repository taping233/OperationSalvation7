# 代号柒工作区

当前游戏来源是 `搜打撤/` 下的 Vite 网页版；已授权实施 Windows Unity 桌面移植，沿用现行玩法、内容与视觉。Godot 与旧桌面 EXE 线保持冻结，开发与协作边界见 [AGENTS.md](AGENTS.md)。

| 目录 | 用途 |
|---|---|
| `搜打撤/` | Vite 游戏源码、测试、文档；桌面外壳保留但冻结 |
| `SoudacheUnity/` | Windows Unity 桌面移植；GitHub 源码与资源恢复入口见下方分支 |
| `SoudacheGodot/` | 冻结的迁移工程与历史资源 |
| `图片/` | 原始图片与分类源素材，不直接作为游戏运行目录 |
| `图片成果/` | 海报、预览图、应用图标候选和历史版本 |
| `工具/` | 独立美术处理工具，不参与游戏构建 |

游戏与启动说明见 [项目 README](搜打撤/README.md)，开发入口见 [QUICKSTART](搜打撤/docs/QUICKSTART.md)，按任务查资料见 [文档导航](搜打撤/docs/README.md)。生成目录和依赖缓存按项目忽略规则保存。

Unity 源码单独同步至 [codex/unity-validated-20261101](https://github.com/taping233/OperationSalvation7/tree/codex/unity-validated-20261101/SoudacheUnity)，与同仓 `搜打撤/game/` 保持同级布局。大媒体导入副本与本地构建包通过该分支的 `GITHUB-SOURCE.md` 说明恢复；本轮范围与输入证据见 [验收记录](搜打撤/docs/evidence/2026-11-01-github-sync/README.md)。
