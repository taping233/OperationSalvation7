# 并行批 · 资源体积与重复加载审计（2026-09-28，子代理 C）

只读审计报告。本任务唯一写入物即本文件；未修改任何源码、资源、构建脚本或共享记录，未生成 build，未删除/压缩/移动任何资源，未安装依赖，未提交/推送。

## 1. 审计口径

- HEAD：`e6836fc1538085458b8afb6cd9eabef229cf235d`（master，2026-09-28 14:51:03 +0800「docs(vite): record hand selection and pet egg verification」）。`git log -1` 与 `git status --short` 实测核对。
- **工作区不干净**：主线有另一并行会话的未提交改动。跟踪文件修改 12 个（比协调者清单多 1 个，如实记录）：
  1. `搜打撤/docs/REFACTOR-2026-09-28.md`
  2. `搜打撤/docs/development.md`
  3. `搜打撤/docs/quality-gates.md`
  4. `搜打撤/game/src/battle/battle.selection-flow.js`
  5. `搜打撤/game/src/hub/base.js`
  6. `搜打撤/game/src/run/game.session.js`
  7. `搜打撤/jsconfig.strict-foundations.json`
  8. `搜打撤/jsconfig.strict-hand-selection.json`
  9. `搜打撤/scripts/check-types.mjs`
  10. `搜打撤/tests/battle-selection-flow-boundary.test.js`（协调者清单未列，实测存在）
  11. `搜打撤/tests/strict-foundations-types.fixture.ts`
  12. `搜打撤/tests/strict-hand-selection-types.fixture.ts`
  另有大量未跟踪文件/目录（`.codex/`、`.exp-observe/`、`.ui-*`、仓库根 `package.json`+`package-lock.json`（仅 puppeteer-core 依赖，属其他会话工具链）、5 个 09-28 构建产物目录、`docs/PARALLEL-CODE-QUALITY-TASKS-2026-09-28.md`、evidence 图片等）。
- **未提交改动对资产链路结论的影响评估：无影响**。依据：
  - 12 个修改文件中无任何资产文件、无 `vite.config.js`、无 `game/data/art-mapping.json`、无 `game/data/cards-sync.json`、无 `game/assets/asset-manifest.json`、无 `game/src/generated/art-manifest.js`/`thumb-manifest.js`（构建期生成的清单）、无预算常量 `game/src/core/performance-budgets.js`、无 `game/index.html`、无 `game/css/*`；
  - 三个源码文件（battle.selection-flow.js / base.js / game.session.js）的 `git diff` 内容经关键词扫描（asset/webp/png/mp3/ttf/font/manifest/art）零命中（唯一命中为 "departure" 内含 "art" 的子串误报），改动属选人/离场/会话状态域；
  - 其余为文档、jsconfig、类型检查脚本与 fixture，不在资产链路。
  - 因此本报告的资产统计与源码结构结论对当前工作树有效；若并行会话后续落库涉及 `vite.config.js`/art-mapping/清单文件，结论需复核。

## 2. 脚本只读性确认（先于运行）

两个脚本均完整通读（89 行 / 106 行，均 <300 行，无需先 rg）：

