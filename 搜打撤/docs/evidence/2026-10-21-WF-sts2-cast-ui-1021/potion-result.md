# 道具阅读、确认与选靶

道具现在先显示说明和“使用 / 取消”，明确确认后才调用现有 `commands.usePotion(uid)`。悬停、按住与轻点图标不消耗；取消不改变原 UID、道具槽、能量或手牌。核心 `battle.bag.domain.js` 未修改，既有单敌确认后直接使用、多敌进入 `pendingItem`、自用直接结算、首脑永久道具禁用和临时道具规则均沿现有命令。

本子任务新增 `game/src/battle/view/battle.potion-use.js`、`game/css/battle-potion-use.css`、`tests/sts2-potion-use-1021.test.js`，迁移 `tests/potion-tip.test.js`、`tests/potion-tip-lifecycle.test.js`。`battle.view.js` 接线、前景保护和旧监听移除由布局子代理实施，不计入本子任务自有差异。

控制器接口为 `createBattlePotionUse({ UI, getSnapshot, commands })`，返回 `sync(stage, snapshot, potions?)`、`open(uid)`、`close()`、`dispose()`。模块自行导入专用样式。`sync` 在普通战斗渲染完成后接收当前舞台与展示描述；`btPotion` 调用 `open`；页面离开收起面板；HMR 调用 `dispose`。

确认按钮闭包绑定本次检查会话，提交前再次核对：当前战斗 token、舞台与道具栏身份、连接/可见性、空闲玩家阶段、当前代表 UID、道具可用性。提交先关闭本次检查；双击和旧按钮无法再次提交。舞台委托监听只在舞台/道具栏更换时重绑，不随每轮渲染累积。按下说明与固定确认共用一个面板，不保留两套 tooltip。

浮层附着 `.bt-potions` 下方，宽度最多 310 px，高度最多 255 px，长说明在浮层内滚动。单击“取消”、Esc、右键或外部按下收起；窗口失焦收起后可重新查看。敌方道具的真实拖拽释放仍由公共 aim 模块处理。

本地参考源：`D:/素材/杀戮尖塔2源码/sts2-decompiled/MegaCrit.Sts2.Core.Nodes.Potions/NPotionHolder.cs` 的 `OnRelease / OpenPotionPopup / UsePotion`、`NPotionPopup.cs` 的 `OnUseButtonPressed`，以及 `MegaCrit.Sts2.Core.Nodes.Combat/NTargetManager.cs` 的目标会话启动与结束。仅转译“先看再确认、按已有目标分类施放、会话失效不提交”的输入结构。

| 验证 | 结果 |
| --- | --- |
| `npm run test:target -- tests/sts2-potion-use-1021.test.js tests/potion-tip.test.js tests/potion-tip-lifecycle.test.js tests/sts2-consumed-items.test.js tests/battle-potion-bar-layout.test.js` | 退出 0；5 文件、72 例通过；2026-10-21 12:25 本机时间 |
| `node node_modules/typescript/bin/tsc --noEmit -p jsconfig.runtime.json --pretty false` | 退出 0 |
| `node node_modules/eslint/bin/eslint.js game/src/battle/view/battle.potion-use.js tests/sts2-potion-use-1021.test.js tests/potion-tip.test.js tests/potion-tip-lifecycle.test.js` | 退出 0 |
| 自有目标 `git diff --check` | 退出 0 |

专属 45 例覆盖使用按钮只响应 click、按下/轻点/双击图标只读、取消保资源、键盘与长按、不可用说明、文本安全、空闲阶段、旧 token/舞台/栏/UID、祖先和源图标隐藏、同名 UID 换战、100 次差分同步、离页及失焦。原启动链测试新增实际回复 12 点生命的确认，旧确认按钮重复点击只回复一次；生命周期测试使用真实道具快照，并验证多敌确认进入公共选靶、取消保留原 UID 和槽位。消耗账本与道具栏既有回归同时通过。

启动链测试仍使用原有 jsdom 媒体/网络桩，输出音频编码不支持、资源预热桩缺少 `arrayBuffer` 的提示；本轮没有未处理异常，测试退出 0。这些测试是构造事件与状态断言，不代表真实浏览器输入或视觉验收。

本子任务未启动服务、未运行浏览器、未跑全量或 build、未提交。当前窗口内置浏览器的视觉位置、鼠标/触摸真实交互及拖拽路径由父会话统一验收；本记录不宣称该部分通过。

与父会话 `.tmp/sts2-cast-ui-1021-before` 的自有变化：两个新运行文件在 before 中不存在，为本轮完整新增。before 未保存 `tests`，两旧测试以本轮首次读取原文及当前定向 `git diff` 核对，当前差异为 `potion-tip.test.js` +32/-20、`potion-tip-lifecycle.test.js` +56/-27；没有把 HEAD 冒充该目录的文件级快照。

| 自有文件 | SHA256 |
| --- | --- |
| `game/src/battle/view/battle.potion-use.js` | `A598C460A0DB9B0B195D17C76199393B75EDB67BED44D92B0C45940D8C79D819` |
| `game/css/battle-potion-use.css` | `AEDD8C0DE3C16258576CEDF0A6ACE750B27C8534984FCA41632C0231D4708EC9` |
| `tests/sts2-potion-use-1021.test.js` | `D623DFF58DB866577FA0DA20F9D74194DDE4DA1543B57E1163CD0A5BC28D1419` |
| `tests/potion-tip.test.js` | `5BE670389EF2E983471618A2C77166545EFB77F006B552DFC76C1D6D92D1BBBA` |
| `tests/potion-tip-lifecycle.test.js` | `1A71BB03A73EFD6817CCDBFB2B8EAF77EB0508FF71856BD1B2ABDDD20D95E4D1` |
