# 02 · 数据与资产清单（Unity 移植用）

目标项目：`D:\素材\代号柒\搜打撤\game`（v0.51.0）

## 1. 资产全清单（assets/，约 240 文件，总计约 120 MB）

### 大头（必须优先处理）
| 组 | 文件数 | 体积量级 | 格式 | 说明 |
|---|---|---|---|---|
| assets/portraits/enemies/ | 13 | 每张 2.0~2.5 MB，共约 29 MB | png | 敌人整图（手绘拍照原版，带纸底） |
| assets/portraits/full/classes/ | 11 | 每张约 1.3 MB，共 14 MB | png | 11 职业立绘原版 |
| assets/cards/ | 约 40 | 每张 0.3~3.3 MB，共约 55 MB | png | 桌游卡牌整摞扫描图 + resources/ 12 张资源特写 |
| BGM | 2 有效 | 4.2 + 4.6 MB | mp3 | bgm-black-stream-sea.mp3(局内)、bgm-sour-orange-earth.mp3(标题)；bgm-never-perching-bird.mp3 已删；M500000rh0dE2TyUic.mp3 为无引用孤儿文件 |
| assets/reconstruction/ + title-* | 若干 | 最大 6.4 MB (wallpaper-original.jpg)、4.1 MB (title-hero-ascension.jpg) | jpg/webp/png | 壁纸与标题背景 |

### 分组明细
- **场景图** `assets/scenes/`（15 个）：webp 为主（battle-normal-anime-v2、scene-{door,extract,fire,altar,chest,shop}-anime-v2、scene-pickup-{coin,key,rations,wood}-anime-v2、event-bandits-anime-v2），另有 battle png 原图与 scene-deploy-anime.png、hub-{ach,classes,stash,upgrade}.png。
- **卡牌** `assets/cards/`：类型大图（consumable/equipment-*/event/healing/martial-*/resource-*/spell/unknown/hero.png 各 1.9~3.3 MB）+ 11 张 hero-*.png + `resources/` 12 张（diamond、econpack、garnet-marble、key*、ration*、wood*）。
- **立绘** `assets/portraits/`：`classes/`(11)、`enemies/`(13)、`full/classes/`(11)、`cut/classes/`(11)、`cut/enemies/`(13)、expedition-roster.png(3 MB)。**`cut/` 是构建期已抠图版本（透明背景、高≤760px）——Unity 直接用 cut/，原版作后备**。
- **图标（地图结点）** `assets/icons/`：11 组，每组 svg(36~88 KB)+png(4~24 KB 栅格版)——altar/battle/boss/chest/door/entrance/event/extract/fire/key/player/shop。另有 `icons-orig/`、`icons-source-web/`（源图 12 MB，可不搬）。
- **图标（UI）** `assets/ui/icons/`：**61 张小 png（400~1200 字节/张）**，对应 icons-bitmap.js 的 NAMES 集合。作 Sprite 使用。
- **冬季 UI** `assets/winter-ui/`：5 组 svg + raster/ 5 张 webp；menu-emblems/（source/ 大 png 约 9 MB 可不搬）。
- **音频**：
  - SFX：`sfx/` Kenney UI Audio（CC0）——click1-5.wav、rollover1-6.wav、switch1-6.wav；`sfx/battle/` 26 个 ogg（hit/hurt/heal/curse/parry/reveal/victory/defeat/legend/chestburst/chestshake，含 kenney-license.txt，CC0）。
- **字体** `assets/fonts/`：cascadia-code-400/700.woff2、notosans-sc-400/700.woff2（OFL，**Noto 为项目文本子集仅 1704 字形**）。CSS 引用 'Cascadia Code' 与 'Noto Sans SC Sub'，回退 Microsoft YaHei。Unity 需 ttf/otf：Cascadia Code 与 Noto Sans SC 均开源，可下载完整 ttf。

**Unity 搬运建议**：cut/ 立绘 + scenes webp（Unity 6 原生支持 webp 导入）+ icons png + ui/icons png + sfx（wav 直用、ogg Unity 原生支持）；icons-source-web/、portraits/{classes,enemies,full}、winter-ui/menu-emblems/source/、cards/ 大图按需。

## 2. 数据文件——全部内嵌 JS 对象，无独立 JSON

- **卡牌** `src/cards.js`（98 KB）：**245 条卡牌记录**内嵌（TABLETOP~TABLETOP8 + BESTIARY），按批次（TT1~TT9 + cc 迁移）通过 `seedBatch()` 播种进 **localStorage 键 `sdt-cards-v1`**，玩家改动优先于种子。字段：`id, name, cost(0-5), rarity(初始/古朴/稀有/史诗/传说/衍生/职业/棱彩 8 档), type(武术/法术/生物/道具/装备/事件/英雄卡/资源 8 类), dmg, dmgType(attack/spell/fixed/true), draw, infuse, heal, armor, desc, value, sellable, unrandom, cls, hero, art`。示例：`{ id:'foe-infantry', name:'荒民打手', cost:0, rarity:'衍生', type:'生物', unrandom:true, art:'infantry', desc:'攻击 4 / 生命 4。...' }`。BESTIARY 14 条（10 小怪 + 3 BOSS + 龙）。
- **角色** `src/characters.js`：5 个远征角色（霜翎/白契/栗团/玄砾/灯葵），字段 `id,name,rulesetId(5 职业之一),visualId,color,tag,bg,task,role,skin,hair,outfit,scale`。职业表 `CLASSES = ['侠客','战士','牧师','法师','降临者']`（11→5 整合，LEGACY 映射表保留旧名）。
- **地图** `src/mapData.js`（16 KB）：8×8 抽象三环棋盘（外 28 + 中 20 + 内 12 格 + 中央祭坛 2×2 + 3 BOSS），`SDT.MAP` 含 `version,boardId,boardName,cols:30,rows:30,tile:48,nodeLayout{radii:[560,390,225],jitter...}` 与确定性 `buildNodePositions()` 极坐标布局算法。**节点类型枚举 13 种**：coin/wood/battle/event/shop/fire/chest/rations/key/emergencyExit/door/altar/boss。
- **场景文案** `src/game.run.data.js`：SCENES（13 种节点的 icon/title/tone/btn/lines 台词池）、CLASS_STORY（11 个旧职业背景故事）、PRELOAD_SCENES、EVENT_SCENE_META。纯内容只读数据。
- **建议**：导出 JSON 作 TextAsset 或生成 C# 静态数据类（245 卡 + 5 角色 + 13 节点类型，量级完全可行）。

