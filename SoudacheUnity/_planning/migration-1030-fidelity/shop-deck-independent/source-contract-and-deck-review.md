# 现行源契约及独立只读核对

日期：2026-10-30。属地：Shop / BossFormation。审查者：shop_deck_independent_contract。

独立从现行 Web 导入链、执行逻辑和 CSS 建立清单，不沿用旧矩阵。Unity 原生效果由 Root 统一验收，本记录不把静态通过当作实图或真实输入通过。未运行 Unity / build / CUA；未写 Assets 或共享 docs。

## 现行入口

- Shop：`搜打撤/game/src/game.boot.js:23,39` 配置背包返程，`game/src/run/game.run.scenes.js:20,49` 使用 `game.run.shop.js` 的控制器。`game/index.html:33` 的 `expedition-shop.css` 覆盖较早 winter；其 `:12` 强制批准商人插画。`cover-remaining.css` 仅在 index:49 注释，故其 ordinary-polish/cover-run 不构成本轮生效样式。
- Formation：`game/src/battle/view/battle.view.js:40,331` → `battle.overlays.js:21`。`battle.decision-shell.js:6` 导入 `battle-decision.css`，`battle.aim.js:8` 导入 `battle-hand-overhaul.css`。只适用 formation 的多列网格；不套用 hand-select 的单行覆盖。

## Shop 精简可验契约

| 范围 | 现行具体行为 / 画面边界 | 源位置 |
|---|---|---|
| 商品板 | 商人左26 / 商品右74，间隔40；5列2行，商品格外显名称、价格、已售/余额/满包状态；批准商人场景为背景，神秘卡使用问号背面 | expedition-shop.css:12,44–80 |
| 神秘人 | 仅五句轮换交谈、前往收购台、整理背包；没有额外新增服务、批量售卖或独立规则页 | game.run.shop.js:425–450,657 |
| 检视购买 | 点击商品进入覆盖商品板/商人区的详情；页头、页脚仍在；只隔离board/merchant。可买时支付当前报价；已售仅继续浏览；缺钱禁买；满包可进整理背包；神秘卡未买前不泄露身份 | game.run.shop.js:76–95,260–282,674–734 |
| 长文规则 | 规则超过80字符才有完整规则开关；详情自身滚动可读；同页patch保留规则开合、滚动与可操作焦点 | game.run.shop.js:260–282,550–610 |
| 返程 | 检视关闭180ms后回原商品焦点；进入280ms。背包返回原main/sell、检视开关/规则、滚动、具体action；收购台返回原商品板快照 | game.run.shop.js:616–641,693–714,789–799; shop-browse-state.js |
| 收购台 | 只列isSellable且!stored的独立UID；安全格可售并显示位置；单张确认卖出；显示持有/可售/币值与规则折叠 | game.run.shop.js:476–541,760–786; expedition-shop.css:151–185 |
| 成交与防陈旧 | 命令重新校验session/stock/owned身份、UID唯一性、卡牌/价格/free/补货次数；重复或旧报价不可再成交 | shop-commands.js; game.run.shop.js:644–655,720–786 |
| 失败瞬态 | Web普通买卖先成交内存后保存，save=false仍返回ok=true，留unsaved；离店重试保存，失败继续停留。委托折扣保存失败则回滚，勿混用两种逻辑 | shop-commands.js; game.run.shop.js:98–104,810–850 |
| 动作表现 | 普通购卡飞背包560ms；神秘卡先缩/翻/停再飞，表演不充当成交闸门；reduced-motion跳过动画 | game.run.shop.js:294–392 |

**保存失败差异待 Root 决定**：Native 原子回滚与 Web 保存失败后的内存成交保留不同。此前允许保留 Native 边界，最新 Root 要求先穿透持久化 API，再决定商店局部同态方案；当前不能以平台适配结案。

## Formation 精简可验契约

| 范围 | 现行具体行为 / 画面边界 | 源位置 |
|---|---|---|
| 候选池 | 按独立UID保留顺序；!stored、!pouchOf，排除道具/资源/事件/生物/初始攻击；继承仍有效旧编组，并裁剪超过装备栏的开战装备 | battle.lifecycle.domain.js:416–424 |
| 门槛 | need由快照考虑开战装备可占栏数，画面need=min(snapshot.need,poolCount)。selected达到need且不超max才可开始；总牌数selected+starterCount；移出容量装备后超限必须先调整 | battle.snapshot-projection.domain.js:22; battle.overlays.js:24–31; battle.lifecycle.domain.js:430–470 |
| 装备 | 画面提示判type=装备且desc含对战开始时；实际命令使用结构化battleStart优先、旧desc兜底，并限制开战装备占用的栏数 | battle.overlays.js:32–42; battle.equipment.domain.js:281–291; battle.lifecycle.domain.js:437–440,462–466 |
| 摘要 | Boss名、ATK、maxHp或hp，词缀图标/名/说明，进度与容量；短池说明只在poolCount<snapshot.need时显示 | battle.overlays.js:45–70 |
| 壳层与格子 | 居中min(1760,viewport−88)×min(980,viewport−88)；summary优先；主内容可滚动，底部开战/放弃固定。formation格240–280宽、gap28；卡后独立详情按钮 | battle-decision.css:10–41,89–99 |
| 规则与阅读 | rules默认折叠；详情阅读器不选牌，支持浏览全候选；关闭后回当前浏览项的详情按钮 | battle.overlays.js:71,79; battle.decision-shell.js:120–200 |
| 稳定性 | 同battleToken+poolKey只patch选择/计数/确认，不销毁候选网格，保留滚动和焦点；放弃调用cancelDeck，不只隐藏视图 | battle.overlays.js:48–63,78–83 |

