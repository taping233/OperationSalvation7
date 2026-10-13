# 基地重做交付与验收

本轮已实施并接入可审阅版本。上一轮被老板否决的主页仅留作历史对照；本轮视觉判断来自实际当前窗口，多次修订后逐页复核，不把代码测试当成审美通过。

## 当前实现

- 主页沿用已认可冬日人物背景，五个轻导航、一个出征主动作；去掉棕色候选背景、巨大宠物、重复人物卡/容量卡。正常入城不铺说明；直入敌腹的参数由独立信息入口展开。
- 仓库完整卡牌上下两排、横向分页、固定数量位置；材料并入标题栏。仓库、招式、角色归档共用卡牌翻阅；点击进入原卡和独立阅读区。木材口粮使用现有卡面查看与商品图。
- 补给、扩建、队员、归档和庭院均从主页进入完整子页。纸灰/墨色/深蓝灰与少量赤陶红用于共用控件；页内依内容分别排版。人物确认和卡牌整备沿用原流程，统一配色；整备由库存/背包两区呈现，取消重复人物大图。
- 阅读区前景层级、标题被旧样式隐藏、两排页脚出窗、卡背绝对定位、外观旧图承托和卡牌关闭焦点已修复。库存双栏布局在展开位置计算之前确定，避免入场使用旧布局坐标。仓库同页重绘保存当前特写动作；异步归档锁住重复操作，迟到结果不更新新档位或其他特写。
- 下雨/锦鲤是独立休憩页，复用本地Canvas源码，返回释放生命周期。来源及MIT许可位于 `game/src/hub/courtyard-vendor/SOURCE.md`。旧审阅副本未删除。

## 资料与比较

参照 [参考资料与落地规则](references-and-redesign.md)，含实际看过的方舟肉鸽主页、仓库、信用商店、腾讯游戏学院视觉拆解、NN/g层级/渐进披露/游戏反馈教程。借鉴层级与动作逻辑；没有复制第三方游戏画面到运行资产。

## 验证

- 115项独立定向用例通过：主体12文件95项见 `accepted-targeted-tests.json`；premium仅基地2项见 `premium-base-tests.json`；库存入场定位续改后51项复核（含18项照片特写生命周期/备注防回归）见 `zoom-placement-tests.json`，去重统计见 `validation-summary.json`。目标源码/测试ESLint通过，32项JS语法/CSS解析检查见 `source-validation.json`。ESM环路和源码边界哨兵通过。
- 另一会话保护的 `openStashCardView` footer原字节SHA256保持 `260e5ae5346df12a4d8edb739605a944d7ac494617ae4de1e2e64d9da6c4c076`；未改 `base-camp.css` 中的 `camp-card-actions`。
- 实页使用Codex内置浏览器、当前1280×720窗口、localhost:5200、档案01。真实输入覆盖主页/各子页/返回，仓库大卡阅读与关闭焦点、物资到培养、招式翻页和第二页大卡、勋章选择/卡背目标定位、外观预览、难度切换、雨势/投喂、人物确认到整备和临时选卡即时计数。正常难度与已装备外观恢复；重载清掉验收用临时整备选择，仓库仍5张、物资仍0，未开始新局。
- 最终主页控制台error列表为空；四枚显示资源图标均载入。主页/仓库/招式的页面scrollHeight与clientHeight一致，主要两排与分页保持可见。
- 稳定图：`home-final.jpg`、`warehouse-final.jpg`、`skills-final.jpg`、`inventory-detail-final.jpg`、`shop-final.jpg`、`personnel-round-three.jpg`、`appearance-preview-final.jpg`、`expansion-final.jpg`、`archive-room-final.jpg`、`archive-character-final.jpg`、`archive-backs-final.jpg`、`archive-story-final.jpg`、`departure-character-final.jpg`、`departure-preparation-final.jpg`、`difficulty-detail-final.jpg`、`rain-final.jpg`、`koi-final.jpg`。

## 边界与未核项

没有在真实档案执行购买/卖出/复原/孵化/培养/领奖/应用外观/确认出发；命令与条件覆盖来自定向测试。没有进行多尺寸、全量测试/全量lint/typecheck/build、提交、推送或发布。一次扩大定向检测中，照相馆两条既有结构断言失败；它们属于活跃的其他会话范围，未改，原始结果在 `targeted-final-tests.json`。只适配premium的基地断言。

审美最终是否符合老板预期仍待老板实看。本记录说明本轮可审阅实现与验证范围，不代表老板已经认可最终成品。历史方案、被否决截图、临时变换脚本和命令输入JSON仅作过程证据，不应作为下一轮实现正本。
