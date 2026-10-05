# WF-motion-ui-p0 留证 README（2026-10-04）

- **工作流**：WF-motion-ui-p0（美术 UI 升级计划 P0-A + P0-B 实施）
- **留证会话**：留证员（本 README 写入者）；HEAD=`425d039`，全部改动**完成未提交**
- **本轮范围 8 文件**（`git status --porcelain` 实跑）：6 新建 untracked = `game/css/motion-transitions.css`、`game/src/ui/motion-transitions.js`、`game/src/ui/comm-feed.js`、`game/src/ui/transitions-director.js`、`game/css/title-relayout.css`、`game/src/ui/title-relayout.js`；2 白名单修改 = `game/css/overlays.css`（diff 11 行）、`game/src/ui/overlay.js`（diff 24 行）
- **本会话动作边界**：仅只读核查（`git status`/`git diff --stat`、`rg`、定向 Read、`ls`）+ 建本目录 + 写本文件；未 build、未提交、未跑测试。下文凡「实施会话自报 / 主控交付」均为交付材料转述，凡「留证实跑」均为本会话命令与输出。

---

## ① 任务来源

老板令：执行美术 UI 升级计划 **P0-A（动效规范）+ P0-B（标题页重排）**。计划文件：
`搜打撤/docs/evidence/2026-10-04-minako-ui-benchmark/美术UI升级计划.md`（留证实跑 `ls` + `test -f` 确认存在；同目录另有 `README.md`、`frames/`）。

## ② 四步实施摘要（实施会话交付材料，行号断言经留证抽样复核见④末）

### 步骤一 · D9-T4 全界面开合成对动画（P0-A 主体）

- 新建 `game/css/motion-transitions.css`（附录 B 五档全套，9 个 keyframes 只用 entrance/pop/fly 三既有 token、只动 transform/opacity）+ `game/src/ui/motion-transitions.js`（`<link>` 运行时注入，恒在 winter.css 后；留证实跑 `motion-transitions.js:14-19` 注入逻辑属实）。
- `overlays.css` 容器淡出对齐 0.22s/0.24s；`overlay.js` 最小 diff（import 装载 + hideOverlay 战斗快档 160/240ms 时序 + 经主控授权的 121 行战斗快档 WAAPI 排除，3 行判定）。
- 覆盖：标准弹层关/全屏页开合/确认小窗/hub 页签（零越线挂既有 page-in 类）/战斗五类全部成对同源反向；room-view 瞬隐性能口径对轻弹层让位 160ms 且容器不播整屏淡出；唯两处 `!important`（对打 winter pgOut/bag 关闭链）自配 reduce 分支保证可被全局开关整体关闭。
- 实施自查（自报）：`git diff` 零越线（scenes.css 零改动），两 JS `node --check` 语法过。
- files：motion-transitions.css、motion-transitions.js、overlays.css、overlay.js；tests：boot / architecture-boundaries / bag-structured-use / chest-click-flow 四文件。

### 步骤二 · T1/T2/T3 转场三件套 + D10 comm-feed 通讯组件

- **T1**：`--hazard` 变量（暖金 #d9bb82 × 深青 #0c1822 45°，密度降至基准 1/3；留证实跑 `motion-transitions.css:148-159` 属实）+ `#t1Gate` 单例闸门层（transform 斜向扫过 0.55s `--ease-pop`、闸门期 `gate-live` 关 backdrop-filter、内容 gateSqueeze scaleX 挤压、will-change 仅 `.on` 动画期存在——`transitions-director.js:45-52` animationend + 700ms 兜底摘 `.on`，留证实跑属实）。
- **T2**：一次性 blur(3px) 融入全屏页关闭 `t4PageOut`（红线明文例外；`motion-transitions.css:62-64`，留证实跑属实）。
- **T3**：编排纯事件挂钩零越线（`sdt-overlay-mode` 广播 + click 捕获 `data-act=flowContinue` + MutationObserver 内容标识比对/hidden 观测），覆盖 flow-transition 继续/超时、hubMain↔depMain 互切、depMain 关闭出击三条链路；闸门 0.55s ≤ 0.8s，战斗域 `lastMode==='battle'` 一律排除。
- **D10**：comm-feed 终端行+时间戳组件（`--ease-spring` 弹入 + FLIP transform 上推 + 打字指示 + D5 分段条挂点 `.comm-progress`/`.comm-seg.lit`）；demo 由 `?commDemo=1` 触发 6 条撤离播报示例（可关、战斗中自动隐藏——`comm-feed.js:102-104` 战斗模式 display:none，留证实跑属实）。
- reduce 下闸门/FLIP/打字指示全部直出；T13 批无新增 `!important`（自报）；`node --check` 三 JS 全过（自报）；`git diff` 零越线（自报）。
- files：上步 4 件 + comm-feed.js + transitions-director.js；tests：boot / architecture-boundaries 两文件。

