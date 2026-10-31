# asset-map.md —— 资源引用名 → 落盘文件映射（W8 收尾产出）

源：`D:\素材\代号柒\搜打撤\game\assets\`；落位：`Assets/Resources\`（契约 00-contracts.md §7）。
Resources.Load 路径 = 各表"Resources 相对路径"列（已去扩展名）。生成脚本：`_planning/tools/w8_copy_assets.py`（幂等）。
所有表内容均已逐项与源码（characters.js / cards.js / art.js / sound.js / game.run.data.js）核对。

## 汇总

- 拷贝总数：**210 个文件，约 74.3 MB**（cut 立绘 25 + 场景 17 + 卡面 36 + 结点图标 12 + UI 图标 60 + 标题 1 + Hub 6 + 冬季 UI 5 + UI 音效 17 wav + 2 license + 战斗音效 27 ogg + 1 license + BGM 2）
- 校验：python os.path.isfile 逐目录核对，目标 = 源目录全量（png/webp/ogg/wav 按规则过滤），无缺漏。
- 契约数字勘误（源码为准）：CutEnemies 实为 **14**（契约写 13，多出 dragon）；Art\Icons 实为 **12**（契约写 11）；Art\Ui 实为 **60**（契约写 61，源 ui/icons 只有 60 张 png）；Battle ogg 实为 **27**（契约写 26，= sound.js SFX 表 4+2+2+2+3+2+3+3+3+2+1）。
- 跳过清单：icons-source-web/、icons-orig/、winter-ui 的 svg 源、winter-ui-source/、menu-emblems/source/、portraits/{classes,enemies,full} 未抠图原版、孤儿 M500000rh0dE2TyUic.mp3、bgm-never-perching-bird.mp3（已删）、scenes 同名 png 原图（battle-normal-anime-v2.png，webp 已拷）、assets 根下其余 title-*.webp/png（仅拷 .jpg）、reconstruction/ 壁纸大图、fonts/（字体由协调者负责）。

## ① 角色 id → 立绘（src/characters.js，5 角色）

角色页立绘不是单图：`art.js characterArt()` 用 `expedition-roster.png`（1672×941 合影）按 x 区间切条显示（ranges 数组顺序 = CHARACTERS 顺序）。Cut 职业抠图立绘仅作备用（classArt 对旧职业名走 `portraits/classes/{id}.png`，Unity 用 Cut 版）。

| 源引用名（id=visualId） | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| shuangling（霜翎/侠客） | expedition-roster.png 切条 x[0,355]；备用 sword.png | Art/Hub/expedition-roster；备用 Art/Portraits/Cut/sword |
| baiqi（白契/降临者） | expedition-roster.png 切条 x[338,672]；备用 descend.png | Art/Hub/expedition-roster；备用 Art/Portraits/Cut/descend |
| lituan（栗团/法师） | expedition-roster.png 切条 x[655,1010]；备用 mage.png | Art/Hub/expedition-roster；备用 Art/Portraits/Cut/mage |
| xuanli（玄砾/战士） | expedition-roster.png 切条 x[991,1397]；备用 warrior.png | Art/Hub/expedition-roster；备用 Art/Portraits/Cut/warrior |
| dengkui（灯葵/牧师） | expedition-roster.png 切条 x[1380,1672]；备用 priest.png | Art/Hub/expedition-roster；备用 Art/Portraits/Cut/priest |

11 职业抠图立绘（art.js CLASS_IDS，含 LEGACY 旧名）：assassin/descend/guard/mage/priest/ranger/sealer/summoner/sword/warlock/warrior → `Art/Portraits/Cut/{id}`。

## ② 敌人 key → 立绘（cards.js BESTIARY art 字段 + battle monsterArt(f.id)，共 14）

BESTIARY 14 条 art 字段全集 = art.js MONSTER_IDS = battle.core/view 的怪物立绘 key，与 CutEnemies 文件一一对应。

| 源引用名 | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| infantry | infantry.png | Art/Portraits/CutEnemies/infantry |
| archer | archer.png | Art/Portraits/CutEnemies/archer |
| bandit | bandit.png | Art/Portraits/CutEnemies/bandit |
| cavalry | cavalry.png | Art/Portraits/CutEnemies/cavalry |
| orc_jav | orc_jav.png | Art/Portraits/CutEnemies/orc_jav |
| orc_axe | orc_axe.png | Art/Portraits/CutEnemies/orc_axe |
| wolf_rider | wolf_rider.png | Art/Portraits/CutEnemies/wolf_rider |
| fire_el | fire_el.png | Art/Portraits/CutEnemies/fire_el |
| water_el | water_el.png | Art/Portraits/CutEnemies/water_el |
| grass_el | grass_el.png | Art/Portraits/CutEnemies/grass_el |
| dragon | dragon.png | Art/Portraits/CutEnemies/dragon |
| boss_general | boss_general.png | Art/Portraits/CutEnemies/boss_general |
| boss_orc | boss_orc.png | Art/Portraits/CutEnemies/boss_orc |
| boss_elem | boss_elem.png | Art/Portraits/CutEnemies/boss_elem |

注意：源码 monsterArt 引用的是 `portraits/enemies/{id}.png`（未抠图原版，未拷）；Unity 按契约统一改用 cut 版 CutEnemies。生物图鉴卡（type=生物）卡面也走这套 key（无映射回退 [[icon:paw]]）。

## ③ 卡面 art key → Art\Cards（art.js cardIcon：家族图 + hero 职业专属 + RESOURCE_ART 按卡名）

| 源引用名（cardFamily / 规则） | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| hero（英雄卡） | hero-<职业id>.png ×11 + hero.png 兜底 | Art/Cards/hero-{assassin..warrior}；Art/Cards/hero |
| event | event.png | Art/Cards/event |
| martial-ranged | martial-ranged.png | Art/Cards/martial-ranged |
| martial-melee | martial-melee.png | Art/Cards/martial-melee |
| healing | healing.png | Art/Cards/healing |
| spell | spell.png | Art/Cards/spell |
| equipment-armor | equipment-armor.png | Art/Cards/equipment-armor |
| equipment-weapon | equipment-weapon.png | Art/Cards/equipment-weapon |
| equipment-utility | equipment-utility.png | Art/Cards/equipment-utility |
| resource-key（家族兜底） | resource-key.png | Art/Cards/resource-key |
| resource-valuables（家族兜底） | resource-valuables.png | Art/Cards/resource-valuables |
| resource-material（家族兜底） | resource-material.png | Art/Cards/resource-material |
| consumable | consumable.png | Art/Cards/consumable |
| unknown | unknown.png | Art/Cards/unknown |

资源卡按**卡名**精确匹配 RESOURCE_ART（原名 `cards/resources/<key>.png`，落盘加 `resource-` 前缀防撞名，已记 TODO-contracts）：

| 源引用名（卡名→key） | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| 制式口粮→ration-std | resource-ration-std.png | Art/Cards/resource-ration-std |
| 口粮→ration | resource-ration.png | Art/Cards/resource-ration |
| 双份口粮→ration-double | resource-ration-double.png | Art/Cards/resource-ration-double |
| 钥匙→key | resource-key.png | Art/Cards/resource-key |
| 一串钥匙→keys-bunch | resource-keys-bunch.png | Art/Cards/resource-keys-bunch |
| 一把钥匙→key-one | resource-key-one.png | Art/Cards/resource-key-one |
| 木材→wood | resource-wood.png | Art/Cards/resource-wood |
| 大量木材→wood-lots | resource-wood-lots.png | Art/Cards/resource-wood-lots |
| 一捆木材→wood-bundle | resource-wood-bundle.png | Art/Cards/resource-wood-bundle |
| 石榴石弹珠→garnet-marble | resource-garnet-marble.png | Art/Cards/resource-garnet-marble |
| 经济卡包→econpack | resource-econpack.png | Art/Cards/resource-econpack |
| 钻石→diamond | resource-diamond.png | Art/Cards/resource-diamond |

注意：`Art/Cards/resource-key.png` 一名两义（家族兜底图 = 源 cards/resource-key.png；卡名"钥匙"映射同 key）。源同名，Unity 直接加载无歧义。

## ④ 场景 key → Art\Scenes（PRELOAD_SCENES / SCENE_META / css 引用，17 张）

| 源引用名（文件名即 key） | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| battle-normal-anime-v2（源码引用 .png，实拷 webp） | battle-normal-anime-v2.webp | Art/Scenes/battle-normal-anime-v2 |
| scene-door-anime-v2 | scene-door-anime-v2.webp | Art/Scenes/scene-door-anime-v2 |
| scene-extract-anime-v2 | scene-extract-anime-v2.webp | Art/Scenes/scene-extract-anime-v2 |
| scene-fire-anime-v2 | scene-fire-anime-v2.webp | Art/Scenes/scene-fire-anime-v2 |
| scene-altar-anime-v2 | scene-altar-anime-v2.webp | Art/Scenes/scene-altar-anime-v2 |
| scene-chest-anime-v2 | scene-chest-anime-v2.webp | Art/Scenes/scene-chest-anime-v2 |
| scene-shop-anime-v2 | scene-shop-anime-v2.webp | Art/Scenes/scene-shop-anime-v2 |
| scene-pickup-coin-anime-v2 | scene-pickup-coin-anime-v2.webp | Art/Scenes/scene-pickup-coin-anime-v2 |
| scene-pickup-key-anime-v2 | scene-pickup-key-anime-v2.webp | Art/Scenes/scene-pickup-key-anime-v2 |
| scene-pickup-rations-anime-v2 | scene-pickup-rations-anime-v2.webp | Art/Scenes/scene-pickup-rations-anime-v2 |
| scene-pickup-wood-anime-v2 | scene-pickup-wood-anime-v2.webp | Art/Scenes/scene-pickup-wood-anime-v2 |
| event-bandits-anime-v2 | event-bandits-anime-v2.webp | Art/Scenes/event-bandits-anime-v2 |
| scene-deploy-anime | scene-deploy-anime.png | Art/Scenes/scene-deploy-anime |
| hub-ach | hub-ach.png | Art/Scenes/hub-ach |
| hub-classes | hub-classes.png | Art/Scenes/hub-classes |
| hub-stash | hub-stash.png | Art/Scenes/hub-stash |
| hub-upgrade | hub-upgrade.png | Art/Scenes/hub-upgrade |

## ⑤ BGM / SFX key → Audio（src/sound.js）

| 源引用名（键/URL） | 落盘文件名 | Resources 相对路径（不含扩展名） |
|---|---|---|
| BGM_URL（局内，loop） | bgm-black-stream-sea.mp3 | Audio/Bgm/bgm-black-stream-sea |
| TITLE_BGM_URL（标题） | bgm-sour-orange-earth.mp3 | Audio/Bgm/bgm-sour-orange-earth |
| click（随机 1..5） | click1-5.wav | Audio/Sfx/click1 … click5 |
| hover/rollover（随机 1..6） | rollover1-6.wav | Audio/Sfx/rollover1 … rollover6 |
| switch（随机 1..6） | switch1-6.wav | Audio/Sfx/switch1 … switch6 |
| sfx('hit')（随机 1..4） | hit-1..4.ogg | Audio/Sfx/Battle/hit-1 … hit-4 |
| sfx('hurt')（1..2） | hurt-1..2.ogg | Audio/Sfx/Battle/hurt-1 … hurt-2 |
| sfx('parry')（1..2） | parry-1..2.ogg | Audio/Sfx/Battle/parry-1 … parry-2 |
| sfx('curse')（1..2） | curse-1..2.ogg | Audio/Sfx/Battle/curse-1 … curse-2 |
| sfx('heal')（1..3） | heal-1..3.ogg | Audio/Sfx/Battle/heal-1 … heal-3 |
| sfx('chestShake')（1..2） | chestshake-1..2.ogg | Audio/Sfx/Battle/chestshake-1 … chestshake-2 |
| sfx('chestBurst')（1..3） | chestburst-1..3.ogg | Audio/Sfx/Battle/chestburst-1 … chestburst-3 |
| sfx('reveal')（1..3） | reveal-1..3.ogg | Audio/Sfx/Battle/reveal-1 … reveal-3 |
| sfx('legend')（1..3） | legend-1..3.ogg | Audio/Sfx/Battle/legend-1 … legend-3 |
| sfx('victory')（1..2） | victory-1..2.ogg | Audio/Sfx/Battle/victory-1 … victory-2 |
| sfx('defeat')（仅 1） | defeat-1.ogg | Audio/Sfx/Battle/defeat-1 |

命名坑：sfx 键是 camelCase（chestShake/chestBurst），文件名是全小写连字符（chestshake/chestburst）。全部音频 Kenney CC0（Audio/Sfx/kenney-license.txt、Audio/Sfx/Battle/kenney-license.txt 已随拷）。

## 附：标题 / Hub / 冬季 UI

| 用途 | 源引用名 | 落盘文件名 | Resources 相对路径 |
|---|---|---|---|
| 标题主视觉 | .title-bg / PRELOAD | title-hero-ascension.jpg | Art/Title/title-hero-ascension |
| 基地背景 | hub.css | hub-bg-rhine.png | Art/Hub/hub-bg-rhine |
| 槽位背景 | css + game.menu.js | slot-bg-knight-fantasy.jpg | Art/Hub/slot-bg-knight-fantasy |
| 棋盘背景 | game.boot/renderer | board-backdrop-wreck.webp | Art/Hub/board-backdrop-wreck |
| 徽记 | index.html favicon | brand-mark-codename7.png | Art/Hub/brand-mark-codename7 |
| 议会图标 | （src 未直接引用，备用） | icon-council.png | Art/Hub/icon-council |
| 远征队合影 | art.js rosterUrl | expedition-roster.png | Art/Hub/expedition-roster |
| 冬季 UI 栅格 | winter-ui | black-longsword/snowflakes/squirrel-branch/winter-hotpot/winter-rose.webp | Art/WinterUi/{名} |
