# 2026-10-04 提案实施：烧色 + 拆帧 + winter 旧样式收敛（老板令「做吧」）

前序：`followup-2026-10-04.json`（三提案定义）+ `attribution-and-fix.json`（10-03 c-v 归因）。
本文记录三提案落地与验证。测试 37/37 绿（cardslib/photo/hub 七文件），实页帧级复测因 IAB 面板
持续遮挡（rAF 冻结，环境 artifact）留待老板实机验收。

## P1 img filter 烧色（已落地）

- **重烘**：`.tmp/rebake-thumbs-tinted.py`（PIL+numpy，LANCZOS 从原图缩放+调色矩阵+webp q82），
  全量 327 张中 322 张完成；4 张 scenes（battle-city-night-anime-v1 / battle-street-day-anime-v1 /
  endfield-ruins / layer3-knight）源图不存在（thumbs 无源残留，仅 thumb-manifest 自动清单引用，
  零游戏代码引用），未动、留待资产清理批处置。
- **矩阵**：`brightness(1.03)·contrast(1.05)·saturate(1.04)·sepia(0.04)` 合并为单 3x3+bias
  （M=[[1.087994,0.003705,0.005219],[0.006245,1.079741,0.004274],[0.002781,-0.006867,1.082379]]，
  t=-0.02575），0-1 归一化 sRGB 逐通道（CSS filter 规范口径）。
- **管线一致性**：`game/tools/bake-card-thumbs.cjs` processOne 加同款 TINT_M/TINT_B
  （未来烘焙自带烧色，canvas 版与 Python 版同公式）。
- **运行时滤镜删除**：expedition-library.css `.studio-photo-art img` 的 filter 行删除
  （布局属性保留）。#cardZoom 大图本就无此滤镜，小图调色/大图原色的观感关系不变。
- **色彩一致性（浏览器实测）**：烧色 thumb vs 原图+原滤镜链，同口径 224px 缩放对比——
  cards/curse-drain meanΔ2.37/255、cards/bound-shadow 2.5、scenes/scene-altar 2.75、
  portraits/enemies/bandit 1.68（均值差 0.7-1.1%，maxΔ 大值集中于 webp 4:2:0 色度抽样边缘，
  远低于可感知阈值）。
- **备份**：`.tmp/thumbs-backup-20261004/`（327 张原 thumbs；git 亦跟踪原版可回溯）。
- **审计口径**：asset-audit 的 327 thumbs unlisted 系 HEAD 已有的历史欠账
  （docs/asset-audit-debt.json issues 内 327 条在案，#35 归一化挂账），重烘不改变登记状态。

## P2 打开/切页签阻塞拆帧（已落地，帧级数值待实机）

- `libGridContentsHTML`：点击帧只同步解析首窗（15 卡面 + 64 首窗壳，覆盖视口+100% 挂载窗口
  到 1080p 全屏），余壳进 `_libShellQueue`；jsdom 降级路径（libWindowed=false）保持全量同步不变。
- `appendLibShellsIdle`：rAF 链每帧补一批（60 壳，192 壳≈4 帧≈<100ms 补齐滚动高度）。
  **弃用 requestIdleCallback**：面板遮挡/后台页 rIC 不触发，实测壳滞留首窗（scrollH 停 5290）；
  rAF 冻结时回调不丢只延迟，恢复产帧即续跑。
- 三层兜底：①rAF 链正常补齐；②grid scroll 监听（passive）——拖到距当前底 600px 内且队列
  非空时 `flushLibShellsNow()` 强制补齐；③`switchLibPage` 键盘定位目标壳不在 DOM 时 flush
  再定位。`renderLibGrid` 重绘经 `libGridContentsHTML` 自然重置队列；`closeLibPage` 丢弃队列。
- 实测（面板产帧期）：打开阻塞基线 52.9+39.9ms（271 壳一次 innerHTML）→ 拆帧后点击帧
  只解析 79 项；**帧级对比数值待老板实机**（IAB 遮挡期 rAF 冻结无法计时）。

## P3 winter.css 旧库样式收敛（已落地，实证闭环）

删除 5 组证死规则（浏览器计算样式快照 A/B：30 元素全属性 hash 482587333 → 删除后完全一致）：

1. `.hs-card.lib` 三行（09-06 紧凑列表）：cards.view.js `cardHTML` 调用面只传 lg/sm/xl，
   `.hs-card.lib` 组合 DOM 永不出现（JS 源零生成）。
2. `.lib-item` 旧边框两行：现行口径 expedition-library.css `border:0!important` 恒压。
3. 09-07 五批错位修复两行（`#overlay .lib-item .lib-cardwrap` / `.lib-cardwrap .hs-card`）：
   旧 flex 结构随 photo-studio 重构退场（快照实证零变化）。
4. 窄屏 media 内 `#overlay .lib-item{min-width:0}`：expedition-library.css 无条件同值供给。
5. 09-12 晚批次 `#overlay .card-library-page .lib-item{padding:10px 6px}`：库页恒带
   body.cardlib-open，`padding!important` 口径恒压；非 cardlib 态无 .lib-item DOM。

**未动**（超出本批范围）：winter.css 382-743 段 `.lib-cardwrap .hs-card/.hsc-*` 系列与
:1589 现行分页动画规则——`.lib-cardwrap .hs-card` 组合可能服务 #cardZoom 放大层卡面，
需单独查证消费面后另行收敛。

## 改动清单

| 文件 | 改动 |
|---|---|
| game/tools/bake-card-thumbs.cjs | processOne 加 TINT_M/TINT_B 烧色（canvas 版同公式） |
| game/assets/thumbs/**（322 张） | 重烘（烧色版 webp q82） |
| game/css/expedition-library.css | `.studio-photo-art img` filter 行删除+注释留痕 |
| game/src/hub/game.cardslib.page.js | 拆帧：首窗常量/队列/appendLibShellsIdle/flushLibShellsNow/scroll 兜底/switchLibPage flush/closeLibPage 清队 |
| game/css/winter.css | 5 组证死规则删除+留痕注释 |

## 验证与待办

- 定向测试 37/37 绿 ×2 轮（card-photo-notes 4 / photo-studio-presentation 2 / photo-zoom-lifecycle 12 /
  card-render-context 3 / hub-architecture 6 / full-review-regressions-hub 6 / custom-cards 4）。
- 烧色像素级一致性 4 图实测（上表）。
- P3 快照 hash A/B 零变化。
- **待老板实机**：①拆帧后打开/切页签阻塞数值（对照 52.9+39.9/22.4ms 基线）；②烧色后库页整体
  视觉验收（截图在遮挡期无法产出）；③真实滚轮滚动体感对照。
- 4 张无源 thumbs 残留 + winter.css `.lib-cardwrap .hs-card` 系列收敛 → 归入下次资产/CSS 收敛批。
