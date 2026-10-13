# 素材清单第三批：透明缩略图 10 张

2026-10-13。修订前全树审计为 376 errors、623 未变历史 warnings，退出 1。本批 10 张均在 `docs/evidence/2026-10-11-studio-alpha-repair/assets.json` 中，逐条验证：清单原 SHA256 等于 beforeSHA256，当前文件 SHA256 等于 afterSHA256，当前 bytes 与登记不符。清单只修改这些路径的 bytes、sha256、source；source 指向透明通道修复记录，原 license 不变。原登记来源为 `docs/evidence/2026-10-05-WF-web-5200-1005/manifest-backfill-2026-10-05.json`，仍可通过清单差异追溯。素材文件未改。

| 资源路径（相对 `game/assets/`） | 当前 bytes | 当前 SHA256 |
| --- | ---: | --- |
| `thumbs/cards/event.webp` | 393872 | `f8c9ab856ef5c1afe302a2333affd6d723a033c2b9b36b12731a564c0206cb7f` |
| `thumbs/cards/martial-tt3-skewer.webp` | 40898 | `a76f8523a9a447851fac68e7c68d3a8ac23a19848582418700b31caccf2f3eda` |
| `thumbs/cards/martial-tt3-wave-slash.webp` | 76268 | `86fe125834ad8f0419ef69357da03fea4d28fe591458090b43d893c8aa23b664` |
| `thumbs/cards/spell-tt3-fireball.webp` | 61254 | `93f5beeefa4ed7c8ed4f5d473afb8d8c36408975f523878f6b7b7cd77f3a69ba` |
| `thumbs/cards/spell-tt3-thunderblast.webp` | 127140 | `7d484079fa1666e270b5656b005fdba4f99ae9b1d8671da890c461d078186ace` |
| `thumbs/cards/spell-tt5-galaxy-voyage.webp` | 55042 | `3d86bcd9b02394e70dcc2aad5f71e41d6e95827e118029925317f0eae247064a` |
| `thumbs/cards/expedition-starters/rations.webp` | 91972 | `4769b74c110b4711c8275c436a58f091aac8cb5831c8eede9bc42cdfac2baf02` |
| `thumbs/cards/items/builtin-fuyuanyao.webp` | 38758 | `2c76c9bafc4baceb181231900a5d55f3d87a0dbe39c89338f26a25482642755c` |
| `thumbs/cards/items/starter-emergency-bandage.webp` | 36086 | `e67d975cbdc913d37b386f1cca4ad8cbc882fc0e947ecc921e15433859eb0919` |
| `thumbs/cards/items/tt-crystal.webp` | 37074 | `8c1899f872f84ad414a31ce98140bbad9d3ffc3ab1958beda52b9b5a6ff9412f` |

修订后全树审计退出 1：356 errors、623 历史 warnings。剩余新增问题为未登记 276、bytes-mismatch 40、sha256-mismatch 40；全树另有历史未登记 586、ghost 33、license-pending 4。针对本批 10 路径的 `auditAssets` 无 issue，检查命令退出 0；`git diff --check -- game/assets/asset-manifest.json` 退出 0。未登记项仍未处理。
