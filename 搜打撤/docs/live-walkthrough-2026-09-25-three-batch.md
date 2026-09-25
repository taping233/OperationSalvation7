# 实机走查报告 · 三批合并（N1 注能堆叠 / 09-24 战斗交互残留 / 商店重复率）

- 日期：2026-09-25 17:2x +08:00（走查窗口 16:4x–17:2x）
- 执行：Friday（实机走查子代理），零代码改动
- 结论速览：三组主体全部 PASS；**1 项 FAIL**（组1③ Esc/右键取消注能缺失）+ 2 项附加发现（dev freezeAll 指令静默失效、终局页 icon:info 位图缺失）。无 BLOCKED 项。

## 环境

- 服务：`npx vite --port 52793`（Vite 6.4.3），走查结束后已停。
- 代码基线：HEAD `dd87ed3`（docs handoff 补记）。**注意**：工作区存在并行会话未提交改动（`game/src/cards/cards.js`、`cards.sync.js`、`scripts/sync-cards-from-live.mjs` 及多个测试文件，所有权属并行任务）；本走查跑在工作树现状上，未触碰这些文件。
- 浏览器：Chrome 153 headless（`--remote-debugging-port`），由 puppeteer-core 25.12 驱动（CDP trusted 输入事件：真实鼠标 down/move/up + 真实点击冒泡）。**口径声明**：browser-use 插件在子代理环境返回 "Browser is not available in subagent"，改用等价 CDP 驱动；headless 无音频输出（②e 只验证事件链）、无真实显示合成器（②c 用主线程 longtask + rAF 间隔近似，非 GPU 掉帧）。
- 进入方式：`localStorage sdt-dev=1` 开发者模式；标题页 `#titleDev` 节点测试面板真实点击进入 遭遇战/BOSS战/商店。测试局（不写存档）。
- 辅助采样：`window.SDT` 读战斗快照；页面内 `import('/src/run/game.session.js')` 等 Vite 模块 URL 拿运行时 game 句柄（只读 + 组3 等价重掷，见下）；`window.__walk` 错误收集器（window.onerror/unhandledrejection/console.error）。
- 截图：24 张，均在 `game/shots/walk0925-*.png`（该目录本就是未跟踪目录，未新增 git status 条目）。

---

## 组 1：N1 注能堆叠实机复核（99daf74 + 9aa74ed 双闭环修复）

配置：发 3×【邪能护体】（实机 need=2，卡库无 infuse:3 注能卡，`rg "infuse: \d"` 全库最大为 2）入测试局随身牌，遭遇战开局 10 张手牌：邪能护体 3 张成 1 叠（注能态拆为 1 主卡 self + 2 张燃料叠）+ 2×连射 + 初始攻击。能量 2（恰好够 beginInfuse 校验）。

### ① 选满 need 个燃料不再被“组级 toggle”取消 —— PASS

- 操作：点注能角标进注能态后，对同一燃料叠（2 张邪能护体）**同步连点 6 次**（同一帧内 dispatch，比 rAF 合帧更恶劣的时序）。
- 引擎 picked 序列（`SDT.Battle.getSnapshot().infusing` 原文，uid 缩写 B=`…m1q5kp`，C=`…m1c7zlq`）：

| click | 发出 uid | 点击后 picked |
|---|---|---|
| 1 | B（叠代表） | [B] |
| 2 | **C（轮转现算）** | **[B, C]（2/2 选满）** |
| 3 | B | [C]（只取消 B） |
| 4 | B | [C, B]（重新选满） |
| 5 | C | [B] |
| 6 | C | [B, C]（2/2） |

- 旧组级 toggle 下第 2 次连点会把第 1 次顶掉、永远到不了 2/2；实机选满后保持，燃料计数条 `已选 2/2`（`game/shots/walk0925-infuse-cycled.png`，截图时轮转回 1/2 的中间态见 `walk0925-infuse-1picked.png`，注能条文案“已选 1/2 · 同名堆叠每点一次消耗一张”清晰可见）。
- 控制台无报错。

