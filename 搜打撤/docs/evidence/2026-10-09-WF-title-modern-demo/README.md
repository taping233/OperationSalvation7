# 冰下信号 · 标题曲 30 秒候选

老板反馈现有配乐太古典、编曲简单，授权收集游戏 BGM 谱例并创作标题 demo。本轮完成一首 30 秒候选与独立试听页；听感由老板验收。

试听入口：运行现有 Vite 服务后打开 `/title-modern-demo.html`。页面提供播放、暂停、进度、音量和 MP3 下载。现有14首映射与音频没有改动。

## 谱例研究

收集6首 VGLeadSheets 公开转录谱的完整 PDF，视觉查看每首第一页：Celeste《Resurrections》、Undertale《Another Medium》、Persona 5《Layer Cake》、NieR:Automata《City Ruins - Rays of Light》、Minecraft《Pigstep》、Hades《Final Expense》。这些是社区转录谱，不是官方总谱；观察范围不等于完整作品分析。

源链接、下载状态、SHA256、观察与本曲采用的手法见 [references.json](references.json)。下载件保留在 `.tmp/title-modern-references-1009/`，不进入 git。Transistor 官方乐谱公告找到，但商店下载入口失效，未计入收集与分析。

本曲取固定音型与慢旋律分工、弱拍低音、近距离扩展和弦、分阶段加层、减鼓留白及低音转位等方法。旋律、和弦顺序和具体声部重新创作，无游戏原声采样，也未导入参考谱的音符序列。

## 编曲与产物

《冰下信号》为112 BPM、4/4拍、14小节，正好30秒。电钢与脉冲引子之后，约4.3秒进入合成器主题，约12.9秒减鼓，约17.1秒主题变奏及高音回答进入，最后收束。低音、鼓、电钢、延迟吉他、合成器铺底与短音型承担不同节奏/音域角色。

使用现有 GeneralUser-GS SoundFont/FluidSynth 渲染电钢和电吉他，其余音色由确定性合成生成。复现命令：`python docs/evidence/2026-10-09-WF-title-modern-demo/compose.py`，无需安装软件。原始声部事件和和弦见 [score.json](score.json)。

本地音频不进入 git；按项目二进制规则只登记路径和指纹。获取方式均为运行 compose.py：

| 路径（项目根相对） | SHA256 |
|---|---|
| docs/evidence/2026-10-09-WF-title-modern-demo/title-underice-signal-30s.wav | 0cc7b4d6c74659c5e8211134a381c88d5be1422bc0bebb04730e6573e5bd54a7 |
| docs/evidence/2026-10-09-WF-title-modern-demo/title-underice-signal-30s.mp3 | 78fb8377d672fda792232bbd79d3d279fe3de90a046da34dd7390c5a2c4f9dbf |

## 验证

渲染PCM为48kHz立体声，30.000秒；数值均有限、峰值约-1.31dBFS；逐秒RMS无意外空段。FFmpeg完整解码MP3通过，最大电平-1.3dBFS。详细电平与文件信息见 [render-report.json](render-report.json)。电平检查不代表听感评分。

Codex内置浏览器当前窗口：页面加载、真实点击播放成功；audio duration=30、currentTime=18.324537、paused=false、readyState=4、error=null。截图为 browser-preview.png。修复首次访问时相对音频路径落入SPA的问题，改用Vite模块资源URL；复验通过。未进行多窗口/多尺寸测试。

复用现有5200服务，没有新服务；只改本轮候选页面和证据。完成未提交，游戏正式标题曲未替换。