### 步骤三 · 补充验收核验（demo 链路与连开连关设计说明）

- 主线 dev server 已在跑且核活（curl --noproxy `http://localhost:5200/` 返回 200 且带 `/@vite/client` 注入；未新开服务、零端口登记冲突）；transitions-director.js / comm-feed.js / css/motion-transitions.css 三新件经 Vite serve 均 200（自报）。
- 触发代码路径：`transitions-director.js:115` `URLSearchParams.has('commDemo')` → comm-feed.js mountCommDemo（留证实跑行号属实）；参数经 overlay.js→motion-transitions.js→transitions-director.js 导入链启动挂载，不依赖游戏进度，标题页即可见。
- **内置桥阻塞声明**（自报）：ZCode 官方浏览器控制 skill 在用户级（~/.zcode/skills）与项目级（.zcode/skills）均不存在，node_repl 实测 Computer Use SDK 绑定缺失（`typeof agent === 'undefined'`）——按项目规则「内置桥不可用记阻塞、不换外部 Edge/CDP/headless」如实记录；GUI 层观感归主控/留证环节。
- 连开连关（快速 Esc×5）不叠加不残影设计说明（静态核查）：①重开打断收场——showOverlay 首行 `clearTimeout(this._hideTimer)`（overlay.js:48）并 `remove('closing')`（overlay.js:54），同一元素单 animation 槽物理上不可能叠加；②关闭幂等——hideOverlay 对已在淡出中的重复 Esc 直接 return（overlay.js:189-191，immediate 才抢收）；③收场彻底——finish() 摘全部布局/状态类 + `ovBody.replaceChildren()`（overlay.js:213-245、:236）内容与类零残留；④战斗快档例外链同理，btFastClose 160ms 窗口内重复触发被同一 guard 吞掉；⑤闸门 gateBusy 防重入连触不叠闸。
- 其余约束：本轮无文件外新增改动（git diff 统计与上批一致，overlay.js/overlays.css 零新增，scenes.css 零触碰，自报）；无新增 `!important`（自报）；reduce 全覆盖（自报）。

### 步骤四 · D13 标题页左轴纵列（P0-B，方案 A；运行时重排，index.html/winter.css/title-p0.css 零触碰）

- 新建 `title-relayout.js`：启动时把 mGuide/mInbox/mAch/btnCardLib/mSettings/mStart 六个既有按钮 appendChild 移入新建 `#titleRail` 左列纵排容器（id/类/事件全保留；绑定侧全部是 getElementById + #title 事件委托，已核实 game.menu.js:67-70/88/100 与 game.boot.js:553-555 均不受 DOM 移动影响——自报；RAIL_ORDER 六按钮与幂等 `#titleRail 已存在即 return` 见 title-relayout.js:22、:29，留证实跑属实）；ak-user/ak-sec 移入 `#titleFootline` 沉底缘与 quote/credits 同层。
- 新建 `title-relayout.css`（运行时注入 `<link>`，恒在 winter/title-p0 之后；`title-relayout.js:13-19` 注入逻辑，留证实跑属实）：左列 clamp(18px,4.5vw,64px) 起排宽 min(340px,30vw)（右 ≥60% 完整让壁纸，原右上成就盘/右上档案/右中撤离数/右下大字牌四件全部收编）；圆形入口经 grid 重排为等高行按钮（DOM 零改动），手册/信箱同规格行化；mStart 主轴末端放大为全页唯一大 CTA（clip-path 双斜切角 + `--gold-main` 描边，st-cn clamp 23-31px 构成 wordmark→CTA→菜单行尺寸断崖）；入场沿用既有 akIn/akBtnInDown/akBtnInUp keyframes（DOM 移动不摘类，错峰 .14s/.3s/.44s 保留）；winter.css:33/34 两段媒体查询坐标硬调经 position:relative/static 覆盖对本批元素天然无效化（「砍掉坐标硬调」的运行时等价）；ak-veins 已由 title-p0.css:171 隐藏不重复处理；Tab 焦点序=DOM 顺序=视觉序；零 `!important`（`title-relayout.css:9` 头注自述，留证实跑属实）。
- `index.html`/`winter.css`/`title-p0.css` 零触碰（三件 M 均为他人既有改动，见下附）。
- tests：boot / architecture-boundaries 两文件。

