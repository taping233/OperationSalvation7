# 删除报批清单（2026-09-25）——**已执行完毕**

> 老板 09-25 批示：「UI 图标重绘方案暂时取消，其他你都执行」。除图标方案外全部落地，
> 分三笔落库：资产批、`cd6c3ba` JS 死代码批、`49f7cd7` CSS 死块批。本清单留档。
## 已执行

1. **临时工作文件 4 个**：`.tmp-codemod.mjs`、`.tmp-lint-analysis.mjs`、`battle-lint.tmp.json`、`full-test.tmp.log` ✅
2. **卡面死图 5 张 + thumbs 5 张**：martial-cc-treasure / martial-cc-jianghu / spell-cc-manasupply / equip-tt3-dark-blade / martial-builtin-sha（含 thumbs 镜像）；`card-art-coverage` KNOWN_ORPHANS 白名单同步收窄至 martial-melee/ranged 两条合法兜底，守卫测试绿 ✅
3. **走查截图产物**：`game/.sdt-shots-upgrade/`（9 张）✅
4. **NAI 中间产物**：lab-ending `ending-{1,2,3}.zip` + `*.payload.json`（6 个，webp 本体保留）✅
5. **体检基线 worktree**：`D:\素材\_wt-head-check` 及注册记录——核实已不存在（此前批次已清），仅销账 ✅
6. **孤儿资产 108 个跟踪文件**（orphan-audit 高置信 81 + 中置信 26 + license 1）：
   cursor-art 三件套连带 9、别名副本 2、旧场景图 14、杂项 9（sign.webp 系 09-23 拍板移除）、
   game-icons 整目录 31+署名、旧原型 6、tt-peach 2、redraw-preview 底稿 24 ✅
7. **CSS**：`cursor-art.css` 死文件整删（含其 2 行在途改动，零挂载无效果面）；
   `overlays.css` 死规则块 85 行（旧 HUD 徽章族/旧战斗面板族/旧基地容器/旧背包网格/shop-list，
   含报告漏列的 slot-hud 族——补核零生成点后删）✅
8. **meta.js**：`track('extract'/'death')` 孤儿 case（纯 switch 无反射，零调用方）✅
9. **休眠代码**：cardslib 分页机制残留（libPageIndex/分页条渲染/三页缓存/预热任务/keepPage 死分支/
   libPagePrev-Next 死注册）、overlay.js sceneNext 死探测、run.scenes finishScene/sceneState ✅
10. **`.pyc` 停跟踪**：`git rm --cached` + `.gitignore` 拉黑 `__pycache__/` ✅

## 取消 / 保留 / 延后

- **UI 图标重绘方案：取消**（老板 09-25 拍板）。关联项 `gear.png` 画错（循环箭头非齿轮）**维持现状**——无备用图，随方案取消一并搁置。
- **ending-3 人影**：保留原样（出图定版语义）。
- **art-source/ 36 张创作源归档**：零引用但属创作档案，报告 §3 建议保留，未动。
- **CSS 死块余量 43 块**（base/battle/cards/expedition-library/hub/scenes/winter 七文件）：文件含 UI 审查会话在途改动，避让延后——待其落库后由巡检轮按类名重扫清除。
- **`cursor-art.css` 上 UI 审查会话的 2 行在途改动**：随死文件删除一并消灭（该文件零挂载，改动无效果面），已在提交披露。

## 第二批（09-25 死代码清理授权批，同日追加）

> 老板 09-25 明确授权删除死代码（逐项 rg 验证零引用后才删，宁漏勿误）。禁碰在途改动区间与全部素材。
> 验证：`npx vitest run tests/contracts.test.js tests/premium-ui-pages.test.js tests/photo-studio-presentation.test.js --no-file-parallelism` 27/27 绿；全文件花括号配对平衡。

### 已删（合计 -212 行）

1. **expedition-library.css（-127 行）**【已删 09-25 授权批】：
   `.library-title` 全系列规则块（含金翼衬花 header-flourish 引用块、4.5 标题下衬线、studio-index-layout 系列）——当前 DOM 恒为 photo-studio-v3.studio-index-layout，无 .library-title 元素（cardslib.js:538 为空保护查询永不命中，photo-studio-craft.css 同类死规则不在本批文件清单、未动）；
   `.library-sidebar` 遗留 hover 规则（零生成方）；
   稀有度夹子分档 rv0-rv7/rv-prism 7 块（每张照片纸均挂 data-photo-mount，被 photo-studio-mounts.css:45 `display:none!important` 全压制）；
   `.photo-corner` 相角贴 2 处（JS 零渲染，corner.webp 素材按禁令保留）；
   4.8 段 `.library-head` 两处死折叠列（≥1101px 四列版与 600px 三列版，被 craft.css:2 与本文件 studio-index-layout 终版页眉规则压制）+ 中屏 caption b 字号覆盖（craft.css:161 同特异性后胜，small 行保留）。
