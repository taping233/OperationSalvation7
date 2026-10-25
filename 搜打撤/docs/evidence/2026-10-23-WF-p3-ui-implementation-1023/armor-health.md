# 生命、背包公共布局与护甲核查

2026-10-24，本分片按当前源码及已有实页截图核对。此次仅新增本记录，没有修改产品源码或测试，没有操作浏览器。现阶段确定两个公共界面交付阻碍；卡片分片已经取得的选择、领奖状态和减少动态结果不重复列为问题。

| 阻碍 | 当前证据与精确入口 | 最小处理边界 |
| --- | --- | --- |
| 背包内容未给公共顶栏保留空间 | [背包最终截图](bag-reduced-static-final.jpg)右上占格／卡牌数与金币／攻击资源挤在同一区域，左上公共退出／静音也落入背包分区栏。`game/src/ui/run-top-bar.js:144–148`将房间顶栏移入overlay；`game/src/ui/run-top-bar.css:2–5`将其绝对定位在顶部、高104px；`game/css/expedition-inventory.css:23–25`仍以28px开始排背包shell，`:56–58`标题区域没有该顶栏保留区。现行`room-footer.css:3`只覆盖奖励／商店／火堆，不含背包。 | 公共顶栏统一提供高度／内容起点约束，背包shell消费一次该约束；整组分区栏、标题、容量、筛选与网格进入同一内容区，不单独平移容量数字。保留五列、滚动和既有卡片命中／动画责任。对应原F01及C07的集成边界；不是新的卡片算法。 |
| 同一生命宿主仍受页面条件皮肤与两个格式写入者控制 | [领奖截图](screens/reward-focus.jpg)、[背包截图](bag-reduced-static-final.jpg)、[战斗截图](status-16-99-compact-final.jpg)显示同一顶部生命信息的外框／数字比例不同。`game/css/page-expedition-hud.css:210–226`只在非opaque、非战斗时提供生命子层外观；其他页面退回`base.css:178–190`与旧skin。`game/src/ui/run-top-bar.css:18`目前统一的是外宿主。`game/src/ui/run-top-bar.js:129–132`用`hpText.textContent`写纯数字；`game/src/ui/hud.js:98–107`按数值缓存用带`.hp-rest`的innerHTML写同一节点，最后写入者改变内部结构。 | 公共生命组件独占宿主及子层的外观与文本格式，保留单一数值更新入口；地图／背包／领奖／战斗共享同一生命DOM语义。旧条件皮肤退出该公共宿主责任，不能继续叠局部覆盖。主代理负责实施与实页。对应原F01，双减少动态出口仍沿F05。 |

覆盖边界：C01发现的选择／Tab焦点分离、C05可领与已领状态、C07卡片transform所有权以及aura双减少动态出口已有各自证据，未发现新的确定冲突。本核查不把容量不足等尚未操作的场景当成已存在的产品故障，也不把原计划的条件优化自动升级为交付阻碍。

## 护甲铺满疑点的证伪

当前`game/src/battle/view/battle.layers.js:690–697`分别创建生命数字`span`与护甲`b.sts-hp-armor`，随后追加到同一生命条。`game/css/battle-stage.css:63`的`.sts-hp>span{inset:0}`和`game/css/overlays.css:19`的`.bt-hpwrap span`都不匹配实际护甲节点。护甲规则`:141`设置left/top/bottom，right保持初始auto；没有查到另一条命中该`b`并将right设为0的活规则。因此“护甲span继承right:0铺满生命条”的前提不符合当前源码，本轮未追加right:auto或改变生命数字选择器。

运行`vitest run tests/battle-unit-metadata.test.js -t 'updates armor visibility' --reporter=dot`：1项通过、8项跳过，02:05:21开始。该用例通过真实`mountUnitLayer/updateUnits`验证护甲0→7、hidden、文字和ARIA，生命27/80及人物身份保持正确；它不测真实像素宽度。真实护甲是否有其他布局问题留给主代理当前窗口实页，不用这条测试替代。

核查基线SHA256（产品与测试未写入）：

| 文件 | SHA256 |
| --- | --- |
| `game/css/battle-stage.css` | `33d2b37f37486cb73824c41e7160b79b80373bacc24ed9b8a7f5310debc31102` |
| `game/src/battle/view/battle.layers.js` | `db2094cd70f4608819f5c335601f0bf59db40797acd2d936f6b45589ec19640c` |
| `tests/battle-unit-metadata.test.js` | `9435c053a9ab960b2f02332451487ceb84f6b51cf78a9be3f40fef0e436d22cf` |

## 真实发甲样本

主代理可在现有开发控制台“指定卡牌”搜索 **包扎**（`tt3-bandage`）发到当前战斗。`game/src/cards/cards.data.js:402`的现行覆盖为1费、自身目标、回复3生命并获得3护甲；`builtin-card-field-defaults.js:31`也保持heal3/armor3。即使现有2能量，不必补能量或修改牌效。开发入口为`game/src/run/game.run.dev.js:183–185`；战斗内发卡按原说明为临时卡。此次仅提供样本，没有执行发卡或写存档。
