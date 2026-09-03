# 代号7 美术资产语义替换矩阵

> 资产原则：角色与场景位图均由内置 ImageGen 独立生成；要求精确小尺寸字形的应用/UI 图标允许由项目内确定性脚本直接生成 PNG/ICO，不使用 SVG。参考仅限高层视觉语言，未复制角色、五官、发型、服装、构图或水印。未列出哈希的条目尚未生成，避免把占位误报为成品。

## 总览矩阵

| 类别 | 原语义/当前接入 | 替换资产与生成提示词 | 尺寸 / SHA-256 | 接入点 | 目检 |
|---|---|---|---|---|---|
| 标题/主菜单 | 代号7 标题、开始/设置/退出 | `title-hero-codename7-anime.png`；原世界观灾后校园搜索员，明确二维日系动画线稿与赛璐璐明暗，右侧角色、左侧 UI 留白 | 1672×941 / `70A6211BD9FE3B7BA5317BF60230BEE4BFFA634FB2B314647DC9E281D7D4BD36` | `index.html #title` | 已检：无图内文字、Logo、水印；1920×1080 与 1150×700 实际渲染通过 |
| 品牌标识/应用图标 | 深紫金色衬线 7、内嵌旧 favicon | `brand-mark-codename7.png`；石墨折角铭牌、硬边 7、冷青校准线、微量琥珀警示块 | 256×256 PNG / `0E5C9813F04A022F401B5175696A3CA5D590ED7B1120D7250055774141D5BE74`；ICO / `BCBC0874E039113B8275634C0C3A21C42818CDB8BC48124ACB931028529E12EF` | `index.html rel=icon`、`desktop/app/main.js`、`desktop/app/icon.ico` | 已检：全链路仅位图；32px 仍可辨；PNG 含 alpha；ICO 可解码；重复生成哈希一致 |
| 基地·出发 | 选择玩法、出征预报 | 黑白灰终端面板，青/琥珀动作色（CSS） | — | `.hub-*`, `.mode-card` | 已检：语义保持 |
| 基地·仓库 | 卡牌仓库与安全格 | 石墨卡槽、状态色（CSS） | — | `.bag-*`, `.vault-*` | 已检：语义保持 |
| 基地·升级/职业/成就 | 进度、职业、奖励 | 工业模块与冷光分隔（CSS） | — | `.hub-tab`, `.cls-*`, `.ach-*` | 已检：语义保持 |
| 三环地图/棋子 | 校园三环棋盘、玩家棋子 | 冷灰网格、斜切辅助线（CSS） | — | `#viewport`, renderer canvas | 已检：不遮挡棋盘 |
| 事件·时空孔隙 | 前进 6 格 | `scenes/event-timespace-rift-v1.png`；灾后学校体育馆空间裂隙，冷青能量 | 1672×941 / `43356731441F6BB4ADE06AEFB6D56606B88ECA1950C4C38C124D7A4102447EBC` | 待 sceneId/assetKey 契约；目标 `.scene.sc-event` | 已检：无字、无水印 |
| 事件·恶魔交易 | -1 血、传奇武器 | `scenes/event-demondeal-v1.png`；灾后学校维修隧道的未知交易台 | 1672×941 / `8A48B8C8BB189B4F1D928E8FC3AA677C1B86BD00A747D23251448AB10192DBE2` | `[data-asset-key="event-demondeal"]` | 已检：无字、无水印 |
| 事件·盗匪横行 | 土匪×5、多敌战斗 | `scenes/event-bandits-v1.png`；暴雨废校走廊五个原创掠夺者 | 1672×941 / `15B7EF057789818E8AE9E38DFEB4EEE6CD80DC01CFA9186615A19616EAFC5F71` | `[data-asset-key="event-bandits"]` / `.bt-foes` | 已检：无字、无水印 |
| 事件·神秘补给 | 彩色令牌、+2 币 | 原创应急补给柜；待生成 | — | `.scene.sc-event` | 待生成 |
| 事件·金矿 | +3 币 | 原创地下维修层矿化裂缝；待生成 | — | `.scene.sc-event` | 待生成 |
| 事件·闪金之锤 | 5 伤害事件战斗 | 原创临时动力锤与废校机房；待生成 | — | `.scene.sc-event` / `.bt-foes` | 待生成 |
| 事件·爱心救济站 | 回复 6 血 | 原创校医室救济台；待生成 | — | `.scene.sc-event` | 待生成 |
| 事件·空中补给 | 随机资源 | 原创天窗下的空投箱；待生成 | — | `.scene.sc-event` | 待生成 |
| 事件·宝箱 | 抽取宝箱 | 原创地下储藏室箱体；待生成 | — | `.scene.sc-event` / chest overlay | 待生成 |
| 事件·系统补给 | 令牌、木材 | 原创无人机补给终端；待生成 | — | `.scene.sc-event` | 待生成 |
| battle | 玩家 vs 普通敌人 | 角色/怪物体系现为独立 SVG 图鉴；新增背景待契约 | — | `.bt-self`, `.bt-foe`, `.bt-fportrait` | CSS 已验收 |
| Boss battle | 玩家 vs 将军/兽人首领/元素领主 | 3 个 Boss 保持语义独立；新增背景待生成 | — | `.bt-boss` | 待生成 |
| shop/fire/chest/door/altar/extract/pick | 商店、火堆、宝箱、门、祭坛、撤离、拾取 | 各自 tone 色与终端层已接入；独立背景待生成 | — | `.sc-shop` 等 | CSS 已检 |
| 11 职业 | 刺客、剑客、术士、法师、牧师、授印者、降临者、召唤师、守卫、游侠、战士 | 每职业保持武器/职业语义，当前 `classArt()` SVG；独立位图待生成 | — | `SDT.Art.classArt()` | 语义表已盘点 |
| 11 普通/精英怪 | 步兵、弓兵、土匪、骑兵、兽人投矛手、兽人斧手、兽人狼骑兵、火元素、水元素、草元素、龙 | 每个 id 独立保持行为/元素语义，当前 `monsterArt()` SVG；位图待生成 | — | `SDT.Art.monsterArt()` | 语义表已盘点 |
| 3 Boss | 将军、兽人首领、元素领主 | grow/frenzy/aegis 语义保持；位图待生成 | — | `monsterArt(boss_*)` | 语义已盘点 |
| 卡牌框/稀有度/卡背 | 武术/法术/道具/装备/事件/英雄/资源，S/A/B/C/EV，7 卡背 | 石墨框、状态色与卡背纹理（CSS/SVG） | — | `.hs-card`, `.tier-*`, `.hs-back` | 已检：文本与类型未变 |
| 资源/道具图标 | 木材、口粮、金币、医疗针、绷带、水晶、烟雾弹等 | `icons.js` 程序化图标，保留物品语义 | — | `SDT.Icons` / `cardIcon()` | 已检：无缺图 |
| 装备/武术/法术卡面 | 卡面插画与效果 | 当前程序化卡面；独立插画资产待生成 | — | `Cards.cardHTML()` | 待生成 |
| 宝箱与全部图标 | 宝箱、门、旗、骰子、战斗状态 | 程序化 SVG + CSS 工业化处理 | — | `SDT.Art.gateIcon()`, `SDT.Icons` | 已检：无控制台 error |

