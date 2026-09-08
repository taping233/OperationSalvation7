# Godot 存档边界

Godot 存档是 UTF-8 JSON，当前 schema `3`，共五个槽位。`SaveGameDto` 的 `version` 必须先经过 `SaveMigrations` 逐级迁移，再做范围和结构校验；未知附加字段会被忽略，缺失的新增字段由 DTO 默认值补齐。版本高于当前版本时拒绝读取，不会覆盖原文件。

每个槽位包含对局字段（`seed`、`rngState`/`rngStreams`、位置、生命、背包、卡牌、事件、骰子历史、体力等）和基地字段（资源、仓库/口袋、收藏、职业熟练度、统计、成就、卡背）。Web 导出的 `rngState` 命名随机流会保留在 `rngStreams`，单值随机状态进入 `rngState`。

## 文件与安全写入

`AtomicJsonSaveService` 默认创建五个槽位：`save_0.json` 至 `save_4.json`，并为已存在的主文件维护同名 `.bak`。写入顺序是同目录 `.tmp`、刷新到磁盘、Windows `File.Replace`（不可用时先复制 `.bak` 再替换主文件）。读取主文件解析失败、缺失或校验失败时回退 `.bak`；过新版本不会回退到旧备份，以免误载入旧进度。没有可用备份时，错误会继续抛出或由 `TryLoad` 返回 `false`。

服务 API 采用 0-based 槽位索引，以兼容 Godot/C# 数组；导入器把原版 `slot1..5` 映射为 `save_0..4`。

## 离线导入 Web/Electron 导出

先从游戏提供的导出功能得到一个独立 JSON 文件（键值对象、`localStorage`/`storage`/`values` 包装对象，或 `{key,value}` 数组均可），然后运行：

```text
node tools/import-localstorage.mjs --input C:\path\localstorage-export.json --output C:\path\godot-saves
```

工具只读取命令行明确指定的普通文件，不扫描或打开 Chrome/Electron 隐私目录；路径包含 `AppData`、`User Data`、`Local Storage` 或 `IndexedDB` 会拒绝。旧键 `sdt-save-v1`、`sdt-base-v1` 只在槽位 1 缺失时迁入槽位 1。输出目录还会写 `import-manifest.json`。

## 兼容边界

- 原版 `sdt-save-v2-slot1..5` 与 `sdt-base-v2-slot1..5` 独立合并；只有基地而没有进行中对局时输出 `runActive: false`。
- 坏 JSON、负资源/生命、重复卡牌实例、无效基地堆叠、非法模式等均拒绝；主文件损坏不静默覆盖，备份保留恢复机会。
- 导入器不读取浏览器数据库、Cookie、缓存或私有目录，也不尝试恢复未导出的键。
- 当前只转换存档数据，不保证把浏览器运行时对象、DOM 事件或未列入存档的设置迁移到 Godot。