### ② 点选中的 uid 会轮转/取消（per-uid 语义）—— PASS

- 上表 click3：满容量时发出组内**最早被选**的 B，引擎按 uid delete，picked 从 [B,C] 变 [C]——被取消的是 B 不是“最后一张”；click5 对称地取消了 C。插入序 = 点选时间序，per-uid 语义正确。
- 连点同帧轮转：click2 发出的是 C 而非重复的 B——按下瞬间现算轮转 uid（battle.layers.js:116 `infuseRotateUid`）在“连点同帧到达”场景生效。

### ③ ESC 或右键取消后可重新选 —— **FAIL**（取消入口缺失；“取消后可重选”半边 PASS）

- 实测：注能态（picked=[B,C]）派发 Escape（overlay 捕获链）→ `infusing` 仍在、注能条未消失；右键（contextmenu + button=2 pointerdown）→ 不取消注能，反而弹出「记录试玩反馈」浮层（`game/src/ui/game.menu.js:83` 全局 contextmenu）。截图 `game/shots/walk0925-infuse-reselect.png`（该图右侧为反馈浮层遮挡态，留证）。
- 代码侧对齐：`game/src/ui/overlay.js:241` `closeTopOverlayByEsc()` 对 `mode === 'battle'` 直接 `return false`（注释“战斗中 Esc 只清瞄准”）；`game/src/battle/battle.layers.js:24-36` 的 document Escape 处理只覆盖 `aim / clickSelectedUid / pendingTarget / pendingItem / slamPending / dartPending`，**不含 `infusing`**。即 Esc 取消注能从未接线，与走查预期（“ESC 或右键取消”）不符 → 判 FAIL。
- 现行唯一取消入口：注能条「取消」按钮（`btInfuseCancel`）——实测点击后 `infusing=null`、注能角标恢复（chips 0→1）；重新进注能态后连点 2 次可再次选满 [B,C]（“取消后可重新选”本身成立）。
- 玩家影响：进入注能态后若不想注能，只能鼠标去点「取消」或「不注能直接打出」，键盘 Esc 无效——建议补 Esc→cancelInfuse（一行接线即可复用 battle.layers 的 Escape 处理）。

---

## 组 2：09-24 战斗交互批实机残留清单（handoff 403 节遗留）

### ②a 整张卡的内部 HP/击杀钩子逐击 await —— PASS

- 用卡：连射（实机定版为「造成2 点固定伤害，触发 3 次」cost 1，见附加发现 4）。拖到敌人身上真实打出。
- 飘字（`.sts-float`）MutationObserver 时间线（performance.now，ms）：`0: -2 → +571ms: -2 → +984ms: -2`；HP 时间线 `1/3 → 0/3（击倒）→ 3/3（转移目标）→ 1/3 → 0/3`。
- 三段伤害相隔 571/413ms，节奏由演出驱动而非瞬间全结算。
- 击杀钩子等演出收尾：第 1 段把 1HP 敌人打到 0 后，击杀贴纸「干净利落！」(+321ms) 播出，第 2 段在 +571ms 才落下——击杀反馈先收尾、后续击再落拍；第 3 段自动转移到存活敌人（log“剩 2 个敌人”→“剩 1 个”）。战利品/搜刮页在结算后正常开启（`game/shots/walk0925-b2-pace-result.png`）。

### ②b 2× 倍率卡两拍间隔 —— PASS（实测数值）

- 严格 2 段卡：流星箭雨（“攻（-1）；触发 2 次”，玩家攻 4 → 每段 3 伤）。拖到敌人打出，两段飘字间隔 **251ms**（floats：`0: -3 → +251ms: -3`），肉眼可见的两拍。
- 佐证（连射 3 段）：相邻两拍 571ms / 413ms。
- 结论：多段伤害的拍间隔稳定在 250–600ms 区间，倍率=多拍成立。

