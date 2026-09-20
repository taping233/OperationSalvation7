# 战斗系统对齐改造 · 交接锚点（2026-09-12）

> 用途：新对话接续执行。定调与进度全部在此，接手必读。
> 源头：STS2 对齐审计 = `docs/sts2-combat-mechanism-audit.md`；本文件是执行状态源。

## 已定调（老板拍板，不要再问）

1. 架构走折中：**只把手牌区 + 单位区常驻化**（不做全节点树常驻）。
2. 动画路线：**Pixi 材质层 + NAI/GPT 序列帧，跳过 Spine**。
3. 帧集规格：**每角色 6 帧**（待机=基准帧 / 攻击起手 / 攻击命中 / 受击 / 施法 / 待机呼吸）；**敌人本轮不上序列帧**（静图+受击反馈）。
4. 基准帧：NAI 新出（已完成 3 张，832×1216 纯渐变底全身）。
5. GPT 网页版出帧由老板做，提示词包已交付：`.tmp/nai/战斗帧序列-GPT出帧包.md`；帧图放 `.tmp/nai/output/frames/<角色>/`，命名 `frame-<角色>-<后缀>.png`（后缀 idle/atk-wind/atk-hit/hurt/cast/idle-breathe）。

## 批次进度

| 批次 | 内容 | 状态 |
|---|---|---|
| A | 手牌区常驻化 | ✅ 已提交 `2743071`；**批次B 修复了它的隐藏坑**（见下方令牌机制），槽位差分自此才真正跨渲染生效 |
| B | 单位区常驻化：玩家/敌人立绘、意图、血条、状态图标常驻节点 + 局部更新 | ✅ 已提交 `ccfdce6`，实机验证通过（结束回合-敌方阶段-出牌-墓地挂起返回，玩家/敌人/手牌槽位全链路同一 DOM 节点零报错） |
| C | 交互收敛：click/drag/指向统一 interaction 状态机，`pendingTarget` 多语义收敛，取消幂等 | ✅ 已提交 `edef44d`，实机验证通过（取消幂等三连调/砸击槽 begin-cancel-resolve 取消不扣费/click 管线出牌/targeting 挂起 endTurn 回归全过零报错） |
| D | Pixi 材质层 + 序列帧播放器（单位区接入；程序化位移走合成器，遵守性能三铁律） | ✅ 代码完成+实机复验通过（未提交）：battle.frames.js + view 接线 3 处 + core 补传 card.type；**帧数按实际资产探测**（基准 `<动作>.webp` + 追加 `<动作>-1..N.webp`，idle 尾部含 idle-breathe，有几帧播几帧、SEQ_MS 均分，老板 09-12 追加定调）；修实机 bug：播放器订阅 `battle:end` 自行 hide（#unitFrames 挂 overlay 直下不随 ovBody 销毁，战后曾残影浮在非战斗场景）；254 测试全绿+构建通过+实机出牌飞行/敌方回合横幅/你的回合横幅/战后卸载/再战重挂全过零报错 |
| E | 帧图批量抠图接入 | ✅ 完成（未提交）：老板 09-12 交付三张 GPT 透明底 12 格精灵图（2行×6列，**整图交付出**，取代逐帧交付方案）→ `.tmp/frames-bake/bake-sheets.py` 切片烘焙（谷底切分防切脚/贴边网格线清除/去低alpha雾）→ assets/portraits/frames 39 张 webp（512×760，旧占位帧全部覆盖）：wu 12张（atk-wind×3+atk-hit×2）/ changwuyu 12张（cast×3）/ baita 15张（cast 全链×6），idle 均为呼吸级微差双帧循环；SEQ_MS cast 620→800 适配多帧链；254 测试全绿+构建通过+产物核验 39 帧；对照表在 `.tmp/frames-bake/contact-*.png`。敌人不上序列帧是定调 |
| F | 出牌队列演出（卡牌飞行/队列结算/回合过渡）+ 总回归 | ✅ 代码完成+实机复验通过（未提交）：同帧多张打出走两段式（先飞手牌上方队列位横排错开入场→停 260ms→依次飞去处），单张保留原直飞弧线；回合过渡加 `.bt-turnbanner` 横幅（敌方回合红/你的回合金，battle.css）。总回归=254 测试+构建+实机冒烟全过 |
| G | 紧凑手牌 + STS2 拖拽状态机/打击感（09-12 晚，老板三次定向） | ✅ 代码完成+实机复验通过（未提交）：① 手牌常态只露费用角标+插画+名字条（`.bt-card.compact` 隐藏 desc/type/kw/val），**悬停** CSS :hover 弹出完整卡面（老板否掉单击展开方案，点击=直接出牌/选目标）；槽位沉底 bottom:-24px + fanLayout 边缘正 y 压平 ×0.35 + rowScale 起缩点 7→9 + HAND_PAGE_SIZE 12→16；双击放大退役。② 拖拽=**STS2 NMouseCardPlay 状态机逐条对齐**（反编译 NMouseCardPlay/NCardPlay/NTargetManager 后重写，第一版"全程跟手"被老板否）：卡跟手（rAF+moveAim 双通道防遮挡挂起）→ 上拖过**出牌线**（playZoneY：75% 线，抓取点校正=max(线,抓Y-100)/min(线,抓Y-50)）→ 指向卡 **CenterCard 停靠视口底部中央缩 0.75 + 箭头自卡画向指针**；**瞄准态松手有目标=打出、无目标=转 clickTarget 点击确认（箭头保持）**，点目标打出/点空回手；未指向卡过线=战场 drop-any 亮环+松手即打出；**取消区=底部 5%**（cancelZoneY=95% 线，hasLeftCancel 离开过再进入才取消，瞄准态每次 move 检查=STS2 exitEarly）；右键/Esc 取消；单敌直打（findIndex 活敌，非字面量 0——修过尸体占位 bug）。③ 打击感：stsShake（x=10·sin4t·sin(t/2) Cubic-Out，帧播上 hurt 则不抖）、physicsFloat 伤害数字抛体（随机走 Random.random('fx')——random.test 禁 Math.random）、≥10 点重击分级（贴图 210px/抖动 1.55×/粒子 22）、血条幽灵条 .sts-hp-ghost（主条即时+黄尾 delay .4s/dur .55s）。涉及 battle.view.js/battle.css/battle.hand.js/tests/boot.test.js；271 测试全绿+构建+实机（过线停靠数值精确/松手打出/无目标转点击确认/幽灵条宽度差 157vs79）全过 |

