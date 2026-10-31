# 现行设置、输入与试玩反馈迁入

本域以 `搜打撤/game` 当时工作树为权威（含现行未提交修改）；逐文件指纹见 `source-sha256.json`。准备稿位于本目录，生产写入以主会话开放窗口为前提。生产修改仅替换 MenuDialogs 的 SettingsScreen、VolSlider、SuggestionBox，以及新增本域组件与两个共享偏好/输入投影。

## 对应关系

| 原来源 | 原生入口与对应行为 |
| --- | --- |
| menu-settings.js / settings-navigation.js | SettingsScreen → CurrentSettingsPage；260 左导航、40 间距、右侧独立滚动详情；四分类；通用中数据与档案/危险操作/致谢与来源三折叠；每类阅读位置与折叠状态保留 |
| settings-navigation.css / page-settings.css / home-ui-tokens.css | 1540 内容宽度，88 页首，74 分类钮，72 开关行，正文22/标签18/页题30；同源 snow-road 背景、运行时模糊和去饱和；独立选择标、分类淡出淡入、导航焦点 |
| settings-input.js / core/input.js | CurrentInputBindings 维护10动作、默认双键、覆写优先、冲突转移、单字母开关、实际动作解析；设置捕获新键，Esc/Tab取消，焦点移走取消，冲突确认后写入，默认恢复 |
| settings-audio.js / menu-settings.js | 两个独立开关、两个音量条，拖动立即作用AudioService，音效松手试听；读缺失音乐状态，手动重试当前场景资源；保持既有四首现行BGM加载路径 |
| core/performance-settings.js | sdt-performance的low/balanced/high与30/60/120；Application.targetFrameRate + vSyncCount=0为原生帧率实际作用，游戏时间与战斗节奏独立；画质消费者由主会话接入后启用 |
| index.html #sugLayer / menu-feedback.js / feedback.local.js | SuggestionBox → CurrentFeedbackComposer；正文2000、步骤1200、预期800、实际800；本地Saves.Global sdt-suggestions-v1共享HomeInbox；追加ts/version/page/target/at字段，坐标原点为屏幕左上；成功清表返回，失败保留输入 |

## 集成API

- `CurrentUiPreferences.Flag(key, defaultValue=false)`、`TrySetFlag(key,value,out error)`、`TrySetString(key,value,out error)`；`ReducedMotion/ReduceShake/ReadingLarge/EndTurnHold/HintBar/LayerBanner/BattlePace/Quality/FrameLimit`；`TrySetPerformance/ApplyNativePerformance`；`Changed`。
- `CurrentInputBindings.Actions/ActionName/BindingLabel/Bindings`；`ActionFor(string,bool ctrl=false,bool alt=false,bool meta=false,bool composing=false)`；`KeyFor(KeyCode)`；`ConflictFor/TryRebind/TryReset/LettersEnabled/TrySetLettersEnabled/Changed`。
- App在普通Escape及动作分发前检查 `SuppressGameplayInput`，调用 `CaptureKey(KeyCode,bool ctrl=false,bool alt=false,bool meta=false)`；字串端口为`TryCapture`。页面关闭释放捕获委托。
- `CurrentSettingsActions.OpenRunData` 为真实数据页入口，未接时按钮禁用。`CurrentSettingsPage.QualityProjectionAvailable` 在真实质量消费者接好后启用。
- ReadingLarge、EndTurnHold、HintBar、LayerBanner、ReduceShake、Quality消费由主会话接在实际页面/战斗/HUD；本域不写这些属地。

## 可见失败语义

偏好、键位、留言、清档均通过Saves.Global或现有事务写入；失败显示文字，不宣称保存成功。键位和普通偏好保存失败保留原值；音频服务保留会话内的实际调整，因此显示“本次调整已生效但保存失败”。坏留言库不重置、不覆盖，输入保留。未增加旧output/suggestions.json兼容。

## 已做检查与边界

- `prepare_checks.py`：自有代码与固定辅助源码/已导入程序集私有编译，输出仅在本域private-check；最近一次0警告0错误。
- `behavior_checks.py`：22条行为断言通过，覆盖动作默认/覆写/冲突转移/字母 gate/失败不污染映射/恢复默认/原生键名/捕获阻断/留言追加/坏数据及失败保留，另验证偏好默认、帧率投影调用和保存成功后刷新失败的区分。帧率属性使用替身，不作为引擎运行证据。
- `deploy_owned.py`：部署前对非属地文本作脱敏对比，确保MenuDialogs其他类型逐字保留；不调用Unity、不触共享编译输出。
- 原生运行、离屏画面、真实输入与完整流程由主会话集中验证；私有编译和假存储断言不替代这些证据。
- 背景以480×270三次可分离box滤波近似源7px Gaussian，去饱和.5；背景渐变和圆角/光影的最终视觉一致性须集中看图。
- 原生画质的浏览器采样倍率与48/96/192MiB图片缓存没有在本域虚构；真实原生映射待主会话接入后补记。跑局数据页与采集同样由主会话迁入。

当前：已按主会话开放窗口写入生产；私有编译与22条行为断言通过，diff-check通过；未提交。主会话继续接实际消费者及集中原生验收。
