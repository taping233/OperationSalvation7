# 充能火山卡面重绘

2026-10-04，Friday / Codex；handoff 来源 HEAD 425d03920e，远端未刷新，本轮未提交。

老板令继续使用参考图共同特征与博览者v4提示词重画「充能火山」`tt8-hero-descender`。按常无欲现行人设（character-bible/changwuyu.md）保留男性、银灰长发低髻、黄瞳圆镜、尖耳、黑弯尖宽檐帽、黑紫袍金滚边、左胸白羽蓝宝石、黑手套；不持杖。重新设计火山熔流弧线汇聚掌前火球的充能动作，脸部细线、衣袍宽长笔触与连通色块。

内置 imagegen 使用常无欲定稿参考图作为身份参考，老板新发的第一张截图、军帽、紫发、金褐人物四张作为画风参考。未输入旧卡图。完整实际提示词见 [prompt.txt](prompt.txt)，来源、尺寸、SHA256与备份路径见 [images.json](images.json)。Sharp仅作WebP编码与现有bake-card-thumbs缩略图矩阵，不另作画面修绘。

已接入 `game/assets/cards/hero-volcano.webp` 与 `game/assets/thumbs/cards/hero-volcano.webp`，缓存版本 `changwuyu-volcano-broad-brush-v1-20261004`；asset-manifest仅新增本两件。大PNG留 `.tmp/imagegen/changwuyu-volcano-20261004/hero-volcano-v1.png`（>1MB不入Git），由内置生成取得；SHA256 `eff274d13a48f05d4d7a0d23783b2b1de5b558940bef866268d829c16f159aa1`。原图及原已调色缩略图留同目录originals，源生成文件仍保留。

沿老板「不要做检验和测试，做就行」续令：本版直接生成、编码与接入，未检验、未测试、未实页、未build、未提交。无新服务，其他卡面与清单条目未纳入本任务。
