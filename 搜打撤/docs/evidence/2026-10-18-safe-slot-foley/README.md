# 安全格存取 Foley：证据重建

重建日期：**2026-10-18**。原 README 和原始验收日志缺失；以下内容来自现存[mapping.json](mapping.json)、[receipt.json](receipt.json)、接入前快照、当前源码和本次定向测试。

| 事件 | 运行文件 | 增益 |
| --- | --- | --- |
| safeStore | assets/sfx/real-foley/lockbox-turn-06.wav | 0.18 |
| safeRetrieve | assets/sfx/real-foley/lockbox-unlock-01.wav | 0.22 |

两者均为ui分组，以锁盒转动/解锁表示安全存取。收据记录来源为 Vehicle / Jan Schupke 的 Fantasy Accessory SFX Library，CC0 1.0；原包内文件名分别为 `keyhole-lockbox-turn-06.wav` 与 `keyhole-lockbox-unlock-01.wav`。[来源与署名](../../../game/assets/sfx/real-foley/SOURCES.md)可查；当前没有原下载包，原包元数据沿用[前批 packages](../2026-10-17-real-foley-batch/packages.json)。

本次重算两件运行WAV指纹，与收据和当前资产清单一致：

- turn：123516字节，SHA256 `47fba948e9eab77cad4480ce88a75d842ae1fe7e3046fc13446178c4bff5d197`。
- unlock：131252字节，SHA256 `4a8307c941dc56d984fc460b4730b70bf4833252c29922f08457b96d1ce10df0`。

[接入前catalog](before/game/src/audio/sound.samples.catalog.js)与[接入前资产清单](before/game/assets/asset-manifest.json)均保留。[sound-safe-slot-foley 定向测试](../../../tests/sound-safe-slot-foley.test.js)2026-10-18运行3项通过，核对只有上述两事件变化、旧资源保留、两件WAV指纹、清单和署名；通用gain与核心战斗声音未随这批变更。

四组音频测试合计4文件125项通过，见[本次机器报告](../2026-10-17-sample-only-sfx/reconstructed-tests-2026-10-18.json)，来源核对见[verification](../2026-10-17-sample-only-sfx/verification-2026-10-18.json)。receipt保留 `listening_verified:false`；本次未恢复历史试听或进行人工耳听，实际混音听感仍无验收结论。
