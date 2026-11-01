# 战斗片独立只读审查

结论：本轮指定五个生产文件中未发现需退回的确证缺陷。审查时五文件 SHA 与 `battle-freeze.json` 一致。没有编辑生产/测试文件，没有编译、运行测试或启动 Unity。

## 暂停、续接和结算

- `StructuredRules.cs:66–67` 将 rulePick 纳入全部输入等待，同时保留独立 RuleSelectionPending。新卡/装备/技能/批次因此不能抢占目标，但 `SelectRuleTarget`（`BattleTargetSelections.cs:50–55`）不再因自己的 rulePick 被等待谓词拒绝；它仍验证 over/busy、其它选择、敌方阶段、battle token、selectionId 和存活目标。
- 批次保留输入 UID 数组、index/count/max。子卡交互暂停在原 continuationBase 插入后续；child 完成后的 eachDraw 再查一次输入等待，因此 onDraw.choice 完成后才执行下一 UID（`StructuredRules.cs:760–813`）。按 LIFO 的既有 continuation 列表，子卡剩余效果先于批次后续，批次后续先于外层剩余操作/完成段。新 helper 保存 castContext 并 finally 恢复，生成批次也使用同一路径；没有增加随机抽签或改变抽牌次数。
- `SelectRuleTarget` 在二段动作后先 ResolveRuleOutcome 再 ResumeRules。最后敌人死亡时 Finish 先清队列，下一 UID 不会被恢复；取消只丢弃当前二段动作，再判断终局并恢复原批次（`BattleSession.cs:1286–1293`）。普通拿牌取消保持原有仅清目标的行为；LockPendingTarget 在已有结构化输入时拒绝覆盖。
- 原卡的回手与 CompleteRuleCast/计数保持在原完成段立即执行，没有延迟到第二次点敌人；Unity 的既有段内顺序为回手→BeginDeferredTarget→CompleteRuleCast，本轮未改。现行 Vite `battle.exec-play.domain.js:422–452` 的 beginDartStrike 同样先于 completed-card 记录，支持本片保留“二段待选时原卡已计数”的时点。父卡有真实子输入时仍通过原 continuation 等待，未把自动子卡顺序改成再次支付或换 UID。
- `Finish`（`BattleSession.cs:1243–1280`）先构造结果账本，再清各牌区、续接和所有待选引用，之后设置 over 并通知正式结果处理。ExecPlay 主效果若已终局直接返回，ResumeRules 也有 over 停止条件，避免逃跑/胜利/失败后再补抽或新建交互。永久来源与临时 spentCards 的原结果语义保持。

## 提示身份与死灵反馈

- 提示签名增加 battle token、kind、selectionId（`BattlePresentation.cs:327`）；取消按钮捕获该次快照，验证当前 token、未终局及相同 pending UID/kind/selectionId（338–345）。GetSnapshot 使用 CopyPendingTarget，因此捕获的目标不是随后被原地改写的当前目标。上一二段按钮无法清除下一二段或新场目标。
- 死灵保留 drawPile 尾部最多两张到 grave 的顺序，不进入 played/consumed、不删除永久拥有卡、不增加 RNG。日志的数量来自实际 count，最终承伤倍率来自更新后的状态；同批实际撕到至少一张才发送一次 burn，零张只记录日志（`CurrentBossMechanics.cs:18–45`）。与 Vite `battle.boss-mechanics.js:40–48` 和 `battle.anim.view.js:136–142` 的事实/合并声音一致。牌库 UID 没有真实旧手牌矩形，不补造同名手牌消融。

## 验收边界

已只读核对 `Round3Checks.cs` 的二段目标、取消、终局、eachDraw→onDraw.choice、生成批次与死灵方法级断言，以及 `battle.md` 的正式原生入口说明；这些检查尚由 Root 集中执行，本审查不记录运行通过。

本片解决自动释放/结构化 RunRuleOps 的等待。文档已明确敌方回合外层仍有同步调度；未依据假设卡组把该边界扩写为全回合状态机，也不据本审查宣称任意嵌套时点已全部对齐。实际按钮射线、自然牌序、跨职业获得、九回合画面和设备听感均不由静态审查证明。

| 文件 | SHA256 |
| --- | --- |
| StructuredRules.cs | e053ecfa9059821e58bda3d211137ea4bfddc69a49a5f069d22a24cacdc25a95 |
| BattleTargetSelections.cs | 3d70f52edd656820ed399768bf1ac8833f87bc60451b634c3eaa8291069a8ea9 |
| BattleSession.cs | cab00756172ed2b0e736569388861a44d515fa860a995bf5f8bb3fad658e2702 |
| CurrentBossMechanics.cs | 100c5582273fd7a1bf3927c2acae35fac774e5712984d633f52398c1a4f33a67 |
| BattlePresentation.cs | 9e221aef2586afc14b844dba1483916bc25a130724ccb48871afa5c0a4a8b92d |
