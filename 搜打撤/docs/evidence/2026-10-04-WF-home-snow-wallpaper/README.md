# 主页雪景壁纸替换

2026-10-04，Friday（Codex），WF-home-snow-wallpaper。基线 HEAD：425d03920e。老板明确指定把本聊天最后生成的雪景直马尾图替换当前主页壁纸。

- 仅同名替换 `game/assets/reconstruction/wallpaper-wu-1004.webp`；CSS、HTML、菜单排版与原有裁切设置未修改。
- 原始生成图：`.tmp/imagegen/home-snow-wallpaper-20261004/source.png`，1672×941；SHA256 `a747401243bc801a9c8eccdfaae0a9677fe47410d0274a7c656ca12cbd606ad8`。由本聊天内置 ImageGen 编辑得到，参考由老板提供；大 PNG 仅留本地、不进 Git。
- 编码：现有 ffmpeg，libwebp，quality 90、compression_level 6，不缩放；运行图片 299938 bytes，SHA256 `798b4996f4f923bd3ffac456f46e540a6e19189c396a5fb0953d562363c16db6`。
- 替换前图片保留在本目录 `before-wallpaper.webp`，未经编辑。素材清单仅新增当前壁纸条目并对应增加 count。
- Codex 内置浏览器新建验证标签访问 `http://127.0.0.1:5200/`，使用当前窗口 1280×720，目视确认雪景壁纸、人物、菜单与边栏在位；没有点击游戏入口或更改视口。截图 `home-snow-current-window.png`。
- 5200 为已有服务（当次监听 PID15108），本会话未启动、停止或重启。当前增量未提交、未推送；远端/CI、其他尺寸与完整功能流程未核，不运行 build。
- 台账工具受现行「近期已释放」纯文本格式阻塞（缺少表头分隔行），本会话仅用定向补丁登记与销账，未改流程工具或其他会话记录。
- 验证：ffmpeg 解码通过，清单当前壁纸 bytes/SHA256 与 count 通过（`asset-check.json`），目标 diff 格式检查通过；浏览器只读确认实际 CSS 指向同名新图，console error 0。全库资产门返回 334 项范围外错误及 831 项历史警告，未记全库通过、未修他人素材。
