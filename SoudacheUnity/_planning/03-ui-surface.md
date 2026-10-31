# 03 · UI 界面清单（网页版 → Unity uGUI 移植侦察报告）

项目：`D:\素材\代号柒\搜打撤\game`（升格会的冬日猜想 v0.51）
入口 `index.html` → `src/main.js` → `src/game.boot.js`（DOMContentLoaded 初始化 + rAF 主循环）。

## 0. 全局 UI 架构（读前必懂）

- **静态骨架只有一份**：index.html 写死 `#app > #sidebar + #viewport(canvas + 所有浮层)`。除标题页/侧栏外，**其余所有界面都是一个共享模态容器** `#overlay > .card > #ovTitle + #ovBody`。
- **DOM 生成方式：几乎全部是模板字符串 → `innerHTML`**。各模块的 `renderXxx()` 拼 HTML，经 `UI.showOverlay(title, bodyHtml, mode)`（src/ui.js）一次性灌入 `#ovBody`，然后 `UI.act(name, fn)` 注册按钮回调。`mode`（'page'/'battle'/'bag'/'bagpage'/'scene'/'chest'）只切换 `.card` 上的 class 决定布局样式。
- **事件委托**：`#ovBody` 上的 click 委托到 `[data-act]` 按钮查 `_acts` 表；input/mouseover 也有可插拔 handler。
- **数据绑定 = 重绘**：状态变化后整块 innerHTML 重建（战斗每次出牌都整页重渲染）；仅 `UI.refresh()` 对侧栏 HUD 做脏检查式局部更新。
- 地图本体是 Canvas 2D 手绘（renderer.js），非 DOM。

## 1. 屏幕/界面全清单（约 30 个界面）

| # | 界面 | 入口/触发 | 源码模块 | DOM 生成 |
|---|------|-----------|----------|----------|
| 1 | 标题主页（明日方舟风 HUD） | 启动 `showTitle()` | game.menu.js + index.html 静态 | 静态 HTML，`renderTitleStats()` 回填存档数据 |
| 2 | 选档页（5 档横排卡片） | 标题「开始探索」→ `openSlotPicker()` | game.menu.js | 模板串 'page' |
| 3 | 快速参考 | 标题 `mGuide` | game.menu.js `openTitleGuide` | overlay 模板 |
| 4 | 成就总览 | 标题 `mAch` | game.menu.js | overlay（.ach-row 列表） |
| 5 | 设置页 | 标题 `mSettings` | game.menu.js `openSettings` | 'page'，checkbox/range + addEventListener |
| 6 | 建议留言箱（右键任意处） | document contextmenu | game.menu.js `openSuggestionBox` | 静态 `#sugLayer`，写 output/suggestions.json（桌面 IPC）或 localStorage |
| 7 | 退出告别屏 | `quitGame()` | index.html `#exitScr` 静态 | 静态 |
| 8 | 基地 Hub（5 页签：出发/仓库/升级/人物/成就） | 进档位 `openBaseHub(tab)` | game.hub.js `renderHub` + hubDeployHTML/StashHTML/UpgradeHTML/ClassesHTML/AchHTML | 'page'，页签切换重绘 |
| 9 | 出征整备（带卡 stepper） | 基地「出发」→ `openDepartPrep()` | game.hub.js `renderDepartPrep` | 'page' |
| 10 | 对局地图主界面 | `newRun`/`loadGame` | index.html 侧栏 + Canvas | 侧栏静态，Canvas 每帧绘制 |
| 11 | 选角色页（+二级卡池页） | 空降后 `openClassChoice()` | game.run.js | 'page'（左网格 + 右立绘详情双栏） |
| 12 | 节点过场（scene 卡通页） | 踩格 `openScene(kind)` | game.run.js | 'scene' 模板 |
| 13 | 区域转场（900ms flow-transition） | `enterNode` → `showRunTransition` | game.run.js | 'scene'，setTimeout 自动关 |
| 14 | 拾取页 | `openPickupPage` | game.run.js `nodeShell` | 'page' |
| 15 | 事件对话页（ink 多分支） | `triggerEventCard` | game.run.js + narrative.js | nodeShell + `.evt-opt` 选项条 |
| 16 | 环间门/污染核心入口/BOSS选择/紧急撤离弹窗 | `openDoorModal/openAltarEntranceModal/openAltarModal/openEmergencyModal` | game.run.js | nodeShell |
| 17 | 商店（拾荒商队） | 商店格 `openShop()` | game.run.shop.js `renderShop` | 'page'（shop-grid + 出售区） |
| 18 | 背包页（安全格/消耗口袋/拖拽排序/翻面） | B 键 / bagBtn → `showBackpack()` | game.bag.js | 'bagpage'（bag-grid + flip3d 卡背） |
| 19 | 背包卡牌详情/丢弃确认 | 点卡 | game.bag.js | overlay |
| 20 | BOSS 战后整理背包 | `showBossPackCleanup` | game.bag.js | overlay |
| 21 | 营火休整（消耗口袋复原选牌） | 营火格 `openFireRest → openPocketRestore` | game.run.js | nodeShell |
| 22 | **战斗界面（遭遇战/BOSS战）** | 战斗格 `SDT.Battle.start` | battle.view.js `render()` | 'battle'（详见 §5） |
| 23 | BOSS 编组牌库 / 发现选牌 / 墓地查看 | 战斗内 `renderDeckSelection/renderGrave/discovering` | battle.view.js | overlay 'wide' |
| 24 | 撤离整理入库 / 撤离结算 | 撤离点 `doExtract` | game.run.js | 'page'/nodeShell |
| 25 | 死亡结算 | `doDeath()` | game.session.js | overlay |
| 26 | 离开对局菜单 / 放弃结算 | btnHome → `openLeaveMenu/abandonRun` | game.menu.js | overlay（两步确认） |
| 27 | 结点备注编辑器（notes） | 点地图结点 | game.notes.js `openCellEditor` | overlay + textarea |
| 28 | 卡牌收藏图鉴 | 标题 `btnCardLib` | game.cardslib.js | 'page'（左网格+右大图，mouseover 委托） |
| 29 | 卡牌制作坊（设计器表单+3D 卡面预览） | 标题 `btnCardDesigner` | game.cardslib.js `renderDesigner` | 'page' + 实时 input 回调 |
| 30 | 卡牌库导入/导出 | 设置 | game.notes.js / cardslib.js | overlay + textarea |
| 31 | ? 帮助二级弹层（通用） | 页头 `helpBtn(id)` | ui.js `showHelp/registerHelp` | overlay |

