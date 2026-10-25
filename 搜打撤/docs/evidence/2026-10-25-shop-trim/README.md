# 商店详情、暗色转场与问号卡背

详情去除当前/购买后余额及默认入包去向，保留限制与售罄提示。商店短幕从浅白改为 #090b0d，原时长、滑光及淡出沿用。保存锁结束时保留详情刷新后的可用状态，修复复用按钮购买补货至零币后被旧快照重新启用的问题。

老板否决包裹概念，最终接入夸张手绘问号卡背：暗蓝灰底、米白大问号、少量金黄色冲击笔触。货架和详情共用，成交后仍显示真实卡牌。生成源、提示词与SHA见 question-art-request.json / question-art-receipt.json；旧包裹候选保留在 .tmp/imagegen/shop-trim-rejected/，不是运行素材。

卡面接入前：5文件91项定向测试通过（shop-currency-guidance、shop-detail-focus、cinematics-lifecycle、contracts、architecture-boundaries），目标ESLint与商店CSS Stylelint通过。首轮90过1失败，修复保存锁状态后同组91过。

当前Codex内置浏览器、默认窗口、localhost:5200：使用已有隔离商店夹具，真实点击能量饮料核对冗余提示移除，截图 detail.png；自有 shop-dark-transition-review.html 真实点击播放，页面报告背景 rgb(9,11,13)、shop/glide，完成暗色淡出，截图 transition.png。此为静态商店/生产短幕组件复核，未覆盖真实地图进入商店整链。控制台出现夹具 card:martial-melee 缺映射，不宣称零错误。

后续新卡背接入遵循 game-card-art-fast，未运行测试、资产审计、实页或build；生成图已查看。未提交、推送或启动服务，临时内置页已关闭，共享5200未动。
