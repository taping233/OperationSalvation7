# 敌人 NAI4.5 起稿与内置重绘

2026-10-25，老板否定前批直接内置生成的画风，要求使用 NAI4.5 加内置生图，重做所有不符合现行设定的敌人，并允许非人形。本轮逐张查看现有 27 种敌图，重绘 16 种，保留 11 种已符合现代封城、能力者或感染者背景的原图。范围见 [scope.json](scope.json)。本批替代[前批四图](../2026-10-25-story-enemies/README.md)，旧图保留备份。

依据[第一部剧情设定](../../production/design/STORY-PART-ONE.md)中的军事封锁、多方势力及污染改变身体，去除旧图的西幻龙、元素人、兽人、哥布林、宫廷铠甲及仪式法袍。10 种非人形使用封闭囊体、角质板、匍行肢或城市废料覆板；6 种人形使用现代封控、拾荒及隐蔽势力服装。名称与图形不揭露污染源的隐藏身份。

| 稳定 ID | 接入前名称 | 现行名称 |
| --- | --- | --- |
| archer | 封锁线枪手 | 封锁线枪手（重画） |
| bandit | 截道拾荒者 | 截道拾荒者（重画） |
| orc_axe | 硬化感染者 | 板壳畸变体 |
| grass_el | 增生感染者 | 囊生畸变体 |
| cavalry | 联邦机动兵 | 封锁线突击兵 |
| wolf_rider | 变异雪狼 | 裂颚匍行体 |
| fire_el | 灼热异变体 | 灼囊畸变体 |
| water_el | 腐蚀异变体 | 渗蚀畸变体 |
| dragon | 巨兽「荒渊」 | 封街巨躯 |
| boss_general | 肃清总督 | 封控指挥官 |
| boss_orc | 变异巢母 | 囊巢母体 |
| boss_elem | 异能领主 | 隔离区看守 |
| greedy_imp | 贪财小鬼 | 拾能囊虫 |
| tin_mute | 铁皮哑人 | 覆板缄默者 |
| cultist | 邪教徒 | 封识信徒 |
| fake_apothecary | 假药贩子 | 黑诊配药人 |

16 张均先调用 `nai-diffusion-4-5-full`：832×1216、28 步、CFG5.5、Euler ancestral/Karras、rescale0、variety关闭；实际完整请求保存在本目录的 `*-nai45-request.json`。两张初稿偏成人形，补作 `orc_axe_r2` 与 `grass_el_r2` 后用于正式重绘，共 18 次 NAI 请求。没有把未采用初稿计作最终来源。

随后将各自 NAI 原稿交给内置 imagegen 重绘，以项目[默认美术规范](../../production/art/ART-STYLE-V1.md)收拢动漫五官、不透明色块、随形笔触和局部线条。提示要求平视侧向、自然静止朝左、全身入画、无透视、无攻击动作及透明背景。实际逐张提示与对应 NAI 输入见 [redraw-prompts.json](redraw-prompts.json)。生成图均已目视；未做游戏实页验收。

正式图覆盖 `game/assets/portraits/enemies/<id>.webp`，对应缩略图覆盖 `game/assets/thumbs/portraits/enemies/<id>.webp`。仅作 RGBA WebP 编码（quality92/method6）及缩略图等比缩放至最大448×672，不裁切身体、不用程序重绘。旧图、旧源文件字节及生成 PNG 保留在项目根 `.tmp/imagegen/enemies-nai45-20261025/`；NAI 草稿保留在根 `.tmp/nai/enemies-nai45-20261025/`。大体积 PNG 不进 Git，路径、SHA256、尺寸、透明度与32张运行图元数据见 [receipt.json](receipt.json)。

16张正式WebP合计3115790字节，16张缩略图合计832676字节，单张最大308468字节；素材清单计数保持1717。

`map.json`、`cards.data.js` 同步可见名称和相关策略文案，两个精英战斗日志同步名称；隔离区看守的词缀显示名改为“闭合隔膜”、角标改为“障”，图鉴分类改为变异，原 `aegis` 及伤害减免描述不变。ID、攻击/生命、行为、技能参数、生成池与奖励保持原样；接入前完整怪物/首脑定义留在回执。现有 `ensureFoeRename` 每次启动从 BESTIARY 回填旧图鉴名称和描述，本轮未手改 `cards-sync.json`。

随从形象字典增加14个新名到原有敌图的映射，旧名映射保留；只增加既有稳定资源路径，消费者排除清单不变。对应消费者的 LF 指纹同步记录，未执行资源审计。素材清单仅替换本批32条元数据，计数及其他条目保留。

完成未提交。按老板要求未运行测试、资产审计、lint、类型检查、浏览器验收或 build；不宣称游戏内布局、旧存档恢复已验证。无新服务、文件删除、提交或推送。
