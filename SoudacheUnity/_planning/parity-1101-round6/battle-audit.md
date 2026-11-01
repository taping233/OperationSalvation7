# Round6：献祭与发现选择

状态：2026-11-01，生产及回归源已冻结，等待Root集中验证；本代理未编译、运行测试或启动Unity。最终文件字节与冻结状态见 `battle-freeze.json`。统一执行、当前窗口截图和最终结论由Root登记，旧轮绿灯不代表本轮新分支已验。

## 本轮闭包与依据

1. **献祭是逐实体的真实卡牌选择。** Source `game/src/run/game.run.altar.js:647–705` 以UID选择卡牌、保留原位候选，并由原altar/emergency入口处理取消。原Unity只有卡名、每次选取重建树且取消入口不分来源。同名不同费用/描述的实体无法辨认，覆盖返回及旧按钮也缺完整归属。
2. **已支付发现可以结束当前轮。** Source `battle/effects/battle.discover-flow.js:309–321` 清当前发现；牌库底候选按原UID/原序放回，已确认奖励与来源已支付效果保留。Unity缺取消入口，原“临时入手”说明也不适合挖宝/锦囊/直接施放。新增取消不是退款或清空整个规则队列。
3. **纯发现首轮在支付前预览。** `battle/effects/battle.discover-preview.js:14–48`、`battle/core/battle.selection-flow.domain.js:90–171`、`battle/core/battle.exec-play.domain.js:186–267`：完整纯发现计划才准入，费用/源牌/材料写入前展示首轮；取消不消耗，确认重验后正式支付一次，以私有首轮票兑现原候选。道具正式入口 `battle/bag/battle.bag.domain.js:340–381` 同样先预览。Hub逐条件只读审计见 `discover-preview-audit.md`。

## 生产实现

- `GameRuntime.Map.cs:115–120` 单一资格谓词供当前候选与最终命令共用；公开只读 `GetSacrificeCandidates()`，不改变3 UID、随身/安全格/容器资格或存档事务。
- `CardSacrificeScreen.cs` 使用正式 `CardFace` 展示原费用/描述，逐UID保留Button/Face/滚动内容。选/撤只更新当张选中态与计数；进入、覆盖返回、确认与失败回执才对齐库存。正式提交仍核资格和精确3 UID。
- 页面身份包含runtime、State引用、slot、可空seed、layer、node、Map引用、Top和render revision。旧控件不因同名/同槽复用而恢复权限。本页正式失败回执才可在同地点重绑回滚后的Map；背包覆盖期失败重建Map时，原页退出，最后一个modal按同State/地点安全恢复idle，不接受新Map上的旧动作。Cancel/Esc返回真实原入口，紧急撤离成功沿生产结算路由。
- `BattleSession` 发现状态增加单调 `selectionId`、`kind`、`sourceCommit`、`sourceUid`。生产命令必须携 `BattleToken + selectionId`，Bridge还核当前Session引用；保留可信Core原 `PickDiscover(int)` 的既有签名。取消只处理当前所属发现并恢复当前规则/自动批次/敌方owner一次，终局/旧场次拒绝。Native另外保留旧Core尚pending再换会话，验证旧Bridge不能对它继续输入。
- `DeckBottomDiscovery` 取消归还原UID；确认按选项index映射UID，不用同ID或CardDef引用找第一张。Source `battle.discover-state.js:103–111` 显式候选只显示前3张，保留全部取底UID供取消/未选归还；一般n>3底牌池也遵守此边界。开始及取消清本次 `lastAcquired`，防挖宝取消后护甲使用前一次获得牌的价格。
- 迷之匣按Source先核至少2张随机可获得招式，再用明确招式指定池和职业/衍生门生成两轮；指定池不额外施加普通随机资格。稳定池共用，轮内ID/名称去重，允许两轮选到同ID。每次确认即生成真实首牌，第二轮取消保留首UID原费用；两张齐才交换费用。不使用旧错池结果作预期。
- 新私有 `BattleDiscoveryPreview.cs` 保存当前预览、同battle/turn/sourceUID/计划签名候选缓存及一次性票；签名是id/type/desc/rules，不含printed cost。取消不回退RNG；新回合、Reset、Finish清缓存。确认重验有效来源、计划、当前能量/目标、注能及手牌代价后重入正式执行；失败不支付/发奖。
- freeCost单独使用仍允许预览，directRelease跳过。发现后直接施放的道具走同一private物品执行核的directRelease分支；其后续bag发现已支付，不能再次宣称“取消使用尚未消耗”。这不新增公共指令或玩家抢占当前owner的入口。
- 票仅显式传入来源onPlay或bag主执行，燃料onConsume、获得触发、登记触发与重放默认不携票。材料待选时主效果排在其续接之后；获得触发产生待选时下一发现轮也排队，防覆盖当前输入。首票复用候选并自动结算首选，不重复采样/弹首轮；后续轮仍已支付，取消保留首奖及费用衰减。
- `AcquireRuleCards` 缺省dest改为Source planner的discover；显式hand/deck和旧搜刮专用形状保留。锦囊以实际stored UID映射候选，首次取消不耗母本或RNG，确认消费选中母本一次并直接释放。
- **有意修正Source缺陷：** `firstPureDiscoveryJob`/bag resolver保留整数amount=0，而Source discover flow未拦n<=0，导致零量也生成候选并发一次奖。Root批准Unity对bag discover/acquire的整数数量<=0跳过预览及奖励采样，正式物品使用成本和其它op照常；不退款、不补偿。回归保留零奖和RNG不变断言，这项不声明与错误Source结果跨语言等价，和迷匣种子oracle独立。
- `DiscoverPanel` 按token/selectionId/revision守卫，350ms入场门不因同轮快照重置；新轮即使n/候选完全相同仍清草稿。Escape复用既有 `CloseFromEscape`。文案区分牌库底/生成/直接施放/来源效果/锦囊/迷之匣及支付前后；显式显示费用与Source `battle/view/battle.view.js:372–374` 的未hideCost卡面一致。原招式费用本来可见，本项显示差异仅在装备/道具等被默认隐藏的类型，不能称为修复迷匣招式费用。

