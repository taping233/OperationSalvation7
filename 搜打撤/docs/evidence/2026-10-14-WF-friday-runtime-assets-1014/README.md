# 运行场景素材的可复现分发

CI 对 `c6d9848c3703cbeab53b071d0c8473e653363c99` 暴露两张运行图未进入 Git：制作时把根规则的验收证据红线应用到了实际运行资源，子目录忽略了图片，源码却已引用。本轮只解除这两条具体忽略，并按现有资产清单与制作回执提交原始 WebP；未改玩法、来源登记、历史债基线或图像内容。

| 运行图 | 字节 | SHA256 | 来源与当前状态 |
| --- | ---: | --- | --- |
| `game/assets/scenes/battle/winter-transit-1011/far.webp` | 1259138 | `3677892095e1d1e3cf428bfe6c4da8fdcebd9a1154bebe7eb519b3ea4ee5eda4` | [冬季分层制作回执](../2026-10-11-WF-selection-map-implementation-1011/winter-layer-continue/assets-receipt.json)；当前已接入，整体视觉验收仍待完成 |
| `game/assets/scenes/shop/shop-cardstyle-approved-1011.webp` | 1181460 | `d150710921cd395438f44d98798312e71c9e10f15df887d528909c83e4f335d2` | [商店回执](../2026-10-11-WF-selection-map-implementation-1011/art-calibration/shop/runtime-receipt.json)及[批准记录](../2026-10-11-WF-selection-map-implementation-1011/HANDOFF-NEXT-CHAT.md)；原尺寸、无损编码及原始像素保持 |

两张图属于现有运行包的必需输入；生成原稿、参考、验收截图等大件证据仍不入库。分发继续限于私有仓库和同用户 Library，不据此授予第三方公开许可。

另已只读核对旧档的两份本地原稿：`workflow-completion-2026-09-30/originals/docs/production/engineering/MAKER-HANDBOOK.md` 为4425字节，SHA256 `39d23cbc584ee93b039fb0caf7cecf0cd93b50eb875e63bb900e227e47935006`；`originals/AGENTS.md` 为3588字节，SHA256 `64de3328036ec86faca20cbc7eeb9ac63d120dc6dc9de44c9467f20db8fb0ed1`。两份都与旧清单期望一致。原始字节单独保存在本地 `.tmp/friday-original-archive-bytes-1014/`，供同用户交接，不修改旧清单、原稿或行尾策略；远端历史差异由云端继续处理。

验证与远端结果以相邻任务记录和本轮最终交付为准；原有完整质量门证据见[运行包记录](../2026-10-14-WF-friday-runtime-ship-1013/README.md)，本轮不重跑全量测试。平台内置浏览器此前不可用，未声称自然游玩或新的视觉验收通过。

补图工程阶段已正常提交并推送至私有 `origin/master`：`e2e42ec3ed889ca8bd3e712738f2352319eea4eb`，远端 SHA 已核对。隔离 quick 门通过语法、数据、8组类型契约、lint及增量素材检查；本轮纯资产变更按门选取跳过 Vitest，未重跑全量。原 hook 精确复用收据，不使用跳过变量。秘密扫描覆盖全部5个暂存文件、2443249字节，0命中、0跳过。摘要见相邻 `completion.json`；归档和 Library 交付结果由本轮随后完成并以最终平台返回为准。