## 3. 叙事事件——标准 ink JSON

- `src/generated/narrative-events.js`：`export default {"inkVersion":21,"root":{...},"listDefs":{}}` —— 标准 ink 编译产物（inkVersion 21），由 `scripts/compile-narrative.mjs` 从 `narrative/events.ink` 编译。
- `src/narrative.js` 用 **inkjs**（`new Story(storyContent)`, `ChoosePathString`, `ContinueMaximally`, `currentChoices`）消费。卡片 id→knot 映射（KNOTS），choice 文本用自定义 `@@effect=...@@detail=...@@tone=...` 元数据语法解析（`parseChoice`），无 ink tags。**Unity 侧需 C# ink 运行时（ink-engine-runtime）+ 照抄 choice 元数据解析**。
- 10 个事件（knot）：timeskip 踏入时空气隙瞬移 6 格；demondeal 以血换传说物品；bandits 雨中遭遇掠夺者×5；goldmine 塌矿井安稳挖矿或冒险深挖；mystery 补给柜翻出令牌+币；goldhammer 抡动力锤先手 5 伤；relief 校医室回复 6 血；airdrop 空投三选一物资；chestdraw 双箱一枚芯片二选一；systemsupply 终端补给令牌+木材。

## 4. 存档格式——全部 localStorage，无文件写盘

- 对局存档：`game.storage.js` → 键 **`sdt-save-v2-slot{1..5}`**（5 槽位），旧键 `sdt-save-v1` 自动迁移。写入字段（game.session.js 快照）：`seed, rngState, layerIdx, trackPos, hp, maxHp, coins, turn, atk, mode, myClass, characterId, inventory, ownedCards, cardOrder, usedPocket, eventLog, discovered, diceHistory, elapsed, slot, savedAt`。读取时经 `migrateRunCharacter`。
- 卡库：`sdt-cards-v1`（+十余个 `sdt-cards-ttN-seeded` 播种标记）。基地/全局：`SDT.Base.data`（含 `stats.playSeconds`、`characters` 每角色 lv/xp），另有 `sdt-banner/sdt-cell-notes-v1/sdt-music-vol/sdt-sfx-vol/sdt-muted/sdt-suggestions-v1` 等约 14 个键。
- `output/` 目录只有设计产物与 suggestions.json 玩家反馈，**不是存档**。

## 5. 图标系统

- `assets/ui/icons/*.png`（61 张小位图）是现成静态位图，`icons-bitmap.js` 运行时用 `img(name)` 拼 `<img>` 标签 + emoji→图标映射 + `[[icon:xxx]]` 文本令牌替换。无精灵表打包。
- `assets/icons/*.svg`（11 结点图标）与 `renderer.icons.js`：renderer 惰性加载**同目录同名 png**，SVG 只是矢量源；`drawIcon/drawFlame` 提供代码手绘回退。Unity 侧：直接用 icons/*.png 做 Sprite，canvas 手绘版可弃。

## 6. 构建与工具

- `tools/bake-cutouts.js`：Electron 离线抠图脚本——读 portraits 原版，等比降到高 760 → 洪泛去纸色 → 轮廓羽化，输出 `portraits/cut/`。
- `vite.config.js`（位于 搜打撤/ 上层）：版本号注入 `__BUILD_VERSION__`；自定义插件把 5 个运行时动态引用目录（cards/portraits/icons/ui/icons/sfx）拷到 desktop-app/game/assets/，其余走 Vite 哈希管线。
- `version.json`：`{"version":"0.51.0"}`。

## 关键结论

1. 资产约 240 文件 / 120 MB，最大头卡牌扫描 png（~55 MB）与敌人立绘原版（~29 MB，已有抠好的 cut/ 替代）。
2. 卡牌 245 张 / 角色 5 个 / 地图 13 种节点类型数据全部内嵌 JS，无独立 JSON。
3. 叙事是标准 ink JSON（inkVersion 21）+ inkjs，choice 元数据走自定义 `@@key=value@@` 语法。
4. 存档全在 localStorage（`sdt-save-v2-slot{1-5}` + `sdt-cards-v1` 等 ~14 键）。
5. 有效 BGM 仅 2 首（never-perching-bird 已删；乱码名 mp3 为孤儿）；音效 Kenney CC0（wav+ogg）；字体 woff2 子集（中文字形仅 1704，Unity 侧需换完整 ttf）。
