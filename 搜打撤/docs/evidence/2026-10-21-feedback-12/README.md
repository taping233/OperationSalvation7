# 实测反馈 12 条修复 / WF-feedback-1021

2026-10-21 老板提交桌面测试工具反馈导出（`Downloads/sdt-feedback-all-2026-10-21T12-18-51-382Z.json`，12 条，全部 `done:false`），指示解决。三组并行修复（A=卡牌数据与规则、B=战斗内交互、C=界面布局）+ 主线收口。执行中老板两次介入：补充第 5 条口径「直接释放词条的效果要把注能视为已注能」（**需求而非 bug**，A 组按此返工）；随后指示「不用测试，改完就行」——**叫停后未再运行任何测试/语法门，仅逐点读回自检；全程未做实页验收**。未提交、未回滚他人在途改动。

## 结论

12 条全部改完。叫停前已完成各组定向测试与 `check:syntax`（见下）；叫停后改动存在**未验证缺口**（列于文末）。主线 Vite 5200（本会话 PID10000）已按身份核对后停止、端口释放。

## 逐条修复（根因 → 改动）

**1 影噬调为史诗** — `cards.data.js` 两处定义（:139/:439）稀有/古朴不一致且老档靠 face-refresh 注册表重刷（原无该 id）。两处改 `rarity:'史诗'`，`cards.sync.face-refresh.js` 登记 rarity 重刷；`npm run docs:compendium` 重生成 compendium（该跑在叫停前）。

**2 随机获得卡牌排除职业卡** — 主漏点 `battle.discover-candidates.js:26-29` pred 指定池分支完全不查资格门（名词池/招式池可抽职业卡）；三处文本自造池（`effect-steps.damage.js:192/208`、`effect-steps.kills.js:233`）只排衍生；`cards.rules.js:250 isRandomObtainable` 只按 `rarity==='职业'` 判、带 cls 未迁移卡漏过。单源 `isClassCard` 落 `cards/card-rarity.js`（`rarity==='职业' || (cls && type!=='能力卡')`）并叠进 `isRandomObtainable`；`buildDiscoverPool` pred 分支补职业卡门（`allowClassCards` 打标放行本职业/其它职业显式池）。搜刮/宝箱/商店/run 侧发放核对未绕门。

**3 奖励界面去滚动条** — 720p 下箱插画 clamp + 各容器 min-height/overflow:auto 使内容超可视高。`chest-reward-overview.css` 末尾新增 `@media (max-height:880px)` 只收紧 chrome（内距/插画/箱 min-height），1080p 走原基线；不动领取规则与 280px 卡面口径（受 `reward-action-clipping` 锁定）。720p 几何推算通过；**中/大箱三选一 720p 仍可能残留 40-70px 纵滚（范围外，未压）**。

**4 注能界面去重+全手牌** — `battle.view.js:485` 注能槽按物理副本展开（每副本一槽）挤占横向空间。收敛在 `battle.infusion-view.js` 属地内实现：按身份键去重、非代表槽 `.infusion-dup` 隐藏（保 DOM 与 uid，数字键/点击/撤回不变）、代表卡挂 `×N` 角标；代表被选走后下张副本自动接替，整叠逐张可达。

**5 神灯改「发现招式」+ 直释视为已注能** — (a) 三处脱节：两处 desc、`builtin-choice-execution.js` label/pool、展示层；老档靠 `builtin-card-previous-variants.js` 登记旧 native 变体升级、face-refresh 登记 desc。desc→「发现招式并释放」，pool.kind `随机`→`招式`（武术+法术，schema 定版）。(b) 按老板口径返工：新增 `directRelease` 参数贯穿 `battle.exec-play.domain.js`（inspect/付款复检跳过 `missingInfusionReason`、结算 `infusedBase ||= directRelease`），覆盖发现直释/手选直释/自动直释/锦囊施放/灰烬满手直释共 7 条链路调用点；按已注能效果结算、不消耗材料不增计数；A 组首版的灰烬拦截门已撤。**边界保留**：抽到时施放（`castDrawnCopy`）仍不自动获得注能；留手规则仅保留给不含释放动作的纯发现。`docs/rules.md:96/98/99` 同步改写。发现面板旧拒绝文案（`battle.discover-infusion.js`「无法直接施放/留手」）由主线改为「未注能，直释视为已注能」（徽标仍裁剪为「未注能」，不动 discover-view 渲染），配套两个测试断言同步。

