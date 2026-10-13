# 素材清单第二批：透明缩略图 10 张

2026-10-13。修订前全树 `assets:audit -- --check` 为 396 errors、623 未变历史 warnings，退出 1。所选 10 张均在 [透明通道修复记录](../2026-10-11-studio-alpha-repair/README.md) 的 `assets.json` 中：该记录逐条保存修改前、后 SHA256，清单原 SHA256 等于 beforeSHA256，当前文件 SHA256 等于 afterSHA256。逐条读取当前文件字节数并核对路径，保留原 license，把清单的 bytes、sha256、source 更新为当前值和 `docs/evidence/2026-10-11-studio-alpha-repair/assets.json`。原有来源登记为 `docs/evidence/2026-10-05-WF-web-5200-1005/manifest-backfill-2026-10-05.json`，可从本轮修改前的清单差异追溯；此批记录的是随后透明通道修复的实际输出。

| 资源路径（相对 `game/assets/`） | 当前 bytes | 当前 SHA256 |
| --- | ---: | --- |
| `thumbs/cards/creature-cmtn6ulm4boj.webp` | 63140 | `1862c83833ffa16f9460f3314690ba935fe5d053f0e2204672992b0ceb067f52` |
| `thumbs/cards/creature-cmtn79743r2n.webp` | 129018 | `2d068dfc1f58c283a04494cffb5bb54b671ff54595d2589cef43bb2e376ea7ec` |
| `thumbs/cards/creature-cmtn7err0a7.webp` | 107498 | `0bb0ed7f85e10e808067ae49728921dbb59c9bd83675a72d0cc8339a3cfde18a` |
| `thumbs/cards/equip-tt3-chaos-eye.webp` | 95782 | `f56e15440aba3a92eba7380b1f1e10a13b569caef609246acb362762ee214ca6` |
| `thumbs/cards/equip-tt3-deep-seal.webp` | 50652 | `b17edd6f720fc6538e491539d4298515c0ba3c2eb05dc702fda483323632fa87` |
| `thumbs/cards/equip-tt3-immortal-blade.webp` | 25844 | `58a0ff339fdb635ca98f55736176d0a5471289616a7e6dc94ab1d235a7f82a91` |
| `thumbs/cards/equip-tt3-master-staff.webp` | 44500 | `6af47b70914b607ad3c01050b32006ccab7caf673a3810b684da2c2725a5630e` |
| `thumbs/cards/equip-tt3-silver-runesword.webp` | 39794 | `d7480e92cfd9737243eebc4bdd06c3a3349fe9d90bc91b64d8579e95ed44c968` |
| `thumbs/cards/equip-tt3-staff.webp` | 16954 | `365d4c78a21f41f8c8bdec11fb2dd27b0e226784541a6ea34ea7bb8bad61156a` |
| `thumbs/cards/equip-tt3eq-boiler.webp` | 57272 | `ad5f4b54705c124b8a03e9fe041f3d45776be99ca0c3991ebe43e6330b6633e2` |

修订后全树审计退出 1：376 errors、623 历史 warnings；分类为新增未登记 276、bytes-mismatch 50、sha256-mismatch 50，全树另有历史 unlisted 586、ghost 33、license-pending 4。上述 10 路径定向 `auditAssets` 无 issue，检查命令退出 0；`git diff --check -- game/assets/asset-manifest.json` 退出 0。其余 50 组缩略图按后续批次核对；未处理 276 个未登记项和素材文件。
