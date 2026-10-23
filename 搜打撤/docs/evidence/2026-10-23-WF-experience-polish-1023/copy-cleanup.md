# 文案精简片

状态：老板经主代理批准的 `.tmp/polish-1023/copy-cleanup.patch` 已应用主线，等待与安全格片集中验证；本片未运行测试、静态检查或浏览器。

完成5处精简：基地导航去除“当前房间”重复文字；选人去除“当前选择”标签和重复消耗区教程；整备人物标题只显示姓名并用 aria-label 保留“出征人物”语义；未完成战斗节点说明去除重复完成提示。导航的选中 aria、人物选择 aria、成长、生命/攻击/技能、整备阶段消耗区教程及其教学标记生命周期保持原实现。

4个源码文件：`hub/hub.navigation-v7.js`、`run/game.run.class-choice.page.js`、`hub/game.hub.depart.js`、`core/map-node-state.js`（均位于 `game/src/`）。

同步删除8份 CSS 中只服务于已删标记的孤立规则：`base-framework-v7.css`、`character-cover.css`、`base-camp-roster.css`、`expedition-roster.css`、`roster-reference.css`、`roster-departure-v2.css`、`character-view-motion.css`、`base-camp-rework.css`。未删除文件；后两文件已先按具体路径执行 handoff，相关改动/占用均0、退出码0，其余沿用主代理同轮核对。

仅调整既有测试：`departure-browse-state.test.js` 验证人物标题及 aria 名称；`departure-class-confirmation.test.js` 验证选人不重复教程，同时保留成长和已选人物 aria 语义。未新增纯文案镜像测试；原 `departure-stack-lifecycle-review.test.js` 的整备教程生命周期断言保持未改，可纳入集中验收。

规则、容量、概率、异常原因没有改动；未改共享台账/README、entry_audit在补的3份测试或其他模块。未同步副本、构建、提交或推送。
