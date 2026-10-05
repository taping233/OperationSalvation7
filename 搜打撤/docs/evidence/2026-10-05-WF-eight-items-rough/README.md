# 八件装备 · 原构图粗笔重绘（2026-10-05）

老板在搜索大宝箱任务中追加寒冰剑、冰甲、草甲、自然法杖、珍珠盒、元素符印、命运钟表、沉船宝箱。最后一项实时库名为「沉船宝盒」，ID tt2-wreck，仅重画不更名。前六张初始新设计生成后，老板明确要求前六张全部按原构图返修；后两张也按原构图执行。

最终采用内置ImageGen对八张原生产图分别重画，source-5/8只作宽笔画法参考。原造型、布局、比例和配色为权威，收简次要纹饰为大色面，保留粗笔手绘；实际最终提示词/参考分工见generation-original-layout.json。首轮请求留generation.json，未选六稿路径见rejected-new-layout.json，均未接入。最终八图全部已查看展示，没有称老板已认可或像素级完全不变。

| 卡名 | 稳定ID / 原图文件 | 保留的原构图设计 |
| --- | --- | --- |
| 寒冰剑 | tt2-frostsword / equip-tt2-frostsword.webp | 左下剑尖、右上蓝柄、蓝宝石与冰翼护手、浅青底 |
| 冰甲 | tt3-twinwater-mail / equip-tt3-twinwater-mail.webp | 中央尖棱甲壳与向两侧展开的晶刺、青白冰色 |
| 草甲 | tt3-grass-armor / equip-tt3-grass-armor.webp | 宽草衣/披覆式轮廓、中央交叉系带、藤叶与白花 |
| 自然法杖 | tt7-naturestaff / equip-tt7-naturestaff.webp | 右下至左上的直枝杖、原叶簇与顶端白花、浅绿底 |
| 珍珠盒 | tt2-pearlbox / equip-tt2-pearlbox.webp | 红金开匣、浅蓝软垫、一颗居中珍珠、淡奶黄底 |
| 元素符印 | tt3-element-seal / equip-tt3-element-seal.webp | 小中央菱形、上部两侧火冰意象、深蓝紫大留白 |
| 命运钟表 | tt3-fate-wheel / equip-tt3-fate-wheel.webp | 倾斜金怀表、右上表冠/环与链、原指针/表盘/露齿轮 |
| 沉船宝盒 | tt2-wreck / equip-tt2-wreck.webp | 全开宝盒、箱中金币、左下两张牌、深青底 |

八张原图及同名缩略图共16件已同名实装game/assets/cards/与game/assets/thumbs/cards/，WebP q90/q82、缩略宽448并沿现有烧色矩阵；尺寸、bytes、SHA256与原始来源逐件见images.json。原件备份originals-before-repaint/。PNG源稿留game/art-source/cards/equip-<id>-original-rough-20261005.png，仅本地不进Git，超过1MB者只留路径/哈希/获取方式。

art-mapping仅8id revision；asset-manifest仅本16项来源/哈希/count，按最新355项基础新增16项到371，保留其他会话内容。卡名、效果、cards-sync及游戏代码未改。import-images.py与register-assets.cjs记录实际编码/登记动作。

沿老板禁测令，未测试/资产门/workflow verify/实页/build/提交，无新服务；加载/战斗/CI未核。HEAD沿本会话有效425d03920e，远端未刷新。搜索大宝箱已另行完成接入，见../2026-10-05-WF-big-chest-search/README.md。
