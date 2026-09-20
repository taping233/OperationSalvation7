# 七岗位三轮迭代评审 · 改动总账（2026-09-20）

> **一句话结论：本次三轮评审为"模拟实施"，游戏源码 / 资产 / 数据文件零改动。**
> 下文第三~六节所列全部是「若批准实装，将要做出的改动」——三个模拟版本 v0.57.0（R1 首次实施）→ v0.57.1（R2 实现口径修正）→ v0.57.2（R3 终审热修）的合并终稿。当前游戏版本仍为 0.56.1。

---

## 一、真实改动盘点（本会话实际发生的文件变动）

| 对象 | 数量 | 明细 |
|---|---|---|
| 游戏源码 / css / data / assets / tests | **0** | 未修改、未新建、未删除任何游戏文件 |
| git 操作 | **0** | 无 add / commit / checkout；开工前工作树已有的未提交改动（并行会话成果，含影廊批次三 ddfc2ff）原样保留，**不是本评审所改** |
| Friday 记忆系统（非游戏文件） | 3 | ① 更新 `~/.zcode/cli/memories/.../memory/soudache-7role-iteration-2026-09-20.md`（评审终态覆写）；② 更新同目录 `MEMORY.md`（1 行索引）；③ 曾新建 `soudache-multiagent-review-3rounds.md`，发现与①重复后立即删除（去重） |

本评审期间的全部子代理（21 人次）均在只读铁律下工作：禁改文件、禁 build、禁 dev server、禁全量测试。

---

## 二、三个模拟版本的关系

- **v0.57.0**：第一轮 40 项去重问题的首次模拟实施（十大项①~⑩）。
- **v0.57.1**：第二轮复测发现方案自身有 6 个 P1 级实现口径缺陷（照字面实装会出新事故），逐条修正"怎么改才对"，不新增功能。
- **v0.57.2**：第三轮终审热修（银河之旅文案终稿、蓄力标签、layerToken 读点等 9 处）。
- 以下第三~六节为 **v0.57.2 终稿口径** 的合并清单。标 ⚠️ 的条目实装前需老板拍板。

---

## 三、战斗系统

| # | 改动 | 位置 | 解决的问题（R1 来源） |
|---|---|---|---|
| 1 | 意图预告实算化：伤害含目标当前流血，角标「附加 N 层流血」；evenAttack 敌非攻回合显「蓄力·下回合行动」，旧日志「蓄势待发」同步改「蓄力」 | battle.core.js intentFor(:163)/(:2491-2494)、battle.view.js 意图渲染(:1078-1082) | A-P1 意图与实伤不符 |
| 2 | 开战装备浮现补 CSS（定版功能首次真正生效）：fixed 居中、z-index 900、pointer-events:none、复用 cardHTML('sm') v3 制式、--ease-spring 入场、reduced-motion 降级 | battle.view.js:242-261 + css 新增 ~15 行 | A-P1 裸 div 无样式 |
| 3 | 删除无参 `setDucked()`；sound.js setDucked 补参数校验防回归 | battle.view.js:468、sound.js:437 | F-P1 战斗关音乐反升 BGM 音量 |
| 4 | 敌方阶段 1×/2× 档：单一演示倍率同步缩放 step(420→210ms)/atk 序列/lungefx/飘字四处时长；foeLunge 呼啸 playbackRate ×1.5；入口进 .bt-settings .chk 行卡 | battle.core.js:2562-2564、battle.view.js、battle.feedback.js、sound.js | A-P2 节奏拖沓；避免只缩 step 造成叠影 |
| 5 | 意图气泡并入完整预告：允许两行折行、去「下一回合预告：」前缀；停用原生 title 口径 | battle.view.js:1078-1082、battle.css:148/254 | A-P3 title 割裂、防气泡互压 |
| 6 | 手牌代价句式表升级为单一模块，battle.rules.js 预检 / effect-steps.js 结算 / 审计 classifier 三方引用 | battle.rules.js:55-60、effect-steps.js:57/59 | A-P3 代价措辞绕过预检 |
| 7 | 全卡审计硬校验：无前置条件卡零效果改硬失败；同步 effect-verbs DESIGNER_BLANKS 风味句白名单 | tests/battle-all-cards.test.js、effect-verbs.js:139-141 | A-P2 描述-结算漂移无门槛 |
| 8 | addBlessing 补 Number.isFinite 防护（对齐 addCurse） | combat.js:265-267 | G-P3 NaN 扩散 |

## 四、音频

