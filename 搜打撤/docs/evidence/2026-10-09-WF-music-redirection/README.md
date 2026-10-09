# 方向重写、素材与量化自评

老板否定上一轮钢琴、探索和古典战斗风格，认可商店上一版相对更好；本轮重写前三首，商店直接引用《灯下交易》初稿。随后老板明确要求参考曲目、教程、标准和素材，并在完成后用可量化指标自评、决定返修。此次量化检查是新的授权，不扩展为游戏浏览器验收或正式BGM替换。

## 参考与材料

- 编曲教程：[Ableton · Arranging as a Subtractive Process](https://makingmusic.ableton.com/arranging-as-a-subtractive-process)。应用为明确的引入、退出、减法段与主题返回，不再向原混音持续叠加。
- 钢琴混音：[iZotope · How to mix piano](https://www.izotope.com/community/blog/how-to-mix-piano)。应用为钢琴与铺底的音域/频段分工、空间处理；未安装教程中的插件。
- 测量定义：[iZotope · What are LUFS?](https://www.izotope.com/community/blog/what-are-lufs)。使用FFmpeg的LUFS、真峰值及LRA读数；30秒片段的动态测量有局限，不以数值判定艺术质量。
- 战斗谱例：[Persona 5 · Last Surprise](https://www.vgleadsheets.com/assets/sheets/C/Persona%205%20-%20Last%20Surprise.pdf)。本轮下载并视觉查看第一页，参考切分、短riff、留白与较长旋律的配合，没有导入其音符或录音。路径与SHA见 [references.json](references.json)。
- ThinkSpace 的 Foundations of Making Music 公开课程简介作为方法索引，未注册或观看付费/注册课程，不将其计作已完成课程。

钢琴使用 **Salamander Grand Piano V3 — Alexander Holm，CC BY 3.0**，来自 [sfzinstruments 作者资料与映射仓库](https://github.com/sfzinstruments/SalamanderGrandPiano)。保留署名和[许可证](https://creativecommons.org/licenses/by/3.0/)。只下载本曲涉及的23个FLAC，共37,669,176字节到 `.tmp/salamander-title-1009/`；全部获取URL、路径、字节数与SHA256见 [piano-samples.json](piano-samples.json)。

使用自定义离线采样播放，按最近采样音高移调、选择力度层，加入按和声释放的延音和重复琴键释放。没有安装SFZ/ARIA播放器；此实现不复现原SFZ的全部共振、踏板和释放噪声功能。其他乐器复用现有GeneralUser-GS/FluidSynth，空气铺底与FM音色由确定性合成生成，无软件安装或全局配置改变。

## 音乐调整

| 曲目 | 本轮方向 |
|---|---|
| 首页 | 72 BPM，钢琴乐句和双手织体重新写；保留霜窗回声的主题音高倾向，换真实钢琴采样，加入分句时值、触键、滚奏和按和声释放的延音。铺底只作低层支撑，无鼓或重复电子脉冲。 |
| 探索 | 100 BPM，完全新写清音吉他主线、电钢景深、贝斯与轻节奏；引子、展开、减法段与返回构成30秒行旅。 |
| 战斗 | 128 BPM，完全新写鼓、贝斯、电吉他与FM键盘主线；不使用弦乐、圆号或木管，采用切分riff与节奏段落。 |
| 商店 | 原样使用 `docs/evidence/2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.mp3`，没有重渲染、增益修改或覆盖。 |

## 自评方法与返修

以下是**本项目草稿的内部目标**，不是统一的商业游戏音频规范，也不是“好听分数”：

| 指标 | 内部判定 |
|---|---|
| 时长 | 解码后30秒，容差0.05秒 |
| 削波/坏数据 | 削波样本为0，全部数值有限 |
| 最终MP3真峰值 | ≤ -1 dBTP，给有损编码留余量 |
| 响度 | 首页-22至-18、探索-20至-16、战斗-18至-14、商店-22至-17 LUFS |
| 意外空段 | 排除最初0.5秒和最后1秒后，不出现连续0.5秒RMS低于-45dBFS |
| 低频单声道兼容 | 严格20–120Hz FFT频带的Side/Mid RMS比≤0.15 |
| 立体声 | 整体左右相关性非负 |
| 钢琴可演奏性 | 每只手同时按住的音跨度≤12半音，琴键数≤5；不把踏板延音误作手指按键 |

LRA小于1.5 LU或峰均比小于7dB只触发复核提示，不强制改变音乐。段落声部与实际音频电平记录用于人工结构判断，不能证明旋律、音色、节奏或情绪合格。

第一次测量要求钢琴返修：结尾28.5–29秒提前变空；两处左手重叠换位出现超过一八度的同时跨度。修复为延长终止音、取消跨越换位的上声部、提前释放旧和弦，并按实际和声边界释放延音。

低频检查初版使用二阶低通加权，混入120Hz以上的能量。最终改为严格20–120Hz FFT频带并单列旧加权值；两种值不能直接比较。钢琴混音同时使用零相位Side高通收拢低频，避免原先相位交叉处理的误差。

初次读数见 [evaluation-before-piano-repair.json](evaluation-before-piano-repair.json)，最终原始测量、各判定及钢琴跨度见 [evaluation.json](evaluation.json)。复测结果：

| 曲目 | LUFS | 真峰值 dBTP | LRA LU | 20–120Hz Side/Mid | 制作判定 |
|---|---:|---:|---:|---:|---|
| 首页 | -20.38 | -4.36 | 9.7 | 0.00164 | 通过 |
| 探索 | -17.83 | -3.19 | 2.8 | 0.00596 | 通过 |
| 战斗 | -15.33 | -1.51 | 1.5 | 0.02199 | 通过 |
| 商店 | -18.07 | -5.38 | 2.6 | 0.00745 | 通过，原版不变 |

数值问题已返修，当前不追加技术返修。首页动态范围较大，战斗片段动态较小，需要老板试听确认是否符合场景；不为追求某个LRA值盲目压缩或加层。四首仍是草稿，不声称商业成品或人工听辨通过；完整无缝循环尚未制作。

## 产物与复现

在搜打撤运行 `python docs/evidence/2026-10-09-WF-music-redirection/compose.py` 生成前三首；末尾加 `title` 可只重渲染首页。运行 `python docs/evidence/2026-10-09-WF-music-redirection/evaluate.py` 复现自评，只有测得响度/真峰值超出内部范围才进行新曲增益修正，商店始终只读。

试听页面 `/music-redirection-demo.html` 提供四首音频和本轮数值。每首新曲事件及段落见 `*-score.json`；音频路径、字节数、SHA256和原样保留的商店引用见 [render-report.json](render-report.json)。全部音频/素材二进制本地保留不进git，获取方式分别为运行compose.py或piano-samples.json的URL。没有新服务、浏览器验收、正式音乐替换或提交。
