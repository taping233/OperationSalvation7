# 基地玻璃材质与文字精简

已实现：主面板改成半透明冷色渐变、22px背景模糊、细边高光；内部控件使用浅渐变，减少叠放的纯色块。覆盖首页、人物、后勤、交易所、收藏室、建设和庭院。

按截图移除普通仓库的整条二级标题（含资源、容量及跳转链接）和常规说明入口；待复原入口移入现有仓库工具栏，复原清空提示保留。招式页移除类型、搜索及归档状态筛选，直接展示所选人物的完整卡池，保留翻页、归档标记与卡牌放大。精简首页“远征准备”、人物培养重复提示和首页整备提示段落。培养卡牌按钮悬停过渡改为520ms，底线展开620ms。

先前验证：七页真实点击、玻璃背景与blur计算值取证见browser.json；仓库和招式精简后的DOM见warehouse-trimmed.txt、pool-trimmed.txt；实页已完成招式第二页与卡牌放大，见pool-page2.txt、pool-detail.txt。9份59项定向测试、定向ESLint、类型629/629通过；七份Stylelint通过。它们仅证明当时的输入和范围，不覆盖后续修改。

老板明确“不用验证”后，未再运行任何检查、测试或页面核验。人物页面继承clip-path阻断背景模糊的问题已按实测来源取消；此修复仅完成此前的Stylelint，尚未复看实页。最后的培养按钮悬停放慢与首页提示删除均未验证。home.png/personnel.png为最后两次修订之前的截图；warehouse.png/pool.png为对应删栏后的截图。

源文件：game/css/base-{framework-v7,home-v7,personnel-v12,logistics-trade-v12,archive-facilities-v12,courtyard-v3,collection-v4}.css；game/src/hub/hub.{warehouse,personnel,home-v3}.js；tests/{base-subpage-header-readability,card-browser-state,fresh-run-onboarding-copy}.test.js；docs/card-browser-rendering.md。修改前副本在.tmp/base-glass-1025/before/；共享既有未提交内容保留，无构建、提交、推送或跨对话消息。

## 后续：头像位置统一

培养和招式共用右列头像行、108px按钮宽度与10px间距；移除base-personnel-v12.css中招式专属头像行/尺寸覆盖及feedback-oct12.css中招式均分列覆盖。修改前副本.tmp/base-avatar-align-1025/before/。按老板持续要求未验证，未提交。

## 后续：招式翻页按钮

招式页独立设置64×48px翻页按钮、明亮箭头与常驻玻璃渐变/边框，保留悬停、键盘焦点及禁用态，页码提高对比。仅修改base-personnel-v12.css，覆盖旧透明底样式；修改前副本.tmp/personnel-paging-visible-1025/before.css。按老板持续要求未验证，未提交。