### 附 · 开工前属地基线核查（交付材料转述）

核对命令 `git diff --stat -- game/index.html game/css/winter.css game/css/title-p0.css`：3 files changed, +244/−295。numstat：title-p0.css +227/−284（大范围重写为场景化标题页：`--home-edge/--home-gold/--home-muted` 变量、旧装饰层 display:none、title-lead 副标、顶栏基线、圆形入口左竖排、底部栏分域、「opaque 页下冻结标题不可见特效」规则；git 警告该文件 CRLF→LF）；winter.css +7/−6（删 `.lib-item` 两轮 content-visibility 旧声明「10-04 收敛批」+ 新增 `#overlay .result-pg .ext-brought` 徽章 +3 行）；index.html +10/−5（新增 character-idle.css link、heading 拆行 + aria-label + title-lead 副标、btnTitleExit/btnTitleMute 补 aria-label、两处注释改口）。**结论：三文件均他人未提交在途改动，本任务零触碰。**

## ③ 门禁结果

以下由**主控门禁侧执行并交付**（本留证会话未复跑，留证仅记录交付结论）：

| 门禁 | 结果 |
| --- | --- |
| lint | **PASS** |
| 定向测试 | **PASS**：`tests/boot.test.js`、`tests/architecture-boundaries.test.js`、`tests/bag-structured-use.test.js`、`tests/chest-click-flow.test.js` |

全量测试**未跑**（见⑥验收边界）。

## ④ 红线复核发现与处置（复核交付材料，逐条转述；标注「留证实跑」处为本会话独立复核对账）

### 问题1 · game.hub.pages.js:264、:287（markup :259-263、:280-289；配合 game/src/ui/overlay.js:128-129、game/css/motion-transitions.css:114-125）——【部分修复】

- **两族已真修复**：bag 丢弃确认（game.bag.js:280 `.glass-panel`，mode 'glass'）与离开对局卡（game.menu.js:809 `[data-act=leaveSave]`，mode undefined）——overlay.js:129 WAAPI 排除名单已含 `'.glass-panel,[data-act="leaveSave"]'` 且 querySelector 在 innerHTML 写入后执行必然命中；motion-transitions.css:116 停父卡 / :118,120 `t4ConfirmIn .22s scale(.98)` / `Out .16s` 生效；overlay.js:209-210 btFastClose 含 `.glass-panel` 留 160ms 收场；头注（**motion-transitions.css:22-25**，复核原文未带文件前缀，留证按实位标注；overlay.js:22-25 为无关旧注释）已记录档 2 盖写 deferred 与档 3 无盖写。
  - 留证实跑：game.bag.js:280 `<div class="glass-panel">`、game.menu.js:809 `data-act="leaveSave"`、overlay.js:129 排除名单、motion-transitions.css:116/:118/:120/:124-125、overlay.js:209-210、motion-transitions.css:22-25 头注——全部按行号命中。
