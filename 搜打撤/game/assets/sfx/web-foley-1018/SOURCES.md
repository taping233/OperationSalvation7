# 网络新选音效（2026-10-18）

本目录来自本轮实际联网下载的六组公开音效，全部选择 CC0 1.0 授权。不是旧运行素材改名，也没有生成或合成音效。106个事件的运行映射由 `game/src/audio/sound.samples.catalog.js` 维护；45份剪辑中43份被运行映射引用，余下为本批备用。

| 作者 | 音效库 | 用途 |
| --- | --- | --- |
| Independent.nu / qubodup | [16 button clicks](https://opengameart.org/content/16-button-clicks) | 轻机械点击、选择、确认、返回、拒绝 |
| Kenney | [50 RPG sound effects](https://opengameart.org/content/50-rpg-sound-effects) | 纸张、皮革、钱币、锁扣、刀刃、钝击 |
| Vehicle / Jan Schupke | [Fantasy Weapons and Apparel](https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library) | 兵器、弓箭、格挡、金属、锁扣 |
| PWL | [Bell dings/chimes](https://opengameart.org/content/bell-dingschimes) | 低响度短奖励提示 |
| Brandon Morris / HaelDB | [Completion sound](https://opengameart.org/node/5095) | 稀有奖励、完成与胜利；选用该页提供的CC0许可 |
| JaggedStone | [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx) | 短法术、治疗与状态提示 |

许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。来源页快照、源包SHA256、逐件原始路径与SHA256、剪辑参数、运行指纹见 `docs/evidence/2026-10-18-web-sfx-replacement/receipt.json`。统一剪除前导空白，保留起音前3ms，3ms淡入、最长55ms淡出，高通70Hz，按材质低通3300–6200Hz，转单声道44.1kHz OGG；增益按RMS和峰值共同限幅，最多提升6dB，运行另有各事件增益。音乐未变。

`game/sfx-audition.html?set=web` 提供本轮106事件试听，按运行相对增益播放；它使用HTML音频逐件播放，不含游戏总线滤波/限幅、并发或部分变速，不能替代游戏内听感验收。本轮未人工耳听，不将文件分析、解码或自动测试记为听感通过。
