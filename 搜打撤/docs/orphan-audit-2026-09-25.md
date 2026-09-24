# 资产与 CSS 孤儿盘点报告（2026-09-25）

> 性质：**只读盘点**，本文档是唯一产出文件。未修改、未删除任何现有文件，未执行任何 git 写操作。
> 对应 `docs/pending-deletions-2026-09-25.md` 第 6 类（资产孤儿）与第 7 类（CSS 孤儿）的「待专项复核后补全清单」。**老板批前一律不删。**

## 0. 元信息

| 项 | 值 |
|---|---|
| 分析时点 | 2026-09-25（多轮重跑，最终快照） |
| HEAD | `3db59c6`（分析开始时为 `c89b289`，期间并行任务落库 `0fa8fbf` game.session 拆分、`7c35b56` game.cardslib 拆分、`3db59c6` docs） |
| 工作区 | game/css、game/src 多文件在途修改（M 状态，约 27 个）；CSS 行号以分析时点工作区为准，**落地删除前必须重扫核对** |
| 分析范围 | `game/assets/` 下 git 跟踪资产 1029 个 / 89.00 MB；`game/css/` 41 个 css |
| 方法 | ① 通读全部资产路径构造点（art.js / sound.js / icons-bitmap.js / renderer.icons.js / battle.frames.js / battle.vfx.js / lab.ending.js / home.visuals.js / cursor-art.js / vite.config.js）建立动态引用规则；② 脚本对每个资产文件做「字面路径 → 动态规则 → stem 词法 → thumb 镜像」四级判定；③ CSS 按 index.html `<link>` + JS `import` + `@import` 定入口，对 4616 个含类名规则块做类名生成点检索；④ 全部孤儿逐项人工复核（rg 生成点 + 提交历史 + 测试断言） |
| 语料口径 | git 跟踪文本 ∪ **工作区未跟踪的在途新文件**（game.cardslib.designer.js 等 5 个拆分子模块，已随 7c35b56 落库）。剔除 `game/src/generated/art-manifest.js`、`thumb-manifest.js`（构建期目录扫描产物，**不构成引用证据**，见 §5.1） |
| 分析脚本 | 临时目录 `D:\tmp\orphan-audit\`（asset-scan.mjs / css-scan.mjs / asset-results.json / css-results.json / dead-blocks.txt），可重跑复核 |

与 09-24 体检口径的对照：资产孤儿 ~100 文件 ≈8MB → 本次高置信 81 文件 2.67 MB + 中置信 26 文件 3.53 MB ≈ 107 文件 6.2 MB，量级吻合（原口径疑似把 redraw-preview 预览图与部分 docs-only 场景图一并计入）。CSS「cursor-art 三件套 + ~190 规则块」→ 本次 cursor 三件套实锤 + 87 死块（含解析重复，去重后 ≈82）。

---

## 1. 资产孤儿清单（高置信删除候选：81 文件 / 2.67 MB）

路径相对 `搜打撤/`。字节为磁盘实际大小。

### A 组：cursor-art 三件套连带（9 文件 / 35.8 KB）——置信度：高

09-23 批次（5662dd8）接入的光标系统。**已核实三重死**：`game/index.html` 无 `#codenameCursor` 元素、无 cursor-art.css `<link>`；`cursor-art.js` 全仓零 import；`cursor-art.css` 全仓无 link/@import/JS import，仅 page-battle-ui.css 注释与 docs 提及（注释不是引用）。资产被死文件字面引用，属「连坐死」。

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/css/cursor-art.css` | 6,913 | 无任何加载入口（38 个规则块随文件整删，未计入 §4 死块统计） |
| `game/src/ui/cursor-art.js` | 5,613 | 零 import；且 `'../assets/ui/cursors/'` 相对路径构造在 Vite 产物结构下本就不可达 |
| `game/assets/ui/cursors/field-pointer.png` | 2,767 | 唯一消费者为上两条死文件 |
| `game/assets/ui/cursors/target.svg` | 507 | 同上 |
| `game/assets/ui/cursors/unavailable.svg` | 4,060 | 同上 |
| `game/assets/ui/cursors/waiting.svg` | 4,114 | 同上 |
| `game/assets/ui/cursors/grabbing.svg` | 4,030 | 同上 |
| `game/assets/ui/cursors/interactive.svg` | 4,003 | 同上 |
| `game/assets/ui/cursors/pressed.svg` | 4,124 | 连坐死；且 cursor-art.js 状态机从未产出 `pressed` 状态（pressed 只是 class），此文件连死代码都未引用 |

### B 组：守卫白名单卡面死图 5 张 + 对应缩略图 5 张（10 文件 / 299.5 KB）——置信度：高

`tests/card-art-coverage.test.js` KNOWN_ORPHANS 白名单在案的已批死图（删除须老板批准，批准后同步收窄白名单，与 pending-deletions 第 2 类并案）。

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/assets/cards/martial-cc-treasure.webp` | 33,486 | KNOWN_ORPHANS：盗宝旧 id（现役 cmtn1i64j7y7 已有图），09-12 落错名事故遗留 |
| `game/assets/cards/martial-cc-jianghu.webp` | 36,406 | KNOWN_ORPHANS：江湖救急旧 id |
| `game/assets/cards/spell-cc-manasupply.webp` | 97,718 | KNOWN_ORPHANS：法力补给旧 id（现役 tt7-maxsupply 已有图） |
| `game/assets/cards/equip-tt3-dark-blade.webp` | 30,428 | KNOWN_ORPHANS：灭魔之剑整卡退役（09-16 已批） |
| `game/assets/cards/martial-builtin-sha.webp` | 57,076 | KNOWN_ORPHANS：「杀」改名 starter-attack 后遗留，**待批去留** |
| `game/assets/thumbs/cards/`（上 5 张同名 .webp，7,242/8,080/22,714/7,372/6,190 B） | 51,598 | thumb 镜像原图；原图为白名单死图，缩略图永无 low 场景命中 |

