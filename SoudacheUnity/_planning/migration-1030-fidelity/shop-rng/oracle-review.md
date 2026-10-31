# 商店货架随机对照：独立只读审查

本次所查生成补丁与现行源码的控制流程一致；现有 104 组证据支持逐货位回执、生成后的随机状态及后续四次掉落一致。未发现此次补丁新增的商店生成错误。此结论覆盖货架生成，持久化、交易、界面表现分别由其他工作项验证。

审查人：`/root/shop_rng_source_alignment/shop_rng_oracle_review`。只读生产文件与既有证据，未运行 Unity、编译或操作界面。证据核查于 2026-10-30；审查提出的四项测试加固均已由作者补齐并重跑，审查者随后再次读取了实际结果与脚本核实。

## 真实执行与比较边界

- `source-oracle.mjs` 从 active `game.run.shop.js` 提取 `generateShopStock` 原函数文本执行，使用 Vite 加载的现行 `Cards` 与 `Random`。没有把期望算法另写一份。视图模块被替换为空入口，不参与该函数依赖。
- 原生侧从当前 `ShopScreen.GenerateStock` 提取真代码，使用 `Cards.cs`、`Rng.cs`、静态卡库等真代码快照；`GameRuntime/Base/Pet` 为本次函数所需的薄数据夹具。
- 每个货架比较八项回执字段：`cardId/price/sold/empty/mystery/free/label/shaReplenish`。同时比较 `seed/version/streams`，并继续抽四张掉落再比状态。
- 实际检查数据为源与 Native 各 104 行，双方 ID 集合长度与唯一 ID 数均为 104；不存在本轮证据尾行被 `zip` 忽略的情况。`sourceHashes` 中九个源文件的 SHA256 均仍等于现行文件。
- `catalogEqual=true` 检查的是真实 291 张库中与采样有关的元数据及顺序。自制覆盖与追加经过源 `Cards.upsert` 和原生 `CardLibrary.Upsert`。

## 边界案例确实到达

边界池由固定饮料、200 张同饮料名称的卡和 7 张权重表外稀有度的卡组成。普通格每次 50 次采样均被名称/空档拒绝，然后分别走一次 fallback，因此六个普通格固定消耗 306 次 `shop/reward`；此后实际调用数减 306 即神秘格尝试数。

| 版本与 seed | 神秘格结果 | 实际尝试数 |
|---|---|---:|
| v1 / 0 | 提前成功 | 36 |
| v1 / 1 | 耗尽为空 | 50 |
| v1 / 310 | 第 50 次成功 | 50 |
| v2 / 0 | 耗尽为空 | 50 |
| v2 / 1 | 提前成功 | 20 |
| v2 / 439 | 第 50 次成功 | 50 |

空库源证据消耗 350 次 `shop/reward`，包含六格各 50 次及神秘格 50 次；固定饮料为空时仍保持源回执的价格 2 与 `empty=false`。资格池中十张合格卡均被至少选中过，初始、衍生、职业、带 cls、unrandom、能力、生物、棱彩及旧通行证碎片均没有出现在生成结果。

## 补丁边界复核

- `Cards.cs` 与 `before-snapshot/Cards.cs` 的逐行差异仅为提取 `PickOfRarity`、由 `RandomDropCard` 调用和相关注释；`All()`、资格判定及其他既有改动保持原样。
- 将当前 `ShopScreen` 的 `GenerateStock` 与其 XML 摘要恢复成修前内容后，按原 CRLF 编码得到的整文件 SHA256 精确等于 `before-hashes.json` 中的 `dc8f45d31fba5e0fdaa0b139dc389f9917fbe423f8e915a40918b72a037317a6`。据此确认本补丁未改其他区域，包括 Buy/Sell/BuildCommission。
- 已审查生产指纹：`Cards.cs` 为 `02dad40ff56fe46c2901125fc6f167a237735711c093776e5bf24e8c4e771120`；`GenerateStock` 方法为 `5fc3e5f8fc7232d2d07c4fb1d592740e94af305c4909e4dc1fe9c392c0a01b72`。当时全部七项原生文件指纹均与 after 快照一致。
- 修前证据：104 组货架均不同，生成后随机状态均不同；修后既有 after 证据：104/104 货架、生成后状态、后续掉落及其后状态均一致。

## 测试加固与保留边界

原有 `cardId` 投影不能独自证明对象克隆；现已新增 SHA 固定格克隆对象身份与修改独立性的实际执行断言，源与原生各 104 组均为 true。生产代码调用 `CardLibrary.SHA.Clone()`。

比较器已新增双方行数相等、ID 唯一且顺序一致的门禁；消费源结果前校验当前源文件指纹，防止使用过期缓存；原生每种池直接比较 `All()` 相关元数据及顺序，包含实际覆盖/追加后的 upsert。新增的七项 `catalogChecks` 全为 true，更新后的 after 结果仍为 104 组零差异。

本轮商店调用没有传入 `typeFilter`，未验证共享 picker 的非空类型筛选与 elite 模式。该抽取保留原生 `typeFilter != null` 的既有语义；源 `!typeFilter` 对空字符串的处理存在差别，不能据本轮结果声称共享 picker 所有参数组合均已与源等价。持久货架的读回、购买/收购保存策略和原生视觉检查不在这份生成函数证据内。