- `scripts/asset-audit.cjs`：仅使用 `existsSync/readFileSync/readdirSync/statSync` + `node:crypto` 哈希 + `console.log`。**零写盘、零 exec/spawn，确认只读**。能力：源码资产（`game/assets`）统计与 Top8；指定/默认构建目录（`desktop-app/game`）统计与 Top8、包/源比；对 ≥64KB 源文件做 size→sha256 分组找重复（Top5）；`asset-manifest.json` 清单漂移校验（unlisted/ghost/license）。
- `scripts/perf-budget.cjs`：仅使用同一组只读 fs API + `zlib.gzipSync`（内存压缩，不落盘）+ `console.log`。**零写盘、零 exec/spawn，确认只读**。能力：读取 `performance-budgets.js` 预算常量与 `STARTUP_SCENE_KEYS`，对构建目录检查包总字节、全文件 sha256 重复字节、入口 gzip、首屏 JS gzip（index.html 内 `<script src>`/`<link href="./*.js">`）、battle.view chunk gzip、vendor-narrative chunk gzip、CSS gzip。
- 注意区分：`vite.config.js` 的 `copyStatic` 插件**有大量写盘副作用**（`clearGeneratedDir` 用 `execSync('rd /s /q')` 删产物目录、构建期重写 `src/generated/*-manifest.js`、`patchAssetVersions` 重写产物 JS/CSS）。但它 `apply: 'build'`，仅在 `vite build` 激活；`npm run assets:audit` / `npm run perf:budget` 都不会触发它。本任务未运行 build。
- 实际运行命令（cwd=搜打撤；两脚本内部用 `__dirname` 解析路径，与 cwd 无关）：
  - `node scripts/asset-audit.cjs`（即 `npm run assets:audit`）
  - `node scripts/perf-budget.cjs`（即 `npm run perf:budget`；对默认产物根 `desktop-app/game` 检查，退出码 0）

### 2.1 关键输出摘录（当前工作树，2026-09-28 实测）

asset-audit.cjs：

```text
Source assets: 955 files, 90.61 MB
     7.88 MB  fonts\HarmonyOS_Sans_SC_Regular.ttf
     7.78 MB  fonts\HarmonyOS_Sans_SC_Bold.ttf
     4.20 MB  bgm-cisheng-yuanan.mp3
     3.77 MB  bgm-liejie-fuhe.mp3
     3.57 MB  bgm-sour-orange-earth.mp3
     3.09 MB  ui\photo-studio\leather-archive-v1.png
     2.60 MB  ui\title-plaque-metal-v1.png
     1.87 MB  title-wordmark.png
Packaged game: 943 files, 85.27 MB        （= desktop-app/game，09-25 产物，见 §3）
Package/source ratio: 94.1%
Source duplicates: 1 groups, up to 0.08 MB reclaimable
  0.08 MB x2: cards\expedition-starters\rations.webp, cards\resources\ration.webp
Manifest drift: 708 unlisted, 33 ghost, 0 license-pending
```

perf-budget.cjs：

```text
[perf-budget] startup=6/40
[perf-budget] package=85.27 MiB, duplicates=0.62 MiB
[perf-budget] entry-gzip=242.9 KiB, initial-js-gzip=255.6 KiB, battle-gzip=102.1 KiB, narrative-gzip=31.0 KiB, css-gzip=121.5 KiB
[perf-budget] PASS
```

注意：`Source assets 90.61 MB` 是当前实测；`docs/performance.md` 记录的「2026-09-04 源码资产 312.16 MB」是当日快照（其间经历了 orphan-audit / pending-deletions 等清理批，见 `docs/archive/orphan-audit-2026-09-25.md`、`docs/archive/pending-deletions-2026-09-25.md`），两者不矛盾，**旧文档数字不得当作当前指标**。同理下文产物指标全部属于 09-25/09-28 的产物，**产物指标 ≠ 当前源码指标**（当前源码未构建）。

## 3. 构建产物盘点与溯源

`desktop-app/` 下共 6 份产物目录，合计 **512.8 MB**（`du -sb` 实测）。全部 `version.json` 内容仅 `{"version": "0.60.0"}`，**不含提交哈希**；产物目录全部未被 git 跟踪，无历史构建物可比对哈希。溯源依据 = 目录 mtime + git 提交时间窗 + chunk 组成差异 + 产物内特征字符串（minified 后存留的属性名/字符串），置信度分级如下：

