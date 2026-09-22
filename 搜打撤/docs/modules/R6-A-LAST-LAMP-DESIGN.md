# R6-a《最后一盏引路灯》最终设计

状态：设计待根审核，未授权实现。本文只定义环境故事、永久记录和恢复契约；不修改玩家物资、卡牌、人物背景或既有事件效果。

## 三段正文与玩家可见后果

### 第一段：覆雪路标

教学楼与体育馆之间的连廊破了窗。雪压在一块旧疏散路标上，只露出两层方向相反的箭头：褪色的底层指向实验楼，后来补刷的一层改指体育馆。最下面还有一行铅笔字：**“停电后，以亮灯为准。”**

选项：**擦净路标，记下两层箭头**  
提前展示：**永久记录本段见闻；以后在新的探索中再次遇到这条线索时进入下一段。本局不再推进该故事。无物资变化。**

结果：冰霜化开后，新旧漆面的边缘同时显了出来。这不是画错的箭头，而是某次改道留下的两套路线。

### 第二段：停电巡检表

校工值班室的抽屉里压着一张改道图和一页停电巡检表。改道图在玻璃连廊上盖着“冬季封闭”的红章；巡检表最后一栏写着：**“北门引路灯，停电后切至蓄电。”**

选项：**对照路标，抄下巡检记录**  
提前展示：**永久记录本段见闻；以后在新的探索中再次遇到这条线索时进入最终选择。本局不再推进该故事。无物资变化。**

结果：两层箭头都是真的。一条是平日近路，一条是风雪封路后的公共疏散线；北门那盏灯才是最后的确认标记。

### 第三段：同一盏灯的方向

北门灯箱仍有微光。灯罩内的反光片卡在半开的转轴上：把它抬高朝外，光束能越过积雪照亮公共疏散标识，远处的人也能循光而来，但这条通道会在黑暗中清楚暴露；把它压低转向墙内，光只会在近处投出室内近路记号，通道保持隐蔽，远处寻找出口的人却看不见它。同一块反光片不能同时朝向两边。

选择 A：**抬高反光片，开放远射照明**  
提前展示：**远处的人能循光找到公共疏散线，同时通道会被清楚暴露。永久留下见闻纪念【北门远灯记录】。无物资变化。**  
结果：灯光越过风雪落在体育馆方向，远处也能看清路标；北门通道从此不再藏在暗处。

选择 B：**压低反光片，遮光近照**  
提前展示：**近处仍能辨认隐蔽的室内近路，远处求路者无法看见。永久留下见闻纪念【遮光近照记录】。无物资变化。**  
结果：窄光贴着墙面照出旧箭头，近处的路仍可辨认；从风雪深处望来，北门依旧是一片黑暗。

两项纪念都是“见闻与选择的记录”，不是获得实物。后续环境文字可分别使用 `open_beacon` 与 `shaded_marker` 描述差异；本包不承诺路线增益、掉落或数值效果。

## 永久状态、实例身份与一局一段

现有 `Base.story.flags/outcomes` 可承载本线，不另造经济字段。建议 `story.outcomes['last-lamp']` 形状：

```text
{ version: 1, stage: 0..3, ending: null|'open_beacon'|'shaded_marker',
  segments: { [segmentId]: { runId, eventInstanceId, choiceId, mementoId } },
  runs: { [runId]: { segmentId, eventInstanceId, choiceId } } }
```

R2 已在真实对局存档私有字段 `_r2.runId` 保存稳定身份，`RunStorage.read()` 会通过 `publicRun` 剥除它。R6 不应改用 `mapSeed` 冒充全局唯一身份；最小依赖是给 `game.storage.js` 增加只读窄口 `RunStorage.readIdentity(slotId)`，只返回冻结的 `{ runId, revision }`，不暴露或允许修改 `_r2`。进入故事前先完成既有恢复检查；缺少、损坏或版本过新的 identity 时不提交故事，回退普通事件。

稳定事件实例 ID：

```text
r6:last-lamp:v1:${runId}:${layerIdx},${trackPos}
```

Base 永久状态中的 `runs[runId]` 是“一局最多一段”的权威门槛。只要该 runId 已记录任何一段，同局其他事件格即使生成不同 eventInstanceId，也只能回退普通事件，不能读取下一段。run 内可另存 UI 恢复标记，但不能作为唯一门槛。

命令身份：`command='story.recordLastLampChoice'`，`requestId='last-lamp:'+eventInstanceId`，payload 为 `{ storyId, segmentId, eventInstanceId, runId, choiceId }`。处理顺序必须先调用 `readBaseReceipt(context, identity)`：同 requestId 同 payload 返回原收据；同 requestId 改选项返回 `REQUEST_ID_CONFLICT`。只有不存在旧收据时才验证当前 stage、runId 一段上限、实例与选项。