## 关键代码锚点（批次 A 落点，B/C 沿用同一套模式）

- `game/src/battle.view.js`：
  - 常驻层机制 = `handLayer` / `handSlots` / `handSuspended`（搜索「手牌常驻层」注释块）
  - `mountHandLayer(body, tip, token)`：showOverlay 后 replaceWith 挂回；**重置判定=战斗令牌变更（见下），勿改回 isConnected**
  - `updateHand(snapshot, prev, pageGroups, events, extra)`：差分更新 + 目标值补间 + 新牌飞入；`handGroupState(g, ctx)` 单叠状态计算；内容按 `st.inner` 字符串签名 diff
  - **单位区常驻层（批次B）**：`mountUnitLayer(body, token)` / `updateUnits → updateSelfUnit / updateAllies / updateFoes`；`makeUnitSkeleton` 固定骨架（意图+立绘+名牌四段），各段按签名 diff；`setUnitHP` 血条局部更新（首次填充禁过渡）；敌人点选 click 在槽位创建时绑一次，点击时读 `getSnapshot()` 实时态防闭包过期；常驻节点上每次渲染清残留 `.bt-fpreview`
  - **换场重置令牌（批次B，修批次A隐藏坑）**：`battle.state.js createBattleState` 发自增 `token` → `battle.core.js` 快照带 `battleToken`（snapshotSignature 也含它）→ view 层 `battleToken` 变量比对。不能用 `isConnected` 判定换场——showOverlay 整块重建 ovBody，常驻节点每次挂载前必然脱离文档，按它判定会每帧误重置（批次A因此槽位差分实际失效）
  - `animateBattleTransition(prev, body, events, extraFlightMs)`：只剩克隆飞行/能量与牌堆脉冲/阶段沉升；`takeCardAnims()` 在 render 里取一次共享
