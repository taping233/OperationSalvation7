# 当前单卡扫描消费者修复（生产已冻结，原生由Root集中验证）

五组行为按现行Web源入口迁入StructuredRules与独有partial：heal.upTo补至阈值，满月形态只升上限，curse.extend仅直接延长已有计时状态且不广播新施加事件，整卡replay检查主效果后的实际手牌并排除keepInHand，随机诅咒共享一次generation流抽种结果并排除atkDown。energyCap的单卡策略直接迁自现行card-energy-policy.js；没有改数据字段。

随机sort保留当前源的V8行为：自然run检测与反转后做二分插入。Node v24.13.0实际Array.sort的10000个seed比较器参数与调用数均和算法重现完全相同；生产C#输出顺序、最终RNG状态的10000向量聚合SHA相同，见v8-sort-vectors.json、rng-result.txt。这是V8的现行实现行为，JavaScript规范不保证随机比较器在其他引擎或未来版本具有相同调用序列。

验证：独立生产Core快照编译0错误；129单卡扫描128同源，6张目标卡原有差异全部清零，剩余是既知discoverPlus快照投影差异。39个源进程边界中38完全同源，全部39个RNG状态同源，覆盖治疗阈值上下/0/生命封顶/禁疗、上限与当前能量、freeze负/零/正值、6个固定seed、抽牌后非末手、牌库抽空、常留牌、主效果清空原本非末手与异步选择后续抽牌。原1814/289/167/47回归全通过，各结果只写本目录。

明确缺口：人工拼接replay+handSelect(play)+无抽牌时，源queueHandSelect后继续同步主效果并在实际选择前判断末手；Core既有选择会暂停后续操作，恢复后判断末手，因此源2甲/Core4甲。现行291卡无replay与handSelect/choice/acquire组合；Root明确将其保留为schema组合边界，不扩大冻结调度。39边界结果如实保留一个已知差异，不计全通过。异步后抽牌场景同源。

现行291卡没有self curse.extend。Core既有RuleTargets缺少self诅咒路由，作为不可达组合缺口记录，本轮保持冻结targets入口。预览搜索未发现本次五组的独立状态消费者；现有PreviewDamage不受影响。

源和完整生产Core SHA见receipt.json。未启动Unity/CUA/浏览器或前台服务，未提交、删除；原生实际交互和渲染待Root集中验收。prepare.py是一次性私有草稿，勿重跑覆盖后续生产修改。