- **残留**：原发生域明列的 game.hub.pages.js:264（confirmMaterial 材料确认）与 :287（confirmStashAction 仓库操作确认）两处同为 mode 'glass' 确认小窗，但 markup 仅 `.ov-note`/`.ov-btns`、无 `.glass-panel` 无 leaveSave 锚点 → overlay.js:129 排除不命中仍播 WAAPI overlayIn（0.28s/y18px；motion.js 实测 0.28s/y18/ease[.22,1,.36,1]——留证实跑 motion.js:45-48 属实），档 3 选择器（:118、:124）不匹配，:116 fx-glass 停卡动画（特异性 1-2-0）也低于档 2 :not 链（1-11-0）形同虚设 → 该两处仍走 WAAPI 标准档而非档 3 `.22s/scale(.98)`，**与修复前行为完全相同**。
  - 留证实跑：hub.pages.js:264/:287 两处 `showOverlay(..., 'glass', ...)`，markup 仅 `<p class="ov-note">` + `.ov-btns`（data-act=matConfirm*/stashConfirm*），确无两锚点——残留结论成立。特异性两个数值系复核计算，留证未独立复算。

### 问题2 · title-relayout.css:54、:112（对照 winter.css:1162）——【已修复】

:54 `.ak-circle` transition 收窄为 `transform .18s var(--ease-entrance)`、:112 `.ak-start` 为 `transform .18s var(--ease-entrance), scale .12s ease`，原 border-color/background-color 过渡已删除，hover（:56-60、:114-118）颜色改瞬变无过渡，注释明示口径。残留小注：`scale .12s ease` 系逐字复述 winter.css:1162 既有定值 `.ak-sq,.ak-quickref,.ak-start{transition:scale .12s ease}`（合并声明防新 transition 声明覆盖 winter 既有按压缩放），ease 关键字不在五 token、scale 独立属性字面不在「transform/opacity」内，但属**既有定值零变化复述、非新增动效**。
（留证实跑：:54/:112/:56-60/:114-118 及 winter.css:1162 原文逐字命中。）

### 问题3 · motion-transitions.css:32、title-relayout.css:136——【已修复 · 无残留】

:32 复述改为 `cardIn .22s var(--ease-entrance)`，`--ease-entrance`=base.css:69 `cubic-bezier(.22,1,.36,1)` 与 overlays.css:379 原值逐字一致零变化；title-relayout.css:136 footline 改 `akIn .5s var(--ease-float)`，`--ease-float`=base.css:73 `cubic-bezier(.2,.7,.4,1)`（winter.css:19 原 akIn 为 `(.2,.7,.3,1)`，第 4 控制点 .3→.4 微偏差已在 title-relayout.css:134-135 注释记录，token 合规）。实证：`grep -rn "cubic-bezier"` 六个范围文件→零命中(exit=1)，全部缓动走 token 引用。
（留证实跑：按**六个新建件**集合复跑 `rg "cubic-bezier"` → 零命中，与复核一致；另扩查 overlays.css 命中 :3/:373/:379/:459/:465/:475 六处**既有字面值**，均系本批未触碰的既有原值，其中 :379 即本条引用的对照原值，非违规。base.css:69/:73、winter.css:19、overlays.css:379、title-relayout.css:134-136 均实读核对。）

### 问题4 · motion-transitions.css:102-112（对照 game/src/battle/view/battle.view.js:356、:563-571）——【已修复 · 渐进增强式】

:107-112 开为 `t4BattleIn .18s`（display 切换重播），关为 `transition: opacity/transform .14s var(--ease-fly), display .14s allow-discrete` + `[hidden]{opacity:0;translateY(4px)}`，成对同源反向达成。属地核实：battle.view.js:356 渲染 `.bt-potion-tip` hidden 于 ovBody 子树（`#overlay .bt-potion-tip` 命中），:569/:571 纯 hidden 属性切换与机制匹配；收口 JS（battle.view.js）确未动。说明：成对关闭依赖 Chromium≥116 的 allow-discrete（display 到 none 保持旧值至过渡结束），旧内核整条 transition 无效退回瞬隐=现状零回归；本次未实机验证内核支持（复核仅静态），属设计文档已自注的已知边界。
（留证实跑：motion-transitions.css:107-112 与 battle.view.js:356 命中；:569/:571 的 hidden 切换行未逐行复读——`rg "bt-potion-tip"` 在该文件仅命中 :356 字面——此两点系复核材料断言，留证未独立复核。）

