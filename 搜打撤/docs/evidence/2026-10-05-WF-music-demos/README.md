# 三首原创循环音乐 demo · 2026-10-05

老板授权：替换原三首，保持相近风格与律动，先出标题／探索／战斗三版 demo，并先联网研究程序音乐方法。运行文件引用已替换；原三个 MP3 原样保留，无删除、无提交、无构建。

## 交付

| 场景 | 原曲 | demo | 编曲 | BPM／秒数 |
|---|---|---|---|---|
| 标题 | 离解复合 | 霜窗回声 | 半速鼓点、电钢琴、钟音、低沉铺底 | 136／56.47 |
| 探索及基地 | 直到大地变成一颗酸橙 | 灰线行军 | 切分贝斯、拨弦音序、鼓与金属打击 | 152／50.53 |
| 战斗 | 次生预案 | 黑脉交锋 | 低鼓、厚贝斯、短弦乐音序及旋律 | 124／61.94 |

三首均为 32 小节，A1／A2／过渡／A3 各八小节；所有音色由方程生成，没有外部采样、没有复制原曲音频或旋律。自动分析得到参考 BPM 136／152／123.05，存在半速／倍速歧义；音色方向来自频谱与场景，不代表已经人工试听或证实风格完全一致。

试听页：主线 `/music-demo.html`（WebAudio 循环试听）。游戏仍沿用已有音乐来源偏好；设置选择“原有曲目”即可听新三首，“冬境声景”仍保留。

## 研究依据

- [librosa 0.11 beat_track](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html)：使用起音强度、相关性与节拍跟踪估计律动；自动估计不能替代听感判断。
- [Gordon Reid / Sound On Sound，Practical Bass Drum Synthesis](https://www.soundonsound.com/techniques/practical-bass-drum-synthesis)：底鼓音高与振幅包络、滤波和短瞬态的可编程合成。本 demo 实现下滑音高的正弦低鼓与短噪声瞬态。
- 编曲判断：鼓／贝斯呼应、和声转位、音符力度和少量时序变化、段落增减；循环混响／延迟用环形卷积，将上一轮尾声保留到起点。以上为本会话实现选择，网页不保证生成音乐的审美质量。

搜索工具初次查询返回结果，后续连接失败；通过本机 HTTPS 取得上述两篇正文 HTTP200，记录于 research-fetch.json；第三篇 Audiokinetic 页面403，未作为制作依据。无安装、无全局配置修改。

## 复现和二进制登记

在 `搜打撤` 运行 `python docs/evidence/2026-10-05-WF-music-demos/analyze-reference.py` 分析原曲，运行 `render-demos.py` 生成三首。现有 Python 3.8、numpy 1.24.4、scipy 1.10.1、librosa 0.11、soundfile 0.13.1 与 ffmpeg；随机种子固定。首次资产登记用 register-assets.py；已登记后不盲重跑该脚本。

运行 OGG：`game/assets/music-demo/01-title-frostglass.ogg`、`02-explore-ashline.ogg`、`03-battle-blackpulse.ogg`。对应24位试听 WAV：本目录下同名 `.wav`，仅本地保留且由现有 ignore 排除。所有 OGG/WAV 的 SHA256 与生成方式见 render-report.json、render-demos.py；音频验收文件不进 Git。

## 验证与边界

render-report.json 记录三首48kHz立体声、解码帧数等于目标长度、PCM 无削波及端点幅度变化低于常规相邻采样变化99分位。该指标用于发现明显接缝，不证明听感优秀。正式听感、与原曲风格接近程度、长期疲劳程度待老板验收。

定向测试与当前窗口 Codex 内置浏览器记录见本目录后续 validation-summary.json、browser-check.json。全量／构建／远端CI不在本次 demo 验证范围；共享树其他会话改动不纳入本任务。最近工作基线由 validation-summary.json 记录。
