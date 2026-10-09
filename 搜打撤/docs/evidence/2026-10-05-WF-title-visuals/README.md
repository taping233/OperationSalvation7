# 2026-10-05 · 标题页视觉三连（留言 1/2/5：显隐过渡 / 毛玻璃 / 小按钮边框）

## 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `game/css/title-p0.css` | 唯一代码改动文件（237 → 277 行）。三处：`.wallpaper-only` 显隐过渡、`.home-plate` 毛玻璃重构、`.home-tool` 边框重设计 |
| `game/src/ui/title-wallpaper.js` | 未改动（显隐逻辑已有 class/inert 切换，过渡纯 CSS 实现）。`node --check` 通过 |
| `game/index.html` | 未改动（结构无需变化） |

## 设计决策（对应老板留言）

### 留言 1：「只看壁纸」的选项显隐加过渡

- 现状澄清：项目没有独立壁纸切换面板/列表，「只看壁纸」实际是整体隐去 `.title-inner`（全部选项盘、品牌区、底栏）与 `.home-edge-band`（顶部横带）。故对这两层做过渡。
- 隐藏：`opacity 0` + `translateY(10px) scale(.988)` 轻微回落缩小，`.26s ease-in`；恢复：`.34s cubic-bezier(.22,1,.36,1)` 淡入回位。
- 不可交互保障：`visibility: hidden` 用 `transition: visibility 0s linear .26s` 延迟到淡出结束才翻转（恢复时 0s 立即显形）；隐藏态同时挂 `pointer-events: none`；JS 原有 `inert` 属性点击瞬间即生效，三重兜底。
- `#title.home-composed::after`（暗色渐晕）同步 `.4s` 淡出淡入，避免只有界面闪消、渐晕瞬跳。
- reduced-motion 兼容：title-p0.css 末尾既有 `body.reduce-motion` 与 `@media (prefers-reduced-motion: reduce)` 全量禁 transition/animation 规则覆盖 `#title.home-composed` 全部子孙，新过渡自动被禁用；禁用后 visibility 立即翻转，功能不受影响。

### 留言 2：选项面板毛玻璃

- `.home-plate::after`（填充层）加 `backdrop-filter: blur(10px) saturate(.8)`（含 `-webkit-`），与项目 overlay 毛玻璃主配方一致（beginner-guide/hub-cover/settings-cover 等均为 `blur(10px) saturate(.8)`）。
- 关键重构：原 `.home-plate` 父级的 `filter: drop-shadow(…)` 会形成 backdrop root，导致子孙 `backdrop-filter` 只能采样到盘子内部、模糊不到壁纸。已把墨影下移到 `::before`（墨边层）上，hover/active 的墨影尺寸变化（5/8/2px）与提亮也随迁到伪元素，视觉语言不变。
- 半透明底：默认盘 `#233743f2→#233743d0`、指南 `#174047ed→#174047d0`、退出 `#393039f2→#393039d0`；金色主按钮「进入城市」渐变改 `dd`（87%），保留主 CTA 分量。即使环境不支持 backdrop-filter，82% 左右的底色仍保证可读。
- 已知边界（实测确认点）：入场动画 `homeCoverIn` 与 `data-home-phase` 进出场动画期间父链 opacity<1，会短暂形成 backdrop root，玻璃层那零点几秒退化为半透明无模糊，动画结束即恢复，属可接受瞬态。

### 留言 5（信箱第 3 条）：左下角小按钮边框重设计

- 弃用 `1px solid #b7cdd251` 浏览式细线，改为与选项盘同语言的四件套：
  1. **纸面垫层**：`::before` 米白 `#d4d8c9`，`inset: -3px 3px 3px -3px` 左上外露（对应主选项盘纸边 `-4px 5px 4px -5px` 的微缩版）；
  2. **墨描边**：`::before` 挂 `drop-shadow(3px 3px 0 #07131b9e)` 硬偏移墨影（盘子 5px 的微缩），hover 5px / active 1px 联动；
  3. **切角轮廓**：`--tool-shape: polygon(9px 0, …, 0 9px)` 左上/右下双斜切，呼应选项盘斜切语言；
  4. **金色侧条 + 毛玻璃填充**：`::after` 左缘 3px `--home-gold` 竖条（原 hover 才变金边，改为常驻设计元素），填充 `#10232ea6` + `backdrop-filter: blur(8px) saturate(.75)`——与 `home-edge-band` 配方完全一致。
- hover 抬升 `translate(-2px,-2px)`、active 下压 `translate(1px,1px)`，延续盘子位移逻辑。
- `filter: none` 保留在 `.home-tool:hover`：压制 winter.css 旧规则 `#btnTitleMute:hover{filter:drop-shadow(0 0 8px …)}`，否则 hover 时父级 filter 会截断自家毛玻璃采样。
- 覆盖范围：静音、留言信箱、壁纸计数三颗 + 右下角「只看壁纸/恢复界面」（共用 `.home-tool`），全页小钮统一。winter.css `#btnTitleMute::after{display:none}` 被本文件更高特异性规则覆盖，静音钮同样获得新装。

## 验证