### 问题5 · overlay.js:255、tests/boot.test.js:256——【已修复 · 静态核查】

:255 timer 改 `btFastClose?160:225`，225=0.22s 容器淡出 + 5ms 裕量，对 boot.test.js:256 固定 `await setTimeout(r,230)`（测试侧该行未改，diff 仅另一处 waitFor 15s→45s）形成**先注册且早到期 5ms** 的结构化先后序——Node 定时器按到期序触发，事件循环即使卡顿两定时器同轮触发也保序 finish 先行，原「同到期零裕量」竞态消除。裕量 5ms 偏薄但失效需违约定时器序，风险评估为可接受。按红线未运行测试，纯静态核查。
（留证实跑：overlay.js:255 `setTimeout(finish, btFastClose ? 160 : 225)`、:251-254 时序注释、boot.test.js:256 `setTimeout(r, 230)`——逐字命中。）

### 问题6 · overlays.css:370——注释漂移（纯文档问题）

新增注释写「收场 timer 230ms 见 overlay.js」但 overlay.js:255 实为 **225ms**（`btFastClose?160:225`）——fix 过程中 timer 从 230 再调 225 后注释未同步，纯文档漂移无行为影响。
（留证实跑：overlays.css:368-370 注释原文与 overlay.js:255 实值，漂移确认存在。）

### 全量红线抽查 · game/（属地/战斗域/循环/will-change/reduce/定版五件全项）——【通过 · 零越线】（复核以 git status+定向 diff+grep 实证）

1. **属地**：本轮 8 个范围文件 = 6 新建（git status untracked：motion-transitions.css/js、comm-feed.js、transitions-director.js、title-relayout.css/js）+ overlays.css/overlay.js 两白名单干净文件（diff 仅 T4 内容：overlays.css 11 行=两处容器淡出 0.22s var(--ease-fly)；overlay.js 24 行=import 链/WAAPI 排除/btFastClose/timer），scenes.css 未动不需动；装载合规=overlay.js:7 import → motion-transitions.js:14-19 与 title-relayout.js:13-19 向 document.head appendChild `<link>`（winter.css 之后）；禁止文件（index.html/winter.css/title-p0.css/boot-order.js/main.js/game.menu.js/hub//run/）diff 指纹扫描仅命中 character-idle/achievement 他人特性，本任务零指纹（共享文件多会话在途，归属系内容指纹证据推断）。
2. **战斗域**：档 5 五类弹层 t4BattleIn/Out=fade+translateY(4px)≤6px、.18s 开/.14s 关；`.card.battle` 主界面 :32 复述 cardIn .22s 零变化；快档 swap 变体 :78-83 钉在快档参数。
3. **零常驻循环于战斗域**：范围文件唯一 infinite=motion-transitions.css:206 commTyping 打字指示，仅 `?commDemo=1` 挂载且 comm-feed.js:102-104 战斗模式 display:none。
4. **逐帧重绘**：范围文件零 background-position；will-change 仅 :163 `#t1Gate.on` 期挂载，animationend + 700ms 兜底摘 `.on` 即除（transitions-director.js:45-52）；filter 动画仅 t4PageOut 一次性 blur(3px)=整页切换红线明文例外（非战斗）。
5. **reduce**：winter.css:35 全局 `animation/transition:none!important` 在；唯一新增 `!important` 动画规则（motion-transitions.css:62 t4PageOut）自配同款 reduce 分支（:66-69）；JS 侧 reduceMotion 守卫（gateSweep:39、appendCommRow:31、motion.js canAnimate）。
6. **winter 定版五件零接触**：新文件选择器不涉回合条/名牌/战场状态条/发现磨砂，`.bt-potion-tip` 仅加 animation/transition 不动纸白底；对 winter.css:1242/1489 两处 `!important` 关闭动画的覆盖为同特异性(1-3-0)后载胜、仅改参数保语义。
7. 复核本身仅运行 git status/diff、grep、sed 只读命令，未 build 未提交未跑测试。