## 冻结 Deck 视图核对结果

审阅 `Assets/Scripts/Sdt.UI/Screens/Battle/CurrentDeckFormation.cs` 与 `BattleSubpages.cs:107–123` 冻结版本，SHA256见receipt。**本轮新增视图未发现可证实P1/P2**。

- `Refresh:62–74` 复用相同pool的内容，只patch选中环/计数/门槛；UID映射、Need、Maximum、Starter合计与源一致。
- `RebuildContent:80–104` 对手/词缀、规则默认折叠、start提示及独立详情均存在。卡面子图像不拦点击，禁用其内部描述滚动后选牌；阅读器使用独立CardFaceOptions完整阅读。
- `Inspect:113–114` 交给现有DepartureCardZoom，reader跨页后 `DepartureElements.cs:172` 按当前index回对应Inspect对象。
- `Layout:118–125` 壳层1760/980/88及固定页脚已落地；280列、gap28，卡高420、选中态428、开战提示461、详情499，静态相对位置无重叠证据。
- `BattleScreen.cs:63–72` 关闭子页即清引用，新战新面板。故poolKey未另包含token，在当前生命周期内不导致跨战复用旧节点。

**Root待原生验收**：最后一行选牌不跳回顶、规则展开/折叠后底部可达、详情跨页后返回对应Inspect焦点、开战装备备注与详情无重叠、超限时禁开战/放弃实际返回。

## 既有Core/Boot：旧编组的静态生命周期差异

现行源 `battle.lifecycle.domain.js:420` 继承lastDeckSel并trimStartEquipmentSelection。Native `BattleSession.cs:474` 虽读私有lastDeckSel，但 `Sdt.Boot/BattleBridge.cs:394` 每次OpenBattle新建Session；该字段只在本Session的BeginBoss:527写入，没有跨战注入。这证明实例生命周期不同，**尚不能证明当前标准玩家流程出现丢编组**：Boss按钮和结构化烟雾逃跑均被禁用，取消编组尚未写lastDeckSel，胜负会终局。先前把core flee(null)当玩家复现的说法已撤回，不列玩家P2，不据此推动生产修复。详见deck-lifecycle-callgraph.md的更正。

Native准备/开战缺Web开战装备超限trim/recheck（`BattleSession.cs:461–485,517–520`），但当前生产新Session无法继承旧超限选择，触发证据不足，未提升为已证实P2。若后续恢复旧编组，应同时对齐这两个边界。

## Shop冻结版独审与修正复核

作者声明生产文件写闭后，独立读取 `ShopScreen.cs`、`CurrentShopView*.cs`、`CurrentShopCarry.cs`、`GameRuntime.ShopAcquisition.cs`。批准场景、26/74主布局、5列双行、未购神秘卡背、单UID售卖、安全格售卖、主店/收购台分别保留滚动、背包返程和售后邻项焦点均存在对应实现。容器内容按现行 `bag-inventory-commands.js:121` 同时置stored与pouchOf，Native额外pouchOf过滤在正常状态下不改变可售集合；TryDiscard没有禁止safe。

发现两项P2并发Root/作者：详情仅禁商品按钮、商人仍可经键盘Navigation执行背景服务；长规则开关重建后恒抢焦点至关闭按钮。作者获 Root 授权修正后再次只读复核，`BuildDetail` 已调用 `SetMerchantInteractive(false)`，三商人回调均有selected守卫，`FinishCloseDetail`恢复；非初开详情重建记录原detail内action名称并优先回焦，**两P2代码层闭合**。未执行原生输入。

小视觉差距仍保留：商品选中色仅Build时计算，Inspect/FinishClose未patch；神秘演出缺后续720ms内前320ms真卡显现，抵达缺源420ms背包弹性接收。它们已交Root集中决定，不作为既有两P2修正后的新增扩大修复。

额外active分支发现：`game.run.shop.js:14,214` 导入并调用 `shop-commission.js`。其源码免单候选包含神秘货箱（`shop-commands.js:73–76`、`shop-commission.js:124–126`），Native `GameRuntime.Commission.cs:12` 额外排除mystery。源码 `renderStart:136` → 两轮dice → `story:89` 两格预览 → `commissionEnterShop`保存announced后进主店；Native `ShopScreen.BuildCommission` 直接骰子清单，第二次 `ConfirmCommissionDice`末尾即used=true进主店。两项实际行为/呈现差距已发Root，建议复用现有骰子与节点组件集中补齐。

最后审查方向依Root最新要求改为代码调用链分析，不等待原生/图像。
