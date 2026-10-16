# 内部释放漏口补修 R2

## 已证实与修复

独立审查发现：剑荡妖邪选择面板已显示不朽斩，但实际释放仍走原初始攻击，造成4伤并离手；缺转换目标时同一路径仍造成4伤。已先在自有真实BattleSession回归复现，见 `repro-before.log`（两项失败，另11项因定向名称过滤未执行）。

根因：上一批只在玩家play入口应用统一有效卡；selection-flow、draw、发现与回合结束等内部生产者可直接提交raw卡给queueCardExecution。

最小修复：

- inspection的findEffectiveCard支持可选执行候选对象；仍由同一变形解析器处理，保持候选原本的临时规则/费用修饰及原UID元数据。Array.map传入的数字index不能当候选卡，已有回归锁住
- engine只追加两处工厂端口接线，没有改变具名导出或守卫
- exec-play在所有生产者共用的入队边界和实际支付前再次统一有效化，缺目标直接拒绝，内部freeCost标志、原UID、费用计算及回手管线不变
- draw的同步灰烬/抽到即触发分支先查同一有效卡；目标缺失不消失、不施放，原UID留牌库。全手释放和抽后自动释放只计真正受理的动作
- 不必改selection-flow：保留现有选牌/非注能支付资格，只把执行数据统一到共用边界

生产只动inspection、engine、exec-play、draw四文件；未动layers/hash、ui.js、浏览器、服务、build或真实存档。

## 定向证据

修复后独立两例：5伤、同UID回手、释放不扣费；缺目标0伤且UID留手，见 `repro-after.log`。

`draw-path-tests.log`：3文件31项通过，包括完整既有剑效/UID/费用/青龙/支付回归及新增：

- 选择式内部免费释放按显示不朽斩执行、缺模板拒绝
- 直接释放全部初始攻击时每UID一次、免费、各自回手
- 抽牌后直接释放其中武术按5伤结算并免费回手
- 灰烬满9手时同步直释按5伤，原UID仅在弃牌堆一份；不突破现有手牌上限
- 普通抽牌与灰烬直释缺模板均0伤、无扣费、原UID留牌库
- 既有BC-02同步灰烬直释时序及牌堆UID回归仍通过

静态语法427、类型8配置、4生产+2测试定向lint通过，日志在本目录。

## 范围与增量

`source-change.patch`为R1最终状态到R2最终状态的完整自有增量，含新增7个真实回归与单位契约补充；逐文件before/after在 `source-change-sha256.json`。`before/`保存R2开工前生产备份；初次复现已先加入测试，故session测试真正R1基准另从R1交付patch重建为 `before-r1-session.test.js`，并验证SHA与R1交付记录一致。

源码已稳定并释放编辑。仓库依赖计划判为full门，见 `closure-plan.json`。源树直接Vitest全量于23:43 UTC启动，限制4 workers，未走pretest、未build；父级随后指明应在R7独立副本履行full门，正在等已启动运行自然结束，不追加源树全量，不将此运行替代R7独立验收。终态另记。

## 最终补审与收官

独审进一步证实“玩家先提交不朽斩有效副本，等待实际支付时改为缺模板”仍能绕过末端重查，另发现极速符文预检原初始攻击1费、实际有效青龙2费，会在只有1能量时错误施放。父级追加授权后完成：

- inspection工厂内部WeakMap显式关联有效副本与原UID实时来源；调用者传入的自定义候选保持其原cost/rules。入队和支付前均fresh resolve当前override→变换
- hosted正规化在同一查询后处理，其新clone也携带相同的仅内存来源；不新增卡对象或存档字段。合法serialize只保存重开检查点、旧格式恢复清交互，因此不存在半结算副本跨读档丢WeakMap来源的受支持恢复路径
- 捕获副本的不朽→青龙/取消/非初始override/缺模板都回归；自定义初始同名候选恢复后仍为其自定义cost/rules；Array.map第二index与第三array参数不会误作执行候选/正规化函数
- 极速入口按有效卡预检；真正非免费支付前不足能量拒绝，不再用钳0支付不足差额；freeCost在0能量仍正常
- 源全量发现battle-drag-reference的旧core mock缺新查询端口；按父批准只增加同fixture的findEffectiveCard，原17断言保留

最终生产范围为此前四文件加battle.enemy-phase.js共五个，另2个自有既有测试扩充及1个旧mock更新；selection-flow、layers/hash、ui.js未改。

最终 `final-targeted.log`：33文件390项全部通过。覆盖原15文件与直接执行/选卡/发现/回合结束/符文/架构/schema/录制/视图闭包。`syntax-final.log`语法427、`typecheck-final.log`8类型配置、`lint-final.log`本批8文件均通过。

源全量已自然结束：`full-vitest.log` 为489文件488过1失败，测试4645过17失败2既有跳过；17失败全部为上述拖拽旧mock缺口。该结果严格限于竞态/极速补修前版本，不可报告为最终全量通过；当时scope记录保留在 `full-vitest-earlier-scope-sha256.json`。后补版只跑上述定向闭包，R7由父级独立冻结副本履行full门。

最终完整R1→R2 delta与8文件SHA已重建并逐项复核，见 `source-change.patch`、`source-change-sha256.json`。没有改任何资产消费者指纹；layers仍7041764eea55ce1e147afb10fc2e494e43ab2c493617d0cf88b6bdb185770575，ui.js仍8a1eb7d22e5fea5bb874aec022f240c090e550da8192093f5d42ab64c7fb642d。当前源码、测试与证据编辑全部释放；未残留源全量进程，不再在源树启动全量。

最后经父级批准的小收口：当未变形原raw对象已被确认是liveUid来源时，同样仅在WeakMap登记该来源，使排队期间新增的非初始override能在支付前重读。显式custom对象不登记成live来源，不改卡字段。新增工厂对照及两个真实队列对照：原raw→青龙override用青龙效果/新费用；显式初始同名custom仍按自定义固定2伤/2费，不被UID覆盖吞掉。最终补验 `final-raw-provenance-targeted.log` 为7文件91项全部通过；语法427、类型8配置与变更3文件lint再次通过。之前33文件390项未包含此最后3行与新增3例，不混称完整最终全量。R7独立验收仍待父级。

最终inspection SHA为5ede79e3981ab8c83ffe9408e3c736a1123c4213c82ecd1e19afdb10ee70eac2；其余四生产SHA未再变。完整source-change.patch/逐项SHA已同步并核实。现已再次停止全部仓库写入、释放所有本批文件，不扩展其他机制范围。