（留证实跑对账：①8 文件 git 状态、diff --stat 11/24 行数、overlay.js:7 import、motion-transitions.js:14-19、title-relayout.js:13-19；②③④motion-transitions.css:32/:206/:163 与 comm-feed.js:102-104、transitions-director.js:45-52；⑤`rg "!important"` 两新建 CSS 全量仅命中 motion-transitions.css:62 与 :68（:68 即 reduce 分支本体），title-relayout.css 零 `!important`、winter.css:35 在——与抽查一致。:78-83/:66-69 区段、gateSweep:39/appendCommRow:31、winter.css:1242/1489 特异性系复核断言，留证未逐处复读。）

### 留证抽样复核记录（本会话实跑命令汇总）

| # | 实跑 | 结果 |
| --- | --- | --- |
| 1 | `ls` + `test -f` 计划文件 | 存在（美术UI升级计划.md） |
| 2 | `git status --porcelain`（8 范围文件）+ `git rev-parse --short HEAD` | 6 `??` + 2 `M`；HEAD=425d039 |
| 3 | `rg -n "cubic-bezier"` 六个**新建**文件 | 零命中（RG_ZERO_MATCH_SIX_NEW_FILES） |
| 4 | `rg -n "will-change\|background-position\|infinite\|allow-discrete"` 两新建 CSS | 仅头注提及与 :104/:110/:163/:206 命中，与抽查吻合 |
| 5 | `rg -n "!important"` 两新建 CSS | 仅 motion-transitions.css:62、:68 |
| 6 | `rg -n "commDemo\|hazard"` 三文件 | transitions-director.js:115、motion-transitions.css:148-159 等 |
| 7 | `rg` bt-potion-tip / leaveSave / glass-panel / git diff --stat | battle.view.js:356；game.menu.js:809；game.bag.js:280；overlays.css 11 行、overlay.js 24 行 |
| 8 | 定向 Read：overlay.js 1-75/120-139/185-259、overlays.css 362-381、motion-transitions.css 1-27/28-37/58-72/100-127/200-207、title-relayout.css 48-61/106-119/130-139、hub.pages.js 255-290、boot.test.js 248-259、base.css 64-75、winter.css 15-38/1158-1165、motion.js 40-51、motion-transitions.js 全文、title-relayout.js 1-30、comm-feed.js 98-107、transitions-director.js 42-55 | 全部与上文引用一致 |

**未独立复跑项**（转述交付材料，非留证结论）：lint、四个定向测试文件、node --check、battle.view.js:569/:571、特异性数值（1-2-0/1-11-0/1-3-0）、gateSweep:39/appendCommRow:31 行号、winter.css:1242/1489、GUI/实页类全部条目。

## ⑤ 遗留 deferred 汇总

### A. 与计划附录 B 的已知偏差（单列；T4 交付材料点名要求留证单列，供老板日后拍板）

- **标准弹层「开」参数偏差**（主控拍板 A 方案保留）：实页由 core/motion.js:45-48 的 WAAPI overlayIn 主导（y18px/scale.985/0.28s），与验收规格 y22px/scale.988/0.3s 差 4px/0.003/20ms，同 `--ease-entrance` 曲线肉眼不可辨；CSS t4CardIn 已按精确参数定版（motion-transitions.css:29 `translateY(22px) scale(.988)`）作兜底，motion-transitions.css:22-25 头注留档（档 2 盖写 deferred、档 3 与档 5 已在 overlay.js 排除 WAAPI 无盖写）。是否把标准弹层开动画全量收编进新模块，由老板日后决定。

### B. 仍遗留（后续批次/待拍板）

