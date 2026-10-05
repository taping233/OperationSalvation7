# 桌面编曲软件第二轮试听 · 2026-10-05

老板反馈首轮“还可以，但不够好”，明确授权下载电脑编曲软件、参考指南和作品、接入软件后生成试听。此次交付是第二轮候选音频及可编辑原生工程；没有把候选曲再覆盖游戏中的首轮 demo，没有删除、提交、构建或修改全局 Codex 配置。

## 已接通的软件与音源

LMMS 1.2.2 Windows x64，官方 GitHub 发行包，实际安装在 `.tmp/music-workstation/LMMS/`。本会话调用它的原生 `render` 命令打开新建 `.mmp` 工程并渲染，不是给上一轮自制合成器加软件名称。钢琴连接测试已得到48kHz立体声、288000帧、非静音输出。安装包来源、字节数、SHA256和安装目录见 software-install.json；工作目录独立 `friday-lmmsrc.xml`，命令显式 `-c`，不改用户全局音频偏好。

采样音源为作者仓库 [GeneralUser GS](https://github.com/mrbumpy409/GeneralUser-GS)，通过 LMMS 内置 sf2player／FluidSynth 播放。包括钢琴、电钢琴、弦乐、合成贝斯、圆号及鼓组。作者现行许可允许个人和商业音乐录音，源文件及许可分别由 soundfont-download.json、soundfont-license.txt 记录；作者也在许可正文中说明部分早期采样来源追溯的局限，本文不将其改写为“全部样本来源已独立核实”。此处交付渲染录音，不把 SoundFont 打入游戏包。

## 参考资料与作品

- [LMMS 创建音轨](https://docs.lmms.io/user-manual/production/creating-a-track)：将节奏与旋律分轨，用重复片段组织整体。
- [第一首曲子的指南](https://docs.lmms.io/user-manual/production/your-first-song)：预设音色、钢琴卷帘、音符长度和力度；本轮使用分轨音符、短句留白和声部响应。
- [LMMS 导出指南](https://docs.lmms.io/user-manual/production/exporting)：本轮实际用48kHz、32位浮点中间音频、sinc-best和2倍过采样。指南中的老版本技术表述不作为现代编码质量的定量保证。
- 已读取官方安装包附带 `unfa-Spoken`、Greippi《Krem Kaakkuja (Second Flight Remix)》与 Skiessi《TurningPoint》的原生工程。参考分层与自动化、鼓组片段增减、贝斯和旋律响应；没有复制这些工程的音符、旋律或成品音频。结构摘要和原文件SHA256见 reference-*.json。

## 第二轮编曲

| 曲目 | 速度／长度 | 声部及变化 |
|---|---|---|
| 霜窗回声 v2 | 136 BPM／56.47秒 | 6轨：钢琴主旋律与分解和弦、暖垫、低弦乐、闷音贝斯、玻璃钟音响应、轻鼓；Cm→Abmaj7→Fm9→G7，半速律动，中段旋律降八度 |
| 灰线行军 v2 | 152 BPM／50.53秒 | 6轨：电钢琴主题、切分拨弦、暖垫、合成贝斯、弦乐响应、电子鼓；鼓贝斯错位呼应，中段减密度，末段加细分踩镲 |
| 黑脉交锋 v2 | 124 BPM／61.94秒 | 8轨：拨奏推进、弦乐主题、圆号回答、低弦乐、合成贝斯、太鼓、鼓组及低增益电子叠层；Em→C→D→B7，中段收束，末段重新展开 |

均为32小节，两个周期通过原生引擎渲染，取第二周期承接混响尾音；最后仅做28Hz高通、恒定增益与端点微修，再导出24位WAV、256kbps MP3和OGG。听感和相对首轮的改善仍由老板试听判断，数值验证不等同审美验收。

## 文件和复现

本目录三个 `*-v2.mmp` 为原生可编辑工程，字体／样本依赖保留在 `.tmp/music-workstation/GeneralUser-GS.sf2`。本目录同名 `.wav`／`.mp3`／`.ogg` 为试听文件，只在本地保存，现有 evidence 媒体 ignore 排除。原生浮点中间文件在 `.tmp/music-workstation/renders/`，安装包、SoundFont、原音频均保留，没有清理。

从 `搜打撤` 执行 `python docs/evidence/2026-10-05-WF-music-daw/compose-lmms.py` 可重建。项目同字节且 SoundFont 未更新时可复用本次原生中间音频；各音频与工程的字节数、SHA256、声部、导出参数、峰值和RMS见 daw-render-report.json；检查结果见 validation-summary.json。HEAD／远端差异以该检查记录为准，未运行游戏全量／build／远端CI，本次未改玩家运行代码。