## 2. 主要界面元素树与刷新函数

**对局主界面**（index.html 静态）：`#viewport`（Canvas 地图 + `#sceneTools` 镜头按钮组 + `#layerBanner` 换层横幅 + `#resHud` 金币/攻击 chip + `#topBtns` 退出/静音 + `#hpHud` 血条 + `#tooltip`）+ `#sidebar`（头像/背包按钮+计数/行动·价值/掷骰+3D 骰子+历史）。刷新：`UI.refresh(game)`（脏检查），骰子 = CSS 3D cube（`buildDiceCube/drawDice`），镜头由 camera.js + rAF loop。

**基地 Hub**：`.pg.hub > header（资源 chips：木材/口粮/储备币）+ .hub-body > nav.hub-tabs（5 图标页签）+ .hub-page`。每页签一个 `hubXxxHTML()`，操作后 `renderHub()` 整页重绘。

**背包**：`.bag-view > .bag-head（chips：格数/总值/安全格/口袋）+ .bag-layout > .bag-main（bag-grid + safe-grid）+ .bag-side（消耗口袋列表）`。格子 = 物资槽/卡牌槽（flip3d 双击翻面、点击详情、指针拖拽排序 bindBagDrag + 3D ghost）。

**商店**：`#ovBody .pg.shop-pg > pg-head（金币 chip）+ .shop-grid（9 货位 + 侧栏 coinbox/离开）+ .shop-sell（可售卡列表）`。

**选角**：`.cls-body > .cls-grid（角色按钮：立绘+名+熟练度）+ aside.cls-detail（大立绘/背景故事/出发任务/卡池按钮）+ footer 确认`，内部 render()/renderPool() 二级切换。

## 3. 样式体系

- **css/ 文件**：base.css(27K 侧栏/HUD/弹窗骨架)、overlays.css(36K .pg 页面/ov-btn/事件选项)、hub.css(16K)、battle.css(14K sts-*)、cards.css(22K 卡面)、scenes.css(30K 场景/转场)、winter.css(31K **当前主题**：蓝灰雪青)、theme-classical.css(48K 备用古典)、title-soft.css、ui-soft.css、expedition.css。加载顺序见 index.html（winter.css 最后覆盖）。
- **设计语言**：黑白灰终端风基底，winter.css 覆盖为深蓝雪青（`--ink:#101e27` 等 CSS 变量）；标题页仿明日方舟终端（`--akmint:#a9efc3` 薄荷绿高亮、手写体英文小字、圆形入口、雪花层）；**退出按钮朱红渐变** `linear-gradient(160deg,#A02020,#701616)` 是唯一功能色例外；血条按百分比蓝→金→红渐变。
- **字体**：Cascadia Code（等宽 UI/数字）+ Noto Sans SC（woff2 自托管）+ 宋体衬线（中文大标题）。图标 = `[[icon:xxx]]` 文本标记替换为 SVG。
- **布局**：flex 为主，整屏页 `.pg` 绝对定位铺满；卡面固定纵横比 + `font-size: clamp()` em 缩放；`@media (max-width:1080px)` 背包降单列。
- **分辨率适配**：无缩放系统——viewport meta + flex 自适应 + canvas resize 按 devicePixelRatio。Unity 侧需 Canvas Scaler（建议 1920×1080）。

