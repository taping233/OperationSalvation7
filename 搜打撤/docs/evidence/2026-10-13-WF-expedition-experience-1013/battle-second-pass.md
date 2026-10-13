# 战斗二次对照迭代

2026-10-13，Friday / Codex。源码已交付、停止编辑，未提交。主协调统一最终验收。

## 改动与原因

- `game/css/expedition-battle.css`：战场根容器改 `overflow:clip!important`。真实手牌点击之前让隐藏溢出容器自动滚到113.6px，顶栏滑出；修后同一路径scrollTop为0。
- 同文件：精确匹配 `sts-hp-main` / `sts-hp-ghost`，覆盖winter.css的旧!important绿色规则。实页计算样式与截图确认己方蓝、敌方红、掉血残影金。
- `game/css/battle-hand-overhaul.css`：九叠身份名称18px、无继承字距；长规则详情由绝对定位改卡面与全文栏共同居中的正常布局，留72px间距；卡面长描述只显四行，全文栏独立滚动，防止文字溢出到使用按钮。
- `game/src/battle/view/battle.overlays.js`：首脑编组拆为首脑摘要、已编数量、候选卡与固定确认区。抽牌/固定补给/禁选类型/开战装备细则折叠；准备阶段显示“开战前准备”，不再显示0/0能量。无可选卡时也识别为formation。

## 参考与实际输入

实际读取reference-board.html，查看真实StS2 `reference-images/sts2-current-1.png`及方舟 `arknights-is6-battle.jpg`。采用贴身单位生命、两侧固定操作、底边手牌和前景聚焦大卡的关系。

Codex隐藏内置浏览器，独立origin `http://localhost:5376`，1920×1080。真实新档选择无，带冷冻射线/坚守、出发；项目#devBattle经CDP点击仅用于辅助到场。随后使用真实locator点击、坐标点击和tab.drag输入：

- 普通多敌：冷冻射线从手牌拖到右敌释放，能量2→1，牌离手并击败右敌。
- 单敌：初始攻击点击先打开大卡；使用按钮进入选敌阶段，此时能量仍1、敌生命仍3/3；确认目标后战胜直接进入物资奖励页。
- 九叠：通过runtime模块向独立档插入七张实际卡牌构造，查看9叠名称/即时费用/数量。长规则在神灯副本描述追加明确“仅验收长规则排版”文字；只覆盖排版，不证明该测试文字牌效。
- CSS动态模块重新载入用于冻结HMR关闭页的最新样式。最终主协调须在统一冻结页重新加载生产源复核。

## 本轮证据

同目录：`battle-second-nine.png`、`battle-second-long-rules.png`、`battle-second-single-target.png`、`battle-second-victory-reward.png`。截图只证明对应构造/输入后的外观。

定向命令：`npm run test:target -- tests/battle-hand-layout.test.js tests/battle-hand-inspector.test.js tests/boss-equip-select.test.js tests/expedition-battle-presentation.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`，6文件62项全部通过。该测试在首脑展示实现后运行；随后只调整CSS间距/截断/字距，未重复测试。未build、提交、推送、发布。

## 未核边界

首脑编组最新展示尚未实页查看；首脑编组后战斗与终局未在本轮核对。真实拖回取消、连续跨线回手、长规则栏真实滚动到底、冷暖首帧时间未核。最后长规则截图拍摄与动态样式载入相邻，最终!important截断是否完整呈现仍由主协调统一确认，不将截图当完整通过结论。未对其余页面或引擎规则做修改。

5376本会话服务PID28372、exec78130；失败首启PID27168/exec8088已Ctrl+C。收尾关闭专用tab并停止28372，端口结果由主协调收尾消息列明。
