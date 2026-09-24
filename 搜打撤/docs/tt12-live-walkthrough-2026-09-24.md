# TT12 第十二批 17 张新卡 · 实机演出走查报告（2026-09-24）

## 走查基线（工作区现场口径）

- HEAD = `b156a22`（chore: add ESLint flat config, CI test gate and @ts-check pilot）；TT12 卡表与效果代码落库于 `27df181`（feat: migrate selected card rules to structured contracts）。
- 工作区含未提交改动：6 处 no-undef 缺陷修复（battle.enemy-phase / battle.layers / battle.view / battle.overlays / game.bag 等）+ 5 个 @ts-check 注释文件；另有另一会话进行中的 nest/extraction/hub/css 改动（不在本次走查触碰范围，其中 css 改动引发过 HMR 热更，见「坑」）。
- 17 张卡清单以现场为准：`game/src/cards/cards.data.js` TABLETOP12 池（注意：e527fec 域重组后路径为 `cards/cards.data.js`，非早期文档所写 `game/src/cards.data.js`）。启动时 seedBatch(TT12_KEY) 播种正常，17 张全部进入卡库。
- 单元/实打审计基线：battle-all-cards 272 张硬失败 0（此前已过），本轮为浏览器实机演出验收。

## 环境

| 项 | 值 |
| --- | --- |
| 机型/系统 | Windows（10.0.26200 x64），Git Bash |
| 浏览器 | Chrome 153 headless（`--window-size=1440,900 --mute-audio`，CDP 9223 驱动） |
| dev server | Vite 6.4.3，`npm run dev`（先 5175 后因进程被杀重启于 5176；走查结束均已关闭并确认端口释放） |
| 音效 | `setSfxMuted(true)` + `setMusicMuted(true)` 双静音 |
| 驱动方式 | Node 24 内置 WebSocket 手写 CDP 客户端（内置浏览器工具在子代理环境不可用，零依赖替代；全程未修改任何仓库文件，脚本与截图均在 `%TEMP%\tt12-walk`） |
| 分辨率 | 1440×900 |

## 战斗构造方式（只读 API 调用，不改文件）

1. `localStorage.sdt-dev=1` 开 devMode → 标题页 #titleDev 面板点击「小宝箱」节点自动开测试局（不占档位、不写存档，战士·黑儻 30/30）→ `chestSkip` 收掉搜刮页。
2. 17 张 tt12 卡自 `SDT.Cards.all()` 取模板，以自定义 uid（qa-tt12-0..16）push 进 `SDT.game.ownedCards`；`SDT.MAP.rules.battleEnergy` 运行时改为 8（内存改动，便于逐张打出，不落盘）。
3. `SDT.BattleLoader.start(game, [走查靶A/B/C hp200 atk2], {isBoss:false})` 自构单场战斗（普通战规则：ownedCards 全部战斗卡直接进手牌）。击杀追加专场另开 hp5×3 敌人。
4. 每张卡打出前后取 `SDT.Battle.getSnapshot()`（敌 hp/status/护甲/能量/手牌数/装备/发现面板/注能面板）+ `#log` 日志差分 + `document.getAnimations()` 演出即时取证；打出前读 `.bt-hand .bt-card` 的 aria-label 验证卡面与费用显示。

## 逐卡结论（17/17 可玩，全部无控制台错误）