| 产物目录 | mtime | 体积 | 对应提交（时间窗推断） | 证据与置信度 |
|---|---|---|---|---|
| `game/` | 09-25 18:17 | 85.3 MB | **d9a3967**（09-25 17:55:08） | 高。① chunk 仅 6 个，无 battle.core/game-card-catalog（96950de 09-28 12:29 引入的拆分）；② 产物 JS 不含 `curseOp`（d75bb5a 09-25 23:11 引入的解释器标识），早于 ee517e2（21:54）；③ perf-budget 指标（entry 242.9 / initial 255.6≈255.7 / battle 102.1 / narrative 31.0 / css 121.5 KiB、package 85.27 MiB、duplicates 0.62 MiB）与 `performance-budgets.js` 注释记录的 09-25 同日实测逐项一致 |
| `game-refactor-20260928-1155/` | 09-28 11:53 | 85.5 MB | be589a2（11:26）窗 | 中。时间窗（be589a2 后、96950de 12:29 前）+ 目录名；含 game-card-catalog chunk、无 game.cardslib.page |
| `game-refactor-20260928-photo-lazy/` | 09-28 12:35 | 85.5 MB | 96950de（12:29）窗 | 中。时间窗 + 目录名（photo-lazy 为并行会话实验，对应未跟踪 base-elapsed 文件）；产物内未命中 baseElapsed 特征（minify 改写所致，不能反证） |
| `game-code-quality-20260928-final/` | 09-28 13:11 | 85.5 MB | 9a51054（13:05）窗 | 中。时间窗（9a51054 后、86644ca 13:13 前） |
| `game-code-quality-20260928-round3/` | 09-28 13:59 | 85.5 MB | f4c5838（13:52）窗 | 中高。时间窗 + 产物不含 `petEgg`（74bf80f 14:40 引入） |
| `game-code-quality-20260928-round4/` | 09-28 14:48 | 85.5 MB | 74bf80f（14:40）窗 | 中高。时间窗（74bf80f 后、e6836fc 14:51 前）+ 产物含 `petEgg`×3 |

两个一致性锚点：四个 vendor chunk 文件名（`vendor-narrative-BRMhodx6`、`vendor-render-BY4dZLBD`、`vendor-runtime-DkOp-1lm`、`narrative-events-C2FxCESg`）在 6 份产物中完全相同，说明第三方依赖内容 09-25→09-28 未变；09-28 五份产物的 index.html 均为 22597 字节、826 个 png/webp，与 `game/`（20297 字节）的差别在 chunk 拆分与 index 装配。

**结论：不得把任何产物指标当作当前源码指标。** 本报告引用产物指标时均注明对应提交窗口；构建时工作区可能含未提交改动，与今天未提交清单未必相同。

## 4. 动态加载与运行时映射核查（判断"可移除/可延迟"的前置）

以下机制均已读源码核实，是第 6 节建议的前提：

1. **art.js 是唯一路径构造点**（`game/src/core/art.js`，574 行）：运行时 `img.src`/音频/fetch 路径统一经 `assetUrl()`（`game/src/core/asset-url.js`，追加 `?v=<version.json 版本>`）；卡面解析 `cardIcon()` 的优先级为 `cardArtRevisions`（修订号）→ `cardArtOverrides`（命中即 return）→ spell/martial/equip/creature/event 族文件 → itemArt → resourceArt → cardFamily 家族兜底 → FALLBACK `ui/icons/question.png`。
2. **art-manifest / thumb-manifest 是构建期烘焙清单**：`vite.config.js` 的 `writeArtManifest()/writeThumbManifest()` 在每次 build 的 buildStart 扫描 `RUNTIME_ASSET_DIRS = ['cards','portraits','icons','scenes','thumbs','ui/icons','sfx']` 生成 `game/src/generated/*.js`；`ITEM_ART_ALIAS`（tt-token-color→cmtmvq6ss84l）机制在两文件字节相等时把旧键从清单与副本中省略——**已存在的重复治理机制**。
3. **thumbs 不进 art-manifest**（`ART_MANIFEST_DIRS` 过滤掉 thumbs），有独立清单，由 `game/tools/bake-card-thumbs.cjs` 烘焙（448px WebP）；`art.js image()` 的 `low` 场景按 `THUMBS.has(src)` 判断，无缩略图回退原图不 404。
4. **cards-sync.json 有 retire 层**（684 行，`"retire": [...]`，消费方 `game/src/cards/cards.sync.js` 等），卡退役走数据层，不直接决定图片去留。
5. **守卫是 `tests/card-art-coverage.test.js`**（非 "il.test.js" 现名，那是历史文档里的旧称）：孤儿检测只覆盖 `assets/cards` 下 `martial-/spell-/equip-` 三族前缀文件；`LANDMARK_ART` 定稿清单防缺图/旧 id。**rations 双份不在守卫范围**（无三族前缀）。
6. **启动预热是老板拍板的设计**（2026-09-07「能首次离线进内存的就不在用时计算」、09-13「所有美术资源改成预加载」、09-08「启动强制预热+进度条」）：`warmBatched()` 分批 6 张 + `requestIdleCallback` + cardlib 打开时让路；顺序 = `STARTUP_SCENE_KEYS`(6/40) → `collectCardAssets()`（立绘优先）→ `collectManifestAssets()`（ART_MANIFEST 全量，portraits>scenes>cards>icons>ui 排序）→ `collectThumbnailAssets()`。**本报告不挑战该设计**，只谈清单内的冗余与资源本身的字节。
7. **BGM 首屏零加载**：`game/src/audio/sound.js` 三首 Howl 全部 `preload:false`，播放时才 load；主/标题曲 `html5:true` 流式，战斗曲 `html5:false`（播放时 WebAudio 全解码）。11.54MB 只占产物体积，不占首屏带宽。
8. **产物无"哈希版+原始版"双打包**：`assetFileName()` 把 RUNTIME 前缀的静态引用统一到原路径（vite.config 注释称旧实现单次构建白多约 10MB，已修复），实测产物内重复与源码重复一一对应（见 §5.3）。

