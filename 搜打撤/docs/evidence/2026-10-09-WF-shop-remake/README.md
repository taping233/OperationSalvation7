# 商店重做与四首配乐结构自评

老板要求按商业游戏BGM标准分析四首不足，并授权商店完全重做，参考明日方舟肉鸽商店曲。其他三首本轮只分析，不修改。沿用此前“不要验证，直接给我听”的要求，本轮没有浏览器验收或测试循环。

## 结构判断

四首仍是草稿。上轮保留原混音再叠加五个新声部，无法重新分配原声部的动态、音域与频段。以下判断来自实际谱面、声部事件及音频数据，不声称完成了人工逐耳音色评审。

| 曲目 | 不足 | 后续修改方向 |
|---|---|---|
| 首页 | 暗流主要来自连续中低声部叠加；和弦音模板多，悬留与解决少 | 保留钢琴；重写低层走向，删掉多余持续声部 |
| 探索 | 吉他与木管回应按和弦模板生成，缺少有方向的短句；音色增多没有形成明确的段落关系 | 一个伴奏动机，围绕它写回答、退出与返回 |
| 战斗 | 拨弦、吉他、定音鼓和鼓组同时增加重音，节奏中心分散 | 保留一套主节奏，反击层只在转折出现 |
| 商店 | 原单簧管/羽管键琴/拨弦与新增马林巴/吉他/低音一起活动，短音密集；五拍市集设计不适合本轮神秘交易目标 | 全新四拍小编制，短动机与铜管轮流主导 |

共同缺口：通用SoundFont、固定力度与简单混响限制了演奏法和音色精修；没有完整交付无缝循环。商业成品还需要完整段落、循环和与游戏音效的空间分配。电平对齐不是音质或编曲质量证明。

## 参考

官方API `https://monster-siren.hypergryph.com/api/song/880369` 返回《商人坎诺特》、专辑cid1034、塞壬唱片-MSR及官方录音sourceUrl，元数据保存在 reference-official-song.json。肉鸽Rogue Trader用途由 Arknights Terra Wiki 的 Integrated Strategies BGM 列表支持。

参考录音通过官方sourceUrl下载到 `.tmp/shop-reference-1009/cannot-the-trader.mp3`，仅用于本地分析，不进入git或新曲。前30秒相同FFmpeg loudnorm分析：官方参考约-10 LUFS，上一轮四首约-18至-19 LUFS，原始数据见 audio-comparison.json。整体电平差异不等于质量差异，不把响度作为商用品质分数。

## 新候选《灯下交易》

96 BPM、4/4、12小节、30秒。钢琴建立短动机，10–20秒由弱音铜管接主线，20–30秒主题变奏返回。爵士吉他短和弦、原声低音与轻刷鼓提供节奏；颤音琴只点缀句尾。旋律、和弦与编排全部新写，没有导入旧商店混音、参考录音或参考曲音符。

复现：`python docs/evidence/2026-10-09-WF-shop-remake/compose.py`。事件和和弦见 score.json，渲染信息见 render-report.json；试听页面 `/shop-remake-demo.html`。使用现有FluidSynth/GeneralUser-GS和确定性刷鼓合成。未替换正式BGM，未创建服务或提交。

渲染已完成；音色与风格听感待老板试听。以下本地音频不进git，获取方式为运行compose.py：

| 项目根相对路径 | SHA256 |
|---|---|
| docs/evidence/2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.wav | 480b3e702ac9fd21cfba3a59530cf80d3c342e04c7e4b581b166f0ed6938582e |
| docs/evidence/2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.mp3 | 79cee76063c653131567ca7c94d3b5830f3a03fa441854ddbdedc76366fd3ce3 |