### ②c 100ms 全屏顿帧直接测量 —— PASS

- 对象：BOSS 战【肃清总督】(50HP, atk5)，覆盖两个完整敌方回合（BOSS 普攻 + 技能节奏），采样 ~26s。
- 手段：页面内 `PerformanceObserver(entryTypes:['longtask'])` + rAF 循环记录相邻帧间隔>100ms 的次数。
- 数值：**longtask 总数 0（≥100ms 亦 0）；rAF 间隔>100ms 出现 0 次；共 1583 帧**。两轮分别 773 / 1582 帧。
- 口径：headless 环境无真实 GPU 合成，此数据代表主线程无 >100ms 阻塞；GPU 侧掉帧需老板有头环境人工复测。截图 `game/shots/walk0925-b2-boss.png` / `walk0925-b2-boss2.png`。

### ②d 终结一击死亡演出（f25b7bd 回归确认）—— PASS

- 击杀链实测（敌方单位 className + computedStyle 60ms 采样，单位 ms）：
  - `+0ms` 存活（拖拽悬停时有 `drag-over` 高亮）；
  - `+779ms` `dead bt-death-pending`（pending 拍，立绘原样可见）；
  - `+1079ms` `dead bt-death-pending fx-hit`（致命击闪白）；
  - `+1199ms` `dead fx-hit`，opacity 降至 0.22（fx-die 白闪塌缩播放中）；
  - `+1389ms` 单位自 DOM 移除。
- 终态：`.sts-foe` 数量 0，无 visibility 残影；战斗界面全部 `<img>` naturalWidth 正常（0 破图）；胜利过场「战斗胜利 · 威胁解除」正常接管（`game/shots/walk0925-b2-death-pending.png` / `-death-fxdie.png` / `-death-gone.png`）。
- 与 f25b7bd 描述的验收链一致：pending 拍 → fx-die → 收尾不残留；无“死亡动画和贴图丢失”复发。

### ②e 音效事件触发链 —— PASS（事件链；听感需老板人工验收）

- 全会话（boot→3 场遭遇战→BOSS 战→终局×2）资源 404：**0 条**（`performance.getEntriesByType('resource')` 过滤 responseStatus≥400 为空 + puppeteer response 监听为空）。
- 音频相关 console 错误：**0 条**（SDT.Sound 全程被 kill/hurt/deny/confirm 等路径调用——击杀、注能 deny、购买 deny 等均走到）。
- `SDT.Sound` API 完整（sfx/music/setMuted/setBoss/setBattlePressure…），sfxMuted/musicMuted 均 false。听感本身：**需老板人工验收**（headless 静音口径）。

### ②f 敌方真实序列帧打断 —— PASS（控制打断路径；“行动中击杀”路径不存在，见备注）

- 用卡：冰刺（“1′，附加冰冻”）拖到敌人 1 → `status.freeze=1` 生效（截图 `game/shots/walk0925-b2-icespike-frozen.png`）。
- 结束回合敌方阶段：被冻敌人显示 `fx-frozen` 帧、跳过行动（本回合我方受伤 6 = 另两名敌人各 3，被冻者贡献 0）；阶段结束后三敌帧类全部回到 `bt-foe` idle，**无残帧、无残留 frozen/lunge 类**（70ms 采样，`game/shots/walk0925-b2-freeze-idle-after.png`）。
- 备注 a：dev 面板「冰冻敌人×2回合」指令本身失效——`battle.core.js:342` `addBlessing(f,'freeze',2)`，而 `combat.js` `BUFF_META` 不含 `freeze`（属 CURSES），`addBlessing` 对未知 key `return 0` 静默无效（实测 status.freeze 恒 0）。见附加发现 1。
- 备注 b：「在其行动中击杀」无正常游戏途径（无反伤机制；毒/灼烧结算在敌方回合末 `battle.enemy-phase.js:280` “毒发倒地”，非行动中）。如需严格覆盖该场景，需老板指一个可达成的打断手段再补测。