## 4. 交互流程

- **键盘**：Space/Enter 掷骰、Q/E 旋转、G 全景、F 定位、B 背包、N 结点编号、Esc 关卡牌页（game.boot.js bindInput）。
- **鼠标**：地图拖拽平移（>6px 判定）、滚轮以光标为锚缩放、点结点开备注编辑器；**全局右键** → 留言信箱（带 DOM 位置描述写 suggestions.json）；战斗内**按住卡牌拖出贝塞尔指向箭头**（Canvas，敌红/己绿）到目标松手打出；背包卡牌拖拽排序/拖入安全格/拖出丢弃。
- **动画**：全 CSS（transition/animation：overlay 滑入、200ms 淡出、页签 page-in、卡面 flip3d、飘字 sts-float、受击抖动 fx-hit、BOSS 登场 fx-dread、标题雪花/余烬呼吸）。JS 只 retrigger + setTimeout 清理。

## 5. 战斗 UI（battle.view.js，最复杂）

- **触发链**：battle.core.js 持有全部状态（手牌/牌堆/能量/意图），命令函数执行后调 `requestBattleRender()` → battle.view.js `render(snapshot)` 整页重建 innerHTML（mode='battle'）。
- **结构** `.battle-stage.sts`：`sts-arena`（左下 `sts-unit.sts-me` 自己：立绘+名牌+血条+攻/盾/甲+状态 chips；右下 `.sts-foes` 敌人横排：头顶 `sts-intent` 意图气泡(icon+伤害值)、词缀角标、dead/aegis 态）→ `bt-infuse` 注能选择条 / `bt-pick` 目标锁定提示条（互斥）→ `sts-hud` 三栏：左（能量 ⚡n/max + 抽牌堆卡背+计数）、中（`bt-hand` 手牌：**同名堆叠 ×N、扇形排列**（--rot 旋转、超 6/9 张负 margin 叠卡）、费不足虚化、目标类型角标 ⚔/♥）、右（弃牌堆+墓地 pile + 撤退/结束回合按钮）→ 底部 `sts-note`。战斗背景按 data-asset-key 换（普通/三 BOSS 专属）。
- **刷新机制**：command → snapshot → render 整页重建（飘字特效挂在 #overlay 上不随重建销毁）。`spawnFloats`（伤害/治疗飘字+受击抖动+全屏红闪+粒子）、`startAim/moveAim/endAim` 指向箭头（独立 canvas 画二次贝塞尔）、`showFoePreview` 悬停敌人伤害预估浮窗（克隆快照预结算）。子界面：BOSS 编组选牌、发现三选一、墓地列表（整页 overlay 变体）。

## 6. Unity (uGUI) 映射结论

- 单 Canvas（Screen Space Overlay + Canvas Scaler 1920×1080）+ 每界面一个全屏 Panel，UI 栈/状态机管理（对应 game.state: title/modal/idle/done）。地图用正交 Camera 渲染 Sprite，UI Canvas 叠加。
- `UI.showOverlay/act(data-act)` 模式 → 每界面一个 ViewController 类 + 按钮事件集中路由。
- 标题页独立 Panel（背景 + 绝对定位按钮复刻 AK 布局）；Hub = Tab 5 子 Panel + ScrollView 网格；背包 = GridLayoutGroup 双区 + IDragHandler + 翻面旋转；战斗手牌 = 底部横排 + 脚本控制扇形旋转/堆叠角标；指向箭头用 UI 顶点绘制；飘字/受击用自写缓动。
- CSS 变量双主题 → C# 常量色表/ScriptableObject。
- **移植决策：全部 UI 用 C# 代码运行时构建（UIKit 辅助库），不用 prefab 序列化**——与原版 innerHTML 重建模式同构，且免去手写 prefab YAML/GUID。

## 关键结论

1. 约 30 个界面但 DOM 骨架只有一份：除标题页/侧栏静态外，全部共用一个 `#overlay` 模态容器，由 `UI.showOverlay(title, html, mode)` + mode class 驱动。
2. DOM 生成统一为「模板串 → innerHTML 整块重建 + data-act 事件委托」→ Unity 侧改为每界面一个 ViewController + 数据驱动刷新。
3. 最复杂三个界面：战斗（扇形堆叠手牌/指向箭头/意图/三牌堆/飘字）、背包（拖拽排序+翻面+安全格）、Hub（5 页签）。
4. 地图本体是 Canvas 2D 手绘，与 DOM UI 分离 → Unity Camera 场景而非 uGUI。
5. 设计语言：黑白灰终端基底 + winter 蓝雪主题 + AK 风标题页 + 退出按钮朱红渐变；字体 Cascadia Code / Noto Sans SC；无独立缩放系统。