### C 组：构建期主动排除的等字节别名副本（2 文件 / 297.7 KB）——置信度：高

`vite.config.js` ITEM_ART_ALIAS 机制（L57-76）：`itemArt['tt-token-color'] === 'cmtmvq6ss84l'` 且两文件字节相同（已 `cmp` 实测相同）时，构建期从发布清单与副本中**主动省略**旧键文件。即 tt-token-color.webp 已不进任何构建产物，仓库副本是纯冗余。与 pending-deletions 第 6 类「source duplicates 2 组」并案。

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/assets/cards/items/tt-token-color.webp` | 277,178 | 别名机制排除发布；与 cmtmvq6ss84l.webp 字节相同 |
| `game/assets/thumbs/cards/items/tt-token-color.webp` | 27,692 | 同上（thumb 镜像） |

### D 组：被后继版本替代的旧场景图（14 文件 / 756.4 KB）——置信度：高

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/assets/scenes/battle-ruins-night-anime-v3.webp` | 63,428 | 字面零引用（全仓 rg 零命中）；现役战斗背景为 expedition-battle.css 的 `battle-street-amber-anime-v1.webp` 体系 |
| `game/assets/scenes/battle-tavern-far-anime-v1.webp` | 191,464 | 同上 |
| `game/assets/scenes/battle-tavern-floor-anime-v1.webp` | 165,638 | 同上 |
| `game/assets/scenes/layer4-priestess-light.webp` | 96,082 | 同上 |
| `game/assets/scenes/layer5-priestess-dark.webp` | 93,894 | 同上 |
| `game/assets/scenes/winter-expedition/battle-core.webp` | 53,796 | renderer.js 只字面引用同目录 outskirts/greenhouse/sanctuary/core 四张；battle-core 零引用 |
| `game/assets/scenes/winter-expedition/battle-street.webp` | 53,602 | css 实际引用的是 `battle-street-amber-anime-v1.webp`；本文件是 stem「battle-street」的词法假阳性，人工改判孤儿 |
| `game/assets/thumbs/scenes/`（上 7 张对应缩略图：8,886/8,892/7,442/8,936/9,358/7,428/5,676 B） | 56,618 | thumb 镜像，原图孤儿则缩略图孤儿 |

