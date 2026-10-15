# 《升格会的冬日猜想》先导 PV 交付记录

> 状态（2026-10-13 老板审片）：第一版被否决，仅作历史草稿，不作为最终 PV。原因是主角缺席、卡牌展示不足、误用退役图、画面与运镜缺少优秀 PV 的设计层次；重做任务见 `WF-teaser-pv-v2-1013`。

## 结论

第一版技术文件已经生成，但美术验收未通过。它是 36 秒、1920×1080、24 fps 的有声草稿；画面由 `pv/teaser-2026-10-13/render.py` 程序渲染，音轨由 `audio_mix.py` 编排，FFmpeg 运行 `edit.py` 合成。原分镜与复现步骤见 [制作方案](../../../pv/teaser-2026-10-13/plan.md)与[源文件入口](../../../pv/teaser-2026-10-13/README.md)。

## 产物与获取

| 产物 | 项目相对路径 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| 有声成片 | `pv/teaser-2026-10-13/output/teaser_pv_1080p24.mp4` | 17,543,009 | `801172c239ac631024fb1cddcb7a02e22237e261ecad4f822cb7ab6e037e3abb` |
| 无声视觉母版 | `pv/teaser-2026-10-13/output/visual_master_silent.mp4` | 16,393,677 | `a7936a8bf020060819ed4b12f14b51ebc6114b1312808aeb37d8406b356f3afb` |
| 音乐分轨 | `pv/teaser-2026-10-13/output/music_stem.wav` | 10,368,044 | `049acc4fbfe00d40fda6dd5211343a8bf0def62f41cefd024ea0674d11778560` |
| 音效分轨 | `pv/teaser-2026-10-13/output/sfx_stem.wav` | 10,368,044 | `79321a73567502c637b1b37458dd9721e867ee1e0d89b6e553ae2a6a8808e95d` |

这些大于 1 MB 的媒体文件在本地 `output/`，由该目录的 `.gitignore` 排除；不纳入 Git。可在 `搜打撤` 依次运行 `python pv/teaser-2026-10-13/render.py --mode master`、`python pv/teaser-2026-10-13/audio_mix.py`、`python pv/teaser-2026-10-13/edit.py` 重新取得。`output/manifest_master.json`、`audio_report.json`、`edit_report.json` 分别记录画面素材、声音素材和最终合成的指纹与参数。

## 核验

- FFprobe：成片 H.264 1920×1080 / 24 fps / 864 帧 / 36.000 秒；AAC 48 kHz 双声道。全片 `ffmpeg -xerror` 解码退出码 0。
- 最终成片八镜抽帧检查了主体、字幕和裁切；6.2 秒整备步骤字与 34.0 秒“先导影像”在修订后可读。抽帧合集见 [关键帧图](stills-contact.jpg)。
- 成片综合响度 −16.3 LUFS，真峰值 −2.3 dBFS；未检测到异常黑场或静音。未作人工听辨，主观音乐节奏可由老板看成片复核。
- 画面只读 `game/assets` 的现有素材；参考 PV 仅用于研究镜头节奏，不包含其视频或音频。配乐源自项目原创曲目，采样音效的 CC0 来源见 `game/assets/sfx/battle/SOURCES.md`。
- 本任务未修改游戏运行代码、素材或数据，未启动游戏服务，未提交或推送。