1. **hub 两处 glass 确认窗走 WAAPI 标准档**（④问题1 残留：game.hub.pages.js:264/:287）——复核仅指出残留，处置未定，留证存照待拍板。
2. **T3「旧面板压缩淡出 0.2s」无法实现**：内容即时替换架构下 ovBody.innerHTML 在 sdt-overlay-mode 派发前已同步替换（overlay.js:59-66），不存在先于替换的时序窗口；且 flow-transition 退出走 room-view 瞬隐（留言 #33 性能口径，全屏 blur/淡出逐帧重合成是「继续」卡顿根因，不可改）——以**闸门盖切**替代（闸门扫入盖住瞬隐、扫出露出新页），全程无黑帧达成，旧面板退场演出记此存照。
3. **T2 参数与 T4 档冲突**：T2 规格 blur+scale(.985) 0.2s 与 T4 全屏页档关 scale(.97) 0.24s 同挂 `.card.page` 关闭链，按「同界面同档不混档」以 T4 定档为准，blur(3px) 融入 t4PageOut（0.24s，motion-transitions.css:62-64），0.2s/scale.985 未采用。
4. **闸门覆盖面仅计划 T3 链路三条**（flow-transition 继续/超时、hubMain↔depMain 互切、depMain 关闭出击）；其余 page 间导航（返回基地、章节列表等）未挂闸门防噪——计划附录 A 未列名的链路未扩展，全链路闸门归后续批次拍板。
5. **comm-feed 数据源挂接**（game.run.flow 剧情流位/撤离播报真实事件）不在本批：ask 仅要求组件+demo，run/ 属地禁改；组件 API（commRowHTML/appendCommRow/setTyping/commProgressHTML）已预留，挂接归后续批次。
6. **导入/导出确认窗未找到独立弹层实现**（全库无对应 showOverlay 弹窗）；确认小窗档实际覆盖=fx-glass 玻璃确认×4 处（丢弃/材料/仓库等）+ 离开对局卡（data-act=leaveSave 锚定）；若「导入导出」指设置页内联功能，其宿主页已走全屏页档。
7. **照相馆关闭容器 `!important`**（winter.css:1593，ovFadeOut .2s）未对齐全屏档 0.24s——保守不碰「退出闪烁修复」语义（motion-transitions.css:59 注释同口径）；卡片 0.24s 淡出先于容器不可见，40ms 截尾无感知。
8. **标题页 winter.css:19 `.ak-hud` 三波 nth-child delay** 因 rail 插为首子整体后移一位：保留元素（雪花层/预热条）入场波次有 ±70ms 级漂移——按钮均有按钮级动画覆盖（winter:1155-1161）不受影响，漂移仅及装饰层且视觉无感，不回改（零越线优先）。
9. **右侧留白度**（壁纸上新 UI 占比更小）为目测验收项，无法以静态检查代证——已从布局结构保证：原右半屏四件全部收编进左列与底缘，右 60% 除壁纸外无任何 UI 元素。

### C. 已消解（后续批补齐，附边界）

- **药水提示栏（.bt-potion-tip）关方向**：T4 批曾记 deferred（hidden 切 display:none 瞬隐、纯 CSS 无法成对、收口需改 battle.view.js 属地越线）→ 红线复核确认为**问题4【已修复·渐进增强式】**：motion-transitions.css:107-112 以 transition+allow-discrete 成对达成，battle.view.js 未动；边界=依赖 Chromium≥116，旧内核退回瞬隐现状（零回归），实机内核支持未验证（见⑥）。

## ⑥ 验收边界（未跑/待补验项——全量与实机归主会话）

- **门禁**：lint 与四文件定向测试由主控门禁侧执行（PASS，见③）；**全量测试未跑**；留证会话未复跑任何测试。
- **实页录屏验收未执行**（原列项：≥6 类界面开合成对抽查、reduce 直出、Esc×5 连开连关不叠加）——GUI 阻塞声明：官方浏览器控制 skill 用户/项目两级缺失 + node_repl 无 Computer Use SDK 绑定（`typeof agent === 'undefined'`，COMM 会话实测）；按项目规则不换外部 Edge/CDP/headless。静态替代已验：5200 存活 200、三新件 Vite serve 200、触发代码路径行号核过（实施会话自报）。
- **Esc×5 不叠加**为设计说明+静态核查（overlay.js:48/:54/:189-191/:213-245/:236、gateBusy），**非实测**。
- **allow-discrete 内核支持（Chromium≥116）未实机验证**（问题4 复核仅静态）。
- **问题5 竞态修复为纯静态核查，未运行测试**（按红线）。
- **reduced-motion**：winter.css:35 全局关闭 + 新增 `!important` 自配 reduce 分支 + JS 侧守卫，均为静态核实；reduce 直出实测未做。
- **标题页**：1280×720 与 ≤1100 双尺寸目测、Tab 焦点序、入场错峰、右侧留白度未实机核验。
- **实机性能**（闸门扫过观感、FLIP 上推平滑度等）未测。
- 属地核查与红线抽查仅只读命令；本会话未 build、未提交。

