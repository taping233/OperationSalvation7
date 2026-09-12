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
| A | 手牌区常驻化 | ✅ 已提交 `2743071`，实机验证通过（出牌→发现链→敌方阶段沉升，手牌层同一 DOM 节点零报错） |
| B | 单位区常驻化：玩家/敌人立绘、意图、血条、状态图标常驻节点 + 局部更新 | ⬅️ 下一批，从这里继续 |
| C | 交互收敛：click/drag/指向统一 interaction 状态机，`pendingTarget` 多语义收敛，取消幂等 | 待做（依赖 A） |
| D | Pixi 材质层 + 序列帧播放器（单位区接入；程序化位移走合成器，遵守性能三铁律） | 待做（依赖 B；帧图到位即接） |
| E | 帧图批量抠图接入（part1 提示词包已交付；part2 等老板帧图） | 半成品 |
| F | 出牌队列演出（卡牌飞行/队列结算/回合过渡）+ 总回归 | 待做 |

## 关键代码锚点（批次 A 落点，B/C 沿用同一套模式）

- `game/src/battle.view.js`：
  - 常驻层机制 = `handLayer` / `handSlots` / `handSuspended`（搜索「手牌常驻层」注释块）
  - `mountHandLayer(body, tip)`：showOverlay 后 replaceWith 挂回；战斗中弹层挂起（handSuspended=true，在 6 个早退分支里设置；deckSelection 分支=false 允许重置）
  - `updateHand(snapshot, prev, pageGroups, events, extra)`：差分更新 + 目标值补间 + 新牌飞入；`handGroupState(g, ctx)` 单叠状态计算；内容按 `st.inner` 字符串签名 diff
  - `animateBattleTransition(prev, body, events, extraFlightMs)`：只剩克隆飞行/能量与牌堆脉冲/阶段沉升；`takeCardAnims()` 在 render 里取一次共享
- 扇形数学：`game/src/battle.hand.js` `fanLayout`（1~10 张标定表，handMax=8 契合 STS2 1-10 表）
- 机制审计（P0/P1/P2 与验收标准）：`docs/sts2-combat-mechanism-audit.md`
- 批次 B 拟动区域：render() 里 `selfHTML / alliesHTML / foesHTML`（battle-stage 内 .sts-arena），模式照抄 A：单位节点常驻、hp/意图/chips 签名 diff、受击/死亡动画挂在常驻节点上（现在 spawnFloats 里的 figEl 查询可复用）

## 验证口径（每批必做）

1. `npm test`（37 文件 254 断言）+ `npm run build`（产物进 desktop-app/game，哨兵 ≤2 个 index bundle）
2. 实机冒烟：python 静态服挂 `desktop-app/game`（8139）→ 档位 02 继续对局 → `#devBattle` 强制遭遇战 → 出牌/发现/结束回合全链路，检查 `.sts-hand`/单位区节点身份 + `window.__errs`
3. 注意：内置浏览器（IAB）会偶发渲染进程闪退（打回 about:blank），复测不复现即环境毛病；档位 02 是测试档

## 遗留/顺带发现（未处理）

- `src/scene/`（9 文件含 runtime.js）全仓无人 import 的孤儿 Three.js 模块，是 characters.js 里 skin/hair/outfit/color/scale 的唯一消费者——老板未定夺，勿动
- asset-manifest 197 条 unlisted 既有漂移；css/hub.css 里 .cls2-tag/.cls2-story 死规则；docs/archive 里几处指向已删文档的下引用
- validate-data.mjs 不校验 heroCardArt/spell/martial/equip/creature 五族的存在性（曾因此误删 hero-summoner.webp，已恢复；体检脚本在 `.tmp/artmap_exist_check.py`）——要不要并入 validate-data 等老板发话