## 工作量与性能边界

献祭选/撤由重建所有候选对象改为保留对象、局部写入；当前资格输入复检仍为O(N)且会生成候选快照，选中卡面有序列化比对，不声称零分配。库存对齐为O(N)，不每帧执行。发现缓存让同回合同源同计划重开不再全池采样或消耗RNG；计划指纹只在交互命令边界计算，不增加每帧规则扫描。没有线程化修改随机规则。

## 待Root统一执行的回归

- 既有BattleChecks增加 `Round6Checks.cs` 与独立 `Round6PreviewChecks.cs`，旧R3/R4主体未修改。覆盖原UID/原序、挖宝取消不吃前次价格、已确认奖励、同选项新owner、自动批次/敌方owner续接、终局旧输入；纯预览包含费用/注能/手牌代价、缓存/计划/生命周期、支付一次及第二轮取消、失效材料/目标、bag准入与实际神秘召唤/锦囊。
- `discover-source-oracle.mjs <绝对输出路径>` 调实际Vite迷匣queue、discover flow、candidate gate与seeded RNG。Root先生成JSON，再以 `SDT_DISCOVER_SOURCE_VECTORS=<绝对JSON路径>` 执行领域项目。控制卡池覆盖0/1张、3种seed、正常两确认/第二轮取消和同ID变体；比较完整候选顺序/费用及所有RNG stream状态。UID端口为确定计数器且省略获得/视觉触发，不作为完整游戏运行证明。
- 全局 `CurrentSacrificeRound6Checks.Run()/Assertions`：正式存档可读夹具、真实卡面/变体、逐UID原位/滚动、同帧覆盖返回、旧事件、同槽新State/换层换节点、真实背包保存失败回图、当前页保存失败重试、两来源Cancel/Esc和紧急撤离生产路由。
- 全局 `CurrentDiscoverRound6Checks.Run()/Assertions`：真实Bridge/会话，实际组件Submit、350ms、同选项新轮、旧控件、真实挖宝、神秘召唤支付前取消/缓存/支付一次、锦囊同ID不同UID/原费及终局拒绝。构造前置不等同OS输入或射线布局证明；当前窗口Player由Root独立取图/点击。
- 独审：Run `sacrifice-independent-review.md`；Hub `discover-preview-audit.md`。均为只读静态检查，未冒称执行通过。

## 有界残余

初始只读审计曾发现 `CurrentDeckFormation.cs:115–128` 每帧Layout重复15个RectTransform Set调用（每次5个属性setter）；Root已明确停止这条性能片，当前未修改，不能写成完成或收益。其余不再扩大新战斗方向。Source本身无意义的池名/非法规则形状不通过新增兼容回退补齐；本片以现役合法卡牌和明确控制夹具为边界。

最终生产/检查清单、字节与SHA由 `battle-freeze.json` 登记。本轮没有删除文件、修改Vite、提交、推送或运行验证。

## 集中验收后的QA修正