### E 组：杂项孤儿（9 文件 / 1,292.4 KB）——置信度：高

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/assets/ui/bag-icon-alt.webp` | 7,882 | 字面 + stem 双零命中；现役背包图标走 ui/icons 体系 |
| `game/assets/scenes/hub-wallpaper.jpg` | 262,207 | css（winter.css L455 等 3 处）引用的是 `hub-wallpaper.webp`（存在且在用）；`.jpg` 是被替换的旧格式 |
| `game/assets/thumbs/scenes/hub-wallpaper.jpg` | 15,040 | thumb 镜像 |
| `game/assets/ui/photo-studio/sign.webp` | 23,668 | **已拍板移除**：expedition-library.css L424 注释「sign.webp 随 09-23『彩带去掉』拍板移除」；`tests/premium-ui-pages.test.js:83` 有 `expect(css).not.toContain('assets/ui/photo-studio/sign.webp')` 负向断言锚定（字面命中来自断言与注释，非引用，见 §5.3） |
| `game/assets/ui/photo-studio/cabinet-trim.svg` | 2,244 | css 引用的是 `cabinet-trim-painted-v2.png`（2 处）；svg 为被替换的旧版 |
| `game/assets/scenes/battle-city-night-anime-v1.webp` | 153,926 | 运行时零引用，仅 docs/multi-agent-review-changelog 提及（文档提及不是引用） |
| `game/assets/scenes/battle-street-day-anime-v1.webp` | 176,702 | 同上 |
| `game/assets/scenes/endfield-ruins.jpg` | 520,799 | 同上（仅 docs 提及） |
| `game/assets/scenes/layer3-knight.webp` | 160,972 | 同上 |

### F 组：game-icons 素材库整目录（31 svg / 51.0 KB）——置信度：高

`game/assets/icons/game-icons/`（badges-crown、badges-heart、badges-skull、carl-olsen-crossbow、caro-asercion-round-potion、delapouite-boss-key、delapouite-chest、delapouite-coins、lorc-angel-wings、lorc-archery-target、lorc-battle-axe、lorc-bleeding-heart、lorc-book-aura、lorc-bordered-shield、lorc-bowie-knife、lorc-bright-explosion、lorc-broadsword、lorc-broken-shield、lorc-broken-skull、lorc-bubbling-flask、lorc-crossed-swords、lorc-crystal-ball、lorc-energy-breath、lorc-gem-necklace、lorc-heavy-arrow、lorc-hourglass、lorc-key、lorc-lightning-arc、lorc-scroll-unfurled、lorc-thunder-blade、lorc-treasure-map）。

判定依据：`renderer.icons.js` 的结点位图只按 `BITMAP_SRC` 表的 12 个名字取 `assets/icons/<name>.png`（缺图回退同名 .svg），**从不进入 game-icons/ 子目录**；该目录是 2026-09-09 NAI 重绘前的原始素材库（CC-BY 署名文件 LICENSE-CC-BY-3.0.md 同目录，删除时建议连同处置或保留署名，**须老板拍板**）。目录级排除法：目录名不出现在任何路径构造模板。

### G 组：home-prototype 非 clean 旧原型（6 svg / 3.0 KB）——置信度：高

| 文件 | 字节 | 判定依据 |
|---|---|---|
| `game/assets/home-prototype/chair.svg` | 441 | home.visuals.js 只字面引用 `-clean.svg` 变体（chair-clean 等 6 张）与 room-back/room-foreground/room-direction-candidate；本 6 张零引用 |
| `game/assets/home-prototype/display-cabinet.svg` | 668 | 同上 |
| `game/assets/home-prototype/table-lamp.svg` | 474 | 同上 |
| `game/assets/home-prototype/wall-decoration.svg` | 427 | 同上 |
| `game/assets/home-prototype/work-table.svg` | 485 | 同上 |
| `game/assets/home-prototype/woven-rug.svg` | 582 | 同上 |

（stem「chair」等命中的是 home.catalog.js 的**家具 id**，同名但非资产引用，见 §5.5。）

### 高置信组合计：81 文件 / 2.67 MB

---

## 2. 中置信候选（引用模型零命中，但去留涉及老板决策；可进删除候选，需逐项批）

| 组 | 文件 | 大小 | 说明 |
|---|---|---|---|
| 卡面漏登记映射 | `game/assets/cards/items/tt-peach.webp`（167,966 B）+ `game/assets/thumbs/cards/items/tt-peach.webp`（34,410 B） | 197.6 KB | 卡 id tt-peach 在 cards-sync.json 出现（卡可能现役），但 art-mapping.json itemArt 无此键 → art.js 永不取图。**是删图还是补映射，需老板定**（若属漏配图则删图是错的） |
| 资源重绘预览底稿 | `game/assets/cards/resources-redraw-preview/`（12 张原图）+ `game/assets/thumbs/cards/resources-redraw-preview/`（12 张缩略图） | 3.34 MB | art.js 只构造 `cards/resources/<key>.webp`，`resources-redraw-preview` 目录名不进任何路径模板 → 运行时绝对零引用（含 wood.webp——其字面命中来自 art-mapping 里正式路径 `cards/resources/wood.webp` 的子串，人工复核后归孤儿）。但目录性质是「资源重绘 redraw 前后对比底稿」，可能有美术工作流价值，删除须老板拍板 |

中置信合计：26 文件 / 3.53 MB。

---

## 3. 零引用但不入候选（记录在案）

| 项 | 说明 |
|---|---|
| `game/art-source/`（36 个跟踪源图） | 全仓零运行时引用，但性质是 NAI 出图/矢量化的**创作源归档**，且 tools/*.py、game/tools/bake-* 生成流程可能复用，未深查。保持原状 |
| `game/assets/scenes/lab-ending/ending-{1,2,3}.zip` + `*.payload.json`（未跟踪） | NAI 中间产物，pending-deletions 第 4 类已在案（ending webp 本体经 lab.ending.js 引用，是活的，勿动） |
| `game/assets/icons/game-icons/LICENSE-CC-BY-3.0.md` | CC-BY 署名文件。若 F 组整目录删除，署名义务需老板确认处置方式 |

---

## 4. CSS 孤儿清单

### 4.1 文件级（唯一：cursor-art.css）

41 个 css 文件，入口事实源 = `game/index.html` 的 `<link>`（36 个）+ JS `import '../../css/*.css'`（3 个：combat-feedback.css ← core/motion.js、home-scene.css ← home/home.scene.js、preparation.css ← hub/game.hub.js）+ `@import`（1 个：title-p0.css ← ui-scale.css）= **40 个在用**。唯一无任何入口的文件：**`game/css/cursor-art.css`**（见 A 组）。

> 易误报项均已核实为活：combat-feedback / home-scene / preparation 是 JS 动态 import（不走 index.html）；title-p0 靠 @import 间接加载；36 个 page-*.css / expedition-*.css 全部在 index.html 现场引用。

### 4.2 规则块级（87 块，winter.css 压缩行去重后 ≈82）

口径：对 40 个在用 css 解析全部叶子规则块，提取选择器中的类名，检索其生成点（game/src JS、index.html、game/data、tests；**css 之间互证不算**——别的 css 里也写这个类不代表 DOM 会生成它）。块内所有类名均零生成点 → 死块。动态拼串类名（`tp${ti}`、`hub-' + page`、`lab-tone-${tone}` 等）已按前缀保护剔除，另有一批死块在人工甄别中被 designer.js 等在途文件救回（见 §5.2）。

