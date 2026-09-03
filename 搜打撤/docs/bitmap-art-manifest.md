# 非场景位图资源清单（v0.30）

> 运行时根目录：`prototypes/map-system/assets/`。最终仅允许 PNG/WebP/ICO；不得引用生成缓存、inline SVG、`.svg` 或 `data:image/svg+xml`。

## 职业立绘（768×1024，PNG）

`assassin` 刺客、`sword` 剑客、`warlock` 术士、`mage` 法师、`priest` 牧师、`sealer` 授印者、`descend` 降临者、`summoner` 召唤师、`guard` 守卫、`ranger` 游侠、`warrior` 战士。

路径：`assets/portraits/classes/<id>.png`。

## 怪物与 Boss（768×1024，PNG）

`infantry` 步兵、`archer` 弓兵、`bandit` 土匪、`cavalry` 骑兵、`orc_jav` 兽人投矛手、`orc_axe` 兽人斧手、`wolf_rider` 兽人狼骑兵、`fire_el` 火元素、`water_el` 水元素、`grass_el` 草元素、`dragon` 龙、`boss_general` 将军、`boss_orc` 兽人首领、`boss_elem` 元素领主。

路径：`assets/portraits/enemies/<id>.png`。种族、武器、身份、能力语义一律保持现有设定。

## 卡面小图（384×512，PNG）

按当前可见语义族匹配：`martial-melee` 近战武术、`martial-ranged` 弓箭/射击、`spell` 法术、`healing` 医疗、`consumable` 道具、`equipment-weapon` 武器装备、`equipment-armor` 防具、`equipment-utility` 功能装备、`resource-key` 钥匙、`resource-material` 木材/口粮、`resource-valuables` 币/令牌/水晶、`event` 事件、`hero` 英雄卡、`unknown` 未分类。

路径：`assets/cards/<family>.png`。卡名、类型、费用、稀有度、描述和效果字段保持不变。

## UI 图标（128×128，PNG，透明背景）

保留 `SDT.Icons` 的现有 key 契约：`heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner`。

路径：`assets/ui/icons/<key>.png`。所有图标为硬边工业终端图形，不显示系统 emoji。

## 通用生成基线

原创日系战术二次元设定集风格；干净线稿、动画式五官、克制赛璐璐阴影；石墨、冷灰、青色信息光与少量琥珀/珊瑚安全色；磨砂金属、技术织物、轻微磨损。禁止文字、伪文字、Logo、水印、官方角色或符号、穆夏拱框、彩绘玻璃、羊皮纸、木框、宝石大色块和写实摄影。