**6 TNT 不能使用 / 9 所有道具都用不了（同根因）** — 引擎进点选态唯一判据是 `itemTargetSideFor`（`battle.bag.domain.js:572`），视图却用 `targetSide`（`battle.aim.js:360`、`battle.layers.js:872`）；`targetSideFor` 对只有 `rules.bag.use`、无 `triggers.onPlay`、无 dmg/heal 字段的道具恒返回 null → 点「使用」后场上无敌人高亮、`battle.potion-use.js:43` 因 `pendingItem` 存在返回 null → 开框/确认全部静默拒。两处视图判据统一改 `itemTargetSideFor`。TNT 自身结算（execute 二杀）实测正确，其「不能使用」是被同一守卫拒。真实启动链端到端测试通过（叫停前）。

**7 选择手牌界面重做** — 渲染 `battle.decision-content.js:24` 按物理 uid 1:1 出卡；布局 `battle-decision.css:76` 固定 300px 多行网格成翻页感。CSS 重写为恒单行 `minmax(190px,1fr)` + slot 上限 520px + 字号随槽宽；`battle.decision-content.js` 增按 `cardIdentityKey` 同名分组去重（代表卡挂 `×N`、`data-i` 保原 pool 下标、每次点击仍提交一个实际 uid，选卡语义零改动）。`skull-sword` 两处同名断言同步；`battle-decision-redesign` 核对后无需改。

**8 返回地图位置统一** — 各页 footer 各自为政：事件族 `.node-foot` flex-start、scenes center、cqo/shop/resources/battle 右对齐；另两屏返回键在正文 body 而非页脚。统一到**右侧**（共享 `.ov-btns` 基线惯例全在右、改动面最小）：`entry-events.css` flex-end + 返回键 `order:9` 钉行内最右；`event-lifecycle.js` 两屏 body→foot；`chest-reward-overview.css` 钉位兜底（不动 A 组 chests.js）。全站 13 处「返回地图」逐一核对归宿（正文 nodeOpt 选项卡、顶栏退出图标保持原位）。

**10 负面效果图标缺失** — 名牌角标只拼词缀/`rotSeedMarked`/`status`；标记类负面一个不出：`deathBurst`（腐化之种结构化路径）、`damageEcho`/`soulContractMarked`（契约回响）；且 `cc-rot-seed` 两条写卡路径（结构化只写 deathBurst、文本写 rotSeedMarked）造成「有些有有些没有」。`battle.layers.js:930` 补两枚角标（去重合并）。7 诅咒+9 祝福图标映射核对齐全（16/16）。

**11 战斗数值实算显示** — 描述渲染一律返回静态文案、无战斗上下文入口。新增 `cards/battle-value-context.js`（引擎注册 provider、按需现取），`card-description-text.js` 末尾 `applyBattleValues` 对 4 类伤害句按 `atk+atkUp`/`spellPower+spellUp`（与 `combat.factory.js:93/102` 同式、下限 0）重算；非战斗自动回落静态。**边界**：只做伤害句；护甲/回复/抽牌与按目标加成未纳入。

**12 卡牌区偶发不升起+虚化** — 沉底动画 WAAPI `fill:'forwards` 挂常驻手牌层，而 `prev` 采样依赖本渲染有出牌事件（`battle.view.js:361`）；敌→玩家帧常无事件 → 既不建升回也不 cancel，沉底态永久盖过声明式 CSS，且不自愈。`battle.anim.view.js` 改为模块自记相位终态 `handPhaseTarget`，每渲染用 `prev ?? handPhaseTarget` 对账：该升建升回、终态不符 cancel 交回 CSS；只在 enemy↔非 enemy 维度翻转建动画。无定时器兜底。

## 验证记录