## 生成提示词登记

### 已完成：标题主视觉

```text
Use case: stylized-concept. Asset type: FINAL 16:9 title-screen key art for original game Codename 7. An unmistakably hand-drawn 2D Japanese anime adult female disaster-zone search operative stands on the RIGHT third of a ruined modern school atrium, looking left into the mission area. Clean anime facial features visible in three-quarter profile, crisp inked linework, restrained cel-shading, flat graphic shadow shapes, subtle printed concept-sheet grain. Original practical charcoal layered tactical jacket, utility pouches, knee protection, radio and compact field scanner; no existing franchise resemblance. Concrete, steel beams, broken geometric skylight, wet floor, barricade tape shapes, distant amber emergency lamps and restrained cyan scan light. LEFT 42% must remain dark, uncluttered negative space for real HTML title/menu. Bold asymmetric industrial geometry, hard-edged light, black/white/grey plus cool cyan and tiny amber. Premium Japanese game art-setting-book presentation, NOT a movie poster, NOT photorealistic, NOT 3D. No text, letters, numbers, logo, watermark, symbols, fantasy robe, medieval motifs, candles, purple magic, stained glass, parchment, sexualization, excessive bloom or muddy detail. Entire character, face, hair, uniform, equipment, environment and composition must be completely original.
```

### 已完成：品牌标识

应用图标的两次独立 ImageGen 请求均因网络错误未产生文件。为避免候选或占位交付，最终标识改为项目内确定性位图：折角石墨铭牌、硬边数字 7、冷青校准线与单个琥珀警示块；由 `desktop/make-icon.ps1` 同源生成 256×256 PNG 与 ICO，网页 favicon 也直接引用 PNG，不使用 SVG。该做法确保小尺寸边缘与唯一字形准确。

### 已完成：时空孔隙

```text
Use case: stylized-concept; Asset type: game event scene background.
Primary request: original temporal rift inside an abandoned school gym for a search-and-extract event card.
Scene/backdrop: disaster-damaged school gym, vertical cyan-blue spatial fracture above cracked floor, rescue equipment, rain through broken skylights.
Subject: no characters, no readable text. Style: refined Japanese anime-inspired tactical illustration, cel shading blended with painterly atmosphere, crisp silhouettes.
Composition: wide 16:9, central rift with dark side margins for event UI.
Lighting: dramatic cold cyan rim light, tiny restrained magenta energy glints.
Constraints: completely original; no logos, trademarks, watermark, named-game or copied-character resemblance.
```

### 待生成提示词模板（每个条目需独立调用）

- 恶魔交易：废校封锁室、未知交易台、暗红能量与冷青轮廓光，无角色 Logo/文字。
- 盗匪横行：暴雨走廊、五个原创掠夺者远景剪影、障碍物与警示灯，无具体作品服装。
- 神秘补给：翻倒实验室中的原创应急补给柜、青色扫描灯与琥珀标签形几何但无文字。
- 金矿：地下维修层的金属裂隙与矿化墙面，金色反光但保持灾后校园语境。
- 闪金之锤：校工机房、原创动力锤与火花，冷青背景、少量琥珀高光。
- 爱心救济站：校医室临时救济台、医疗包与柔和青光，温暖但不出现 Logo。
- 空中补给：破碎天窗、悬吊空投箱、风雨与冷青体积光，留 UI 留白。
- 宝箱：地下储藏室原创金属箱、尘埃光束、琥珀锁扣，无文字。
- 系统补给：废弃控制室的无人机补给终端、青色扫描面板与木材箱，无品牌标识。

## 验收边界

- 所有成品必须复制到 `prototypes/map-system/assets/` 分层目录；不得引用 `.codex/generated_images`。
- 每张图目检无水印/文字/官方标识，哈希与引用点补齐后才标记完成。
- 10 把钥匙特殊关卡不制作资产。