| # | 卡 | 结论 | 实测现象（数值/演出） |
| --- | --- | --- | --- |
| 1 | tt12-freezeray 冷冻射线 | PASS | 敌A 200→196（4 法伤），满血未受伤→`freeze:1` 附加成功（敌A 状态栏实证）；演出 anims 19/fx 3 |
| 2 | tt12-sporewall 孢子城墙 | PASS | 目标敌中毒 +2 层（poison 1→3 实证），自身护甲 6→12（+6）；演出正常 |
| 3 | tt12-elemburst 元素爆裂 | PASS | 随机敌 2 伤 ×4 次（8 伤分散 3 敌：-2/-4/-2），另轮实测 5 次（10 伤）——4-5 次区间带内；多敌随机目标实证 |
| 4 | tt12-hitechrd 高端研发 | PASS（衰减见存疑 Q2） | 发现面板 3 张 2 费武术（血毒双镖/破甲重斩/铁甲阵，池过滤正确），`costDecayPerTurn:1` 标志实证；选中卡入手且卡面显示「血毒双镖 · 2 费」 |
| 5 | tt12-barriermend 屏障修复 | PASS | 无甲时卡面显示「0 费。费用 0（ 当前按 0 费打出）」（armorZeroFree 修饰器），打出 0 费（能量无扣减）+ 护甲 0→6 |
| 6 | tt12-saturate 饱和打击 | PASS | 主效 7 法伤精确（174→167）；「消灭额外释放一次」专场双杀实证（见下） |
| 7 | tt12-felguard 邪能护体 | PASS（同名堆叠限制见新账 N1） | 注能 2（两张不同名燃料）打出：手牌 15-3+3 守恒（抽 3 实际发生）；敌方回合 3 敌进攻玩家 30/30 恒定、无新诅咒——伤害与诅咒免疫生效 |
| 8 | tt12-unstableray 不稳定射线 | PASS | 5 伤（区间 4-6；另轮 6 伤），两轮均在带内 |
| 9 | tt12-infectray 感染射线 | PASS | 4 法伤 + 1 层随机诅咒（两轮分别实证 中毒 / 沉默——随机性成立） |
| 10 | tt12-basicdev 基础开发 | PASS | 随机获取 2 张 0 费招式**入手牌**（handN 12→13 = -1+2；终局手牌目视「射击 · 0 费」） |
| 11 | tt12-firecracker 违禁烟火 | PASS | 全体敌人各 1 点固定伤害（3 敌 167/196/198 → 166/195/197） |
| 12 | tt12-magicfind 魔法新发现 | PASS | 发现面板 3 张 1 费武术（池正确），`zeroCost:true` 标志实证；入手卡面显示「坚盾 · 0 费」 |
| 13 | tt12-chargeray 充能射线 | PASS | 注能计数精确：此前注能消耗 3 张燃料 → 5 + 2×3 = **11 伤**（163→152 实测命中） |
| 14 | tt12-breakthrough 突破进展 | PASS | 随机获取 0/1/2 费招式各一入手（handN 13→15 = -1+3） |
| 15 | tt12-raygun 射线枪 | PASS | 0 费装备穿上（战斗 HUD 装备栏「射线枪」实证）；主动技能发现面板恰好 3 张射线牌（冷冻/感染/充能射线——池正确限定「射线」）→ 选中即直接释放，敌A -4 伤 |
| 16 | tt12-backupcell 后备能源 | PASS（减费分支见存疑 Q1） | 打出后能量 8→(扣 6)→**回满 8**（回复所有费用生效）+ 抽 2（handN 13→14 = -1+2） |
| 17 | tt12-raydragon 龙焰射线 | PASS | 注能 1（消耗 1 张手牌燃料）后打出 **11 点法伤精确**（194→183），燃料随本体离手（handN -2） |

**演出取证**：每张卡提交后 `document.getAnimations()` 均捕获 17-46 个活动动画 + fx 特效元素（出牌飞行/伤害飘字/状态挂附）；终局截图目检：手牌费用角标、护甲值 12、敌人「中毒 3」标签、装备栏射线枪、能量 8/8 全部正确渲染。全程 `window.__qaErrs`（pageerror/console.error/unhandledrejection 捕获）为空。

**专场：饱和打击「消灭敌人额外释放一次」**（hp5×3 敌）：7 伤击杀薄皮靶A → 追加释放击杀薄皮靶B（两次释放、anims 86）→ 薄皮靶C 满血存活（战斗未误判提前结束）。

## 问题汇总

### 新账（本批走查发现）

