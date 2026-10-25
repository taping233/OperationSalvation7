# 事件异步保存合同的测试迁移

任务 WF-review-remediation-1023；日期 2026-10-23。仅编辑主代理指定的7个事件测试文件、新增专用 tests/helpers/event-dice-async.js；没有修改生产代码、共享旧骰子helper、通用存储测试或其他代理持有的测试。

## 迁移内容

- 出示骰子、投骰、确认、领取、退出与恢复动作等待各自Promise；DOM点击和同步外壳派发的异步工作通过事件循环完成点等待，不再把同步返回当作落盘。
- 真实session/RunStorage夹具使用项目现有installImmediateWebLocks，初始化、删除与保存均等待完成；没有放宽保存必须成功的断言。
- 新增专用异步骰子helper，等待已展示的骰子及后续嵌套投骰完成，旧helper保留给其他迁移线。
- 资源飞入测试把视觉完成保持为pending，避免jsdom无动画回退在await保存后就收掉飞入节点；仍检查真实飞入DOM、入包数量、重复操作不重播及既有锚点。
- 3个新增行为用例：投骰/确认保存等待中不重复扣款、随机或发奖；初次保存完成前上下文失效不得覆盖新页；已授予卡牌保存等待中重复领取只发一份，过期上下文不得关闭新页。

## 实际验证

7文件140项全部通过：event-dice、event-callback-lifecycle-audit、event-choice-recovery-cloud、event-choice-session-resume-cloud、event-choice-acquired-gift-cloud、run-event-controller-ownership、event-settlement-unification。新增3项，其余业务断言保留，没有skip或降低预期。

此前两轮迁移反馈为109通过/28失败、134通过/3失败；这些失败用于区分未等待夹具与生产Promise真值问题，不计为通过。确认为生产问题的黑市奖励承接失败后pending被清空已报告主代理，并由主代理把hit回调和finishEventRoll改为async/await；最终通过轮覆盖该修复。runEventDeck完成/空卡池退出等待也由主代理处理。

迁移过程中未打开浏览器、未访问玩家存档、未构建或提交。测试stderr中的恢复身份隔离提示以及故意注入的存储失败来自原有场景，没有未处理异常。

最后针对资源夹具等待点补验 event-callback-lifecycle-audit：1文件57项通过；清理仅含未用导入/无作用的await，不改变业务预期。自有diff检查通过。

## 追加：保存等待期间的页面所有权

新增独立 tests/event-save-page-ownership.test.js，只运行该新增文件，1文件6项全部通过。三个实际控制器并发场景各验证保存成功/失败两种结束：

1. 资源重试保存开始后同一探索、同一ovBody切到系统菜单，迟到结果不得重渲旧资源页；再点旧重试/领取回调不产生新保存或新授予。
2. 已领取资源的退出保存等待中切到新页面，成功/失败均不得关闭新页、推进旧done回调或重复发牌。
3. 事件closeEventFlow保存等待中替换页面，成功不得关闭新页，失败不得把新页替换成旧事件保存重试页；旧退出回调失效。

用可释放的Promise控制保存完成时点，刻意保持探索身份不变，只替换当前页面根节点，验证主代理新增的await后页面所有权复核。断言新根节点、可见状态、刷新/关闭次数、存储调用次数、领取数量与已消费事实；没有改生产代码，也没有重复未受影响的既有事件或公共UI组。

## 全量反馈后的其他事件夹具迁移

全量运行期间定向确认event-node-binding-cloud、event-recode-selection-continuity、four-player-event-regressions仍依赖同步骰子helper，导致事件选择、退出和领取断言提前执行。仅改这3个测试的等待及专用异步helper引用，保留原业务预期；迁移后3文件20项通过。没有修改旧共享helper，没有重跑全量。

追加迁移blackmarket-card-preview、events-lazy-entry、events-lazy-story-ownership、nightshift-u10-teardown-guards、r6-story-flow.repro：等待投骰/领取/保存退出以及专用异步宝箱继续helper。保留黑市只读、五次保底、过期详情失效、领取去重、故事保存失败回滚、页面所有权与环境拆除安全断言。这5文件随战斗6文件定向合跑，11文件170项全部通过。r6失败确认发生于保存Promise完成前读取visited，等待完成后原“失败不消费节点、重试后才离开”断言通过，未改生产存储逻辑。
