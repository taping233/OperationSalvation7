# 原创循环音乐 demo

2026-10-05，老板授权替换三首原有曲目并先交付三版 demo。

所有音色由正弦／谐波／FM／确定性噪声及包络、滤波合成，无外部采样、无原曲片段，无原曲旋律提取。乐句、和弦转位、鼓与贝斯编排由本会话程序生成。此说明记录实际制作方式，听感仍待老板验收。

复现：在 `搜打撤` 执行 `python docs/evidence/2026-10-05-WF-music-demos/render-demos.py`，依赖现有 numpy/scipy/soundfile 与 ffmpeg；程序同时生成试听 WAV 和运行 OGG。

| 文件 | 名称 | BPM | 秒数 |
|---|---|---:|---:|
| 01-title-frostglass.ogg | 霜窗回声 | 136 | 56.47 |
| 02-explore-ashline.ogg | 灰线行军 | 152 | 50.53 |
| 03-battle-blackpulse.ogg | 黑脉交锋 | 124 | 61.94 |

文件 SHA256、音量、帧数和循环端点数据见 `docs/evidence/2026-10-05-WF-music-demos/render-report.json`。
