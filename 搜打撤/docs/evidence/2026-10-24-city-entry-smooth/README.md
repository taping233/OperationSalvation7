# 进入城市准备与选档动画优化

2026-10-24，Friday。老板反馈首页点击进入城市卡顿，偶发丢失入场动画；本轮只处理首页到选档页，完成未提交。

- `ui/menu-slots.js` 每次打开只读一次各档对局和基地数据，最近档位判定与卡片内容共用本次快照。下次重进重新读取；单档异常仍仅降级该档卡片，不写玩家存档。
- `ui/game.menu.js` 实际用户的城市入口在首次和热重进时均先绘制反馈，再整理档案。热重进复用菜单模块及控制器；其他热菜单和显式注入的同步组合接口保留原契约。取消、重复点击与换页仍由原入口守卫处理。
- `css/archive-motion.css` 在准备遮层尚未揭幕时暂停选档页及其子元素、伪元素动画，就绪揭幕后开始播放。优先级与原档案专用动画一致，避免被其important动画简写覆盖；不更改原演出时长。

验证：

- `npx vitest run tests/city-entry-snapshot.test.js tests/menu-pages-lazy-entry.test.js tests/archive-motion.test.js tests/fast-bug-sweep-round2-title-slot-context.test.js`：40项中39项通过。与本轮直接相关的城市快照3项、菜单入口27项、存档上下文4项全部通过（34项）；档案动画额外5项通过、1项成就过场断言失败。失败用例`achievement browsing keeps the navigation surface free of scene curtains`期望无切幕，实际未改动的`camp-entry.js`保留成就专用切幕，本轮未处理或计为通过。
- 新测试覆盖每档只读一次、重新进入读取新数据、坏档局部降级、热重进先绘制/同请求合并及首帧前取消。真实菜单测试中原有fixture缺少Base.issue产生的降级warning单列，不冒充真实档案异常。
- 两个源码与两个本轮测试的ESLint、archive-motion.css的Stylelint通过。
- 当前Codex内置浏览器、当前窗口、复用127.0.0.1:5200：通过真实进入城市/返回主菜单按钮确认首次与热重进，揭幕时archiveDeal运行；结束五张档案卡、data-archive-motion=1、无残留page-loading。未点击进入具体档位、未覆盖/删除或写入玩家档案。
- 单独的样式探针临时插入准备遮层，读取实际computed style后立即移除：档案卡及档名在准备态均为paused，leaving后均为running。该探针仅证明样式暂停/恢复，不作为真实输入或随机卡顿的复现证据。第一次探针因当时页面已返回首页无目标而结束，遮层仍在finally中移除；随后在实际选档页重做成功。
- 截图`slots.png`为本轮五档实页。未作耗时对照、慢网或多尺寸验证，不宣称偶发问题完全消失或整体提速比例。

无新服务、无build、未提交推送；原5200服务保留，本轮临时内置标签页关闭。
