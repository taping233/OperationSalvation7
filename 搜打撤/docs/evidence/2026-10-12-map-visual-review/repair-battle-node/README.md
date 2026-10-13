# 战斗/商店/奖励视觉返修

2026-10-12，进行中；主代理独占IAB并提供当前窗口图片，子代理不启动服务或浏览器。已授权本轮视觉闭环，不运行全量tests/build，不改冻结图与规则。

第一片源码可确定修复：winter.css仍给discover内bt-hand限制58vh，而新battle-decision-content已有独立滚动，导致双层高度边界；仅新附加壳内解除卡阵max-height并让其overflowvisible，滚动仍由content负责。编组已编入文字原bottom5压在完整卡底部，改为候选按钮预留34px外部状态带，状态放卡面之外。对应参考B-N02牌库完整卡正文与B-N06选牌当前卡/候选分工，不冒称它们是编组规则参考。

summary源码位置确实在header后、content外；当前未找到直接display:none覆盖，尚待当前窗口。shop购买三段源码grid仍在；回执不重复名字分支仍在。待主代理提供实际battle/shop/reward矩形与截图后定位剩余缺陷。当前仅源读取定位和展示CSS编辑，未宣称实页通过。

主窗口05-shop-review.png：商人/柜台、九货位5/4、分层价签和离开明确可见，详情可返回原货位；第二排史诗“一捆木材”底框盖住持有数。源码定性：并非全局scale，rose/frames.css让卡::before按各稀有度--rose-top/right/bottom/left负inset向外扩，史诗底扩10.66176cqw；shop-preview未为伪元素外扩留高，正常文档流只计卡盒。仅商店查看按钮新增18%上/16%下留白、flex不收缩，持有数保独立行。宽度和游戏缩放不改、框SVG和冻结图不动；待根同货位复看。

07-battle-settings-compact.png反馈短设置仍满页：已定性true模式UI.showOverlay继续沿_roomActive打card.room，overlays.css的#overlay.room-view .card.room三class规则高于原compact两class，width100%/height100%仍赢；房间ovBody也保限宽居中。仅room中data-decision-kind=settings+compact解除外壳满页width/height/minheight/flex与ovBody固定继承，设置整卡800设计px居中、四行各58px占满内容宽，不再以230px列缩小代替短壳。其他支付/编组/牌库及主battle未改。待根复看。

09-shop-frame-spacing.png回归：统一18%/16%留白让普通卡两排价签越出首屏。已替换有效值为局部货架卡宽140设计px/字号9px（覆盖卡片em最小高度，实际仍以272/406比例），普通14/10px上下框余量，稀有16/13、史诗20/16、传说23/19、棱彩26/22px，均按rose真实cqw外扩140px换算留位；货位行间距10px、价格38px，第二排与第一排共用相同5/4模板。冻结卡框/商店图/globalzoom未改，保固定离开。待根实际首屏两排价签/史诗持有复看，未把滚动当完成。

10-large-chest-reward.png已view_image：三卡居中与高稀有对象焦点成立，史诗迷之匣顶框侵入上方品质字、底框覆盖估值2。保190普通/216高稀有卡尺寸不缩：按rose外扩换算，普通top54/bottom48，稀有58/52，史诗66/60，传说76/65，棱彩80/70设计px分别预留“上字行+顶框+间距”与“下估值行+底框+间距”；字样line-height固定1.25，估值层次明确。只rewardCSS，箱帧/规则/卡面与其他页面未改；待根当前真实稀有样本复看，不能继承新的随机开箱为同一批结果。

先前局部失败点复看证据：08-settings-fixed.png主窗口确认设置634.6×393.5px居中、四行可读、返回居中且成功回战斗；11-rewards-fixed.png真实史诗金疮药品质/估值脱离外框；12-shop-fixed.png真实含史诗花鸩，两排九商品所有价签可见。以上只是对应失败点复看，**不等于商店美术批准**。

老板随后明确否定商店整体UI，重新开启商店改造。唯一参照为art-reference-collection/shop-reward-bag/is7-source-2.jpg（实际IS7双状态拼图，带攻略大字，已亲眼view_image），对照12-shop-fixed.png也view_image。具体差异：旧页每货位蓝灰大购买块/持有行拆散，左侧收购大方块、页头与页脚承托过重，离开小圆钮；参考商品底部中性绿黑透明价签/金额右大字、左身份/右交易与离开分工。

实际实施仅game.run.shop.js展示markup和expedition-shop.css：加入shop-is7-reference展示作用域；持有与购买整合连续shop-offer底条，价格右对齐29px、差币11px小字，不增加确认或改handler；左商人说明去大底保文字/边线，收购与整理合并薄横向服务区，右离开208×62px灰直角控件；资源变右上单排、页头去大底；九货位5/4、140px卡面及按rose等级外扩留位保留，批准背景/人物/框素材不动。独立新作用域特异性覆盖旧蓝灰规则，不改收购页面其他壳。需要主窗口复看整体美术，不能以不裁切宣称通过。未浏览器、测试、验证/build或新服务。

20-shop-source-layout.png实际view_image，与唯一IS7原图同看：新布局连续绿黑交易条/左薄服务/右宽离开已经出现；仍明显不像的是价格字样在左、金额尺寸偏弱（参考价格字样在金额正上方右侧）、差币与左说明/服务小字太小。只改这组比例：价格18px置右上、金额42px置右下，差币15px置左下，持有15px并上留8px；价签58px高，左说明22px、服务22/16px、整理20px、footer18px。参考两排间本就紧凑约12px/200px货位尺度，新页约20px/170px并不更挤，因此本轮不另加大行间距、不缩卡/改两排网格。增加字级后的真实首屏预算仍待根复看。自然窗口1523×956 DPR1.25，1280×720仅输出图缩放，未当第二viewport。

root追加亲看参考纠正：关键为完整深黑透明货位及上缘商品名，非单独绿价签。已改展示markup每buy货位加入真实shop-item-title（包括神秘货箱；初始攻击余量置名条小字），20px左对齐浅白单行。CSS整货位深黑透明/底部灰青克制梯度，shop-offer背景/边线清除；隐藏重复持有与价格标签，右下数字作为主信息，差币仅一行。完整140卡面/框留位及5/4保持，不新增确认/业务。仅shop两文件，待根实页复看。

老板自然胜利03-natural-battle-result.png明确否定奖励整体。已搜索并实际view取得唯一主参考reward-reference/zzz-story-obtain.jpg（1280×745含窗口标题栏，2025-06-21玩家博客主线完成实页，来源/原字节SHA见source.json；文内描述1.7/2.0，图内无版本标，不称现行版）。实际观察：跨宽深灰奖励带、标题/完成标居中、对象与数量同列、主确认居中，背景退让。非商店布局混造。

实际只修改chests.js render/showLoot展示body及奖励CSS：reward-zzz作用域把蓝灰边框大盒改全宽中性深灰带；标题居中/来源小标，金币从右上角变为真实对象收益列，容量与本战详情降到对象下，主领取与次退出居中。单卡208px/高品质238px，多卡190px/高品质216px份额，卡框品质/估值留位保留；高品质只对象焦点，不整页光。数据/随机/保底/领取消散/容量模拟/handler/markChestTier不改，其他会话rose frames不碰。未操作浏览器/测试/服务/build。等待根新自然奖励实页审阅后返修，不以无裁切等同美术通过。
