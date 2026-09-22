# R6-a《最后一盏引路灯》交付

## 玩家可见变化

- 每次探索最多在一个普通事件格推进一段环境故事，共三段；其余事件格继续原有随机事件。
- 第三段明确二选一：开放远射照明会帮助远处求路者但暴露通道；遮光近照会保留隐蔽但远处无法找到。
- 基地“成就·收藏室”显示“见闻纪念”进度；结局后分别显示【北门远灯记录】或【遮光近照记录】。
- 页面明确说明故事记录不提供地图或战力效果。本包不扣物资、不发实物、货币或职业卡。
- 故事页使用既有 `winter-expedition/outskirts.webp` 无人物雪街作为氛围背景；它是复用素材，并非《最后一盏引路灯》的专属插画。

## 实现边界

- `story.last-lamp.js`：严格校验 `stage/segments/runs/ending` 的跨字段一致性；仅缺少 `outcomes['last-lamp']` 才视为新线，已有空值或坏结构拒绝且不覆盖。事件实例统一绑定 `runId + 非负整数节点`，支持含冒号的 runId。所有更新保留其它 `story.flags/outcomes`。
- `story.commands.js`：先读 M01 receipt，再读取与验证当前 Base；相同请求重放原结果，异选择沿用 `REQUEST_ID_CONFLICT`。
- `game.storage.js`：增加 `RunStorage.readIdentity(slotId)`，只读真实 `_r2.runId/revision`；验证档位、版本和字段，pending journal 时拒绝，不生成新身份。
- `game.run.flow.js`：只使用 `getActiveSlot()`，不借 `Base.slot`。选择提交前后均复核 activeSlot、runId 与 journal；迟到回调不提交，提交期间换局则不消费新局节点。Base 提交成功后才允许消费事件节点。Base 成功但 run 保存失败时撤销内存 visited，结果页提供重试；重载可按永久实例记录补消费。选择页、失败页和结果页均登记背包返回钩子。
- Base 的 `runs[runId]` 是同局一段的权威限制。即使 run 保存失败后回到更早节点并进入另一个事件格，也不会推进第二段。
- Ink 加载失败或故事不适用时不因故事消费节点，原普通事件随后照旧结算。pending journal 则停在未消费的重试页，不执行原事件。
- receipt 和节点保存是两次持久化，本包不声称跨键原子。

## 实际文件

- 新增 `game/src/story.last-lamp.js`
- 新增 `game/src/story.commands.js`
- 新增 `tests/r6-story.test.js`
- 修改 `game/src/game.storage.js`
- 修改 `game/src/game.session.js`（只读真实 activeSlot 导出）
- 修改 `narrative/events.ink` 并用正规脚本生成 `game/src/generated/narrative-events.js`
- 修改 `game/src/narrative.js`
- 修改 `game/src/game.run.flow.js`
- 修改 `game/src/game.hub.js`
- 修改 `game/css/scenes.css`（专用故事背景复用既有无人物雪街）
- 新增 `tests/r6-story-flow.repro.test.js`
- 设计文档 `docs/modules/R6-A-LAST-LAMP-DESIGN.md`

未修改人物 bible、卡库、effect-steps、地图层数、经济、撤离结算或 R7。

## 自动验收

```text
npx vitest run tests/r6-story.test.js tests/r6-story-flow.repro.test.js tests/narrative.test.js tests/narrative-coverage.test.js tests/m01-base-commit.test.js tests/events-0919.test.js --no-file-parallelism
```

结果：最终定向 6 个文件、44 个测试全部通过；其中 R6 状态/存储专项 15/15、真实 flow 动作回归 6/6，并通过 Acorn 与定向 `git diff --check`。

R6 专项覆盖两结局与不同纪念、保留其它 story、同 run 异节点拒绝、同实例恢复、强 schema、事件实例绑定、真实 M01 本地存储三 run 提交、重载幂等与异选择冲突、真实 run identity/pending 拒绝和正式 Ink 文案。真实 `runEventDeck` + `UI.act` 动作回归覆盖结果页换局/换节点迟到、背包恢复迟到、Ink 等待期间换局、Ink fallback、Base 写失败页内重试，以及 Base 成功后 run 保存失败重试。

Ink 正式编译成功；新增/修改 JS 通过 Acorn 语法检查，定向 `git diff --check` 无错误。

## 根实际验收（2026-09-21 06:15）

- Friday在同一Vite服务器的隔离localhost来源，确认空档后新建QA01/02，各通过正常整备、随机地图、真实战斗走三局，共六局，未注入故事状态或强制胜利。
- QA01：第一局L2事件3→第一段，结果页刷新后点原节点恢复同一结果；背包在选择页/结果页均正确回到原页；同局下一事件是原暴雨劫道，没有读第二段。正常战死后基地1/3。第二局L2事件12→第二段，正常放弃后2/3。第三局L2事件2→开放远射，放弃回基地实际显示“北门远灯记录”。
- QA02：第一局L2事件3→第一段；第二局经过两场普通战到L2事件4→第二段；第三局L2事件6→遮光近照。结局已提交、未点离开时刷新，续局仍在同节点，点击脚下只恢复遮光结果，没有再次改选。离开并正常放弃后基地显示“遮光近照记录”。
- 两个档分别刷新重进收藏页，仍显示各自不同纪念；原127来源玩家档完全未动。第二段/最终选择/基地纪念的1280×720截图可读，无遮挡；背景已复用无人物雪街，不再误用医疗救助角色图。
- 根亲跑过前版6文件43/43，最终完整绑定修改后真实flow6/6；代理最终6文件44/44。真实flow用实际M01和RunStorage，但UI/session saveGame为故障端口夹具，不冒称整个session写失败的IAB实测。

## 验收范围与未覆盖

- R6-a有限环境故事接入通过；这不等于R6-b涉及撤离奖励/物资代价的跨键经济闭环完成。成功撤离经济仍受R0/R2规则门约束，本次只实际验证故事对死亡和放弃的保留；不为旧安全格规则盖章。
- 本包只让后续环境文字具备区分结局的状态字段，没有新增地图增益或额外后续事件。
- 程序与界面验收不代替制作人的最终文字审美认可。
