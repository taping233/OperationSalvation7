# 实录 Foley 批次：证据重建

重建日期：**2026-10-18**。原 README、下载原包和历史A/B/验收报告缺失。现存[packages.json](packages.json)、[receipt.json](receipt.json)、[mapping.json](mapping.json)、两份包内readme及接入前快照保留；本页只整理这些资料和当前核验结果。

来源记录为 Vehicle / Jan Schupke 的 Fantasy SFX 系列，CC0 1.0；[素材来源页](../../../game/assets/sfx/real-foley/SOURCES.md)、[Accessory 包readme](accessory/readme.txt)和[Tinysized 包readme](tinysized/readme.txt)保留作者及许可信息。packages记录原下载地址、包大小与SHA256；当前没有原压缩包可重算，不能将元数据视为本次重新下载核验。

现存精确映射覆盖**6件运行WAV、9个事件**：

| 事件 | 运行文件 | 增益 |
| --- | --- | --- |
| coin、tradeSell、tradeBuy | coinflip-01/02.wav | 0.28 |
| searchStart、recodeStart | book-page-02.wav | 0.13 |
| click | wood-tap-01.wav | 0.20 |
| cardSelect、characterSelect | wood-tap-01.wav | 0.16 |
| foeLunge | tube-whoosh-01/02.wav | 0.18 |

文件位于 `game/assets/sfx/real-foley/`；receipt保存每件原包内路径、运行文件字节数及SHA256。wood-tap源名为 `wood-bowl-hit-wood-spoon-01.wav`，tube-whoosh源名为 `tube-plastic-whoosh-01/02.wav`。本次逐件重算6件运行WAV的长度/指纹，与收据及当前资产清单一致；未取得原包，不能重新执行原包到运行文件的逐字节对照。`foeLunge`仍保留现行220ms播放包络，源文件处理声明沿用收据。

[接入前catalog](before/sound.samples.catalog.js)与[接入前资产清单](before/asset-manifest.json)可查。当前运行在本批9事件之外又加入[安全格两事件](../2026-10-18-safe-slot-foley/README.md)，draw仍为f4ngy。

2026-10-18的[sound-real-foley 定向测试](../../../tests/sound-real-foley.test.js)3项通过，覆盖9事件与后续两事件边界、6件WAV/资产清单指纹、来源署名和未耳听标记。四组音频测试合计4文件125项通过，见[本次机器报告](../2026-10-17-sample-only-sfx/reconstructed-tests-2026-10-18.json)；文件复核见[verification](../2026-10-17-sample-only-sfx/verification-2026-10-18.json)。本次未作人工耳听、实时混音或历史A/B重放。