> **行号警告**：分析时点 game/css 下多文件处于在途修改（M 状态），行号会漂移。落地前必须按「选择器关键类名」重扫定位，不要按行号删。

| 文件 | 死块数 | 行号区间与选择器（判定关键类名均全仓零生成点） |
|---|---|---|
| `game/css/base.css` | 3 | L271-272 `#bagBtn .bag-cap`（#bagBtn id 本身已不存在，现役是 #bagBtnFloat）；L339 `.bag-card-detail`；L341 `.bag-drop-note` |
| `game/css/battle.css` | 5 | L3 `.bt-foes`；L18-19 `.bt-fportrait`；L20 `.bt-finfo`；L21-22 `.bt-finfo b`；L35-36 `.bt-ops-col`（旧战斗布局层，现役为 page-battle-ui.css 体系） |
| `game/css/cards.css` | 2 | L251 `.lib-actions`；L330 `.shop-grid` |
| `game/css/expedition-library.css` | 5 | L11 `.library-kicker`；L14 `.library-sidebar`；L15 `.library-filter-head`；L32 `.lib-actions`；L35 `.lib-pager` |
| `game/css/hub.css` | 6 | L43 `.deploy-grid`；L86 `.deploy-foot`；L87 `.deploy-forecast`；L101 `.stash-grid`；L115 `.dep-name`；L116 `.dep-stepper`（旧部署/仓格页类，现役为 page-deploy/page-stash 增量层） |
| `game/css/overlays.css` | 38 | L8-9 `.bag-cards`；L11 `.bag-card-note`；L41-42 `.base-main`；L43 `.base-col`；L58-65 `.bt-enemy`/`.bt-avatar`；L67-69 `.bt-estat`/`.bt-tags`；L78-82 `.bt-ops`/`.bt-player`/`.bt-tip`；L231 `.hud-left,.hud-right`；L233-247 `.hud-life`/`.hud-life-ico`/`.hud-life-main`/`.hud-shield` 家族；L249-265 `.hud-lv`/`.hud-lv-ring`/`.hud-lv-main`/`.hud-lv-chev` 家族；L267-275 `.hud-gold`/`.hud-gold-bar`；L278-283 `.hud-tri`；L408 `.shop-list`（旧 HUD/旧战斗面板家族，现役为 page-expedition-hud.css） |
| `game/css/scenes.css` | 12 | L190-194 `.bt-self`/`.bt-self .bt-fportrait`；L206-208 `.bt-self-tag`；L209 `.bt-hint-warn`；L236-238 `.evt-sts-title`；L242-244 `.evt-sts-main`；L245-250 `.evt-sts-art`；L251 `.evt-sts-opts`；L288-290 `.evt-opt-art`；L291 `.evt-opt-txt`（注意：同族的 `.evt-sts-desc`/`.evt-opt` 在 chests.js/game.run.flow.js 有字面生成、是活的，勿连带误删——死的只有上列这些） |
| `game/css/winter.css` | 16 条解析（压缩行去重后 ≈10） | L12 压缩段 `.ak-hex` 家族；L13 压缩段 `.ak-invest` 家族；L28 压缩段 `#mapLabels` + `.map-label` 家族（mapLabels id 与 map-label 类均零生成点，地图标签功能已下线）；L40-41 `.title-suggest`；L214 `.sac-list`；L235 `.back-sm`；L366-367 `.lib-pager`/`.lib-pageinfo`；L1651 `#bagBtn .bag-btn-art`（#bagBtn 同 base.css 条目） |

