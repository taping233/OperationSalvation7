# 原创全套音效合成与 A/B 试听页（WF-sfx-original-1027）

## 结论

老板要求更新游戏音效且不用仓库旧素材（含 `.sfx-work/arknights-runtime` 方舟系候选）。本轮 46 个发声配置全部用 Python（numpy）从零合成原创候选，零第三方音频输入、无版权风险；106 个触发场景中 95 个获得新候选，11 项沿用此前「已取消音效」决定保持静音。运行映射 `sound.samples.catalog.js` 未改，等老板试听勾选后再接入。

## 产物

- 合成脚本：`.sfx-work/synth-1027/make.py`（确定性种子，可复现；本目录留 `make.py.txt` 副本）
- 新音频：`game/assets/sfx/original-full-1027/`（46 个 WAV，44.1kHz 单声道 16bit，共约 1.6MB；音频不进 Git，逐项 SHA256/时长/峰值/RMS 见 `manifest.json`）
- 试听页：`game/sfx-lab-1027.html` + `game/src/audio/sfx-lab-1027.js` + `game/css/sfx-lab-1027.css` + `game/src/audio/sfx-lab-1027.candidates.js`（由脚本从运行映射生成事件→候选对照）
- 页面逐项提供「现行 / 新候选」A/B 播放（相同事件增益与变速参数），勾选「采用新音效」存 localStorage `sdt-sfx-lab-1027`，可复制采用清单；11 项静音场景标注「已取消音效」不提供候选。

## 验证（2026-10-27，内置浏览器，5200 端口复用他会话服务）

- 页面加载完整：106 场景、95 候选、11 静音，分组渲染正常。
- 音频直读 HTTP 200（click.wav 6218B / bossReveal.wav 88244B / defeat.wav 97064B）。
- 真实点击「新候选」→ 状态栏显示「正在播放 新候选：按钮点击」，无播放失败回退。
- 勾选「采用新音效」→ 底栏「已采用 1 项新音效」；导出弹窗清单文本正确；验证后已还原勾选状态。
- 未运行测试/lint/build；听感由老板实听定夺。

## 后续

老板在试听页勾选并回传清单后，按清单改 `sound.samples.catalog.js` 指向 `original-full-1027` 文件并同步 asset-manifest、docs/audio-system.md；不满意的项可调整合成参数重出。