## 5. 三类重复的实测结论（不凭文件名推断，全部 sha256 实测）

### 5.1 源码重复引用

- 未发现同一资源被多个模块以不同方式静态重复打包（`new URL()` 引用统一落同一文件）。
- 唯一疑似：**tt-rations 卡的双映射**。`game/data/art-mapping.json` 中 `cardArtOverrides."tt-rations" → "cards/expedition-starters/rations.webp"`（完整路径，`cardIcon()` 前段命中即 return，art.js:489），同时 `resourceArt."tt-rations" → "ration"`（拼成 `cards/resources/ration.webp`，art.js:514，位于 overrides 之后，**在 cardIcon 路径下不可达**）。是否真的零消费需运行时断点/日志二次确认（图鉴等其他视图可能走 resourceArt，未逐一排查）。

### 5.2 物理重复文件（不同路径、同 sha256）

源码 `game/assets` 全量扫描（不限 64KB）共 **25 组，可回收上限 0.62 MB**（与产物内完全一致）：

- `cards/expedition-starters/rations.webp` = `cards/resources/ration.webp`（80 KB）+ thumbs 镜像同重复（24 KB）；
- `portraits/frames/{wu,changwuyu,baita}/` 序列帧 11 组等字节对（39–61 KB/组，合计约 0.56 MB）：`cast-1=cast`、`hurt-1=hurt`、`idle-1=idle-breathe`、`atk-wind-1=atk-wind`（wu/changwuyu/baita 各若干）及 `baita/atk-hit-1=cast-4`、`atk-hit=cast-3`、`atk-wind=cast`——即动画首帧与静止帧字节相同，属烘焙产物冗余；
- `ui/icons/` 1 KB 级同哈希小图标 10 组（crystal=gem、book=cards=notes=save=scroll、bag=pocket=pouch 等，合计 <10 KB）；
- `cards/.gitkeep` = `portraits/enemies/.gitkeep`（0 字节，忽略）。

### 5.3 实际重复打包（进入产物后）

产物 `desktop-app/game`（09-25 产物）sha256 全文件分组：**25 组 / 0.62 MB**，与源码重复逐组对应（RUNTIME 目录原样拷贝 + 静态引用统一原路径，无二次复制）。`perf-budget` 预算 `packagedDuplicateBytesMax=904 KiB`，当前 0.62 MiB，PASS。

## 6. 首屏加载链与大资源（实测）