### 4.3 死块统计口径说明

- 4616 个含类名叶子块中 87 块全类名零生成点。winter.css 为半压缩文件（L12/L13/L28 单行多块），解析器产生少量重复条目，去重后实际约 82 块。
- 纯标签/ID/伪类块（无类名）不做此判定，不在 87 内；其中 `#mapLabels` 段因混入 `.map-label` 类被捕获，人工核实 id+类全死后计入。
- **这些死块不影响页面现况**（浏览器只是多解析几条永不匹配的规则），删除收益是维护性与体积；与「资产孤儿」不同，误删活块的代价是样式回归，故落地时建议每文件删后跑对应页面走查。

---

## 5. 误报保护段（报告可信度关键，逐条已核实）

### 5.1 清单命中 ≠ 引用
- `game/src/generated/art-manifest.js` / `thumb-manifest.js` 由 vite.config.js 构建期**扫描资产目录自动生成**（writeArtManifest/writeThumbManifest），是目录自拷贝。所有孤儿文件都「在清单里」，但运行时只是预热/回退判断用，从不被消费者点名。本报告已将两个文件从语料剔除。
- `game/assets/asset-manifest.json`（create-game-assets 登记表）与 `scripts/asset-audit.cjs` 的 unlisted/ghost 口径是**登记账目**，不是运行时引用（unlisted≠孤儿、listed≠活）。约 30 个「弱命中仅 asset-manifest」的文件已按零引用处理并人工复核。

