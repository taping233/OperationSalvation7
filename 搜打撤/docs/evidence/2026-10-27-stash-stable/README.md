# 入库后保留整理页

老板反馈：点击入库会导致整个界面重构闪烁。

原因：`saveCards`保存后再次调用`renderExtractStash`，原渲染无条件走`UI.showOverlay`，替换整个内容并重新触发页面与卡牌入场。

实现：同一整理回执runId且当前整理页仍有效时，在现有`#exMain`上局部协调DOM，不再调用打开弹层入口。新增`game/src/ui/extraction-stash-update.js`；卡牌行以完整卡牌快照为键保留同版本卡面，更新计数、按钮与索引；变动卡牌才增删。保留原页面、滚动容器与折叠状态，后续更新关闭重复入场动画。首次打开、帮助返回及其他页面切入仍走完整打开。旧处理器随现有渲染版本机制失效，新处理器绑定最新回执；保存失败也沿同一路局部更新恢复按钮。

范围：`game/src/run/game.run.altar.js`、`game/src/ui/extraction-rewards-view.js`、`game/src/ui/extraction-stash-update.js`。入库、容量、持久化与放弃确认规则保留。

按老板此前要求未运行测试、实页或构建，实际无闪烁表现待核验。未提交、推送或启动服务。