- `game/index.html` 首屏：`<link rel=preload>` 壁纸 `assets/reconstruction/wallpaper-original.webp`（源文件 1270 KB，标题页即首屏，合理）+ **`assets/fonts/HarmonyOS_Sans_SC_Regular.ttf` 7.88 MB** + cascadia/notosans woff2 三个；18 个 CSS（gzip 合计 121.5 KiB）；`<script type=module src=./src/main.js>` → entry 242.9 KiB gzip、首屏 JS 合计 255.6 KiB gzip（`manualChunks` 注释明确 game-card-catalog 为静态启动依赖，计入首屏）。
- `HarmonyOS Bold TTF`（7.78 MB）不 preload，`game/css/base.css` @font-face 按需，但 UI 粗体常见，实际很快触发。
- 产物 ≥1MB 文件 12 个合计 40.4 MB（占 85.27 MB 的 47%）：字体×2（15.66 MB）、BGM×3（11.54 MB，首屏零加载）、PNG×6（11.91 MB：leather-archive 3.09 / title-plaque 2.60 / title-wordmark 1.87 / note-atelier 1.85 / frame-atelier 1.30 / cabinet-trim 1.20）、wallpaper 1.24 MB。
- PNG 六件的引用入口（rg 实证）：`game/css/expedition-library.css:2064,2075,2093` + `game/css/page-cardslib.css:67`（leather-archive）、`game/css/expedition.css:77,161`（title-plaque）、`game/css/expedition.css:64` + `game/dev.html:10,160`（title-wordmark；**dev.html 不进产物**）、photo-studio 系 CSS（note-atelier/frame-atelier/cabinet-trim）。CSS 背景按需下载，但字节常驻产物。

## 7. 建议（按收益/风险排序，最多 5 条；全部为字节级推算，未宣称帧率收益）

1. **HarmonyOS 两个 TTF 转 woff2**
   路径：`game/assets/fonts/HarmonyOS_Sans_SC_Regular.ttf`（7.88 MB）、`..._Bold.ttf`（7.78 MB）；入口：`game/css/base.css:8-17` @font-face + `game/index.html:10` preload。
   收益上限：woff2 对 CJK TTF 典型压缩至 40–60%，**字节级推算省约 6–9 MB 产物字节、首屏 preload 项省 4–5 MB**；不确定性：实际压缩率与字形覆盖需实测，中文字形不可激进子集化（游戏文本动态组合），官方 woff2 版本可用性需验证。
   风险：低-中（渲染像素级差异需实页走查；需同步改 preload/@font-face/引用名）。
2. **photo-studio/标题 6 张大 PNG 转 WebP（保留 alpha）**
   路径与入口见 §6（合计 11.91 MB）。
   收益上限：PNG→WebP 有损典型省 60–80%，**字节级推算省约 7–9 MB 产物字节**并加快卡库/图鉴/照片工作室页首开；不确定性：皮革/金属质感与文字标边缘对压缩敏感，需老板视觉验收。
   风险：低（纯资源替换 + CSS 引用改名；thumbs 不涉及；art-manifest 构建期自动重生成）。
3. **desktop-app 6 份产物目录治理（磁盘收益，非游戏产物收益）**
   5 份 09-28 实验产物为并行会话未跟踪副本，与 `game/` 合计 512.8 MB，其中重复冗余约 427 MB。
   收益：**字节级推算回收磁盘约 427 MB**；不确定性：无（纯副本）；风险：低，但**删除必须先列路径报老板批准**（AGENTS.md 约束），且须等并行会话确认收尾。
4. **序列帧烘焙管线对等字节帧去重**
   路径：`game/assets/portraits/frames/{wu,changwuyu,baita}/` 11 组（§5.2），来源为烘焙产物（`game/tools/` 烘焙链）；入口：art-manifest 全量预热 + PIXI 序列帧运行时映射（art.js:163-166 队列构造）。
   收益上限：**约 0.56 MB + 11 次重复解码**；不确定性：动画时间轴仍需等长帧表，去重需帧表支持重复引用同一文件或烘焙输出别名，属代码改动。
   风险：中（动画表现回归需逐角色走查）——收益小，排后。
