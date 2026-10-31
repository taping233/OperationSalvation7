# 商店货架：现行源码执行对齐

2026-10-30，本轮已冻结货架生成补丁。修前 104 组货架及生成后的随机状态全部与现行 Web 实现不同；修后 104 组逐货位回执、生成后完整随机状态、后续四张实际掉落及其后完整随机状态全部一致。该结论来自两端真代码执行，不是分布近似或旧 passed 记录。

## 已修与保留边界

| 项目 | 当前结果 | 依据 |
|---|---|---|
| 普通六格档内选择 | 已修：按每张卡权重，道具 0.7、装备 0.8、其余 1；复用新提取的 `CardLibrary.PickOfRarity` | 活跃 `cards.rules.js` 实现；没有沿用其“类型均分”旧注释 |
| 资格与池顺序 | 已修：复用 `IsRandomObtainable`，排除初始、衍生、职业、带 cls、棱彩、能力、生物、unrandom；掉落类及旧碎片排除沿共享规则 | 真实 291 张库及七种夹具的采样元数据、顺序直接相等；源 upsert 后 292 张库直接相等 |
| 普通格同名去重 | 已修：保留每次稀有度与档内采样，最多 50 次拒绝，然后从剩余同名去重池 fallback | 普通六格各触发 50 次拒绝后 fallback 的实际种子案例 |
| 随机流及消费顺序 | 已修：稀有度与 fallback 用 shop/reward，档内用 loot/reward；不预过滤同名后少抽随机数 | v1 独立 shop/loot 与 v2 归并 reward 均逐状态相等 |
| 神秘货箱 | 已修：完整合格库采样并拒绝面板同名，最多 50 次；耗尽为空货位 | 实际第 50 次成功、50 次全拒绝及提前成功均覆盖 |
| 固定格、免费标记及空格 | 已修：源 SHA 克隆、招财猫第一格免费及 free 标记、源无货 label/标记/价格 | 八项回执字段逐格比较；SHA 对象身份与改克隆不影响原对象均断言通过 |
| 持久货架与列位 | 生成仍为六随机、饮料、初始攻击、神秘格共九格；现有节点 shopStock 存取与视图列位入口未修改 | 独立审查证明 ShopScreen 除 GenerateStock/摘要之外逐字保持修前现场 |
| 公共 picker 的空字符串 typeFilter | 保留旧边界，未修：Native `typeFilter != null` 与源 `!typeFilter` 对空串有差别；商店调用不传该参数 | 本轮为保持已有 RandomDropCard 参数行为，只抽出共享档内函数 |
| 持久读回、购买/出售保存策略、原生画面及真实输入 | 本证据未验证，交由主任务集中验证 | 本代理没有启动 Unity、构建 Player 或操作前台 |

## 修改范围与冻结指纹

- 生产 `Assets/Scripts/Sdt.UI/Screens/Run/ShopScreen.cs`：只替换 `GenerateStock` 及摘要。方法 SHA256：`5fc3e5f8fc7232d2d07c4fb1d592740e94af305c4909e4dc1fe9c392c0a01b72`。
- 生产 `Assets/Scripts/Sdt.Core/Cards.cs`：只把原 `RandomDropCard` 的档内资格、加权、loot/reward 采样抽为 `PickOfRarity`，由原 50 次稀有度循环调用。文件 SHA256：`02dad40ff56fe46c2901125fc6f167a237735711c093776e5bf24e8c4e771120`。
- 没有重写全文件、修改原 Web 玩法、覆盖 All() 已有改动，或触碰 Buy/Sell/BuildCommission。共享 ShopScreen 其他作者随后可以继续改自己的区域，整文件指纹只代表私有执行快照。

## 执行方法与结果

`source-oracle.mjs` 直接提取 active `game.run.shop.js` 的 `generateShopStock` 原函数，配合 Vite 加载的现行 Cards/Random 执行。只替换未参与生成的卡牌视图入口；没有重写期望算法。

`check.py` 提取原生真 `GenerateStock`，与真 Cards、Rng、CardDatabase 等一起在私有目录编译执行；GameRuntime/Base/Pet 只提供函数需要的数据。修前快照保存在 `before-snapshot`，修后快照保存在 `after-snapshot`。后续编译与执行不经过 Unity。

每行比较实际 ShopOfferReceipt 的全部八项生成字段：`cardId/price/sold/empty/mystery/free/label/shaReplenish`；随机状态比较 `seed/version/streams`，包括已经存在的其他流。生成后继续执行四次两端真实 randomDropCard，并比较结果及状态。比较前强制行数、唯一 ID、ID 顺序一致，校验源指纹；当前指纹覆盖 74 个源文件，含卡库代码与 cards-sync.json。每种池同时直接比较采样元数据和卡库顺序。

| 检查 | 修前 | 修后 |
|---|---:|---:|
| 逐格完整回执相等 | 0 / 104 | 104 / 104 |
| 生成后完整 RNG 状态相等 | 0 / 104 | 104 / 104 |
| 后续四张实际掉落相等 | 29 / 104 | 104 / 104 |
| 掉落后完整 RNG 状态相等 | 0 / 104 | 104 / 104 |
| SHA 克隆身份与独立性相等 | 0 / 104 | 104 / 104 |
| 七种池的采样元数据/顺序相等 | 7 / 7 | 7 / 7 |

覆盖：baseline、源/Native upsert、自定义资格边界、仅饮料、空库、同名异 ID、普通 fallback 与神秘 50 次上限。常规种子为 0、1、2、42、123、999、4294967295；版本 v1/v2；真实库另覆盖招财猫与预消费的 shop/loot/target/scene 状态。边界种子为 v1 的 0/1/310、v2 的 0/1/439。

私有编译通过，0 errors；存在 SDK 路径属性的 MSB3539 警告，不涉及生产源码。生产两文件 `git diff --check` 通过。独立代理只读核查见 `oracle-review.md`。

## 证据及复跑

- `source-results.json`：现行源 104 组回执、前后 RNG、后续掉落、池元数据及源指纹。
- `before-comparison.json` / `after-comparison.json`：真实修前/修后对照。
- `before-hashes.json` / `after-hashes.json`：原生真代码快照指纹。
- `before-results.json` / `after-results.json`、相应 compile.log：原生执行原始结果。
- `oracle-review.md`：独立审查及结论边界。

从 Unity 工程根目录运行源 oracle 后，使用 `python _planning/migration-1030-fidelity/shop-rng/check.py after --frozen` 重放修后快照。`before --frozen` 应以退出码 1 报出修前差异；省略 `--frozen` 会重新采集当前生产片段，保留 before 证据时务必使用该参数。