| # | 改动 | 位置 | 来源 |
|---|---|---|---|
| 1 | 节流表补 `curse:60 / parry:45 / coin:80` | sound.policy.js:4 | F-P2 AOE 爆响 |
| 2 | strike 实录化：rate 0.92-1.00 微下探、不加低通、增益表新增 `strike:0.55`，与 hit(亮)/hurt(闷) 成三段；jsfxr 降兜底 | battle.core.js:1979/1994、sound.js:198/206/362 | F-P2 打击音风格分裂 |
| 3 | 注能确认：成功接 confirm.wav，失败分支补 sfx('deny') | battle.core.js:1486-1487 | F-P2 注能无反馈 |
| 4 | deny 抑制（反向）：deny 播出时查 30ms 内有 click 记录则吞 deny（跨键读 lastSfxAt，不改 shouldPlaySfx 签名） | sound.js sfx() 入口 | F-P2 click+deny 叠音 |
| 5 | 基地升级接 sfx('levelup')（return true 前同步播）；龙巢解锁 legend 接进 unlockNest 分支、altar.js:711 改调 unlockNest 统一写点、撤离时与 victory 错峰 ~350ms | base.js:293-331、game.nest.js:74-79、game.run.altar.js:711 | F-P1 成长时刻零反馈 |

## 五、流程状态机（P0 修复簇）

| # | 改动 | 位置 | 来源 |
|---|---|---|---|
| 1 | hideOverlay：新增 immediate 同步路径（首行 clearTimeout(_hideTimer)+幂等 finish）；补「已关闭短路」；overlay 增 layerToken 代际标记并在异步收尾点读取；immediate 仅 exitToTitle/终局路径启用 | ui.js:591/602-638 | C-P0 龙巢撤离死锁（210ms 淡出竞态） |
| 2 | exitToTitle 收口：game.menu.js:619 守卫收窄为仅 `G.battleActive` 时**直接 return**（不收战斗，防 battle:end 异步续流叠层）；龙巢撤离(nest.js:424-436)/备战返回(nest.js:123)改走收口；altar.js:285（cls2Quit）整句替换为 exitToTitle() | game.menu.js、game.nest.js、game.run.altar.js | C-P0/P1； altar setTimeout(240) 时序补丁退役 |
| 3 | startNestRun 重置 pendingRunePick / nestTargetedBox；doExtract 改调 unlockNest() | game.nest.js:135-162 | C-P2 龙巢跨局白拿 |
| 4 | 背包协议：bagpage 关闭改回调 closeBackpack()（bindBagMixins 晚绑定注册，不新增导出）；来源优先级链 `bagOverChest > bagReturnHook > 来源恢复 > 状态兜底`；showBackpack(true) refreshOnly 不覆盖登记；无恢复回调时 modal 态拦截开包并提示（提示 30s 节流）。**事件页查背包能力随之移除 ⚠️待老板确认** | ui.js:655、game.bag.js:228-244/1070 | C-P1 Esc 关包卡 modal、开包吞结算 |
| 5 | 事件兜底：事件池空补 finishInstant()（先于 visited 写入）；triggerEventCard 的 await 包 try/catch 失败按 narrative=null 默认结算；空池文案定稿「这里已经被人搜刮过了」 | game.run.flow.js:266-291 | C-P2 永久卡 moving / 黑屏 modal |
| 6 | event-bus：emit 保持同步返回数字（成功订阅者数），仅对单个订阅者的 Promise 返回值 `.catch` 上报——battle.core.js:2843 的 0 订阅回退链不受扰动 | event-bus.js:30-44 | C-P2 async rejection 无人接 |

## 六、存储 / 数据 / 文案术语

**存储与数据**
1. 读档数值归一化：`Number.isFinite(+v) ? +v : 默认`（保合法 0 值）；执行顺序 = MIGRATIONS 深遍历 → migrateRunCharacter → 归一化 → readCache.set｜game.session.js:461/463/500（修 G-P2 坏字段锁局、C-P3 hp 无兜底）
2. 写档健康：base.js save() 返回布尔+失败警示（走 `window.SDT.UI?.log` 晚读）；对局写档失败警示改 30s 节流、成功重置计时、关页前必报；文案「存档写入失败，进度可能未保存——请检查磁盘空间」｜base.js:192-198、game.session.js:394-400（修 G-P1/P3 静默丢档）
3. 设置页与自定义卡库全部走 safeGet/safeSet｜game.menu.js:712-779、cards.js:1012（修 G-P2 隐私模式抛异常）
4. 钥匙计数改 desc「×N」解析（中文数词不可识别显式拒绝）｜base.js:500（修 B-P1 三把钥匙只计 1）
5. 成就播报 _seen 改按 slot+id｜meta.js:265（修 C-P3 跨档串台）
6. 卡库通道：cards-sync version **29→30**；v30 条目必须整卡对象；TT10/TT11 现役源卡整卡并入；tt6-chestdraw 的 desc 只改 EVENTS_0919 数组并 bump EVENTS_0919_KEY，不双写｜cards.js 合并链

