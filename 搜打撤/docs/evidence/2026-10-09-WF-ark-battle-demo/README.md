# 方舟战斗方向重做，首页恢复初版

老板要求《霜窗回声》改回初版，战斗整首重做为明日方舟战斗配乐方向。本轮新试听页直接引用最初游戏的标题曲和探索曲；商店保留之前认可相对更好的《灯下交易》初稿。正式音乐映射仍未修改。

## 参考与创作范围

从塞壬唱片官方歌曲API核对两首参考的元数据和官方录音入口：

- 《短兵相接》cid048744，专辑4527。
- 《Operation Spectrum Battle Theme》cid697658，专辑4522。

官方响应保存在 [official-references.json](official-references.json)；歌曲入口为 `https://monster-siren.hypergryph.com/music/048744` 与 `https://monster-siren.hypergryph.com/music/697658`。曲目用途/类型定位参考 Arknights Terra Wiki 的 Main Theme BGM 与 Operation Spectrum 页面。此次参考范围为公开曲目定位与氛围方向，不声称完成逐耳转录。

《冷线交锋》为本项目新写的工业电子作战候选。采用低频压力、短合成器信号、机械点音、碎拍与少量转折冲击；不使用此前吉他riff、弦乐、圆号，也未导入参考曲的录音或音符。

120 BPM、30秒：0–8秒低频与片段信号，8–16秒完整动机及节奏展开，16–20秒留白，20–30秒主题返回并落在主音。音色由确定性加法/FM/谐波合成和噪声滤波生成，无外部采样、软件安装或新服务。

## 定向数值反馈

沿用此前已经声明的检查方法。战斗内部响度目标-22至-18 LUFS，保留老板此前“不太吵”的约束；不是统一的商业游戏响度标准。

最终MP3：-20.83 LUFS、真峰值-7.04 dBTP、LRA4.6 LU。时长、削波、坏数值、意外空段、严格20–120Hz低频单声道及整体立体声相关性硬项通过，没有新增复核提示。详细读数见 [evaluation.json](evaluation.json)。数值不证明与方舟听感一致或达到商业成品品质，仍由老板试听。

## 交付

独立试听页 `/ark-battle-demo.html`：战斗新稿、霜窗回声初版、灰线行军初版、灯下交易保留版。标题与探索引用 `game/assets/music-demo/01-title-frostglass.ogg` / `02-explore-ashline.ogg` 的完整音频，没有重新渲染或覆盖。

复现新曲：在搜打撤运行 `python docs/evidence/2026-10-09-WF-ark-battle-demo/compose.py`。可编辑事件/段落见 [score.json](score.json)。本地 `battle-coldfront-30s.wav` / `.mp3` 二进制不进git，路径、字节数、SHA256以及保留音频的指纹见 [render-report.json](render-report.json)，获取方式为运行该脚本或直接引用已存在文件。

完成未提交；没有浏览器验收、正式游戏音频替换或提交。四首仍处于草稿试听阶段。