Root已生成8组Source迷匣oracle。Battle第二次SDK执行在 `SameOracleRandom` 失败：检查错误地将Native `Rng.SaveState()` 当作JSON。实际 `Sdt.Core/Rng.cs:79–95` 格式为 `seed=<uint>;v=<int>[;s=key:<uint>,...]`。检查现按该格式严格比较seed/version与全部流键/值，排序只消除字典枚举顺序影响，不忽略多余流、缺失流或数值差异；没有改生产RNG、候选、随机次序或断言预期。Root另已删除新preview检查文件末尾的一个多余右花括号。两项均为QA修正，待Root重跑；本代理没有执行验证。失败证据为 `docs/evidence/2026-11-01-unity-parity-round6/domain-2/battle-stderr.log`。

第三次Battle已通过严格Source oracle，随后混合发现取消检查未得到1护甲：受控夹具错误地把armor量写为n，正式 `StructuredRules.Amount` 默认读取amount/amountField/range。已将同文件两处armor均改为amount=1；discover的count、acquire的n、手牌代价count及bag的整数amount/n-or-one各按对应正式入口逐项静态核对。保留1护甲/0能量和其它原断言，不改生产续接。证据为 `docs/evidence/2026-11-01-unity-parity-round6/domain-battle-3/battle.log`；仍待Root执行。

## Player实绘失败后的容器修正

Root报告Player-3退出0/81张，但发现页视觉验收失败；本代理实际查看了 `player-3/player-discover-bottom.png`：标题上半越屏，提示/说明左侧裁切。点击/规则检查通过不能证明画面合格。受控敌人白块为夹具，不是本次生产资源问题。

根因在同文件 `BattleSubpageBase.Build`：新RectTransform设置比例stretch anchors后未清默认100×100尺寸增量；实际宽为父级97%+100、高为95%+100，父Canvas1920×1080时四边越出约21.2/23单位。现仅清零card.offsetMin/offsetMax，保留既有锚点；`DiscoverPanel.Build` 只在创建时把内容内边距设为40/40/20/20和间距16，避免说明贴屏边。已读Source最终battle-discover.css的安全内边距与候选横排规则；本修只处理已确证裁切，不重新设计其他层。同步删除“文案逐字照抄”的过期描述。

业务规则、owner、取消/确认、350ms门和RNG均未改。共同Base实际由DiscoverPanel与GravePanel使用；DeckSelectionPanel覆写Build并独立创建CurrentDeckFormation，不调用此Base。按直接符号和“墓地”检索，旧Editor原生及NativeDisplayReview均未直接命中Grave/OpenGrave，旧绿灯不作为该页几何证明。

现有 `CurrentDiscoverRound6Checks` 增加真实Canvas矩形检查：表面、标题、viewport、提示/说明、候选及footer均在可见父范围；选中重建后再核。另由正式Boss请求/编组确认挂实际GravePanel，以互不重叠的受控原UID构造grave内容并记录consumed，验证分组内容、共同表面/标题/正文/footer和真实返回。该夹具只隔离墓地布局，不声称覆盖材料如何入墓地。

预期新增96条：7次初页几何74（候选数3/1/3/2/3/3/3）、选中后9、Grave几何9+状态2+真实Submit2=13；当前发现检查从已验58到预期154。Root总新原生预期367/合计1310，尚未执行本修。需Root统一重跑CurrentRound6Validation并重建当前窗口Player，目检底牌/选中/纯预览和相关Grave；1483领域与其他未触及组件的证据由Root按输入闭包复用。

Root回报native-round6-3实际367通过；Player-4的标题/提示布局已恢复，但驱动误把通用获得限定为hand.Count=1，随机候选为道具时与正式 `AddTempCard` 的道具归属不符。生产授予规则无需修复。通用hand-kind候选可能为道具，提示已由“选择1张置入手牌”改为“选择1张获得”，对应普通发现文字断言同步；牌库底/直接施放/锦囊/迷匣的明确去向文案保持。该新文案仍待Root本次统一原生和Player补验。

同因原生QA也已修：首次确认前记录GrantedCards UID集合，随后要求差集唯一新增实体的id/cost/variant精确等于所选候选；道具不入hand，非道具hand必须正好该新增UID。保留E98、来源UID移出且played唯一、发现关闭和RNG不增条件，合在原一个Check，断言数量仍154。没有更改生产AddTempCard或为道具补手牌。

Root报告Player-5退出0/83图后仍发现墓地页共享HUD与标题叠压；本代理实际view_image核到 `player-5/player-grave.png` 的顶部生命/头像/资源栏覆盖墓地标题，故该包仍未视觉验收。Root自有CurrentRunTopBar.Covers已改为DiscoverPanel/GravePanel类型判断。本代理仅在GraveGeometry补两条检查：真实页挂载并过一帧后Visible=false且实际CanvasGroup.alpha=0；真实返回战斗并过一帧后Visible=true且alpha=1。原有几何、分组、返回及业务断言保持，预期当前检查154→156、Root新原生369/总1312；此版待统一执行，无本代理测试。
