# 非场景位图资源清单（v0.30）

> 运行时根目录：`game/assets/`。最终仅允许 PNG/WebP/ICO；不得引用生成缓存、inline SVG、`.svg` 或 `data:image/svg+xml`。

## 职业立绘（425~467 见方，WebP）

`assassin` 刺客、`sword` 剑客、`warlock` 术士、`mage` 法师、`priest` 牧师、`sealer` 授印者、`descend` 降临者、`summoner` 召唤师、`guard` 守卫、`ranger` 游侠、`warrior` 战士。

路径：`assets/portraits/classes/<id>.webp`；战场用抠图 `assets/portraits/cut/classes/<id>.webp`（同尺寸，透明背景）。

## 怪物与 Boss（源图 1038×1516，WebP；战场抠图 520×760 透明 WebP）

`infantry` 联邦巡防兵、`archer` 联邦射手、`bandit` 反抗组织拾荒者、`cavalry` 联邦机动兵、`orc_jav` 反抗组织掷弹兵、`orc_axe` 甲壳变异体、`wolf_rider` 变异雪狼、`fire_el` 灼热异变体、`water_el` 腐蚀异变体、`grass_el` 滋生异变体、`dragon` 巨兽「荒渊」、`esper_crow` 白鸦、`esper_candle` 烛火、`esper_silence` 静默、`esper_echo` 回声、`boss_general` 肃清总督、`boss_orc` 变异巢母、`boss_elem` 异能领主。

路径：`assets/portraits/enemies/<id>.webp`；战场用抠图 `assets/portraits/cut/enemies/<id>.webp`。世界观口径：联邦部队 / 反抗组织 / 双阵营能力者 / 变异生物体；id 与美术绑定关系保持不变。

## 卡面小图（896×896 为主，另有 1024×1536、512×512 等，WebP）

按当前可见语义族匹配：`martial-melee` 近战武术、`martial-ranged` 弓箭/射击、`spell` 法术、`healing` 医疗、`consumable` 道具、`equipment-weapon` 武器装备、`equipment-armor` 防具、`equipment-utility` 功能装备、`resource-key` 钥匙、`resource-material` 木材/口粮、`resource-valuables` 币/令牌/水晶、`event` 事件、`hero` 能力卡、`unknown` 未分类。

路径：`assets/cards/<family>.webp`（另有按卡牌 id 绑定的专属立绘 `assets/cards/{martial,spell,equip,creature,resource}-<id>.webp`）。卡名、类型、费用、稀有度、描述和效果字段保持不变。

## UI 图标（128×128，PNG，透明背景）

保留 `SDT.Icons` 的现有 key 契约：`heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner`。

路径：`assets/ui/icons/<key>.png`。所有图标为硬边工业终端图形，不显示系统 emoji。

## 通用生成基线

原创日系战术二次元设定集风格；干净线稿、动画式五官、克制赛璐璐阴影；石墨、冷灰、青色信息光与少量琥珀/珊瑚安全色；磨砂金属、技术织物、轻微磨损。禁止文字、伪文字、Logo、水印、官方角色或符号、穆夏拱框、彩绘玻璃、羊皮纸、木框、宝石大色块和写实摄影。