`StoryReceipt.output` 至少包含 `{ storyId, segmentId, eventInstanceId, runId, choiceId, nextStage, ending, mementoId }`。未知段、越级段、未知选项、已被另一实例占用的同 runId 均拒绝且不改状态。

## 提交、失败与重载恢复

故事记录是一次 M01 Base 提交；节点消费仍是既有 run 保存。两者不是跨键原子事务，不得如此宣传。

1. 玩家确认选择，先提交 Base。提交成功前不调用 `consumeCurrentCell()`。
2. Base 成功后显示结果页，再写本局恢复标记、消费节点并保存 run。
3. 若 Base 成功而 run 保存失败，重载后无论回到当前节点还是更早节点，永久 `runs[runId]` 都会阻止该局推进第二段。
4. 重回原 eventInstance 时，读取永久实例记录/旧 receipt，重开已完成结果页并补节点消费，不重复提交。
5. 同局到达另一事件格时，发现 `runs[runId]` 已有记录，直接走原普通随机事件；不能以新实例推进下一段。
6. Base 提交失败、`STALE_REVISION` 或可重试保存错误：保留选择页与当前节点，明确显示失败原因和“重试”按钮；重试仍先读 receipt。失败不 consume、不写纪念。
7. Ink 加载或 knot 解析失败：记录诊断并回退现有普通事件流程，不写故事状态。坏的 `story.outcomes['last-lamp']` 原样保留，返回 `INVALID_STORY_STATE` 并回退普通事件；不得自动清空、补结局或覆盖坏数据。

本线全部永久记录均为 `immediate`：成功提交后，成功撤离、死亡或放弃都不撤销已读段或最终选择。经济 R0 未决不阻塞本切片，因为它不扣物资、不发物品、货币或职业卡。

## 玩家可见纪念入口

基地页增加只读的“见闻纪念”小区块，直接读取 `Base.story.outcomes['last-lamp']`：未完成时显示已读段标题与 `进度 N/3`；完成后只显示对应的一项纪念卡。

- `last_lamp_open_beacon`：**北门远灯记录** —— “你让灯光越过风雪，公共疏散线也随之暴露。”
- `last_lamp_shaded_marker`：**遮光近照记录** —— “你让窄光留在墙边，近路仍隐蔽，远处却看不见出口。”

它们不进入 `home.owned`、背包或仓库，不可售卖、摆放或提供加成。最终选择页与基地纪念都必须展示真实取舍，不能只换标题而共用同一后文。

## 实际文件范围

- 新增 `game/src/story.last-lamp.js`：纯状态机、schema 校验、段落/选项和 prepared change。
- 新增 `game/src/story.commands.js`：组合 `readBaseReceipt/readBase/commitBase`；不改通用提交语义。
- `game/src/game.storage.js`：仅增加冻结的 run identity 只读窄口。
- `narrative/events.ink` 与正规编译产物 `game/src/generated/narrative-events.js`：三个 knot、第三段两个结局。
- `game/src/narrative.js`：加载本线段落，不执行 JS 字符串。
- `game/src/game.run.flow.js`：在真实 event 分支做资格判断、实例 ID、提交成功后消费、结果页恢复和普通事件回退；不改现有事件卡效果。
- `game/src/game.hub.js`：只读“见闻纪念”入口。
- 定向测试：纯状态机、M01 幂等/冲突、稳定 runId 一段上限、异节点重试、失败不消费、Ink/坏状态回退和两种纪念渲染。

不修改人物 bible、卡库、effect-steps、地图层数、经济、撤离结算或 R4/R5 模块。

## 验收与停止点

正常：三次不同 runId 的探索依次完成三段；第三段两条路径各自得到不同结果文案与基地纪念；每局故事只占一个事件格，其余事件保持原流程。死亡、放弃、成功撤离后永久进度一致保留。

失败：Base/identity/Ink/坏故事状态任一失败时不推进、不消费节点、不生成纪念；页面可重试或安全回退。未知事件、段落和选项零状态变化。

重试：同实例同选项返回原 receipt；同实例异选项冲突；Base 成功而 run 未保存后，原节点可补消费、异节点不能推进第二段；刷新、重复点击与背包覆盖返回均不重复记录。

停止点：根审核本文后，才可实现纯状态机与 Ink；接线后必须做隔离三局自动验收，再由根在真实 IAB 连续多局检查两结局与基地纪念。程序验收和环境稿完成不等于最终审美认可，制作人审美结论单列。