### 5.2 动态拼串救回的「假死块/假死图」（本轮人工甄别剔除，**严禁连带删除**）
| 类名/资产 | 生成点 |
|---|---|
| `.tp1`~`.tp7`、`.rv0`~`.rv5` | cards.view.js L129 `hs-card tp${ti}` 模板拼串 |
| `.hub-ach`/`.hub-shop` 等 `#hubMain.hub-*` | game.hub.js L137-140 `'hub-' + pageId` 拼接 |
| `.lab-tone-crisis/flight/abyss` | lab.ending.js L35 `lab-tone-${p.tone}`（tone 值来自数据） |
| `.cdes-*`/`.mech-*`/`.dmg-ctl`/`.dmg-hint`/`.stage-hint`/`.desc-count`/`.rar-dot` | `game/src/hub/game.cardslib.designer.js` 字面生成（该文件在分析前半程还是未跟踪在途文件，曾导致误判死块 +14，已纳入语料修正；已随 7c35b56 落库） |
| `.lib-cardwrap`、`.dep-card`、`.sts-unit`、`.bt-card`、`.bt-foe`、`.bt-potion` 等 | cursor-art.js 白名单字符串虽死，但同名类在现役 JS 有真实生成点（battle/deploy/view 层）——**cursor-art 死不影响这些类** |
| 资产：`assets/cards/spell-tt3-*/tt7-*/tt12-*` 等 187 张三族卡面 | art.js 按 `DATA.art.spellCardArt/martialCardArt/equipCardArt`（art-mapping.json，80+63+37 项）拼串；全部命中，无一孤儿（守卫测试保证 id 现役） |
| 资产：`assets/cards/resources/*.webp`、`cards/items/*.webp`（除 tt-peach/tt-token-color） | resourceArt/itemArt 键值映射拼串 |
| 资产：`assets/portraits/enemies/*.webp`（18 张）+ `cut/enemies/*.webp` | monsterIds + NEST_MONSTER_ALIASES；cut 图经 cutoutFigures() 运行时换源 |
| 资产：`assets/portraits/frames/`（39 张） | battle.frames.js HAS_FRAMES{wu,baita,changwuyu} × candidateNames()（idle/atk-wind/atk-hit/hurt/cast 各 -1..-5 + idle-breathe）按存在性探测加载；39 张全部落在候选名集内，**零孤儿** |
| 资产：`assets/sfx/`（62 个 ogg/wav） | sound.js 枚举模式全量核对（switch1-6/rollover1-6/click1-5/battle 各系编号/additions/jsfxr），**零孤儿** |
| 资产：`assets/ui/icons/*.png`（59 个） | icons-bitmap.js 顶部 `NAMES` 白名单（59 名）精确对照，全活；art.js FALLBACK question.png 亦活 |
| 资产：`assets/icons/`（根目录 png/svg） | renderer.icons.js `BITMAP_SRC` 12 名（battle/event/shop/fire/chest/key/extract/door/altar/boss/entrance/player），png 主路径 + svg 回退 |
| 资产：`assets/bgm-*.mp3`（3 个）、`assets/fonts/`（6 个） | sound.js `new URL` 字面；base.css @font-face + index.html preload |
| 资产：`assets/thumbs/`（其余约 470 张） | thumb 镜像规则双向判定：原图 live → thumb live（卡库 low 场景）。原 thumbs/cards 158 张一度误判孤儿即此规则缺失所致，已修正 |
| 资产：`assets/reconstruction/wallpaper-original.webp`、`brand-mark-codename7.png`、`title-wordmark.png`、`slot-bg-knight-fantasy.webp` | index.html preload / game.boot.js new URL / css 字面 |