- `node --check game/src/ui/title-wallpaper.js` → syntax OK（文件未改，基线确认）。
- 定向测试：`rg -l "title-wallpaper|m03-home" tests/` → `tests/title-wallpaper.test.js`（唯一命中）。
- `PYTHONIOENCODING=utf-8 npx vitest run tests/title-wallpaper.test.js --reporter=dot` → **Test Files 1 passed (1)，Tests 5 passed (5)**，1.58s。
- 未改任何 `tests/` 下文件、`game.menu.js`、`feedback.local.js`、`core/storage.js`。未提交、未 build。

## 实页验收重点（主会话浏览器确认）

1. 「只看壁纸」↔「恢复界面」：选项盘淡出带回落、横带同步淡出、渐晕不瞬跳；淡出进行中按钮已不可点（inert），淡出完才整层消失。
2. 选项盘（尤其左侧三盘与金色「进入城市」）背后壁纸纹理是否透出且被模糊；文字对比度是否仍够。若玻璃感不明显，备选方案是把 `d0`（81%）再降到 `bf`（75%）。
3. 左下角三颗小钮 + 右下「只看壁纸」：切角轮廓、纸边左上外露、墨影右下、金色侧条是否与大盘子语言统一；静音钮 hover 无异常金色光晕。
4. 开场入场动画（staggered homeCoverIn）期间玻璃层有无明显闪烁（已知瞬态，见上）。

## 遗留事项

- 无阻塞项。可选后续（未实施，属新需求）：若老板觉得左上纸垫层太抢眼，可把 `::before` 背景换回墨色 `#08131b` 变纯墨描边。
- PARALLEL-REGISTRY 登记由主会话统筹（子会话未动共享台账）。

## 第6条·全局过渡（2026-10-06）

### 机制分析

- 五个整页（设置/成就总览/照相馆/生存指南/留言信箱）统一走 `UI.showOverlay(html, 'page')` → `interface-motion.css` 容器档：veil 淡入 + panel 抬升缩放，生命周期挂钩 `#overlay[data-ui-motion="page"]`（档位）、`[data-ui-enter="a|b"]`（每次开层翻转重播入场）、`[data-ui-closing]`（关层，overlay.js 计时 225ms 后 `hidden=true` + 焦点归还，退场不可交互已有 pointer-events/hidden 兜底）。
- 制作名单是独立 `<dialog id="homeCredits">`，走 `home-menu-motion.css` 的 `data-home-motion="in|out"`（hmDialogIn/Out）。
- 内容级现状：设置页与留言信箱（`.pg.settings-page .settings > *`）已有 page-settings.css 的 setPanelIn/setRowIn 级联；成就总览、生存指南、照相馆、制作名单此前只有容器级单层淡入（即老板「简陋」体感来源）。

### 方案（零 JS，纯 CSS 编排层）

新建 `game/css/page-transitions.css`（index.html 末位 link 引入）：

1. page 档容器参数升级：入场 .36s / 抬升 18px / 缩放 .986（原 .34s/14px/.992）；属性选择器双写抬特异性，压过运行时注入的 interface-motion.css。
2. 内容块级联入场（`ptBlockIn`，.34s + 12px 抬升，cubic-bezier(.22,1,.36,1)，`backwards` 预藏）：成就（页头→档案栏+70ms→陈列+130ms）、生存指南（页头→章节导航→正文页，翻页重建时同款重播）、照相馆（页头→馆藏目录→选片检查台）、制作名单 dialog（返回钮→标题→名单→来源，nth-child 级联 0/.05/.1/.15s）。
3. 红线：只动 transform/opacity；退场不做块级动画（容器统一收场，语义与性能口径不变）；`prefers-reduced-motion: no-preference` 媒体守卫 + `body:not(.reduce-motion)` 双重守卫全量禁用。

### 文件清单

- 新增 `game/css/page-transitions.css`。
- `game/index.html`：+1 行 link（`css/page-transitions.css`）。
- 未改任何 JS（game.menu.js 零接触，留言保存自动退出逻辑不受影响）；未触碰 title-wallpaper.js、feedback.local.js、storage.js、tests/。

### 测试

- `PYTHONIOENCODING=utf-8 npx vitest run tests/m03-home.test.js --reporter=dot` → **1 passed (1)，Tests 7 passed (7)**。
- `PYTHONIOENCODING=utf-8 npx vitest run tests/settings-page.test.js tests/cov-motion-primitives.test.js --reporter=dot` → **2 passed (2)，Tests 23 passed (23)**。
- 未改 JS，node --check 不适用。未提交、未 build。

### 实页验收重点

1. 六页进出均有过渡且层次感（容器抬升 + 内容级联）：设置、成就总览、照相馆、生存指南、留言信箱（信箱级联沿用 setRowIn）、制作名单。
2. 指南翻页（上/下一章）会重播正文级联——体感应像「翻页」而非闪烁；若嫌重可把 `.bg-page` 的 delay 归零。
3. 照相馆内改筛选/换选中卡只 patch 局部 DOM，级联不应重播；若发现重播闪烁回报。
4. reduced-motion（媒体查询 + 设置开关）下六页瞬时显隐。
5. 关闭六页过程中点击应无响应（退场 pointer-events 兜底），关完回标题/上级页焦点归还。
