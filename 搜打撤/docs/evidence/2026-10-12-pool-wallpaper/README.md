# 人物招式单区与新春旗袍接入

2026-10-12，Friday / Codex。

人物招式页改为单区卡牌目录，保留人物切换、筛选和分页；每页一行卡牌，无上下滚动，点击直接进入共用卡牌放大页。原右侧卡牌详情不再渲染。

老板确认采用无的新春旗袍横图。运行引用切到 wu-spring-v15.webp，原图保留；来源、尺寸与 SHA256 见 [asset.json](asset.json)。原 PNG 位于用户 generated_images，本地 >1MB 文件不进 Git。

老板后续明确不验证。此前已完成 JS 语法与 CSS 解析；中间页面显示隐藏属性被旧 CSS 覆盖，最终改为不渲染右侧区域。最终改动未做测试或实页验证，无 build、提交。

游戏留言改由本地 Python 只读解析 Chromium LevelDB WAL/SST，精确选择 http://127.0.0.1:5200 的 sdt-suggestions-v1。2026-10-12本轮读取27条、5条待处理，最高序号11241，最近保存留言16:54旧BGM；没有读到更多已持久化留言。未修改或标记完成。脚本位于用户 .codex/memories/read_game_feedback.py；偏好已写入 MEMORY.md 与 memory_summary.md。
