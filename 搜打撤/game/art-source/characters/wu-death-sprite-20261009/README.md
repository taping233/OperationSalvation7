# 无：死亡倒地 Sprite 候选

动作从认可待机开始，失去支撑、屈膝撑地、侧身落下，最后保持躺倒。8 个帧槽含 7 个不同姿态，按 21 个约 24 fps 时间步播放，共 875 ms。最后两个帧槽使用同一张倒地图片，`loop:false`、`holdLastFrame:true`；不会自动回到站立。

首帧 `death-00.png` 直接复制已认可的待机 `../wu-idle-sprite-20261009/v2/frames/idle-000.png`，文件字节与像素相同；全套同为 768×512。其余姿态由内置 imagegen 生成，保持相同比例、相机横向位置和地面基线，侧躺时保留完整人物与剑。

`index.html` 可单次死亡、待机→死亡、查看最后倒地帧与进度；`sprite.json` 是动作配置，`wu-death-sheet.webp` 是 4×2 透明帧图，独立 PNG/WebP 已导出。GIF/WebP 观看副本只播放一次并停留最后倒地图。提示词和源路径在 `request.json`，导出复现运行 `python pack_sprite.py <原始帧图路径>`，使用已有 Pillow、NumPy、OpenCV。

目前为候选，未接入正式战斗。超过 1 MB 的源图/帧图只留本地并由 `.gitignore` 排除，SHA256 与获取方式在本轮证据收据中。
