# 高频流程收拢：停用战斗界面退役

持续目标第十七批，从已停用的独立手牌详情与战斗背包生产引用出发，退出旧展示、动作和专属样式，使现行说明对应实际交互。

状态：本批修改完成，编辑释放，待老板统一验收，全部保留未提交。`retire_hand_panel_r17`与`retire_battle_bag_r17`使用6.1-sol/high，分别负责手牌旧层和战斗背包；主会话维护说明与归属。共享CSS由单一代理写入，按实际选择器协调。

本批集中修改，由老板统一验收，不运行测试、lint、构建或实页，不新增测试，不提交或推送，不删除文件或目录。

## 退役依据

- 独立手牌详情三个API在生产源码中只有旧模块自用；aim中的旧show/close也无生产消费者。实际输入从layers进入startAim/selectCardByClick，当前使用原卡位拿牌、目标选择与注能。
- 战斗背包的openBag明确提示禁用并返回false，生产viewingBag写入仅closeBag置false，runtime初值同为false。旧存档恢复的restoreImpl与checkpoint/start都会closeBattleViews，恢复过程不回填旧背包视图。

## 实施

- `battle.hand-inspector.js`保留原路径与三个返回false的兼容API，退出旧DOM、观察器、全局事件、焦点及inert管理。`battle.aim.js`移除无消费者的旧详情show/close导出与旧层命中守卫。
- `battle.overlays.js`移除旧renderBattleBag与四项动作注册，连同无保存等待的旧safe移动分支一起退出。`battle.view.js`移除旧分发及对应展示锁；当前药水栏、牌堆、发现和选卡继续原入口。
- `battle.decision-shell.js`移除bag kind/compact判断；`battle.decision-content.js`移除旧背包独占的pileDetailHTML及依赖，详情继续正式大卡入口。
- `battle-hand-overhaul.css`、`battle-secondary-overlay.css`、`public-controls.css`、`secondary-ui-tokens.css`、`cover-battle-shell.css`、`expedition-battle.css`、`page-rewards-bag-help.css`、`winter.css`、`battle-decision.css`退出旧手牌层、旧背包和inline inspect专属规则/选择器成员，保留现役规则与通用bag-grid/bag-slot。
- 战斗tip及注释改为实际拖拽/拿起后点击确认、数字键选择、Enter目标确认与Esc取消。`game/src/README.md`和`docs/modules/secondary-ui-style.md`按当前持有者及交互维护。

后端viewingBag兼容字段、openBag/closeBag/useItem保留；未更改战斗规则、地图背包、药水实际使用或存档格式。原有r11/r12/r15等未提交增量按现役范围保留。

## 老板统一验收入口

- 拖牌、拿起后点击确认、数字键/Enter/空格、Esc与注能继续当前行为；手牌阅读留在原卡位。
- 牌堆查看/详情、发现/抉择与药水栏沿当前入口操作。
- 地图背包正常使用；战斗背包维持现有禁用提示，恢复对局进入当前战场。
- 现役公共按钮、玻璃工作区及手牌悬停外观保持当前方案，旧层样式不再参与。

源码与样式引用已由各属地读取确认；本批未运行任何测试、构建或实页。原有直接断言旧手牌弹层的测试与本轮退役合同不同，统一验收时需更新对应断言；不沿用早期通过结果证明本批增量。
