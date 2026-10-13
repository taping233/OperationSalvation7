# C线：收藏、领奖与建设

状态：授权实现完成，待主会话当前窗口视觉与真实操作复核。

## 改动

- `game/src/hub/hub.archive-v3.js`：奖励详情明确标注奖励预览、目标条件与可领取；里程碑标题和列表同时表达未达成/可领取/已领取；卡背详情说明当前仅预览或实际使用，以及应用去向；空待领取列表保留目标与里程碑入口。
- `game/src/hub/hub.collection-v4.js`：收藏详情标题明确“已收藏 · 卡牌预览”，保留缩略选择与详情放大的现行分工。
- `game/src/hub/hub.facilities.js`：当前容量和扩建后容量并排；材料持有/需要邻接确认动作，禁用按钮关联真实原因；数值与命令不变。
- `game/css/base-archive-facilities-v12.css`：对应奖励阅读层级、建设对照和缺口样式。与A确认后移除旧courtyard-v12专属规则及共用选择器内庭院分支，新courtyard-zzz布局由A属地承担。
- 新增`game/src/hub/hub.reward-feedback.js`、`game/css/base-reward-feedback.css`：收藏室局部领取结果与关闭动作，保留目录和房间返回。

修改前六个可写既有文件均为未跟踪文件。字节数与SHA256记录在`c-baseline.json`；本线未改`hub.archive.js`和`base-collection-v4.css`。未写主会话或其他线属地。

## 真实结果合同

`bindRewardFeedback({root,base,meta,cards})`已由自有`bindArchiveV3`调用，父壳无需重复接入。root为`#hubMain .hub-archive-v3`。

capture只记录快照；原`data-act=claimAch/claimColl`处理器仍唯一执行原命令。原同步处理器返回后，microtask核对同slot及此前未领取→真实已领取标记；只有这一变化才生成成功回执。奖励名称与数量取实际资源/仓库/卡背增量，随机卡牌显示实际入库名称。弱集合防重复监听，弱映射保存回执；脱离DOM的root不处理新输入。确认与panel内Esc只关闭，不调用领取；焦点回当前记录或目录。非回执区域Esc不拦截。

失败显示真实“尚未领取，领取记录未改变”。原命令的具体UI.log原因保留。父壳不暴露结果对象，因此本线无法把原原因复制到panel；不推测仓库满、保存失败或其他原因。旧已领取点击不创建第二份回执，slot变化不发布本次结果。

## 检查

- `npx vitest run tests/hub-archive-v3.test.js tests/hub-upgrade-render.test.js tests/collection-room.test.js --reporter=dot`：exit 0，3文件27项通过，覆盖收藏室、扩建呈现、真实收藏领取与仓库不足拒领。
- `npx vitest run --config docs/evidence/2026-10-12-WF-zzz-base-overhaul/c-vitest.config.mjs --reporter=dot`：exit 0，3项回执行为通过：marker与实际差量、失败及原错误保留、确认/Esc不领取、同slot和脱离DOM保护、重复绑定/已领取不重复回执。
- 5个自有JS的`node --check`逐项exit 0；3个CSS用现有PostCSS解析exit 0。
- 首轮包含`tests/hub-collection-v4.test.js`：exit 1，2项失败。该旧测试仍要求缩略图点击直接放大、旧记录disabled；已存在的版本采用缩略选择预览、详情按钮放大，并允许查看旧记录。本线只修改详情标签，未改变上述行为；未为旧测试恢复旧交互或改测试。

未运行build/全量/安装/服务/浏览器/提交。实页视觉、实际保存失败交互、当前窗口遮挡与Esc层级由主会话验收，代码与单测不作为美术通过结论。
