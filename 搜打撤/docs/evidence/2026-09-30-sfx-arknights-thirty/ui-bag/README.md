# 方舟 A2 扩展：界面、卡牌与奖励十项

Friday / Codex 子代理；2026-09-30；工作区 HEAD `fd38468`。老板认可 A2 后追加三十项，本片只写本目录和 `game/assets/sfx/alternatives/arknights-expansion/ui-bag/`。完成未提交，音频冻结交主代理汇总和内置浏览器复核。共享登记、服务和试听页由主代理维护；本片没有开服务、浏览器、build、提交或安装依赖。

## 来源与对应动作

| ID | 本项目候选用途 | 实际源文件 | 调版秒数 |
| --- | --- | --- | --- |
| cardSelect | 选卡 | battle/b_ui/b_ui_mark.wav | 0.704792 |
| draw | 抽牌 | avg/d_avg_paper1.wav | 1.025833 |
| discard | 弃牌 | avg/d_avg_paper2.wav | 0.874313 |
| pick | 物品拿起 | avg/d_avg_clothmovement.wav | 1.018229 |
| coin | 金币 | avg/d_avg_coin.wav | 0.616688 |
| reveal | 奖励揭晓 | battle/b_ui/b_ui_getcast.wav | 0.388437 |
| legend | 高稀有奖励 | battle/b_ui/b_ui_star.wav | 0.297271 |
| victory | 战斗胜利 | battle/b_ui/b_ui_win.wav | 1.822167 |
| defeat | 战斗失败 | battle/b_ui/b_ui_lose.wav | 1.865521 |
| flee | 逃离 | battle/b_char/b_char_escape.wav | 0.836958 |

十项各用一个不同源文件，未复用此前十项的整段素材。卡牌采用两段不同纸页动作；拿起采用布料挪动素材。这些用途属于候选映射，文件名和目录已核对，原游戏实际触发时点、声音适配感和人工试听未核验。没有使用对白、长 BGM 或合成层。

源仓库为 [PseudoMon/arknights-audio](https://github.com/PseudoMon/arknights-audio)，分支 `global-server-voices`。[上游 README](https://raw.githubusercontent.com/PseudoMon/arknights-audio/global-server-voices/README.md) 说明其收录游戏音频，部分目录沿自 Aceship，主要持续更新语音，并注明教育用途。这里保留原音频主体，是方舟素材衍生试听候选；不声称原创、官方音效库或已取得本项目使用/分发授权。

`upstream-inventory.json` 保存 avg、battle/b_ui、battle/b_char 三个目录的完整 GitHub contents 响应，仅用于选择与核对，不是整库音频下载。`sources/` 只下载本片明确选定的十个文件，字节数和 Git blob SHA-1 均与响应核对。逐项原 URL、Git blob SHA、SHA-256、源长度及参数见 `sources-parameters-checks.json`。

## A2 处理与技术验证

使用主代理已有 `../process_common.py`，本片的可复现入口为 `generate.py`，未执行上游代码。每项生成一个 `*-base.ogg` 原声基底和一个同 ID 的轻调版。基底仅按活动阈值去除首尾静音、25 Hz 一阶高通、17.5 kHz 一阶低通、首尾小淡化，并把采样峰值定到 -11 dBFS；其原声主体保留。

轻调版独立音高 -0.2 至 -0.5 半音，tempo 1.02–1.06；RubberBand 保持声道同步，5.6 kHz 分离出的高频分量轻收 -0.5 至 -0.7 dB，末尾 35–55 ms 小幅收尾和末端淡出，再统一采样峰值。准确逐项参数、活动裁切起止与 FFmpeg filter 原文见 JSON。没有添加新混响或合成声音。

20 个 OGG 均完整解码通过，48 kHz 双声道、有限数值检查通过；解码采样峰值 < 0.9、4 倍重采样真峰值 < 0.95。`cues.json` 的十个唯一 ID、独立源 URL、文件路径及两版时长已核对，`frozen-assets.json` 固定最终 OGG 的 SHA-256 供汇总复核。`processed/` 保留处理用 PCM_24 WAV，不接游戏调用。

技术检查不等于听感验收；主代理仍需完成三十项清单汇总与当前内置浏览器试听页复核，老板的人工试听决定适配。原游戏触发、许可授权均未核验。