### ②g 拖牌手感与重开终局 —— PASS

- 拖牌：真实鼠标按下→分步移动→悬停敌人→松手，全链成功打出（连射/流星箭雨/冰刺/初始攻击均经此路径）；拖动中途截图 `game/shots/walk0925-b2-drag-mid.png`：卡牌抬起跟随光标（`aim-lift card-pickup-flash` 类）、**保持全尺寸**（f25b7bd 问题①“拖出不变短”同时回归确认），敌人端 `drag-over` 高亮。
- 重开终局：遭遇战内「撤离（判负）」两步确认 → 终局结算页（撤离失败 · 损失物资/抢运回基地/安全格占用，`game/shots/walk0925-b2-endgame-1.png`）→ 再出发重开。**重复两轮**：重开后 ownedCards 恒为 初始攻击×5、coins 0、HP 30/30、回合 1、手牌 5 张、敌人满血——无任何上一局状态残留（含邪能护体/连射等测试发牌全部清空）。

---

## 组 3：商店重复率复测（销账判定）—— PASS，销账

- 进店路径：标题页节点测试「商店」真实点击（开测试局+进店，`game/shots/walk0925-shop-first.png` 与货架内容逐槽吻合）。
- 重掷口径：`openShop(stockKey)` 按 key 持久货架（D-1 防重刷），同名 key 不会重 roll。首样本来自真实点击（key='dev'）；后续 23 样本每次换独立 stockKey 调同一 `generateShopStock()`（即真实商店格每次到站的生成路径），**共 24 面板 × 6 随机槽 = 144 槽**。
- 判定口径（按任务要求）：同名=重复；同名双版（tt2-*/cmnt* 同名）=重复；跨稀有度同 name 也算。
- 结果：**0 个面板含重复，0 对同名重复 → 实测重复率 0.0%（0/24）**，对比历史 25.6% —— **去重代码（`game/src/run/game.run.shop.js:38-47` panelTaken + 神秘货箱同口径）生效，销账**。
- 石榴弹珠顺带验证：`tt3-garnet-marble` 运行时 `unrandom: true`（ensureRandomPoolFixes 幂等补回生效）；144 槽实测出现 **0 次** → 已退出商店随机池 ✓。
- 24 面板全量槽位清单（抽样佐证，跨面板同名属正常，如 寒冰剑/治愈/重斩 多次出现在不同面板）：

```
熔岩爆破|法力光波|治愈|突破进展|闪电链|灵符     急速跑鞋|包扎|射线枪|自然法杖|大量木材|毒药
摸索|充能射线|天狼长弓|寒冰剑|毒箭|狂暴药水     感染射线|斗神酒|自然形态|连击箭|刀剑形态|寒冰剑
生命箭|冰甲|破甲急袭|复原药水|坚守|神秘药水     龙焰射线|连射|追斩|烟雾弹|飞身劈|高端研发
深海咒印|冰刺|基础开发|违禁烟火|包扎|连射       诅咒之刃|迷之匣|迅疾箭|能源结晶|挖宝|镭射
魔法锅炉|百炼青虹剑|复原药水|烟雾弹|法力奔涌|流血药水   治愈|基础开发|银河之旅|员工通行证C|灵能召唤|绿化箭
急救合剂|致命穿刺|冰甲|江湖救急|天狼长弓|饮血剑  火焰药水|破甲箭|邪能护体|木材|龙焰射线|影噬
镭射|寻宝图|净化箭|连弩|恢复药水|后备能源       二刀流|重斩|一把钥匙|棘刺之地|急救合剂|治愈
高端研发|神灯|净化箭|法力奔涌|毒药|魔法锅炉     斩杀|木材|连弩|精神药水|感染射线|元素爆裂
射击|雷殛|剧毒药水|余烬爆裂|包扎|腐化之种       感染射线|精神药水|摸索|长剑|一把钥匙|深海印记
法杖|神秘药水|寻宝图|治愈|口粮|孢子城墙         迅疾箭|格挡|挖宝|重斩|基础开发|急救合剂
冰甲|一把钥匙|急救合剂|破甲箭|重斩|镭射         草甲|二刀流|员工通行证C|后备能源|追斩|血箭
寻宝图|冰冻药水|命运钟表|不稳定射线|一把钥匙|割蚀 魔法锅炉|高端研发|重斩|违禁烟火|穿刺|射击
```

