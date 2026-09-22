# R7 最终集成检查

Friday根执行，2026-09-21。此文件保存真实失败，不以新模块定向绿灯替代全项目绿灯。

## 全量 Vitest

命令：`npx vitest run --no-file-parallelism`。

06:48:23开始，227.74秒：105文件中98通过、7失败；591项中582通过、9失败。

| 失败 | 归因与处理 |
| --- | --- |
| rapid-fire 2项 | R3离手UID守卫揭露旧fixture反复取ownedCards第一张牌；最后收口改为真实hand中的不同UID，保留原伤害/计数断言，不放宽runtime。根最终5文件42/42通过，连射两项已修复 |
| contracts 1项 | 另一会话的main.js已导入term-tips，BOOT_ORDER缺该项（34/33），是真实清单维护遗漏。未擅自修改其他任务文件 |
| collection-room 1项 | 断言生产卡池必须仍有无归属退役职业卡；当前卡表已修正归属。收藏池纯度与其他13项通过。未删除此断言 |
| hub-flow-regression 1项 | 旧源码字符串仍找stash-row；当前及HEAD已是原生button的stash-cell。保留他任务测试不顺手改 |
| card-photo-notes 2项、card-notes-coverage 1项 | 老板已要求清空备注底稿（09-20交接明确），当前card-notes.json骨架与要求旧备注的测试相冲突。未恢复已弃用文案来凑绿灯 |
| _tmp-l4flow 1项 | 既有临时脚本sweep白名单漏掉首胜教学唯一出口ammoTeachOk；fight仅等battleActive=false，未等战后宝箱/教学续流。真实链先记visited再打开教学为modal，与trace一致。根git show确认HEAD已有同教学。未改临时脚本，不把此失败当作流程通过 |

期间battle-all-cards遍历255张：硬失败0、零效果警告3（铸甲、剑荡妖邪、快意恩仇）。这是故障扫描，不能证明所有语义正确或真人趣味性。

## selftest

`node game/selftest.js`：所有列出的src语法检查通过，但3项BOSS源码正则失败。只读按HEAD源码拼接重算，同3项均false：

- “军威强化/元素庇幕”正则依赖已不在同一行的文本，真实军威每回合强化和元素庇幕机制存在。
- 普通战斗现允许打开战斗背包，BOSS/编组在战斗模块分别拦截；旧全局一刀切条件不再存在。
- 现行BOSS编组只把所选卡建入牌库，不删除未选ownedCards，旧删除断言已过时。

未改selftest或倒退游戏行为让这些旧契约变绿。

## 数据与实机

`node scripts/validate-data.mjs`根已通过：6宠物、23成就、15怪物、12场景、55同步卡。

R7-b真实localhost IAB已完成：四字段输入→键盘Tab聚焦保存→保存明确本地→留言库正确展示v0.57.0及标签字面→刷新后仍恰好一条→实际JSON下载。浏览器工具download事件等待超时，但文件实际已写入`C:\Users\太平\Downloads\sdt-feedback-2026-09-20T22-48-44-830Z.json`；根从磁盘读取核对版本、四字段/换行、页名、坐标及白名单，无selector或额外档案。

实际1280×720与960×540表单均可滚动，保存/返回按钮可键盘到达，焦点轮廓可见。根用DOM确认窄屏确为960×540（尺寸覆盖只作用当前选中标签，未把未生效覆盖误计为通过）。窄屏保存按钮位于y424—461，完整在视口内。测试后恢复默认尺寸。

最后实机发现：留言库返回设置再回标题后，旧game.state变idle使反馈误报地图；最后只修反馈当前页识别并补真实菜单链回归，不顺手重构settings状态。根IAB重走完整往返链后右键，位置已正确为“标题页·按钮设置”，R7-b根验收通过。

## 最终有界补丁复验

06:54:14，Friday亲跑`npx vitest run tests/r7b-feedback.test.js tests/rapid-fire.test.js tests/r3-b-action-boundary.repro.test.js tests/r5a-session-menu.test.js tests/boot.test.js --no-file-parallelism`：5文件42/42（14+5+6+4+13）。反馈字段/页面小修与连射fixture的实际diff已复核；原伤害、日志和新回合清零断言均保留。定向diff-check通过。

没有重新跑全量，因此不得把前次582/591手动改写成新的全量结果。全量中的连射2项已由本次定向消除，其余7项仍保留上述归因。当前工作区不宣称“全测试通过”，也未构建或发布。
