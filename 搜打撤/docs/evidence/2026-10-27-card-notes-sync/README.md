# Edge卡牌备注同步

2026-10-27，按老板要求只读解析 Edge Default 的 Local Storage LevelDB。来源 http://127.0.0.1:5200，键 sdt-card-photo-notes-v1，最新序号1845066，共117条；localhost同键为空。未发现该来源的独立审阅页存储记录。

与现行永久底稿比较后逐字更新43条，其余248条不变，总计291条。保留老板长文和明确同文组。同步前底稿见 before-sync.json，提取原文见 edge-notes.json，逐条差异见 changes.json。历史原文检查以本轮老板改写为优先；新增全量合并及正式读取校验，确保未改条目完整保留。

定向 tests/card-notes-coverage.test.js 8项通过，无失败、跳过或异常；目标 git diff --check 通过。未改浏览器存储、审阅状态或静态页，未刷新正在编辑的页面；未做实页验收、整体构建、提交或推送，无新服务。