**文案与术语**
7. 熔断双箱三方统一：「从大、中、小宝箱中随机抽取 1 个开启。」（卡面 desc / events.ink 开场 / V2 detail）；ink 改后必须 `npm run narrative:compile` 并 grep 产物核验｜cards.js:105、narrative/events.ink:23、game.run.flow.js:546（修 **B-P0** 三方矛盾）
8. 碎片提示语改写「员工通行证A碎片（1/2，集齐 2 枚可合成员工通行证A，兑换一张能力卡）」｜game.run.flow.js:510（修 B-P1）
9. pets.json robot/fire 的「杀」→「初始攻击」｜pets.json（修 B-P1）
10. 银河之旅 desc 定稿「你的所有武术均为 1 费。」+ battle.core.js:659 触发正则补「武术」分支（R3 终裁：旧方案「所有卡牌」不命中正则会整卡失效）｜cards.js:864、battle.core.js:659/520（修 B-P1 招式三口径）
11. 盗匪横行 ink「数道剪影」「×3~5」｜events.ink:44-45（修 B-P2）
12. 标点/数词/引号全库清扫（圣盾半角句点、破甲重斩「。；」、骷髅王剑引号方向、火球术→火球、cc-dual-wield 数词等，全部走 v30 整卡通道）｜cards.js 各条（修 B-P2×2）
13. 宝箱口径定版：单指一律实装名（恶魔交易 detail→「获得 1 个军用保险柜。」）；列举可用大/中/小 + rules.md:20 映射注「大=军用保险柜、中=密封物资箱、小=小型物资箱」；game-compendium.md:297/392 同步（修 B-P2）
14. 「保护格」→「安全格」8 处玩家可见面（pets.json:12、game.hub.js:126/134/207/652/933/934、compendium:392）（修 B-P2）
15. rules.md 补灼烧诅咒+版本头 v0.53.2→0.57.0；performance.md 同步「空闲零绘制+4Hz 巡检」；「招式=武术+法术」术语总表落 docs；scenes.json classStory 旧职业死数据加「待定稿」占位（修 A/B/D 文档漂移簇）

## 七、美术资产（含 ⚠️删除报批）

1. **⚠️待批删除**：`assets/scenes/endfield-ruins.jpg`（含官方 logo 版权角标）+ thumbs 副本；孤儿场景图（battle-city-night-anime-v1 / battle-street-day-anime-v1 / battle-tavern-far / battle-tavern-floor / layer3-knight / layer4 / layer5-priestess，实装前以 grep 复核为准）；批准后 **desktop-app 旧 bundle 同步重打包**（其内仍引用待删图）。
2. art-mapping.json 删除退役 id cc-thousand 死链条目（数据编辑，非文件删除）。
3. 战斗底图换血：scenes.css:588 战斗四条改挂已预载 battle-normal-anime-v2（写实 street-amber 退役）；过场横幅 scenes.css:537 同步改挂，消除进战斗前后割裂。
4. 三首脑专属底图：PRELOAD_SCENES **显式新增 boss 专槽**+路线确认时预取（不占启动带宽）；battle-stage-shade 按首脑紫红/琥珀 tint 差分（tint 放独立层，避让 fx-dread 入场动画）。
5. 名牌规格：两行化**仅限敌方**（玩家名牌三行维持——equips 是技能按钮）；敌方 chips>4 收纳为 icon+数字（保留层数/回合）、title 保留全文。
6. 元素命中差异化：IMPACT_TINT 补冰冻/雷电键色 + 火/冰/雷三套 spawnSparks 参数包（纯 DOM 粒子，零新资产）｜battle.view.js:1166/1175。
7. fx-slash 补反向弧+十字弧（每弧一张图+css 一行）。
8. 通用族卡面重出 5 张（hero/consumable/healing/coin-gold/tt3-blue-potion）：hero 兜底图不得带五人任何一人的脸；items 族 object-fit contain→cover 同步改；resources 补 PROVENANCE.md 台账。
9. 龙巢 8 敌专属立绘 + cut 烘焙配套——**前置修复 tools/bake-cutouts.js：.endsWith('.png') 放宽为 .png/.webp、MIME 跟随输入**（现脚本对 18 张全 webp 的 enemies 执行=静默空转）。
10. 构图异常存量卡全量清单+逐张补 object-position/重裁；所有换图后 thumbs 全量重烘焙；首脑底图锁 ≤1080p、上线跑 `SDT.Art.warmStats()` 断言 bytes<80% 预算。