5. **rations 双份收敛（含 thumbs 镜像）**
   路径：`cards/expedition-starters/rations.webp` 与 `cards/resources/ration.webp`（同 sha256，80 KB）+ `thumbs/` 镜像 24 KB；入口：`game/data/art-mapping.json` `cardArtOverrides.tt-rations`（优先生效）与 `resourceArt.tt-rations`（cardIcon 路径下疑似不可达，§5.1）。
   收益上限：**约 104 KB**；不确定性：resourceArt 后备是否被其他视图消费未运行时验证；需同步 cardArtRevisions/缩略图重烘。
   风险：中低；收益最小，排最后。

**不建议项**：BGM MP3 重编码（可省 3–5 MB，但属音质决策需老板拍板，且 `preload:false` 已使运行时零首屏成本）；ui/icons 1 KB 级重复（<10 KB，不值得动）。

## 8. 窄范围实施切片（供主线选用；本任务不执行）

每片均不修改现有预算（`performance-budgets.js`：package 112 MiB / duplicates 904 KiB / entry 270 KiB / initial-js 310 KiB / battle 104 KiB / narrative 50 KiB / css 136 KiB / startup 40，只引用不改），收尾若涉公共资产架构则按仓库约束跑 `npx vitest run --no-file-parallelism`。

- **切片 A（字体 woff2）**：动 `game/assets/fonts/*` + `game/css/base.css` + `game/index.html` preload。验证：转码后构建，`perf-budget` PASS 且 css-gzip 无异常增长；DevTools 确认 woff2 请求 200、无 TTF 回退请求；标题/卡面/战斗实页字体走查；`assets:audit` 前后字节对比留档。
- **切片 B（PNG→WebP）**：动 §6 六张 PNG + 对应 CSS url（+dev.html）。验证：expedition-library / page-cardslib / expedition 标题 / photo-studio 实页走查（按仓库约束 CSS/图片验实页）；`assets:audit` 前后对比；老板视觉验收留证。
- **切片 C（产物目录报批清理）**：列出 5 个 `desktop-app/game-*` 路径报批，批准后删除并 `du` 复核。验证：删除前后目录清单与字节数留档。
- **切片 D（可选，rations 收敛）**：先运行时确认 `resourceArt.tt-rations` 不可达（日志/断点或图鉴逐页走查），再统一映射指向单份文件、重烘 thumbs。验证：tt-rations 卡面在卡库网格（thumbs 路径）与放大视图（原图路径）均正常、无 404；`card-art-coverage` 守卫绿（该卡非三族前缀，守卫本身不受影响）；定向卡库测试绿。

## 9. 不确定项清单

1. `cards/resources/ration.webp` 是否完全不可达：仅静态分析 cardIcon 优先级，未运行时验证其他视图是否消费 resourceArt 后备。
2. woff2/WebP 转换的实际压缩率与视觉验收：未实测（本任务不压缩资源）。
3. 09-28 五份产物的对应提交为时间窗+特征字符串推断，非哈希级溯源（version.json 无 commit 字段、产物未跟踪）；构建时可能含当时的未提交改动。
4. `photo-lazy` 产物是否真含 photo-lazy 实验改动：minified 后 baseElapsed 特征未命中，仅目录名+mtime 推断。
5. asset-manifest 漂移（708 unlisted / 33 ghost，登记 267 / 实际 955 文件）：asset-manifest.json 属 create-game-assets 授权清单域，33 个 ghost 是否全部属于已批/待批删除未逐项核对（`docs/archive/pending-deletions-2026-09-25.md` 有历史批次记录）；处置归属不属本任务。
6. `performance.md` 的 09-04 基线（312.16 MB / 12 组重复 38.54 MB）与当前实测（90.61 MB / 0.62 MB）之间的清理批次未逐一溯源，引用了 archive 文档名但未核对每个删除项。
7. 未提交的三个源码文件改动内容按 diff 关键词扫描判定与资产无关，未逐行业务审读。
8. `performance-budgets.js` 注释 09-25 实测 initial-js 255.7 KiB 与本次对 `game/` 产物实测 255.6 KiB 有 0.1 KiB 出入，量级在四舍五入内，不影响溯源结论。