- 扇形数学：`game/src/battle.hand.js` `fanLayout`（1~10 张标定表，handMax=8 契合 STS2 1-10 表）
- 机制审计（P0/P1/P2 与验收标准）：`docs/sts2-combat-mechanism-audit.md`
- 批次 C 拟动区域：`startAim/moveAim/endAim/cancelAim`（battle.view.js 指向施法段）与 battle.core 的 `pendingTarget/pendingItem/slamPending` 多语义收敛；批次 B 已把敌人点选 click 收进常驻槽位（点击时读实时快照），C 可沿用该模式
- **统一交互槽（批次C）**：battle.core.js 三散落变量收敛为单一 `interaction = { kind:'card'|'item'|'slam', uid, card, hint }`——同刻至多一个交互；入场走 `beginCardTargeting`（卡牌指向，单槽顶替旧交互）/直接赋 item、slam 槽；出场只有 resolve*（结算后清槽）与 `cancelInteraction()`（幂等，无交互时 no-op；freeCast 卡取消后按原费留在手牌）。快照对视图仍派生 `pendingTarget/pendingItem/slamPending` 三个兼容字段（getSnapshot 内 `pTgt/pItem` 派生），视图读法不变、勿删
- **endTurn 阶段雷（批次C 修复，勿回退）**：targeting 阶段挂着直接 endTurn 会抛 `targeting→enemy 非法迁移`——endTurn 开头硬清 interaction + `cancelTargeting`（不走 cancelInteraction，freeCast 簿记保留＝「直接释放」卡跨回合仍免费）
- **统一交互 API（批次C，commands 新增）**：`beginCardInteraction/resolveCardInteraction`（=play，click 与 drag 共用）、`cancelCardInteraction`、`beginItemInteraction/resolveItemInteraction`、`beginSlamInteraction/resolveSlamInteraction`、`cancelInteraction`；视图 endAim 拖空取消已改无条件走幂等 cancel
- 单位区 CSS：`.sts-hp i { transition: width .3s ease; }`（battle.css，批次B 加）——首帧填充由 JS 禁用过渡，勿删

## 验证口径（每批必做）

1. `npm test`（37 文件 254 断言）+ `npm run build`（产物进 desktop-app/game，哨兵 ≤2 个 index bundle）
2. 实机冒烟：python 静态服挂 `desktop-app/game`（8139）→ 档位 02 继续对局 → `#devBattle` 强制遭遇战 → 出牌/发现/结束回合全链路，检查 `.sts-hand`/单位区节点身份 + `window.__errs`
3. 注意：内置浏览器（IAB）会偶发渲染进程闪退（打回 about:blank），复测不复现即环境毛病；档位 02 是测试档

## 遗留/顺带发现（未处理）

- `src/scene/`（9 文件含 runtime.js）全仓无人 import 的孤儿 Three.js 模块，是 characters.js 里 skin/hair/outfit/color/scale 的唯一消费者——老板未定夺，勿动
- asset-manifest 197 条 unlisted 既有漂移；css/hub.css 里 .cls2-tag/.cls2-story 死规则；docs/archive 里几处指向已删文档的下引用
- validate-data.mjs 不校验 heroCardArt/spell/martial/equip/creature 五族的存在性（曾因此误删 hero-summoner.webp，已恢复；体检脚本在 `.tmp/artmap_exist_check.py`）——要不要并入 validate-data 等老板发话
