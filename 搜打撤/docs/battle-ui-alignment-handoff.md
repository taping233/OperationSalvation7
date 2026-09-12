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
| C | 交互收敛：click/drag/指向统一 interaction 状态机，`pendingTarget` 多语义收敛，取消幂等 | ⬅️ 下一批，从这里继续 |
| D | Pixi 材质层 + 序列帧播放器（单位区接入；程序化位移走合成器，遵守性能三铁律） | 待做（依赖 B；帧图到位即接） |
| E | 帧图批量抠图接入（part1 提示词包已交付；part2 等老板帧图） | 半成品 |
| F | 出牌队列演出（卡牌飞行/队列结算/回合过渡）+ 总回归 | 待做 |

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
- 单位区 CSS：`.sts-hp i { transition: width .3s ease; }`（battle.css，批次B 加）——首帧填充由 JS 禁用过渡，勿删

## 验证口径（每批必做）

1. `npm test`（37 文件 254 断言）+ `npm run build`（产物进 desktop-app/game，哨兵 ≤2 个 index bundle）
2. 实机冒烟：python 静态服挂 `desktop-app/game`（8139）→ 档位 02 继续对局 → `#devBattle` 强制遭遇战 → 出牌/发现/结束回合全链路，检查 `.sts-hand`/单位区节点身份 + `window.__errs`
3. 注意：内置浏览器（IAB）会偶发渲染进程闪退（打回 about:blank），复测不复现即环境毛病；档位 02 是测试档

## 遗留/顺带发现（未处理）

- `src/scene/`（9 文件含 runtime.js）全仓无人 import 的孤儿 Three.js 模块，是 characters.js 里 skin/hair/outfit/color/scale 的唯一消费者——老板未定夺，勿动
- asset-manifest 197 条 unlisted 既有漂移；css/hub.css 里 .cls2-tag/.cls2-story 死规则；docs/archive 里几处指向已删文档的下引用
- validate-data.mjs 不校验 heroCardArt/spell/martial/equip/creature 五族的存在性（曾因此误删 hero-summoner.webp，已恢复；体检脚本在 `.tmp/artmap_exist_check.py`）——要不要并入 validate-data 等老板发话