---

## 附加发现（非三组清单内，只记录不动手）

1. **dev 指令「冰冻敌人×2回合」静默失效**：`game/src/battle/battle.core.js:342-343` 调 `Combat.addBlessing(f, 'freeze', 2)`，但 `game/src/battle/combat.js` 的 `BUFF_META` 无 `freeze` 键（freeze 属 CURSES，应走 `addCurse`），`addBlessing` 对未知 key 直接 `return 0`（combat.js:276）。开发者控制台该按钮点了没任何效果。复现：战斗中 Ctrl+L → 冰冻敌人×2回合 → 敌人 status.freeze 仍为 0、照常行动。
2. **终局结算页 icon:info 位图缺失**：撤离失败/测试结算页日志行「[[icon:info]] 测试结算仅更新内存，没有写入基地存档」（`game/src/ui/game.menu.js` / `game/src/run/game.session.death.js`）触发 console.error：`[SDT.Icons] missing bitmap: icon:info`（警告源 `game/src/core/icons-bitmap.js`）。图标渲染缺位 + 一条控制台报错，影响面小。
3. 邪能护体实机 need=2，全卡库无 infuse:3 的注能卡（cards.data.js 中 infuse 值仅 1/2 两档）；本次用 3 张同名（1 主卡 + 2 张燃料叠）即满足 per-uid 验证条件，若未来出现 need≥3 卡，组1 连点序列可原样复跑。
4. 连射实机数据为「造成2 点固定伤害，触发 3 次」cost 1，与 `game/src/cards/cards.data.js:105` 基线（cost 2，“2 点伤害，2 次。”）不一致——定版同步批次（cards.sync）覆盖所致，非缺陷，仅记录口径，②a/②b 按实机数据执行。
5. 走查 harness 自身曾在会话早期向 console 注入过 "Script error."（我的 MutationObserver 在脚本间形状不一致导致），已用 puppeteer pageerror 抓真身核实全部来自 harness 脚本（05-pace.js），**游戏本体 pageerror 为 0**；后续脚本已修正并在干净 reload 后复测。

## FAIL / BLOCKED 汇总

| 项 | 结论 | 一句话 |
|---|---|---|
| 组1③ | **FAIL** | 注能态 Esc 不取消（overlay.js:241 战斗态直接短路；battle.layers Esc 清单无 infusing）、右键反而开反馈浮层；取消仅注能条「取消」按钮可达，取消后可重选正常 |
| 组2②f 备注 | （附发现） | dev「冰冻敌人×2回合」指令静默失效（BUFF_META 缺 freeze） |
| 附加 | （附发现） | 终局页 icon:info 位图缺失（console.error，图标缺位） |
| BLOCKED | 无 | — |

## 截图索引（game/shots/）

walk0925-title / walk0925-shop-first / walk0925-infuse-start / walk0925-infuse-cycled / walk0925-infuse-1picked / walk0925-infuse-reselect（含反馈浮层遮挡证据）/ walk0925-b2-before-lianshe / -after-lianshe / -lianshe-result / -drag-result / -pace-result / -meteor / -death-pending / -death-fxdie / -death-gone / -icespike-frozen / -freeze-idle-after / -boss / -boss2 / -drag-mid / -endgame-1 / -endgame-2（共 24 张，另有 walk0925-b2-frozen.png 为失效 freezeAll 指令后的现场留证）。
