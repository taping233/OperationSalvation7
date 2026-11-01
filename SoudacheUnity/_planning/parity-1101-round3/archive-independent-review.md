# 整档自定义卡闭包独立审查

结论：静态独审发现两个确定缺口，已直接报主会话；此记录对应下列字节快照，后续作者修改需要另行复核。未改生产、未执行测试或启动 Unity。

1. **按名称引用的传递依赖漏带。** `SaveSystem.ArchiveCards.CardReferences` 将字符串交给 `all.TryGetValue(id)`，只命中自定义 ID。正式 `StructuredRules.cs:464` 的 `transform.into`、`:472` 的 `release(source=generated).key` 都通过 `CardLibrary.FindByName` 查目标；`:634/637` 的 acquire 使用 `CurrentBattlePools.Resolve`，其 `pool.kind` 也能按卡名定向取卡。若目标档只持有自定义 A，A 通过这些规则引用自定义 B 的名称，B 未直接持有且 ID 不等于名称，当前导出闭包只有 A；新 profile 导入后对应变形/释放/定名获取失去 B，后者还可能转为随机池。最小建议：沿这些正式规则字段解析卡名引用并继续已有队列闭包，不把所有自由文本都解释成卡名；补两个 profile 的间接名称依赖检查。
2. **固定 schema 字段被误认作自定义引用。** `CardReferences` 也对每个 JObject 的 property.Name 调用 Include。Upsert/归档定义校验均允许自定义 ID 为 `wood`、`coins`、`base` 或 `id`；这些卡即使完全不在目标档使用，也会因固定分区/字段名被加入导出。普通自由字符串恰等于 ID 时亦有同类过收。若要求严格只带本档引用，应限定真正以卡 ID 为键的字典和规则字段；当前实现只能称保守超集。最小回归可用未引用、ID 为 `wood` 的自定义定义，断言空的新档备份不带它。

其余已核边界未发现新的确定问题：

- MergeArchiveCards 对已有目标自定义同 ID 使用 JToken.DeepEquals；相同定义不重复追加，不同定义在事务开始前拒绝。仅新增缺失 ID，不移除本机其他自定义定义。预检也执行相同冲突判断，确认文案显示新增条数。
- 导入三处目标档分区及新增 global 自定义卡处于同一 BeginTransaction/CommitTransaction；失败路径沿现有 Persist/CommitTransaction 恢复 profile 与 slot read error，成功后才 ResetCustomsCache 和消耗 preview。其他 slot/global 没有新增赋值入口，原有外部文件变化与预览后变化检查保留。
- 正式 CustomsSaver 经 SaveSystem.SaveCustomCards → Global.SetJson → FlushGlobal，普通写失败抛异常。Upsert/Remove/ClearCustoms 先复制列表并保存，成功后才发布 `_customs` 和失效合并缓存；静态未见普通失败时发布新列表。
- CardLibrary.All 缓存比较源容器引用、数量、每项引用与当时 ID；同长度元素替换、同对象 ID 修改及源列表替换均使缓存重建。就地修改同 CardDef 的非 ID 字段通过同一对象引用可见。Init/ResetCustomsCache/成功 Upsert、Remove、Clear 均显式失效。
- 闭包 HashSet + Queue 对 ID 循环依赖可终止；序列化结果按已有自定义列表顺序输出，不依赖 HashSet 枚举顺序。

范围：Cards.cs、CardsExtras.cs、SaveSystem.SlotArchive.cs、SaveSystem.ArchiveCards.cs、CurrentSlotArchiveScreen.cs；仅补读正式保存门面与具体规则名称消费者。未扩旧存档兼容，未把未运行的两 profile/失败恢复原生检查视为通过。

独审结束时源指纹（SHA256 原字节）：
- `Assets/Scripts/Sdt.Core/Cards.cs`：`d73dbc44c1593339305ad286cb06c26dcb3c1c8f06a42c13d81afcef6ec690a5`，17422 bytes，mtimeNs 1793492151119325300。
- `Assets/Scripts/Sdt.Core/CardsExtras.cs`：`67f64263c9c1f69ad68b46dc67b5169eda2f6905c1f1355cb60f8d9399a25414`，4188 bytes，mtimeNs 1793492151120328100。
- `Assets/Scripts/Sdt.Run/SaveSystem.SlotArchive.cs`：`dd413e85b2e503e887ba0cc9fc8b41ace6f68dd20e8212a1379362e88cece725`，12910 bytes，mtimeNs 1793492043748057000。
- `Assets/Scripts/Sdt.Run/SaveSystem.ArchiveCards.cs`：`d0731f633da8c540b6e8e57fe76b8763c1de2b90a258e4248cd6da8b24b49311`，3380 bytes，mtimeNs 1793492151120328100。
- `Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSlotArchiveScreen.cs`：`fd58c880f5e56907b281d137e5122b50c56eebc587f2ae0542d501ece485731d`，7071 bytes，mtimeNs 1793492151120328100。

## 修正后的第二次只读复核

