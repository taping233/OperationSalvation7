# 单抽牌音效：证据重建

重建日期：**2026-10-18**。原 README 和历史验收日志缺失；保留的收据及接入前快照可复核，未补造历史测试或听感结论。

当前[运行 catalog](../../../game/src/audio/sound.samples.catalog.js)的 `draw` 使用 `assets/sfx/f4ngy/dealing-card-240777-hq.mp3`，播放增益0.26、combat分组。[素材来源与署名](../../../game/assets/sfx/f4ngy/SOURCES.md)记录作者 f4ngy、作品 Dealing Card（Freesound 240777）、CC BY 4.0，以及公开HQ MP3的获取地址；它不是登录后才能下载的原始WAV。

[receipt.json](receipt.json)记录源/运行文件 SHA256 均为 `a16225c9beac75c4d83eb0cb9d59f33c773768a9d95d330fe6b56dc81c56cfb7`，以及文件未裁切、转码或归一化、只降低运行增益。本次重算运行文件指纹与该收据一致；接入前[catalog](before/sound.samples.catalog.js)和[资产清单](before/asset-manifest.json)仍在，旧抽牌素材也仍存在。

接入前 catalog 指纹与收据 `before_catalog_sha256` 一致；实录 Foley 批次的接入前 catalog 又与该收据 `new_catalog_sha256` 一致。这条留存链支持从前态重建早期106事件映射，不能恢复当时的实际浏览器验收过程。

2026-10-18的[sound-f4ngy-draw 定向测试](../../../tests/sound-f4ngy-draw.test.js)3项通过，核对当前 draw 配置、旧资源保留、清单/可见署名和运行文件指纹。与其余三组音频测试合计4文件125项通过，报告见[本次机器报告](../2026-10-17-sample-only-sfx/reconstructed-tests-2026-10-18.json)，指纹复核见[本次来源复核](../2026-10-17-sample-only-sfx/verification-2026-10-18.json)。收据内旧测试数量和波形数值属于留存自述，原始执行日志未找回；没有重新做响度检测、浏览器播放或人工耳听。