**叫停前（各组报告，均 `npm run test:target` 单跑）**：
- A 组：`check:syntax` PASS（618 文件）；自建 4 测试 19 项过；回归 8 批全绿（discover/acquire/chest/class/desc/infusion/battle 核心与审计）；compendium 13 项过。
- B 组：`check:syntax` PASS；自建 4 测试 13 项 + 相关既有 17 文件 290 项全过，另 4 文件 33 项、改动文件 eslint 无告警；仅撞 1 项基线失败（`expedition-battle-presentation`，failed-tests.txt:54）。
- C 组：`check:syntax` PASS；自建 4 测试 14 项过；回归 6 批全绿仅 2 项基线失败（skull-sword:123、sys03-altar:128，单跑亦败）；条 7 去重落地时（叫停前）decision 三文件 28 项过。
- 主线：发现面板文案与断言为叫停后收口，**未运行**。

**叫停后未验证（老板指示「不用测试」）**：A 组 5 条返工（directRelease 链路、rules.md 同步、3 测试断言改写、5 项批准登记）；C 组 `skull-sword` 两处断言与 `wf-feedback1021-c` 新 DOM 用例；主线发现面板文案/断言。A 组建议合入前补跑定向回归：`wf-feedback1021-a-*`、`direct-cast`、`infuse-free-paths`、`battle-discover-retained-feedback`、`discover-infusion-feedback`、`builtin-card-execution`、`m-hosted-contract`、`m-batch-production`、`e8-card-inventory`、`cards-choice-armor-guard`、`compendium`、`sts2-cast-layout-1021`。

**未做**：实页验收（内置浏览器 12 条逐条核验，叫停）、全量 `npm test`、build、提交。

## 改动文件清单（39 源/样式/文档 + 16 测试）

- A 组源码：`game/src/cards/{cards.data,card-rarity(新),cards.rules,cards.sync.face-refresh,card-description-text,battle-value-context(新),builtin-choice-execution,builtin-card-previous-variants,cards.sync}.js`、`game/src/battle/effects/{battle.discover-candidates,effect-steps.ctx,battle.discover-flow,effect-steps.damage,effect-steps.kills,battle.acquire-operation.domain}.js`、`game/src/battle/core/{battle.draw.domain,battle.exec-play.domain,battle.selection-flow.domain,battle.engine.factory.domain}.js`、`battle.core-ports.types.d.ts`
- B 组源码：`game/src/battle/view/{battle.aim,battle.layers,battle.anim.view}.js`
- C 组源码/样式：`game/src/battle/view/{battle.infusion-view,battle.decision-content}.js`、`game/src/run/event-lifecycle.js`、`game/css/{chest-reward-overview,battle-infusion,battle-decision,entry-events}.css`
- 主线：`game/src/battle/view/battle.discover-infusion.js`
- 文档：`docs/rules.md`（L96/98/99）、`docs/game-compendium.md`（脚本生成）、本证据
- 测试：`tests/wf-feedback1021-{a×4,b×4,c×4}`（新建）、`tests/{discover-infusion-feedback,sts2-cast-layout-1021,direct-cast,battle-discover-retained-feedback,events-lazy-entry,skull-sword-effective-session,m-batch-production,cards-choice-armor-guard,e8-card-inventory}.test.js`、`tests/fixtures/builtin-execution-approved-20261020.json`、`tests/helpers/{card-catalog-approved-revisions,e8-card-inventory}.js`

## 遗留/待决

1. 叫停后改动未跑检查（上文清单）——如后续恢复验证按 A 组建议清单补。
2. `battle.target-rules.js` 规则层仍存在 `targetSideFor`/`itemTargetSideFor` 两套口径（视图已同源，分叉源头未统一）——属重构建议，未做。
3. TNT 拖到战场空地无拖拽入口（现仅敌向药水有拖拽）——交互设计缺口，未做。
4. `f.controlled`（心灵控制转化敌）无角标——语义是我方策反而非负面，待老板确认。
5. 720p 中/大箱三选一残留纵滚（条 3 范围外）；正文 nodeOpt 选项卡与顶栏退出图标的「返回地图」保持原位（条 8 若需一并右移另开条目）。
6. 反馈 11 数值实算仅覆盖伤害句 4 类；扩展范围待拍板。
7. 神灯仍保留「发现并释放」直释动作（仅文案与池改定版）；若要改为发现入手需连带改 `battle-end-turn-selection` 链，待授权。
