# 影潮交锋 · 战斗曲30秒新稿

老板要求结合傀影战斗曲1、水月战斗曲1，以本地编曲软件和网上编程/进阶教学重写。交付为原创30秒试听稿和可编辑LMMS工程，正式游戏映射未变。

## 配器与结构

128 BPM、4/4、16小节，PCM严格30秒。D小调中心，使用Dm、Bbmaj7、Gm与A7b9色彩；短弦乐动机、拨奏推进、切分合成贝斯、碎拍鼓组、电钢琴、少量闷音铜管和竖琴回答，共12轨。

| 时间 | 内容 |
|---|---|
| 0–3.75秒 | 拨奏、低音与电钢琴建立节拍，鼓组逐步进入 |
| 3.75–11.25秒 | 两小节小提琴动机及变体，中提琴回答 |
| 11.25–15秒 | 动机缩短、属和声与短过门推进 |
| 15–18.75秒 | 撤去主旋律，贝斯、鼓组和拨奏减密度，电钢琴接续 |
| 18.75–26.25秒 | 主题返回，后半句提高音区，铜管作简短回答 |
| 26.25–30秒 | A7到Dm收束，最后350ms淡出 |

傀影与水月是风格方向参考；本版将管弦动机与电子碎拍组合。对两份本地参考录音的前60秒做了频带能量及起音自相关分析，结果在[参考与音源检查](reference-and-instrument-check.json)。两份录音均以低频与中低频能量为主；起音算法给出多个速度候选，不能据此认定准确BPM或完成逐耳转录。本版128 BPM属于创作选择。参考录音没有导入工程、切片或用于采样；旋律及节奏音符为本轮新写。

## 教学来源及实际应用

| 来源 | 本版应用 |
|---|---|
| [LMMS Creating a Track](https://docs.lmms.io/user-manual/production/creating-a-track) | 原生分轨、Piano Roll音符、Song Editor片段，保留完整可编辑工程 |
| [LMMS Exporting](https://docs.lmms.io/user-manual/production/exporting) | 实际调用安装的LMMS render，48kHz浮点、sinc-best、2倍过采样 |
| [Ableton Basslines](https://learningmusic.ableton.com/make-basslines/make-basslines.html) | 贝斯明确根音，并与底鼓形成错位和呼应，句末短音与八度变化 |
| [Ableton Song Structure](https://learningmusic.ableton.com/song-structure/song-structure.html) | 片段组合成进入、陈述、推进、收束和返回，避免整段只重复同一循环 |
| [Ableton Advanced Voicings](https://learningmusic.ableton.com/advanced-topics/voicings.html) | 和声内声保留共同音，低音与主题分开音区，用七和弦与属和弦色彩 |
| [Open Music Theory: The Sentence](https://openmusictheory.github.io/sentence.html) | 两小节基本动机、变化重复、缩短发展与终止；本曲不是严格古典句式分析 |
| [Sound On Sound: Faking A String Section In Your DAW](https://www.soundonsound.com/techniques/faking-string-section-your-daw) | 检索摘要提示音区、音符编程和声部区别；本版分配小提琴/中提琴/大提琴角色及不同力度。正文403，仅将摘要用作方向，不声称完整研读 |
| [Sound On Sound: Recording Bass Instruments](https://www.soundonsound.com/techniques/recording-bass-instruments) | 检索摘要提示底鼓与长低音叠加可能浑浊；本版低音缩短，140Hz以下侧声道高通。正文403，未将其写成全篇教学结论 |

编程采用已有LMMS工程生成接口，确定性随机种子20261012；和声、主题、配器和段落分别声明，音符先导出[score.json](score.json)，再写原生工程。力度微变化及约11ms以内时序变化用于避免全轨机械同拍；不会以随机音符替代主题写作。

## 本地软件与产物

- LMMS 1.2.2：`.tmp/music-workstation/LMMS/lmms.exe`，复用现有安装。
- 音源：`.tmp/music-workstation/GeneralUser-GS.sf2`，复用既有音源；许可见[原音源许可](../2026-10-05-WF-music-daw/soundfont-license.txt)。本轮没有安装软件、下载音源或修改全局配置。
- 原生工程：`battle-shadowtide-30s.mmp`；试听：`battle-shadowtide-30s.mp3`；24位48kHz立体声：`battle-shadowtide-30s.wav`。
- 原生中间录音：`battle-shadowtide-30s-native.wav`；12轨发声探针在`instrument-probes/`。
- 复现：在搜打撤运行`python docs/evidence/2026-10-12-WF-battle-rewrite-demo/compose.py`。工程依赖现有SoundFont和既有compose-lmms.py接口；项目局部配置`lmms-local.xml`，不改旧工作站文件。

音频二进制仅本地保留，不进Git；原生录音、WAV、MP3和工程的字节数/SHA256/获取方式见[渲染报告](render-report.json)及[生成脚本](compose.py)。参考录音路径与指纹见参考检查，以及[上一轮下载记录](../2026-10-12-WF-roguelike-bgm-reference/sources.json)。

## 验证与收官

LMMS原生进程退出码0；WAV严格30.000秒，MP3完整解码通过。MP3测得−19.5 LUFS、真峰值−5.3 dBTP、LRA2.5 LU；PCM有限值、无削波、内部无意外半秒空段。响度目标沿老板之前“不要太吵”的反馈，数值不代表听感验收。

LMMS/FluidSynth启动日志出现No preset与sfont_unref警告。额外以12个独立原生工程逐轨渲染，每轨均产生有效音频，见参考与音源检查；没有把仅总混音非静音当成12轨全部正常的证据。探针第一次使用LMMS不支持的24kHz而失败，已改成48kHz后12/12通过。

所有原生渲染与探针进程已结束；没有新服务、游戏实装、构建或提交。听感与两首参考融合程度待老板试听。编辑释放，完成未提交。
