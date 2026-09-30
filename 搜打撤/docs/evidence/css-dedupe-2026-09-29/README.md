# CSS 骨架重复收敛（09-29 深夜，老板拍板「你去做吧」）

## 改动（2 文件，-110 行）
1. `game/css/winter.css`：删除 v3 卡面定调**陈旧副本** 107 行（L1149-1261，正本=card-v3.css 后加载恒胜出；副本缺 rv7 棱彩丝带/v3.3 修复/2 条 object-position=落后于正本）。唯一活规则 `.lib-item{contain-intrinsic-size:auto 122px}` **原位保留**（全库唯一声明，须压过本文件上方 224px 行，挪动即翻转级联），留缘由注释 3 行。
2. `game/css/page-rewards-bag-help.css`：T0 `--rbh` 两段逐字相同声明合并为一条分组选择器（级联恒等）。

## 判留（有据不动）
- page-\*（ach/shop/upgrade/stash/deploy/hub/settings/events/rewards-bag-help）的题行金线/焦点环块：**分页作用域规则非冗余**（选择器各司其职），且 page-ach L366 注释明写「与 page-hub.css T2 同语言，**双保险写死在本作用域内**」=有意设计。
- expedition-library.css 相纸块「重复」：注释明写「相纸语言与墙面瓦片**同源**」=设计语言复用。
- cards.sync.js ensureXxx 模板：PENDING #12 已裁决「声明式配置非坏重复」。

## 数字（jscpd，game/css+game/src+scripts，默认 min-tokens 50）
- 克隆 83 块/952 行 → **79 块/837 行**（-4 块/-115 行）
- card-v3⇄winter：**109 行/3 块 → 0**；09-29 深夜口径的 CSS 部分 389 行 → 约 276 行
- 报告：`jscpd-before-report.json` / `jscpd-after-report.json`

## 验证（改前基线→改后复验，同一导航路径）
- 计算样式 A/B（24 属性白名单，内置浏览器 1280×720，隔离服 5322）：
  - 战斗（遭遇战手牌=初始攻击卡，两次同卡）：13 组选择器**零差异**（img 列表 18 处差异=图标元素排序换位，非同元素）
  - cardlib-zoom（点开首张实挂瓦片）：**绝对零差异**
  - 照相馆网格：padding/content-visibility/contain-intrinsic-size(291px) 全同；6 处 height 差异=基线抓到占位瓦片(291+21padding=312)、改后抓到实挂瓦片(245)，取样差非样式差
  - 商店：差异全部可归因**随机卡身份**（丝带/宝石稀有度色 + em 缩放同比 ×1.1143=卡字号档），外壳规则零改动
- 全量 vitest：**235 文件 / 1889 通过 / 2 skip（66s）**，改动在场跑的。
- 截图：shot-zoom.png / shot-grid.png（相纸区域黑块=下述顺带发现①，非本次改动所致）。

## 顺带发现（只报告，已另行登记）
1. **照相馆照片在 Vite 主线 dev 服全黑**：页面内相对路径 `assets/thumbs/*.webp` 解析到 `/game/assets/*` 被 SPA fallback 回 `text/html`（16/16 naturalWidth=0）；绝对路径 `/assets/*` 有映射正常。HEAD 版 CSS 还原 A/B 同样 16/16 黑=**与本改动无关、改前即如此**；老板实机验收走的 8137 静态服（game/ 即根）不受影响。已登记 PENDING #13。
2. winter L1059 `.hs-card::before{display:none!important}` 之后无文件再开 display——v3 `::before` 内芯疑似恒被压制，改前既有层叠现象，未动。
3. 无主 node 服务监听 5200/5321（REGISTRY 无主物品区已登记）。

## 复跑口径
`npx jscpd --reporters json --output <dir> game/css game/src scripts`
（09-29 jscpd 首跑报告还含根级 *.py 与 perf-ledger-capture.mjs，故总行数口径略有差异；card-v3⇄winter 109 行/3 块两口径一致。）
