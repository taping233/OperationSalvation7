# 物资点室内场景候选

## 火堆事件画风对齐版（当前运行图）

老板否定面部精修版，反馈不好看且与其他事件画风不一致。读取现行mystery、airdrop、relief实图后，以 `event-tt6-mystery.webp` 和 `event-tt6-relief.webp` 作为直接画风参考，内置重绘三人火堆：人物放大、细化二次元五官，恢复覆盖笔触及冷暖色块，远处通过概括形体与空气透视减弱细节。原稿 `game/art-source/scenes/fire-shelter-20261015/fire-event-match.png` 已接入原火堆背景和缩略图。提示词 `fire-event-match-prompt.txt`；转换与备份 `install-fire-event-v4/receipt.json`。助手已看生成图，尚待老板审美确认。沿用不测试、不实页、不build；未提交。

## 火堆面部精修版（当前运行图）

老板要求人物脸部细致、遵守既定画风。以内置生图局部重绘简化版，按项目v1.0的“脸比衣料细化”规则补清眼睑、鼻口、脸颊与颈部结构，保持三人围坐、简化环境和虚化远景。原稿 `game/art-source/scenes/fire-shelter-20261015/fire-three-faces.png` 已接入原火堆背景及缩略图。提示词见 `fire-faces-prompt.txt`；转换哈希与前版备份见 `install-fire-faces-v3/receipt.json`。沿用不测试、不实页、不build；未提交。

## 火堆简化版

老板反馈细节过多，要求去掉无用细节、远处虚化。内置以三人版为输入重绘为 `game/art-source/scenes/fire-shelter-20261015/fire-three-simple.png`：保留三人、火炉、杯壶及挡风棚大形，去除背包、花纹毯、密集窗格、天线与建筑碎纹理，远处城市虚化成低对比色块。已接入原火堆背景和缩略图；当前转换及前版备份见 `install-fire-simple-v2/receipt.json`，完整提示词见 `fire-simple-prompt.txt`。沿用老板“不用测试”的要求，未运行测试、build和实页。

## 火堆重做与实装

火堆采用NAI初稿→内置重绘→三人围坐定向修改。现原稿为 `game/art-source/scenes/fire-shelter-20261015/fire-three-travelers.png`；已转入运行背景 `game/assets/scenes/scene-fire-anime-v2.webp` 及对应缩略图，保留原asset-key与休整行为。未来高架候车厅的弧形挡风设施内，三名旅人分别烤火、捧杯与添柴，围着同一火炉休息；远处是冬日城市与高架交通。

生成请求见 `nai-fire-request.json`、`fire-redraw-prompt.txt`、`fire-group-prompt.txt`。单人重绘是错误中间稿，老板纠正围坐人数后已替换为三人版。运行图、缩略图、原稿哈希和旧图备份见 `install-fire/receipt.json`。老板明确“不用测试”，未进行实页、测试或build；没有提交。

## 物资点实装

老板明确选择传送带修订之前的室内人物翻箱版。`interior-searcher-imagegen.png` 已转成运行背景 `game/assets/scenes/scene-chest-anime-v2.webp`，对应缩略图同步更新；沿用既有asset-key、预加载和场景布局。物资点文字改为闯入废弃配送站翻找遗留箱柜，奖励规则不变。转换参数、原稿和运行图哈希、原运行图备份见 `install-assets.py` 和 `install-chest/receipt.json`。老板明确“不用测试”，因此未运行测试、资产审计、build或实页验收。

## 透视与视线引导修订

老板反馈前版引导弱、缺少透视和特色。最新候选为 `../../../game/art-source/scenes/supply-petal-20261015/interior-searcher-depth-v2.png`：内置重绘改成从破损入口斜看纵深房间，近景门框和弧形分拣传送带形成前景框架，地面接缝、光带和传送带引向翻找人物，远处走廊形成第二层空间。配送站以弧形传送带和顶部分发轨道建立特征。完整提示词见 `depth-v2-prompt.txt`，尺寸与SHA256见 `depth-v2-receipt.json`。已看图核验，待老板审阅；未接入游戏。

老板将方向改为闯入建筑、翻找遗留物资，随后要求加入人物并明确用内置生图修改。已完成NAI初稿及内置重绘；未接入游戏。

现交付：`../../../game/art-source/scenes/supply-petal-20261015/interior-searcher-imagegen.png`。内置实际输出1672×941，约16:9（与严格16:9相差0.053%，未拉伸或裁切）。SHA256：`f1f33d95dadcc1436bd8908aa2746a45c4f34df3f892f0d44ac7ceb4adadc905`。来源：内置imagegen以`nai-interior-searcher.png`为编辑目标，完整提示词见`imagegen-prompt.txt`。人物俯身单膝跪地，一手拿起包装袋、另一手翻找箱内物资；柜门、抽屉敞开，地面遗留散物。助手已检查实际画面；尚未获老板认可。

NAI人物第一版回头警戒、动作偏弱，已交内置定向重绘；第二版NAI在途请求随后成功，保留为候选而非内置重绘输入。全部NAI请求及SHA256分别保存于对应request回执。

- 无人物初稿：`../../../game/art-source/scenes/supply-petal-20261015/nai-interior-draft.png`，1024×576，严格16:9；SHA256与全部提示词、模型、参数见 `nai-interior-request.json`。
- 获取方式：运行 `generate-nai-interior.py`，经项目现有 `nai_gen` / `nai_guard`，HTTP 200。
- 助手观察：室内空间、冷暖光及储物柜明确；强行进入、柜门翻开和遗留散物表现偏弱，尚未获得老板认可。
- 旧室外舱体方案已被老板的新方向替代。`nai-request.json`保留旧NAI回执；当时已在途的内置出图不作为现候选。
- 原始PNG在素材目录忽略；请求回执保存哈希。没有覆盖运行素材、修改游戏代码或提交。