2. **card-v3.css（-3 行）**【已删 09-25 授权批】：`.lib-item{contain-intrinsic-size:auto 122px}` 旧遗值及注释——libGrid 恒渲染在 `.card-library-page` 内，被 expedition-library.css 的 `#overlay .card-library-page .lib-item`（auto 344px）覆盖。
3. **hub.css（-26 行）**【已删 09-25 授权批】：`.cls-list/.cls-card/.cls-ico/.cls-info` 簇 16 行（零 DOM 生成方；motion.js:50 的 `.cls-card` 查询为空转 no-op，不在允许文件清单未动）；`.stash-row` 三连（零生成方；复合 focus-visible 规则保留，服务 .dep-card/.bag-cell）；`.dep-name/.dep-stepper/.step-btn` 7 行（零生成方；`.dep-n` 徽标款按要求保留）。
4. **winter.css（-6 行）**【已删 09-25 授权批】：`.ak-banner` 死规则段（基础定义整行、1100px/740px 两媒体档内片段、入场动画行、active 缩放/过渡选择器修剪）；`.lib-grid` 四个死折叠档（1100px 四列、860px 三列、998-1003 块内 auto-fill 档、560px 两列档——均被 expedition-library.css:25 高特异性 `!important` 压死）。1360-1380 血条段、1671-1678 背包浮键段未碰。
5. **title-p0.css（-24 行）**【已删 09-25 授权批】：ak-banner/bn-* 纯死规则（1101px 档海报式定位块等）删除 + 混合选择器中 ak-banner/bn-* 死支修剪（ak-circle 支全部保留）。
6. **expedition.css（-17 行）**【已删 09-25 授权批】：ak-banner/bn-* 纯死规则（top 定位×2、workshop-staff 图标变量、bn-arrow、紫晶 --home-glow 档、bn-ico::before 背景档）+ 混合选择器死支修剪；09-25 新加的 `#title .ak-banner, #title .ak-circle` 基态过渡规则按要求原样保留；133-135 图标盘缩放未碰；`#sidebar #bagPanel/#bagBtn` 死规则 6 条（DOM 09-19 已删，仅剩 #bagBtnFloat 活规则）。
7. **cards.css（-1 行）**【已删 09-25 授权批】：`.shop-grid`（全仓零引用复核确认）。
8. **index.html（-8 行）**【已删 09-25 授权批】：`.winter-edition` 卷号行、`.st-orn` 装饰 SVG×2、`.ak-bp`（含 .ak-word 字牌）、`.ak-plus p1/p2`、`.ak-line1`——五组均被 expedition.css 恒久 `display:none`（expedition.css:68/186/201），无可见效果；game.menu.js:78 对 `.ak-word` 的彩蛋查询空安全（`if (word)` 守卫），JS 未动。

### 核验后跳过（未删，保留现场）

- **expedition-library.css 4.8 段 type-badge 无框化**：全仓无任何后续覆盖（craft/page-cardslib 均无 type-badge 规则），删除会令前行 1328 的边框徽章款复活＝可见变化，不是死规则，跳过。
- **expedition-library.css libPhotoPageIn 段**（keyframes+动画规则，约 2556-2558 行）：与 UI 审查会话在途改动区间（原 2689-2699）重叠，按纪律整体跳过。
- **hub.css #btnDeploy 双定义**：三处 DOM 生成方（hub.depart.js:29/178、altar.js:865）；bare 款仍向出发页 deploy-primary 提供 letter-spacing/serif/text-shadow，.dep-foot 款仍提供 font-size/flex——均部分存活，跳过。
- **hub.css .dep-back 9px 圆角款**：有生成方（hub.depart.js:177）；仅 border-radius 被 page-deploy.css:255 压死，hover filter 等声明仍活，整条跳过。
- **hub.css .dep-list**：altar.js:853 有生成方，活规则，跳过。
- **base.css #bagPanel/#bagBtn 残余、winter.css:22/1646 #bagBtn 残余**：不在本批允许文件清单，未动。
- **winter.css:1252 `.lib-item` contain-intrinsic-size、:360 lib-grid 基础六列档**：不在授权清单枚举范围，未动（后续巡检候选）。
