# 搜打撤 UI/体验大修 · 逐文件改动明细（2026-09-27）

> 配套终报：`.ui-loop-0926/FINAL-REPORT.md`（闭环统计/报批/下轮建议）。
> 本明细覆盖**本任务的净足迹**：43 个文件改动（+938/−347）+ 2 处新增。
> 并行会话在途文件（src/agent/**、tools/agent-*.mjs、battle/battle.lifecycle.js、ui/overlay.js、src/generated/**）**零接触**，不在本文档内。
> 每条标注来源 issue 单号（台账在 `.ui-loop-0926/ISSUES.md`）。

## 一、战斗体验（打击感/反馈/误指）

| 文件 | 改动 | 单号 |
|------|------|------|
| `src/battle/battle.vfx.js` (+39) | **击败瞬间爆点**：击杀标记触发舞台震动（8 段衰减 translate）+亮度脉冲 1→1.18→1+顿帧 120ms；终结跳字顿帧 100→140ms 拉开层级。尊重屏幕震动开关与 reduced-motion | W5-01 |
| `src/battle/battle.view.js` (+48) | 撤离钮 arm 态红染/描边/光晕/放大 1.07（危险升级一眼可辨）+与低危钮间距 4→15/14px；跳字样式注入（终结 38px 金/暴击橙/治疗绿，生命期 1.3-1.5s） | W2-01/W5-04 |
| `src/battle/battle.aim.js` (+24) | 治疗卡误指敌人时被点目标红框+0.45s 抖动反馈（650ms 自摘；拒绝逻辑零改动）；pendingItem 按道具 targetSide 过滤可点目标（自用道具不再高亮敌人） | W3-03/W5-06 |
| `src/battle/battle.layers.js` (+28) | 同上的键盘路径同式过滤 | W5-06 |
| `src/battle/battle.piles.view.js` (+6) | 三徽章全 0 时整组隐藏（恒零即噪音） | W5-07 |
| `src/audio/sound.js` (+4) | 音量曲线倒挂修正：kill 0.28→0.7（Accent 归位）、victory 0.5→0.62 | W6-02 |
| `src/ui/hud.js` (+25) | 战斗内背包钮可点修复：反 inert MutationObserver+行内 z101（绕行冻结的 overlay.js，根因双层：inert 隔离+room-view z-100 盖钮） | W1-02 |

## 二、结算与成长（大修最大靶）

| 文件 | 改动 | 单号 |
|------|------|------|
| `src/run/game.session.death.js` (+34) | **终局页熟练度成长块**：金条进度+「本局 +N XP·xp/need·差 M 点升级」+跨级升级宣告；doDeath 构造 token 时快照 xpBefore/lvBefore（补 receipt 只回 levelsGained 的缺口）；0 安全格教学行改条件渲染；「撤离失败」横幅挂接。顺手修 classSummary 取全职业数组的取值 bug | W3-01/LEG-6b |
| `css/page-rewards-bag-help.css` (+68) | doom 页错峰阶梯 CSS（--i 0.3s+90ms 逐项、CTA 垫后、reduced-motion 直出）；胜利搜刮页战报金闪；宝箱三档档位色带（古朴灰/稀有蓝/传说金） | W3-01/W2-05 |
| `src/run/chests.js` (+34) | 胜利搜刮页顶部车队横幅（胜暖金）；中宝箱三选一**跳过出口+右上 × 双出口**；弹层开启时底层假可点路线卡降权；victory 音锚点注释（防止重复接线） | LEG-6b/W1-05/W6-01 |
| 顶栏 XP 微条（battle.view/hud 内） | 「Lv·xp/need·差 n 点」+hairline 金条，maxed/无职业隐藏 | W3-02 |

## 三、地图与导航

| 文件 | 改动 | 单号 |
|------|------|------|
| `src/run/expedition.view.js` (+28) | 地图目标行实时播报「下一层闸门在 <方位>·直线约 N 格」（atan2 方位映射+八方位表，评审 72 点采样对账）；修「已探索已探索」文案拼接重复 | W1-10/W1-09 |
| `src/run/game.session.map.js` (+5) | 门节点键集合 doorKeys（Set 派生一次，渲染侧 O(1) 查询，逐帧零分配） | W1-10 |
| `src/core/renderer.js` (+13) | 画布门节点金色化（ legal 态 #edcb8d，与「目标/通道」全站语义色对齐） | W1-10 |
| `css/expedition-map.css` (+39) | 闸门路线卡金边+定位钮回归左上系统簇（19,17，原 y=-184 离屏）+地图 HUD 制式 | W1-10/W1-04 |

## 四、基地与枢纽

| 文件 | 改动 | 单号 |
|------|------|------|
| `src/hub/game.hub.pages.js` (+15) | 出发页锁态收敛（未解锁时锁钮+宝藏大门横条不渲染，右栏 05 聚合行，解锁态零损失）；仓库宠物区挂宠物蛋插画；经济总览行「卖卡→储备币·钥匙→复原·口粮→宠物升级·木材→扩建」 | W2-02/W2-03/LEG-6a |
| `src/hub/game.hub.depart.js` (+43) | 整备页返回钮从底中迁左上系统位（页头让位 96px） | W1-03 |
| `src/hub/game.hub.js` (+9) | hub 六页签切换挂既有 switch 音效（同页签重击不响，零新音频） | W6-03 |
| `css/page-deploy.css` (+46) | 锁态样式+页头让位+出发页制式 | W2-02/W1-03 |
| `css/preparation.css` (+8) | 整备页背包预览引导行「初始攻击×5 已默认携带（固定）；首次出征可直接点确认出发」+空格虚线降噪 0.22→0.12 | W2-04 |

## 五、信息架构与全局

| 文件 | 改动 | 单号 |
|------|------|------|
| `src/ui/game.menu.js` (+98) | **跑局数据页界面化**：openDataPageUi 包装器（经 deps 注入，agent.** 零静态接触）+设置页「跑局数据 RUN DATA」节+注入页统一返回件（MutationObserver 防重渲染丢钮） | W1-01/W2-06 |
| `src/run/game.session.js` (+6) | openDataPageUi 导出接线 | W1-01 |
| `src/ui/quick-nav.js` (+7/-3) | Alt+9 走包装器；「卡牌库·照相馆」更名「照相馆」（一物一名） | W1-01/W1-07 |
| `index.html` (+83) | **boot 看门狗重写**：裸 3s 计时→400ms 轮询 SDT；3-12s 中性「加载中」提示（删误导清缓存文案）、就绪自撤、>12s 才升级失败条——「永不移除」根除；标题 CTA 定名「进入远征档案」；标题页留言信箱胶囊；新 css 片挂链 | W5-02/W1-06/W1-11 |
| `src/core/icons-bitmap.js` (+5) | 图标位图别名 chart→archive、info→scroll（零新素材，数据页/终局缺图治愈） | W5-08 |

## 六、视觉制式收敛（等值替换，零视觉漂移已证明）

| 文件 | 改动 | 单号 |
|------|------|------|
| `css/base.css` (+53) | 金色三档 token 定义保护+等值替换；--radius-* 制式 | W4-01/W4-02 |
| `css/winter.css` (+90) | **冷蓝 token 三枚新增**（--cyan-soft/--bg-deep/--bg-deep2，P2 支柱「冷蓝」首次制式化）+同名变量清理 | W4-05 |
| `css/` 其余 17 文件（expedition-roster 77、hub 60、page-ach 30、page-deploy 46、page-hub 38、page-settings 39、page-shop 22、page-stash 20、page-upgrade 20、expedition-hub 20、expedition-inventory 21、expedition 14、page-classes 16、page-slot-select 12、title-p0 2 等） | 金色等值替换 ~185 处（#d9bb82→var(--gold-main) 等三映射，计算 diff 证恒等）；圆角向 --radius-* 三档归一 81 处；eyebrow 七面补齐（仓库 CARD STORAGE//02、商店 TACTICAL SUPPLY//03、升级 UPGRADE LAB//04、整备 DEPARTURE STAGING//06、数据 RUN DATA//09、手册、选档）；--font-display 正名+--font-handwriting token（标题书法字） | W4-01~05 |
| `src/home/home.visuals.js` (+2) | 「出征整备」→「出发整备」（术语定版） | W1-07 |

## 七、素材接线（全部既有素材，零新增生成）

| 新增/接线 | 内容 | 单号 |
|-----------|------|------|
| `game/assets/ui/emblems/`（新增 6 文件） | 五职业纹章 PNG+宠物蛋 PNG（自 .ui-art-loop-0925/nai-out 只读复制） | LEG-6a |
| `src/run/game.run.altar.js` (+24) | 选人页信息面板纹章（随选中职业切换）+底部五张人物卡角标 | LEG-6a |
| `css/expedition-roster.css` (+77) | 纹章珐琅铭牌制式+卡角标+选人页返回件 CSS 迁移+hub.css 通高光柱 bug 压制 | LEG-6a/W1-03 |
| `src/battle/battle.css` (+10) | 胜负车队横幅制式（冻结通报前既成；此后新样式全部走独立片） | LEG-6b |
| `css/page-datapage.css`（新增） | 数据页页头/返回件归位/按钮收敛独立样式片 | W2-06 |

## 八、明确没动的
- 并行会话在途：`src/agent/**`、`tools/agent-*.mjs`、`battle/battle.lifecycle.js`、`ui/overlay.js`、`src/generated/**`（battle.lifecycle 的 victory 音经实机确认本已接线，无需改）
- 玩法数值/机制语义：伤害/结算/掉落零触碰（打击感参数全在 vfx/样式层）
- 不动区：壁纸位图、cards.css 卡背（LEG-2 待拍板）
- 未提交：全部改动留在工作区，等老板实机验收后指示提交