## 八、引擎与性能

1. 资产缓存策略：RUNTIME 资产**稳定路径+?v=**（内容哈希方案已否决——与运行时拼路径机制硬冲突）；?v= 落地 = vite closeBundle 产物级重写（仅匹配 `new URL(` 与 CSS `url()` 两种模式，防双 `?v=`）；版本号取 version.json 可配置，非每次构建时间戳。
2. 删除死依赖 three / @pixi/particle-emitter / sortablejs / stats.js 及 manualChunks three 规则（两轮 grep 复核零引用）。
3. 启动预载 idle 化：slot-bg 与 3 张非 outskirts 壁纸改 requestIdleCallback，**outskirts.webp 保留同步预载**（⚠️整体待老板点头，涉及 renderer.js:39「老板定向」注释）。
4. ensureBackdrop 拖拽优化：~150ms debounce 后重烘焙，期间复用旧底拉伸；img.onload 强制重建路径保留｜renderer.js:61-103。
5. 死代码清理：render-scheduler.js:37-38 + idleFps 参数；game.boot.js:644 sceneFps 死监听。
6. art.js warm() 补 onerror 释放预热池位；motion.js reduceMotion 结果缓存+change 事件失效。
7. perf-benchmark 增虚拟分辨率参数；4K/高 DPI 档 report-only 独立预算（draw p95≤16ms），**不进**现有 AND 门禁。
8. index.html 启动失败提示条：内联脚本 3s 探测 window.SDT 缺失 + error 监听双保险。
9. img 404 运行时用户提示（现为 console-only）——列入 backlog 随下版。

## 九、测试与回归防线（新增）

1. `tests/extraction-settlement.test.js`：消耗口袋 1/3 保留、随身币离局清零、仓库满丢失。
2. `tests/shop-trade.test.js`：买/卖/币不足。
3. QA 六用例：弹层叠加矩阵（各态 exitToTitle+迟到 showOverlay 拒渲断言）/ 背包来源兜底 / 归一化×迁移顺序（v1 档→盖章 v2 全链）/ keyCount 中文数词拒绝 / 空池 visited 写入顺序 / deny 键控不误伤二连点。
4. 节流语义三用例：成功后首败即报 / 30s 内仅一次 / beforeunload 必报。
5. 资产断言：产物 `?v=.*v=` 双写计数=0；`warmStats().bytes < 153.6MB`。

## 十、⚠️ 数值与设计决策（实装前必须老板拍板）

| # | 事项 | 内容 |
|---|---|---|
| 1 | 惩击削 | 2 费 10′→基础 8′（cards-sync v30 整卡：desc+dmg 同改） |
| 2 | 爆燃火球 | 1 费 5′ 受法伤翻倍=削惩击后的新顶点，改「受法伤加成+N」或提 2 费，须与惩击同批 |
| 3 | swiftRune | 打出后继续正常结束回合（battle.core.js:2432-2439 不再 return），交互手感变更 |
| 4 | 壁纸预载 | 其余 3 张 idle 化（outskirts 保留同步），推翻 renderer.js:39 定向注释 |
| 5 | 删除报批 | 第七节第 1 条全部文件 + desktop-app 重打包 |
| 6 | 能力取舍 | 事件页打开背包的能力移除（modal 态一律拦截） |

已裁决否决（留档）：全局配音不做（ROI 倒挂）；4K 不进 AND 性能门禁。

---

## 附：建议实装顺序（获批后）

**Wave1**（互不依赖，先行合入）：存储可靠 + 事件兜底 + 音频 + 战斗 UI → **Wave2** 流程收口（layerToken 方案，需弹层矩阵全绿）→ **Wave3** 文案通道（v30 整卡 + EVENTS_0919 单通道 + ink 编译核验）→ **Wave4** 美术资产（删除项批准后）+ 资产缓存收口。

每波回归门：`npx vitest run tests/sound-policy.test.js tests/render-scheduler.test.js tests/ui-scale.test.js tests/compendium.test.js tests/battle-all-cards.test.js` 全绿 + QA 六用例全绿；battle-all-cards 零效果警告恒=3 条件卡（不新增）。
