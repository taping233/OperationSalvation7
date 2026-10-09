# 无：受击 Sprite

老板已认可本轮候选。动作是短促后仰卸力、稳住重心、回到待机，约 334 ms；3 个不同姿态放在 4 个帧槽，按 8 个约 24 fps 时间步播放，其中受击和稳住姿态有停留。

首帧 `hurt-00.png`、尾帧 `hurt-03.png` 直接复制已认可的待机初始 PNG，文件字节与像素完全相同；同为 768×512。中间两张姿态由内置 imagegen 生成，导出匹配待机的尺寸和脚底位置，源图与提示词在 `request.json`。

`index.html` 连播待机→受击→待机，可单次播放或分别查看首尾；`sprite.json` 是动作配置，`wu-hurt-sheet.webp` 是 2×2 透明帧图，PNG/WebP 独立帧也已导出。GIF 为深色背景观看副本。验证在 `validation.json`，复现运行 `python pack_sprite.py <原始帧图路径>`，使用已有 Pillow、NumPy、OpenCV。

未接入正式战斗、未提交。超过 1 MB 的源图/帧图仅留本地并由 `.gitignore` 排除，获取方式和 SHA256 见本轮证据收据。
