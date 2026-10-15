# 地图生命栏右移

2026-10-15，Friday（聊天01a13ff0）。老板要求生命往右一点；地图专属 #hpHud 的 margin-left 从6px调整为22px，右移16个CSS像素。

当前Codex内置浏览器、当前窗口、localhost:5200，真实点击进入档位03地图；生命35/35与血条显示正常，计算样式margin-left为22px。截图 map.png。未改窗口尺寸。git diff --check通过，CSS单行变化无需Vitest；未build、未提交。