原两项已在新实现中闭合：不再把任意 schema 键/自由字符串作为 ID；CardDef、EventSource、明确 ID 字段/数组和 Base.collection 键分别识别。transform.into、generated release.key、pool.kind 通过正式 `CardLibrary.MergeCustoms` 的目录顺序解析名称，并沿既有队列递归依赖。导入增加源/目标名称绑定冲突拒绝。

这次白名单初稿又发现两个需要收准的点，已报主会话继续修改：`insertCards.ids` / 事件 `rewards.ids` 是正式 ID 数组，不能仅识别 `kind=ids` 的池；缺定义预检不能无条件要求部分已处理组的全部 cardIds。主会话已接手修正，不以本次只读记录替代最终冻结复核或原生验证。

按主会话要求，沿 `GameRuntime.Events` / `EventRoutes` 明确 EventProgress 的最小查库边界：

| stage | 真正需要目录定义的内容 | 可按快照恢复、不能据历史数组强求 global 定义的内容 |
| --- | --- | --- |
| restore | 事件身份可单独检查；没有候选目录要求 | `GetCurrentEventOutcome` 从 usedPocket 的 CardDef 克隆 CardFaces，提交也直接 GrantCard(stack.card)。不要求 p.cardIds、drawn 或复原卡 ID 存在于 global |
| sources | 当前可选 p.cardIds；虽然提交先按 owned UID 取实例，随后仍 FindById(source.id) 构替换池 | owned UID/状态与实例匹配另由正式业务入口负责 |
| selection / rewards | 仅未被 p.taken 处理的 p.cardIds，正式提交按 ID 取卡 | recode/trade 原卡经 EventSource.Matches 找 owned 实例，原 source 的定义不需另查 global |
| recodeConfirm | p.drawn 是待替换目标，展示和替换均查库 | 原 source.name 和 owned CardDef 已有快照；p.cardIds 仍是旧 sources，不应无条件要求 |
| gamble | 尚未授予的 p.cardIds/p.drawn 奖品；胜利转固定奖励时仍查库 | 已完成历史候选不是新领取目标 |
| dice | 当前 die 的可能 cardId（已有 result 时仅所选 outcome），尚未提交的 p.drawn，尚未生成骰子的未来 drawPools；gamble 骰子仍需奖品 p.drawn | 旧 die/labels/message 不要求定义；当前 drawPool 已固化成最多六个 outcomes，可按该 outcomes 代替整池；历史池不再重查 |
| chests | 未完成 chestQueue 中排除 taken/lost 的当前卡 IDs | 旧 p.cardIds/drawn 已交给箱子回执，不再据此强求 |
| choices / battle / complete | 事件身份及后续真正执行的当前内容各走正式口 | 不无条件扫描遗留候选 cardIds/drawn；battle 敌人已有快照 |

依据：Events.cs:53–76、130–160；EventRoutes.cs:43–90、106–161。这里只界定归档缺定义预检，不改变事件流程或另建规则验证器。所有修正仍待主会话统一执行两进程来源/目标、冲突、I/O 失败等验证。

## 最终冻源回核

结论：本审查已报告的四项均在当前冻结修正中闭合；仅静态回核，没有运行测试/编译/检查命令，也未改生产。集中验证由主会话执行，本文不把其结果预记为通过。

- ID 白名单现同时覆盖 `kind=ids`、`op=insertCards` 和 `op=rewards` 的 ids 数组，仍不扫描任意 schema 名或自由文本。
- 入城补给只检查未 taken 的索引；未完成箱子只检查未 taken/lost 的索引。EventProgress sources/selection/rewards 只检查 untaken；recodeConfirm 只检查 drawn；gamble 保留未授予奖品检查。restore、chests、choices、battle 等不再因遗留 cardIds/drawn 强求 global 定义，事件身份独立校验。
- dice 按正式当前 die 选取：已记录 result 时只查该 outcome，否则查当前可出现的 outcomes；drawn 仅在抽卡链或赌约仍需使用时检查；未来池从 `drawn.Count+1` 开始，旧骰/旧池/当前池未进入固化 outcomes 的历史项不再误拒绝。与此前给出的逐 stage 消费者边界一致。
- 导出与上一备档转换均生成 version 2，包含 cards 分区，并在导出时校验真实待处理定义。预检明确要求 v2 有 cards、v1 没有 cards，仅保留 Unity 原生三分区 v1 的读取；不是 Web 旧档兼容。预检缺定义拒绝、同 ID 冲突、名称绑定冲突及同事务写入路径保持。

最终回核源码 SHA256（原字节）：

- Cards.cs：`ca909656a3bb7bc03ab93d27c7d8ef4cf0d3481a7f23592d1dadc5f7ef23f39f`
- CardsExtras.cs：`67f64263c9c1f69ad68b46dc67b5169eda2f6905c1f1355cb60f8d9399a25414`
- SaveSystem.SlotArchive.cs：`bf8b72701e419a1acc4c25f6e18fc8da0f35c8d202605d18095d9fefdcdc840d`
- SaveSystem.ArchiveCards.cs：`238368e6556d702f561821557cfc6d2f11a967cc1c3eaec31de3a63282d1ed9b`
- CurrentSlotArchiveScreen.cs：`fd58c880f5e56907b281d137e5122b50c56eebc587f2ae0542d501ece485731d`
