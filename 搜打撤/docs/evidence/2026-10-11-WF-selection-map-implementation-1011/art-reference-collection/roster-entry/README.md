# 选人、整备、入城与事件：实际素材索引

2026-10-11。本域收录5份有用原图，均已逐张 `view_image`：新增2份，复用3份。只研究，不接入游戏、不生图、不测试；静图不能证明继续对局的过场动效。完整尺寸、原始字节SHA256、来源、获取方式、对应控件与新旧标记见 [assets.json](assets.json)。

| 编号 / 原图 | 尺寸与时间 | 具体对应本项目 | 来源与边界 |
|---|---|---|---|
| RE01 [星铁队伍选人](../../../2026-10-11-selection-map-plan/references/HSR-team-selection.png) | 1920×1080；版本/日期未标，旧集复用 | 头像选中亮边、当前人物、Details与Add分开；对应五人候选与查看/确认 | [实机截图库](https://interfaceingame.com/screenshots/honkai-star-rail-team-selection/)，不是官方独立人物源 |
| RE02 [绝区零VR训练敌人编排](zzz-custom-preparation-original.png) | 1546×857；2024-07-05，新增原上传 | 仅作布局辅助：左空槽、右敌人候选、底部固定电量成本与Save Plan确认；不作实际携带、容量或资源回执证据 | [VR Gameplay Introduction教学](https://www.hoyolab.com/article/30636268)，作者Miyabi’s sword为社区用户。候选为Tyrfing/Alpeca/Hoplital等敌人，属于训练自定义计划，非玩家出征携带或仓库；不是官方独立UI源 |
| RE03 [STS2 Neow开局](../../entry-events/references/sts2-neow-pcgamer.jpg) | 1920×1080；v0.98.2/2026-03-09，旧集复用 | 完整页主对象/标题/短对白、顶部持续状态、下方集中奖励；对应整页入城补给 | [PC Gamer实机文章](https://www.pcgamer.com/games/roguelike/slay-the-spire-2-early-access-features/)，Mega Crit版权截图；不复制Neow或三选一制度 |
| RE04 [STS2 Ranwid事件](../../entry-events/references/sts2-event-pcgamer.jpg) | 1920×1080；v0.98.0/2026-03-05，旧集复用 | 左侧人物、右侧分段叙事、每项黄色动作/白色后果同承托；对应事件叙事与真实选项分层 | 同PC Gamer实机来源；完整截图，不是透明事件人物/背景源 |
| RE05 [方舟IS7事件整页](../map-navigation/source/is7-selected-route-a.jpg) | 1080×485；URL日期2026-07-20，根本轮新增跨域复用 | 中央树、左下“未涉足之树”完整叙事；右侧探索内部/源头/休息三项，亮动作条与暗后果分开；顶部资源/底部收藏队伍持续 | [TapTap玩家教学帖](https://www.taptap.cn/moment/828059228320039824)，修改07/19；不是独立UI源。文件名selected-route历史命名不代表地图性质，实际为多选项事件 |

RE02新增的是训练敌人编排的布局对照：空编排槽、敌人候选和固定确认区域分工清楚。其底部电量成本不是携带容量或资源回执，不能跨场景作为本项目整备业务证据。原图1,431,298B超过1MB，已由本目录 `.gitignore` 精确忽略；原字节路径、SHA和下载URL仍在manifest。没有放大、裁件或截图再编码。

RE05补上比旧STS2事件更接近本轮二游目标的2026年IS7实机：场景中事件对象与叙事相邻，右侧操作区不复制左下整段叙事。原文件已由根保存，本域只跨目录引用；没有截图裁件、没有复制后当官方UI原件。

另实际看过三张未选为主参考的图：`zzz-agent-info.webp`与`zzz-equipment-selection.webp`只有642px宽，`zzz-combat-plan-original.png`虽高清但为分类入口；用途与清晰度限制列在manifest的notPrimary，不把它们补算为高清整备证据。低清角色图只对应身份/属性/成长入口分工，来源是[Piyo指南](https://www.icy-veins.com/zenless-zone-zero/agent-leveling)，图像更新记录2024-10-04，不作为当前2026版本。HoYoLAB公共接口响应保存在 `hoyolab-source.json`，可以核对社区作者身份和原上传URL。

缺口明确保留：没有取得已验证的2026当前版星铁/绝区零选人UI，没有取得官方公开的独立可编辑UI面板或透明事件人物源；继续对局city-cut没有新的真实连续帧/时长采样。本次资料足够比较静态信息层级，不能据此新增动态结论。旧1999未采用设计稿和宣传海报没有重收为实机样板，所有远端图仅研究。
