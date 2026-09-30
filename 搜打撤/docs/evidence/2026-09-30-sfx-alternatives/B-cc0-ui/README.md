# B：冷感界面与工业动作样音

2026-09-30 交付十个 OGG 与 `game/assets/sfx/alternatives/cc0-ui/library.json`。全部文件为 48 kHz 双声道 Vorbis，未接入正式游戏、未提交。样音现已冻结，供老板在三套对比页试听后选用。

界面主声只用两个既有 UI SFX 文件；卡牌、战斗、状态、事件和奖励使用独立的现成动作素材。没有执行上游代码、安装依赖、调用上游合成配方或自行用噪声模板生成素材。UI SFX 官方说明这些库存音频来自程序合成；Kenney 包的完整制作方法未逐项核实，因此不将其统一称为人工录音。

## 来源与许可

- [UI SFX 官方仓库](https://github.com/romainsimon/uisfx)：固定提交 `9950fe66f993a6660dab9c2651dcbcd899ffd83b`，取 `packages/uisfx/sounds/mechanical/press.ogg` 与 `studio/check.ogg`。[官方 LICENSE-AUDIO](https://github.com/romainsimon/uisfx/blob/9950fe66f993a6660dab9c2651dcbcd899ffd83b/LICENSE-AUDIO) 明确该目录音频适用 CC0-1.0；代码的 MIT 许可没有替代音频许可。原文保存为 `UI-SFX-LICENSE-AUDIO.txt`。
- Kenney 官方 [Impact Sounds](https://kenney.nl/assets/impact-sounds)、[RPG Audio](https://kenney.nl/assets/rpg-audio)、[Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds)、[Casino Audio](https://kenney.nl/assets/casino-audio) 页面均标示 Creative Commons CC0。另保留每个下载包实际随附的 `License.txt`，分别保存为 `*-License.txt`；许可没有仅凭“免费下载”推断。
- 每包下载地址、ZIP 内部路径、来源文件 SHA-256 和许可文件对应关系见 `source-files.json`。所有选用原音保留在 `sources/`。ZIP 在内存中读取，未落盘整个音频库，也未保存其图片、链接快捷方式或其他非音频内容。

## 十个用途与原始素材

| ID | 主素材 | 必要小层 | 最终时长 / 解码峰值 |
| --- | --- | --- | --- |
| click | UI SFX mechanical/press | 无 | 0.118 s / -13.95 dBFS |
| confirm | UI SFX studio/check | 无 | 0.216 s / -11.96 dBFS |
| card | Casino card-slide-4 | card-place-2，延后 310 ms，层间低 7 dB | 0.720 s / -10.05 dBFS |
| attackSlash | RPG knifeSlice2 | Impact impactPunch_medium_002，延后 160 ms，层间低 7 dB | 0.550 s / -9.24 dBFS |
| parry | Impact impactMetal_medium_002 | 无 | 0.119 s / -8.91 dBFS |
| shieldBreak | Sci-fi explosionCrunch_003 | Impact impactGlass_heavy_003，延后 18 ms，层间低 4 dB | 1.250 s / -9.07 dBFS |
| heal | Sci-fi forceField_003 | 无 | 0.800 s / -9.84 dBFS |
| eventEnter | Sci-fi doorOpen_001 | 无 | 0.529 s / -9.55 dBFS |
| chestBurst | RPG metalLatch | RPG handleCoins2，延后 130 ms，层间低 2 dB | 0.468 s / -9.93 dBFS |
| bossReveal | Sci-fi lowFrequency_explosion_001 | 无 | 1.000 s / -9.01 dBFS |

表中动作名是设计用途，音色与用途是否合适由试听决定；没有将文件名当成人工听感验收。治疗选用充能/能量场语汇，首领选用低频爆发语汇。

## 处理与验证

`process_audio.py` 只读选中的库存音频，按源采样率转换到 48 kHz；单声道复制到双声道，原立体声保留。裁切采用源峰值相对 -50.46 dB 的活动阈值，保留 3 ms 起音余量与通常 35 ms 尾部余量；首领尾部余量为 120 ms，破盾主体上限为 1.25 s。统一使用 28 Hz 二阶高通去除 DC 与不可闻低频，2 ms 起音淡入、18 ms 尾音淡出。未做移调、时间拉伸、失真、音乐性音阶生成或大幅滤波。

各层先按表中相对电平组合，成品再配平到比较用的峰值：点击 -14、确认 -12、卡牌/恢复/事件/开箱 -10、斩击/格挡/破盾/首领 -9 dBFS。编码使用 `libvorbis -q:a 6 -ar 48000 -ac 2`。Vorbis 重构后的峰值与目标存在小幅差异，表中列实际解码值。

技术验证见 `processing-and-validation.json`：十个文件均可由 SoundFile 与 ffprobe 解码，均为 48 kHz / 2 声道；全部样本有限，削波样本数均为 0，最大解码峰值为 -8.91 dBFS。保留每项准确处理参数、原素材属性、解码 RMS、文件大小和成品 SHA-256。此处没有人工听感验收；正式游戏浏览器交互和三套同页试听由父会话核验。

`prepare_sources.py` 是本会话写的下载工具，仅获取公开音频和许可/来源元数据，没有执行外来脚本。`uisfx-tree.json`、`uisfx-commit.json`、各 `*-page.html` 与 `*-inventory.json` 是来源固定与许可核对记录。
