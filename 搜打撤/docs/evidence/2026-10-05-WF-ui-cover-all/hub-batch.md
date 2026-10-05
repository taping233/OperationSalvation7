# 基地补给、升级、收藏美术补齐

日期：2026-10-05。归属：本轮 Codex 子代理 hub_surface。状态：候选已被最新指令排除，保持未挂载。

老板最新要求“今天改过的就不要再改”。本批属于对已改为新体系的基地页面补修，主会话决定不加载 `cover-hub.css`。候选源码只保留现场，未删除、未回滚、未继续修改；下方为排除前候选记录，不能视为已接入游戏的改动。

## 约束与接入

- 已新增 `game/css/cover-hub.css` 与本记录；最新决定为不挂载。只读搜索 `game` 的 CSS/JS/HTML 没有发现 `cover-hub.css` 加载引用。
- 沿用设置、制作名单、选档、选人的纸面、蓝金、切角、浅硬投影与充分留白。
- 老板已接管实页验收，本批没有浏览器操作、截图、测试、lint 或 build；未写存档，未购买/领取/装备任何物品，未提交。
- 外部 `WF-hub-cover` 的基地外壳/出发/仓库/宠物/人物属地不动。现有 `hub-cover-collections.css` 已处理大量浅色基底，复用其内容，不重写现有文件。
- 本批没有生图：现有商品卡面、物资图标、卡背、人物分类标记足以支撑本批设计；保留透明图标与原画原色。

## 真实入口与选择器

所有规则限定 `#overlay .card.page #hubMain.pg.hub.hub-cover.hub-shop`、`.hub-upgrade` 或 `.hub-ach` 后的内容节点，未覆盖页头、侧栏与页面外壳。

| 真实选择器/状态 | 源码入口 | 补齐内容 |
| --- | --- | --- |
| `.hub-shop .hub-two` / `.shop-shelf` | `game/src/hub/game.hub.pages.js` → `hubShopHTML()` | 复用现有双纸面板，货架为宽松单列；商品主面板与说明副面板有金/青顶缘区分 |
| `.shelf-item .shelf-visual` / `.shelf-info` | 同上；卡面来自 `SDT.Cards.cardHTML(card, 'sm')` | 暗色陈列窗改纸面承托，商品图与名称/说明/价签分栏；长文案正常换行；不改卡面内部 |
| `.shelf-item.poor .shop-price-tag:disabled` / `.poor-why` | 同上；原因来自币不足/仓满 | 灰青禁用价签、明确缺额提示；去旧发光/编号，不把不可购买行当大按钮 |
| `.shop-soldout` | 同上空货架分支 | 浅纸虚线封条；保留原售罄文字 |
| `.hub-upgrade-layout .up-card` / `.up-cap` / `.base-bar` | `game.hub.pages.js` → `hubUpgradeHTML()` | 复用容量纸面档案、扩大留白；两张扩建卡上排，数字/单位/进度/操作清楚分层；去旧扫光编号 |
| `.up-card .ov-btn` / `.up-pets .mini-btn` | 同上；`upBag` / `upStash` / `upPet` 既有操作 | 切角按钮继续使用既有基础样式；新补统一金底、灰青禁用、真实容量/成本与缺额语义 |
| `.up-pets .pet-row` / `.pet-ops` / `.stash-list` | 同上 | 人物名/携带章/描述与等级/升级操作留足空间；释放内层 38vh 滚动限制，交页面自身滚动；携带与未孵化仍分明 |
| `.collection-command .story-strip` / `.ss-tag` | `game.hub.pages.js` → `hubAchHTML()` | 复用现有汇总卡/分类签，补见闻条文字对比与行距；长故事不挤单行 |
| `.collection-panel .ach-row` / `.ach-info` / `.ach-ops` | `hubAchHTML()` 成就分支 | 宽松奖励行，名称/条件/奖励/领取清楚分栏；未解锁、已领取、待领取保留真实状态 |
| `.ach-row.done:has(.mini-btn.ok)` | 同上 | 待领取以暖纸与左金缘提示，去呼吸光罩；领取后仍使用现有完成状态 |
| `.ach-silhouettes` / `.ach-sil` | 同上 `doneN === 0` 空态 | 复用原剪影卡阵，扩大间距，提高锁定图标清晰度，保留 title 条件 |
| `.back-grid` / `.back-card.locked` / `.back-lock` | `hubAchHTML()` 卡背分支 | 卡背托卡留白、名称/解锁来源字号补齐、浅色锁章；保留实际卡背原色与特定卡背分类色 |
| `.coll-room .base-bar` / `.coll-ms` | `game.hub.pages.js` → `collRoomHTML()` | 纸面进度条与宽松里程碑行；奖励可换行；未达/可领/已领按真实类名分级 |
| `.coll-group-head` / `.coll-cards` | `collRoomHTML()` → 各职业组 | 复用原人物分类纸面与 `--role-accent` 分类色；头部可折行、卡牌间距增加，未动职业图片或卡牌大小 |

