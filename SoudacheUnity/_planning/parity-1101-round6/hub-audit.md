# 基地与菜单：Round6核对及最小精简

2026-11-01。基线为已发布 d8f40d78 / 代码 eabc0ccd，已验收播放器 GUID `3a68596b7ad04387a7ea36420d8ac12e`。先复用Round4基地/菜单完成审计与Round5图库/导出，不重复核已闭合自定义归档、准备页/信箱/照片旧回调。未运行编译、测试、Unity或Player。

## 已确认并实施

1. **基地待领奖励重复派生。** Vite `hub.home-v3.js:25`先算一次待领数量再供事务展示。Unity旧 `HubScreen.cs:113,117,122,130`在7个导航按钮循环及首页事务条件/文字中重复读取PendingRewards，每次又按未领里程碑重复CollectionPool/GroupBy；当前5个里程碑均未领且首页有奖励时，共10次Pending、60次全卡收藏池派生。该数字只描述这个明确状态的静态调用次数。

   现 `MetaProgress.Collections.CollectionSummary()`一次给出total/progress；HubScreen.Build仅在有未领里程碑，或当前收藏里程碑页确需显示进度/总量时调用一次。全部已领的普通页保持零次收藏池读取；rewards在全部已领时先按领取状态短路，没有实际汇总消费者，其余收藏分类也不使用这份tuple。需要时把结果、一次PendingAch结果与一次pending数量通过局部参数传给导航、首页事务、奖励与里程碑视图。没有跨Build字段或长期缓存。TryClaimCollection仍在正式事务内重新读取即时资格、容量与奖励池，旧展示不能替代提交校验；原子失败与RNG恢复保持。

2. **人物页计算所有人物卡池却仅展示一人。** Vite `hub.personnel.js`当前人物段按所选人物状态构造；Unity旧 `HubCurrentRooms.cs:104`先ClassSummary再First，`MetaProgress.cs:248`为每个职业调用ClassPool，返回的pool字段当前UI完全不用。现直接使用所选人物已有ClassLv/ClassXP/XpForNext/LevelMax查询；招式页仍按需要查询当前人物实际卡池。

   删除旧ClassSummary/ClassSummaryRow，以及已由单次汇总替代的CollectionProgress/MilestoneNeed文本。Assets和当前正式领域项目的检查源码没有剩余调用或反射字符串消费者；旧私有snapshot里的历史副本不改，不用它们维持生产旧API。

3. **升级/孵化成功缺少命名声音。** Vite `base.js:500-502`升级成功发levelup、`:625`孵化成功发eggHatch，`hub.personnel.js`还有一次成功ding。Unity升级/孵化原UI成功路径没有对应音；通用按钮click在基地子页被正式App策略抑制。

   在背包扩建、仓库扩建、伙伴培养成功持久化后各发一次levelup；人物页和库存蛋详情孵化成功各发一次eggHatch。库存蛋成功关闭沿原Done保留回执，关闭其默认ding，避免额外叠音。失败路径不发成功音。声音仍经正式AudioService，不改混音、资源或SaveSystem。对应当前资源键已在CurrentAudioCues.json声明。

## 已核入口与边界

| 路径 | 当前结论 |
| --- | --- |
| 人物外观 | `collection.commands.js:57-62,203-212`现行已知皮肤均可选，Unity HubCatalog/SelectedSkin/TrySelectSkin对应；没有把旧网页存储的未知资格/旧皮肤回退加进新桌面。预览与保存分开，应用仍经基地正式事务。 |
| 研究所 | 当前MIGRATION继续排除研究所第二图/Nest，不把`base-progression.commands`的独立门禁/旧no-slot兼容列成本轮遗漏。普通/精英出发沿既有入口复用。 |
| 收藏/成就/宠物蛋 | 正式领取仍检查已有领取、进度、容量与定义；宠物蛋从未拥有池抽取，I/O失败由Unity事务恢复蛋、币和RNG，不照抄源在事务前推进RNG的实现。收藏池按当前定义稳定ID去重，移除定义的旧收录不充当当前进度。 |
| 首页留言信箱 | 复用Round4 owner/revision、清空/删除确认和失败回执；本轮未确认新的生产遗漏，不追加旧wrapper。 |
| 五档与整档备份入口 | 复用Round3自定义闭包、Round4归档及Round5共用JSON区域的已验路径，本轮不改导出/导入。 |
| 音频设置 | 偏好与Global原子写失败路径继续保留。发现下述独立错误状态边界，已报Root；其公共音频/设置属地未由本作者修改。 |

## 已报Root的音频状态缺口

`AudioService.PlayBgm:183-187`先把请求模式写入_musicMode，若新曲B资源加载失败则return，旧曲A仍有clip。`CurrentSettingsPage.UpdateAudioStatus:179-181`仅以MusicScene非空、MusicAsset为空判加载失败，因此这时会显示“音乐已就绪”并隐藏重试。Vite `settings-audio.js:17-20`明确区分“当前场景加载失败，仍在播放上一首”。

触发是先有有效曲A，再请求确实缺资源的曲B；不是完整当前包正常路径必现。最小方向是由AudioService提供当前请求失败/就绪状态供设置读取，保留A与手动重试，不增加每帧轮询或加载框架。Root持有范围另行收拢，本作者未改这两文件。

## 检查源与待验

`Sdt.Editor.CurrentHubRewardsRound6Checks.Run()/Assertions`要求隔离profile，涵盖一次实际卡库读取/稳定ID去重/同长替换与追加、全部里程碑已领时首页/人物页零provider读取和里程碑页一次实际读取且显示1 / 2、首页/导航/奖励记录同源数量、收藏领取I/O回滚及提交时资格重检、陈旧确认不重复授奖、单人物页卡库查询次数及原lv/xp、五条真实升级/孵化UI路径的失败保全与一次对应成功声。音效检查读正式voice序列/实际clip，未构造另一个声音系统。

检查源尚未执行；并非性能压测，没有FPS、CPU/GPU时间或整帧分配收益结论。冻结原字节/LF指纹见 `hub-freeze.json`，Root统一接线后集中验证。
