# 骷髅王剑统一有效卡面修复

状态：2026-10-16（项目本地日）完成未提交，生产与测试编辑释放。父级在 R6 正式解冻后授权实施；R6 不包含本批，待父级资产消费者指纹审查、新独立整合与真实浏览器验收。

## 已完成

- 保留现有普通战模式门；开战装备仍需在 BOSS 战编入本场牌库才自动生效
- 库存/远征背包大图的共用装饰器与战斗牌袋规则详情，显示该自动生效条件。没有改原始卡库描述、展示文本对照表或存档
- 新增统一 `findEffectiveCard` 查询：原实例/每UID覆盖优先，当前卡名仍为初始攻击或杀时再应用最近登记的变换；目标卡的全部面板数据、规则描述和图面身份一起生效
- 有效卡查询保留原entry的uid/baseUid/归属信息；原findCard保留给底层实例、存档、费用交换和非注能支付，不将查询副本写回原卡或cardOverrides
- 手牌分组、名字、整张卡面、详情、ARIA、拖拽内部卡、指向说明、牌库/墓地卡面都走同一查询
- 注能入口的可用材料数、点选、确认、最终支付前重验都走同一 `infusionFuelReason`；非法材料拒绝时不扣费、不移牌，已选材料变形后可以取消并重新选
- 转换目标模板缺失时fail-closed：显示原卡并提供目标缺失原因，拒绝出牌与注能材料；不静默回退为普通攻击
- 结算依旧用原UID，保留原来的目标模板费用与按原UID记录的免能量/费用优先级、不朽斩回手、后登记青龙/骷髅规则覆盖顺序
- 非注能手牌支付仍保留既有原始卡名资格；选择面板只转换展示，不因卡面名称改变而丢失原本可支付的选项。真实雷嗔支付已回归

生产涉及批准的10个既有文件，加1个纯提示模块；新增3个专测。既有engine门面守卫只增加批准的两个名字，精确数量68→70，其余断言保留。ui.js、普通战装备门、卡库、真实存档、资产守卫均未修改。

## 验证

最终：15文件159项通过，见 `repair-final-targeted.log`。

新增专测：

- `tests/battle-effective-card.test.js`：3项，原始/有效视图分离、原UID/baseUid、临时牌、覆盖优先级/免能量、缺模板回退可见但不可用
- `tests/card-battle-start-explanation.test.js`：2项，文本/结构化开战装备说明、普通牌不误加提示、原描述不变、库存/背包大图重复装饰幂等
- `tests/skull-sword-effective-session.test.js`：11项，真实BattleSession与真实视图/命令，包括自动编入、手动未编入、4张原初始+1张临时初始逐UID变形，卡面/详情/ARIA/指向/拖拽卡同源，同UID连打两次回手，禁注能的计数/选择/确认/队列末端，缺模板不扣费、原UID免能量/覆盖/baseUid、真实青龙化身→再穿戴剑、普通战和跨战清理，以及雷嗔非注能支付资格不变

近邻专测：battle-hand-inspector、battle-card-inspection、n1-infuse-uid-toggle、hero-cards、boss-equip-select、battle-engine-facade、battle-architecture、battle-modules、e6-card-rules-execution、bag-page-lifecycle-review、expedition-battle-presentation、tt7-hand-payment。

静态：语法427项目文件通过；8个类型配置通过；本批15文件定向ESLint通过；docs检查461链接通过。日志分别在 `syntax.log`、`typecheck.log`、`lint.log`、`docs-check.log`。

队列竞态的首次测试未设置等待边界，而真实队列会同步开始执行，因此先执行后变形；这是夹具时序错误，保留在 `repair-neighbor-tests.log`。最终测试明确用真实renderer的presentation Promise挡住支付前边界，变形后放行，证实末端支付屏障拒绝。未修改队列实现、没有放宽断言。

## 完整增量与资产审查

`source-change.patch` 是本批解冻前备份到最终文件的完整自有delta，包含新模块与专测，不混入其他任务此前改动。原始备份在 `before/`，逐文件SHA256在 `source-change-sha256.json`。

唯一变化的opaque consumer：

- battle.layers.js：9196a64ce8f64e75620fffbcddf01c5fc1effaeda763551c1859841d09bfb475 → 7041764eea55ce1e147afb10fc2e494e43ab2c493617d0cf88b6bdb185770575
- ui.js未改，仍为8a1eb7d22e5fea5bb874aec022f240c090e550da8192093f5d42ab64c7fb642d

本批没有增加手写图片路径或更改资产来源；卡面查询使用现有目标模板identity。父级仍须审完整delta后更新layers单条指纹，不能把本记录视作自动更新批准。

## 未核验

未运行全量、build或浏览器；没有启动/重启服务或操作真实存档。jsdom的拖拽检查证明startAim拿到的UID/完整有效卡数据，不等于真实鼠标拖拽、图像加载和最终像素已验收。需要父级实际BOSS编入剑后检查不朽斩图面、连打回手、禁注能灰态与库存大图说明，并将本批纳入新的独立整合验收。保守伤害预览仍沿用现有“变形后结算无法精算”安全降级，本批未扩展预览求解范围。
