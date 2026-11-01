# Root公共路径独立审查

2026-11-01。结论：对下列确切版本的三处生产改动和HUD原生检查源，只读审查未发现必须退回的确定错误。未编辑生产或检查源，未编译、测试、启动Unity；本报告不替代Root统一运行。

| 文件 | 审查SHA256 |
| --- | --- |
| `Assets/Scripts/Sdt.UI/Kit/CurrentRunTopBar.cs` | `d2c4e7112ae795116fd3c1e84d432a0fcb627a930ee3dae9f1daeadece322975` |
| `Assets/Scripts/Sdt.UI/Kit/App.cs` | `a4175b719fda250f807f309cbeea389a978502ab14bb0e5f1031901298323e89` |
| `Assets/Scripts/Sdt.Run/SaveSystem.ArchiveCards.cs` | `75a3feeea47215c9f6fffd3197aa3699a9445c7c6a3b5219a19e09305ed30b1e` |
| `Assets/Editor/CurrentHudRound6Checks.cs` | `01af8dffd7e0b07270eddfee36d9d51eec4b9defcd38762e136931fa6c132230` |

## 生产行为

- **顶栏 `CurrentRunTopBar.cs:93–112`**：run未活动时通过短路不扫描栈；被覆盖时仍使用原 `Covered/Covers` 规则，隐藏和关闭详情后提前返回。`_visible`只在真假变化时写CanvasGroup三属性。可见时继续扫描实际组件标记，两个标记均找到才提前结束；不同面板分别持有标记也能识别。重新可见没有提前退出，`:113–145`仍按当前battle/run、角色/皮肤、生命、币/攻击、层数和静音状态更新，旧数值缓存不会阻止已变化状态刷新。已查到的正式源没有其它代码写该专用CanvasGroup。
- **输入 `App.cs:126–145`**：无 `KeyCaptureHandler` 时跳过第一轮捕获枚举，普通分派轮仍保留。`CurrentInputBindings.cs:21–25`证明Suppress仅表示handler存在，CaptureKey原本也是KeyFor→TryCapture；现同一按键只翻译一次。handler返回true仍立即消费；返回false但未释放handler仍在`:137`拦截游戏输入；handler自行释放后返回false，`:137`重新读取为false，照常经过输入框/按钮保护和普通dispatch。没有新增无条件早退破坏这一分支。
- **诊断清理**：删除的私有DiagClick在正式旧源搜索仅有 `HEAD:App.cs:122`定义，AppDriver.Update没有调用，当前Assets全C#无该名称消费者。删除不会关闭原有输入驱动或射线判断。
- **归档 `SaveSystem.ArchiveCards.cs:114–115`**：遍历当前run及settlement.run的ownedCards，任何仍附着bagDiscover的来源都属于尚未兑换候选，资格不应因safe/stored位置而免查。沿既有RequireMany/Require验证ID定义，不生成新候选、不改变随机或导入冲突策略。正常依赖仍由`:29/46/55`递归cardIds提取；缺失定义在Export或Preview/Import预检抛错，实际写入仍在既有完整事务后。

ArchiveCards在本地Unity仓库旧HEAD未跟踪，故没有用空git diff冒称无变化。按第五轮已发布 `source-freeze.json`核对，仅读入字节、移除当前114–115两行后SHA为 `813a1d1e4e48c075fad20ab008b68dc6b58f2309d956bea1121d57559dc4671f`，与第五轮该文件指纹完全相同，确认此次确为两行窄增量；没有修改文件。

## CurrentHudRound6Checks夹具与断言

静态成功路径14条Check，覆盖真实保留顶栏、金钱详情开关、Settings覆盖、隐藏期间数字不刷新、揭开后新数字、可见marker、非活动run隐藏和恢复后的新marker/数字。

- `:36–38`的 `resHud/run-gold`与正式 `CurrentRunTopBar.Build:54–58`命名/父子结构一致。`CurrentRunHudView.Button:23–28`返回真正uGUI Button并绑定onClick，ExecuteEvents.submitHandler会走该正式控件；不是对裸GameObject模拟点击。
- `:39`使用 `UiStack.Show<SettingsScreen>("Settings")`，与正式UiStack `:79–86`的挂组件→Push→Build一致；MenuDialogs `SettingsScreen.Build:35–37`创建并Build正式CurrentSettingsPage，OnClose `:39`也会Release。取消PageEntry影片后再手动Tick，不将幕布误判成设置覆盖。
- `:46–50`用正式EmergencyModal作为栈owner/真实NodeShell，不执行撤离命令。添加的CurrentIllustratedNode和CurrentRewardScene只作为组件存在性标记，立即enabled=false；两者没有Awake/OnEnable构建入口，其LateUpdate被禁用，不会用未初始化字段运行布局。TopBar原来的GetComponentInChildren检查就是按活动GameObject中的组件存在性，未要求Behaviour.enabled，所以能正确隔离要验证的标记扫描。
- `:55`停用标记GameObject后，在隐藏期间不改旧呈现；`:58–59`重新活动时扫描结果变为空并刷新数字，能够检出将hidden的提前return错误沿用到恢复帧的回归。

边界：该检查用反射同步调用正式Update，构造uGUI提交和组件存在性；不证明物理按键、自然帧调度、Settings所有交互或真实奖励布局。它不直接运行App.PollKeys的硬件按键分支，捕获返回false语义本次由源码等价审查支持。标记夹具也不声称自然紧急撤离流程或性能实测。生产/检查源与本片已冻结Run Program均保持未改。