### 5.3 测试负向断言不是引用
`tests/premium-ui-pages.test.js:83` `expect(css).not.toContain('assets/ui/photo-studio/sign.webp')` 与 expedition-library.css L424 的移除注释都含「sign.webp」字样——字面检索会误判活，实为**拍板移除的证据**（E 组）。

### 5.4 KNOWN_ORPHANS 白名单语义
`tests/card-art-coverage.test.js` 白名单 = **已确认死图**（不是活图白名单）；其中 `martial-melee`/`martial-ranged` 两条是合法兜底图（cardFamily() 按卡名正则生成，art-mapping cardFamilies 含此二名），对应文件是**活的**，已在 pending-deletions 第 2 类正确排除。

### 5.5 stem 词法假阳性案例（自动判 suspect、人工改判）
| 文件 | 假阳性来源 | 终判 |
|---|---|---|
| `scenes/winter-expedition/battle-street.webp` | expedition-battle.css 的 `battle-street-amber-anime-v1` 含子串「battle-street」 | 孤儿（D 组） |
| `scenes/hub-wallpaper.jpg` | css 的 `hub-wallpaper.webp` 子串 | 孤儿（E 组，css 用 .webp） |
| `home-prototype/chair.svg` 等 6 张 | home.catalog.js 家具 id「chair」等同名词 | 孤儿（G 组，visuals 只用 -clean 变体） |
| `ui/cursors/*` | 被 cursor-art.css 字面命中判「live」 | 连坐死（A 组）：唯一消费文件本身是死文件 |
| `cards/resources-redraw-preview/wood.webp` | art-mapping 正式路径 `cards/resources/wood.webp` 的子串 | 孤儿（§2 中置信组） |

### 5.6 在途重构提示
- 分析期间 `game/src/hub/game.cardslib.js`（7c35b56 拆分为 designer/common/art-warm/photo-fps/photo-props 五子模块）与 `game/src/run/game.session.js`（0fa8fbf 拆分六子模块）已落库；拆分前本报告的 cdes/mech/dmg 家族结论已按拆分后现场复核，无变化。
- game/css 约 20+ 文件在途修改（M 状态）：§4.2 行号会漂移，**以类名重扫为准**；expedition.css / expedition-library.css / game.cardslib.js 等文件属其他代理所有权，落地前需与其对齐。

---

## 6. 置信度口径与验证方式

- **高置信**：字面路径零引用 + 动态构造规则穷举未命中 + 上下文互证（死文件连坐/拍板记录/构建期机制背书）至少一项 → 进 §1 删除候选。
- **中置信**：引用模型零命中，但去留存在非引用价值（美术底稿/漏登记映射待补） → 进 §2，逐项报批。
- **低置信**：不进候选（本次无；art-source 类按「零引用但工作流归档」单独记录于 §3）。
- 复现方式：`node D:\tmp\orphan-audit\asset-scan.mjs`（资产）与 `node D:\tmp\orphan-audit\css-scan.mjs`（CSS），明细在同级 JSON。脚本只读仓库。
- 删除执行建议（获批后）：tracked 文件走 `git rm` 留痕；B 组删除同步收窄 card-art-coverage 白名单并跑该测试；C 组删除后跑一次 `npm run build` 确认 ITEM_ART_ALIAS 机制无回归；CSS 死块删除按文件逐个走对应页面实际走查。