## ⑦ 触发方式（实页验收操作指引，供主会话补验）

### commDemo 通讯组件 demo

- 前置：主线 Vite dev server 于 5200 运行（COMM 会话核验时已存活；新模块经 Vite serve，若服务重启后 HMR 提示则刷新一次生效）。
- URL：**`http://localhost:5200/?commDemo=1`**
- 链路：transitions-director.js:115 `URLSearchParams.has('commDemo')` → comm-feed.js mountCommDemo；导入链 overlay.js:7 → motion-transitions.js:9 → transitions-director.js，启动即挂载，不依赖游戏进度，标题页即可见。
- 预期画面：右下角 430px 宽深青终端面板「COMM FEED // 无线电通讯 · ?commDemo=1」带金色描边，含 6 格分段进度条挂点；首条消息（SYSTEM/链路已建立——撤离窗口开启）即现，此后每 1.8s 追加一条（BEACON 信标/OUTPOST 通路异常/SHUTTLE 运输艇/SYSTEM 追踪警告/EXTRACT 全员登机），每条 `--ease-spring` 弹入、旧消息 FLIP 平滑上推，两条间隔出现「传输中…」三点脉动指示，分段格随消息逐格点亮金 grad；约 11s 播完 6/6 格静止，点 × 关闭，去掉 URL 参数即无任何痕迹；战斗中自动隐藏。

### 标题页重排（D13 方案 A）

- 浏览器开 **`http://localhost:5200/`** 进标题页即见新排版（新模块经 HMR 提示后刷新一次生效）。
- 1280×720 满窗与拖窄至 ≤1100 各看一遍，检查点：
  1. 左列标题下纵排 5 行按钮 + 末端金描边斜切角大 CTA，右 60% 纯壁纸；
  2. 无横向滚动条；
  3. 刷新页面看入场错峰（行按钮自下而上依次浮入、CTA 最后）；
  4. 底缘左侧档案号 + 撤离次数与引言同层；
  5. Tab 顺序应与视觉从上到下一致。

---

*本 README 由 WF-motion-ui-p0 留证会话写入（2026-10-04）；除文内标注「留证实跑」的只读核查外，其余验证结论均系实施/门禁/复核交付材料转述，已在③⑥逐项注明执行方与未跑项。*


## 主会话实页验收（2026-10-04 补录）

- **T4 关闭动画**：手册弹层关闭触发 `#overlay.closing`，卡片 computed animationName = `t4CardOut`，结束后 display:none + ovBody 清空 + 无 closing 类残留；连点关闭×5 无叠加无残影。
- **comm-feed 演出**：`?commDemo=1` 实测 6/6 条撤离播报（链路建立→信标→通路异常→运输艇→追踪警告→全员登机），「传输中…」指示与分段进度条逐格点亮正常，面板金描边终端风。
- **复核发现1 处置**：overlay.js WAAPI 排除条件追加 `mode !== 'glass'`（主控拍板），hub 材料/仓库确认窗归确认小窗档；lint 0 错 + boot/architecture-boundaries 35/35 绿。
- **D13 首页排版重做：老板令「改回原样」已完整撤回**——title-relayout.js/css 两文件删除、motion-transitions.js 断开 import（留撤回注记），实页验证首页零残留（rail 无/注入链接无/散点定位/开始键右下原位）。撤回原因未附（老板未述）。
- **已知观察（非本轮改动）**：焦点不在弹层内时 Esc 不关闭弹层——ui.js:74 的 Esc 监听挂 overlay 子树 keydown，系既有焦点行为；如需「点开即 Esc 可关」属新需求另立。
- **未覆盖**：prefers-reduced-motion 实测（静态核查 reduce 分支齐全）；闸门全链路实机（需对局进度）；运行时左轴方案的实页证据随撤回作废。