## 复用及保护

- `hub-cover.css` 已认可的全屏基地外壳、导航、通用切角按钮、浅纸卡片、字体与滚动条继续使用。
- `hub-cover-collections.css` 已有汇总卡、收藏页签、卡背选中态、人物职业分组色、未收藏虚线空槽继续使用。
- `hub-cover-motion.css` 已有短距离位移与非循环基础运动继续使用；本批没有新增动画、图片、纹理或滤镜。
- 稀有度/类型/人物分类、价格/币/容量/进度、资源不足、升级上限、成就领取、收藏领取、卡背装备均未改文案或业务代码。
- 收藏已解锁卡面的 `.hs-card` 及卡背 `.hs-back` 本体未覆盖；本批只改托卡与外侧标签。
- 主页、设置、制作名单、选档、选人、地图、照相馆、信箱、主页成就馆均没有规则覆盖。

## 二/三级边界及未覆盖

- 补给购买、扩建、宠物升级、成就领取、收藏奖励领取、卡背装备都在原页重绘并发已有日志，没有独立详情 DOM；其行内状态已经纳入本批。
- 收藏卡片放大入口：`game.hub.js` → `UI.act('collZoom')` → `UI.showCardZoom(card)`。这是共用卡牌详情，本批不覆盖共用弹层，由主代理协调共用详情属地。
- 仓库详情 `.stash-shell`、材料弹窗、宠物孵化、人员档案属于外部在途工作，未动。
- 空货架为当前常量货架中的防御性分支，其真实运行状态未验收。
- 代码里对未解锁成就奖励保留内联 `opacity:.55`，属于原有状态弱化；本批不使用 `!important` 去改变它。
- 新增 1100/760px 自然折行仅用于避免溢出，未进行多尺寸检查。

## 静态阅读范围

阅读真实 `game.hub.pages.js` 商店/升级/收藏函数与 `collRoomHTML()`、`game.hub.js` 渲染入口/对应操作；按定位阅读 `hub.css`、`expedition-hub.css`、`expedition-inventory.css`、`page-shop.css`、`page-upgrade.css`、`page-ach.css`、`hub-cover.css`、`hub-cover-collections.css`、`hub-cover-motion.css` 与 `settings-cover.css` 基准。样式加载参考 `game/index.html`。未把阅读结果写成实际视觉/交互通过结论。

## 最新只读二/三级盘点

| 范围 | 真实后续呈现 | 是否有独立且未改界面 |
| --- | --- | --- |
| 商店 `shopBuy` | `game.hub.js` 188-209 行购买后写既有日志并 `renderHub()`；失败只发日志 | 没有独立购买页或详情弹层 |
| 升级 `upBag` / `upPet` / `upStash` | `game.hub.js` 264-291 行直接升级、写日志、重绘原页 | 没有独立扩建或升级页；去孵化入口进入仓库，属外部在途工作 |
| 收藏切签 `hubCollectionView` | 223-226 行切 `backs` / `achievements` / `classes`，均为同一已改收藏页内面板 | 不满足近期未改条件 |
| 收藏领奖 `claimAch` / `claimColl` | 303-308、323-328 行成功重绘原页，失败写日志 | 没有独立奖励预览/确认弹层 |
| 卡背装备 `selBack` | 309-322 行装备后写日志并重绘；锁定时写解锁来源日志 | 没有独立卡背详情页 |
| 收藏卡放大 `collZoom` | 329-331 行 `UI.showCardZoom(card)` | 共用卡牌详情，归主会话；本代理不新增规则 |

因此，本代理负责的商店/升级/收藏范围没有发现可另行重做的真正独立且近期未改二/三级界面。本轮收窄后的动作仅更新本记录与只读盘点，没有新增/修改 CSS。下一动作：主会话继续未改界面；本批候选保持未挂载。