- **N1 · 邪能护体（注能2）×同名堆叠无法选满燃料**：注能选牌对同名堆叠是「组级 toggle」——实测同一叠初始攻击连点三次 picked 数 0→1→0→1（点第二张=取消第一张）。开局手牌 5 张同名初始攻击 + 邪能护体场景下，玩家永远选不满 2 张燃料。代码点 `battle.engine.js` toggleInfusePick（组内 pickedInGroup 非空即 delete）。归属说明：组级 toggle 是 TT8 时代注能机制的既有通用行为，tt12-felguard 是首个「need≥2 + 同名堆叠」实战组合，缺陷被本批卡暴露——建议老板定夺归属与修法（按 uid 选择或 UI 明示「再次点击取消」）。
- **E1 · 既有账：开发者控制台「全体 10 伤」必崩**（与 tt12 无关，顺带发现只报不改）：`commands.dev('damageAll')` 以 `card=null` 调 `hitFoe`，伤害日志行 `esc(card.name)` 解引用 null 抛 TypeError（battle.engine.js:1778 附近），中断动作队列。走查中曾用该命令压血导致饱和打击首验失败，已改用低血量敌专场绕开。

### 存疑（条件未触发，未实机验证）

- **Q1** 后备能源「消耗口袋每有一张法术，本牌费用-1」：走查局不带火球、注能燃料均为武术，消耗口袋无法自然凑出法术，减费分支未实机触发（结构化 rules consumedSpellDiscount 已有单测覆盖）。
- **Q2** 高端研发发现卡「每回合开始-1费」：delayed ruleCostDecay 已挂（源码 battle.engine.js:2449 + 面板 flags 实证），但发现卡在观察点前已被用作注能燃料，未目视到「2 费→1 费」卡面变化。
- **Q3** 屏障修复「有甲时 1 费」由同一 costModifiers 分支推导，未单独采样（无甲 0 费已实证）。

### 归属待定/非缺陷备注

- 走查首日脚本曾在「元素爆裂→龙焰射线」间隔捕获一次 `SDT.Battle.commands` 瞬时不可用的 TypeError（重试即愈，三轮复跑未再出现）；期间另一会话对 page-slot-select.css 有 4 次 HMR 热更（01:18-01:28），时序吻合，判为环境瞬态而非游戏缺陷。
- 「随机获取」类发现产物进**手牌**（addTempCard，战斗内临时卡）而非牌库，与手牌数守恒核算一致。

## 坑（后续走查参考）

1. 内置浏览器工具在子代理环境不可用 → headless Chrome + 原生 CDP（Node 内置 WebSocket）零依赖替代；脚本必须 `process.exit()`，否则 WebSocket 保活让 node 挂着不退。
2. `#log` 行动日志跨局保留，差分统计需按开局重建过滤；开局系统日志会重复出现在差分里。
3. 另一会话改 CSS 会触发 HMR 热更（css 热更不杀状态，但与采样时序叠加会造出假象）；`dev win` 结束战斗会走「放弃对局」结算清 brought 卡——跨场需重注卡。
4. 注能公开 API 名是 `beginInfusion/selectInfusion/confirmInfusion/cancelInfusion`（内部函数名 confirmInfuse/cancelInfuse 不挂在 commands 上）。
5. 指向卡用 `commands.playCard(uid, side)` 直调必须带 side：敌指向 `0`、自身 `'self'`（装备卡 targetSide 恒 'self'），传 null 会进目标选择态等玩家点选；元素爆裂等「随机敌人」卡同样按指向卡处理。
6. 普通战手牌 = ownedCards 全部非道具/资源/事件/生物/能力卡；本局不再自带火球（火球已改衍生），注能燃料要用火球需先获取。
7. 截图全黑问题本次未遇到（DOM 战斗页不受 canvas 首帧影响）；动画未 finish 时快照计数会虚高，settle 双采样后再取终态。

## 结论

17 张 tt12 卡实机全部可打出、卡面/费用显示正确、演出均播放、数值结算与卡效一致，无新增控制台错误。1 个新账（N1，归属待定）、1 个既有账（E1，dev damageAll 崩溃）、3 个存疑（Q1-Q3，条件未触发的分支）。走查全程未修改任何仓库文件，dev server（5175/5176）与 headless Chrome 均已关闭并确认端口/进程释放。
