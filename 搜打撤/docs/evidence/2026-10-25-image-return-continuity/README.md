# 图片恢复与返回连续性

2026-10-25，Friday子代理 `image_return_continuity`。实现完成未提交，编辑释放；共享登记由主代理统一维护。

## 改动

- 照相馆缩略图仍沿近视口加载、四个活动任务及两次自动尝试；失败后在目录提供一个手动重新加载入口。
- 收藏/仓库等 `createCollectionArt` 消费者复用 `list-image-recovery.js`，实际图片失败后就地恢复，不刷新页面、不追加缓存参数。单次手动尝试最多并发四张，每张最多等待六秒；再次失败仍可手动重试。控制位于卡牌按钮外，保留原卡片与其他操作。成功移除提示；新来源、卸载、关页使旧完成失效。恢复不抢回用户已转移的焦点。
- 共用返回恢复优先使用明确id，不再被入场/选中class变化阻断；标签、来源data与唯一匹配仍须成立，禁用/隐藏/歧义项不接焦点。
- 老板明确“同一人物保留，换人物重置”后，角色卡池本次选人会话的筛选、页码、选中预览和滚动随同人物往返保留；切换人物清空，换回旧人物也重置。没有修改游戏进度或存档规则。
- 没有改背包业务或重复重做已有背包同分区局部更新；没有修改选卡专属界面、牌效、角色素材、资产清单或研究所。

## 已有验证

- `tests-final.txt`：9份定向测试109项通过，包括图片失败队列/旧完成隔离、照片有限尝试、真实商店帮助返回、设置返回、收藏延迟绘图、人物图片准备、角色卡池同人物保留/换人物重置、contracts和architecture-boundaries。
- 所改生产JS及测试的ESLint分批通过。两份CSS Stylelint无错误；`card-browser.css`原有25px分页箭头触发一条字号复核提示。已有自有路径diff空白检查通过。
- 当前Codex内置浏览器、自然窗口1280×720，真实点击独立开发页的失败模拟、重新加载、分类/页码、滚动与详情返回。正式模块两张图同原地址恢复，提示移除，焦点回卡片；详情返回后为“装备、第4页、滚动148、焦点detail”。`image-failed.png/json`与`recovered-return.png/json`保存截图、来源、图片加载与日志；error/warn为空。
- 隔离页的失败由按钮派发受控error事件，用已加载图片验证画面保留与同地址恢复；它不是实际断网实验，也不是玩家真实存档路径。队列上限、超时、失败重试与旧完成隔离由定向测试覆盖。

## 验证边界与收尾

老板随后明确“不用测试，改完就行”。该要求到达后立即停止所有测试、浏览器操作与追加检查，只补本记录和现行说明。以上结果均为要求到达前已经取得的证据。

角色卡池新策略已有实际控制器的合成输入回归，未从玩家真实入口追加实页；普通背包及所有图片列表未逐一重新验收，不能据共用模块接入声称全游戏通过。未做多尺寸、性能测量、全量、build、提交或推送；没有创建新服务或删除文件。

## 精确文件

- `game/src/ui/visual-resource-recovery.js`、`list-image-recovery.js`、`overlay-return-state.js`、`collection-view-art.js`
- `game/src/hub/game.cardslib.art-warm.js`、`game/src/run/game.run.class-choice.page.js`
- `game/css/visual-resource-recovery.css`、`game/css/card-browser.css`
- `tests/list-image-recovery.test.js`、`photo-art-warm-audit.test.js`、`help-return-lifecycle.test.js`、`departure-class-confirmation.test.js`
- `docs/ui/shared-interface-components.md`、`game/dev/image-return-continuity-review.html`、本证据目录
