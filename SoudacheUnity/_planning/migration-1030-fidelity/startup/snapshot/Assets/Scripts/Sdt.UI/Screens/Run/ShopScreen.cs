using System.Collections.Generic;
// ported from src/game.run.shop.js createShopController()
//
// 原界面 DOM 结构 → uGUI 控件树映射（.pg.shop-pg.node-pg.sc-shop）：
//   data-asset-key=scene-shop-bg               → 全屏背景 Image + 压暗
//   header.pg-head > h2 + spacer + res-chip    → 标题行 + 金币 chip（[[icon:coin]] n 币）
//   .shop-grid（9 货位网格）                    → GridLayout 3×3：每货位 = 卡面(md)/空货/已售出/神秘货箱
//                                                + mini-btn「[[icon:coin]] n 币」（币不足 disabled）
//     aside.shop-side                          → 网格第 10 格：.shop-coinbox（持有 n 币）+ 离开商店按钮
//   h3.set-h 出售卡牌                           → 分区标题
//   .shop-sell                                 → 可售卡列表：每张 bag-card = CardFace(sm) + 「出售 ＋n 币」
//     空列表文案                                → shop-sell-empty（逐字照抄）
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>拾荒商队商店：6 随机卡 + 1 初始牌 + 金疮药 + 神秘货箱 = 9 货位；出售区可售卡列表。</summary>
    public class ShopScreen : Panel
    {
        /// <summary>货位：card+price / sold / empty / mystery（对齐 game.shopStock 条目语义）。</summary>
        public sealed class ShopSlot { public CardDef card; public int price; public bool sold; public bool empty; public string label; public bool mystery; public bool free; public int? shaReplenish; }

        System.Collections.Generic.List<ShopSlot> _stock;

        // PRICE / SHOP_WEIGHTS（cards.js 照抄）
        static int PriceOf(string rarity)
        {
            switch (rarity) { case "初始": return 1; case "古朴": return 2; case "稀有": return 3; case "史诗": return 4; case "传说": return 5; case "棱彩": return 8; default: return 2; }
        }
        // PRICE 表的字符串形式（供 EnterNode 结果/存档用）——渲染侧统一走 PriceOf。
        public static readonly System.Collections.Generic.Dictionary<string, int> PRICE =
            new System.Collections.Generic.Dictionary<string, int> { { "初始", 1 }, { "古朴", 2 }, { "稀有", 3 }, { "史诗", 4 }, { "传说", 5 }, { "棱彩", 8 } };

        /// <summary>generateShopStock()：加权稀有度抽取 9 货位（weights 照抄 SHOP_WEIGHTS）。</summary>
        public static System.Collections.Generic.List<ShopSlot> GenerateStock()
        {
            var runtime = GameRuntime.I;
            var rng = runtime.Rng;
            var lib = CardLibrary.All().Where(card => !card.unrandom && CardLibrary.DropTypes.Contains(card.type) && card.id != "tt-token-color").ToList();
            var slots = new List<ShopSlot>();
            var drink = CardLibrary.FindById("tt4-woodify");
            var names = new HashSet<string>();
            if (drink != null) names.Add(drink.name);
            for (int index = 0; index < 6; index++)
            {
                var pool = lib.Where(card => !names.Contains(card.name)).ToList();
                double total = CardLibrary.ShopWeights.Values.Sum();
                double roll = rng.Random("shop", "reward") * total;
                string rarity = "古朴";
                foreach (var weight in CardLibrary.ShopWeights) { roll -= weight.Value; if (roll <= 0) { rarity = weight.Key; break; } }
                var candidates = pool.Where(card => card.rarity == rarity).ToList();
                if (candidates.Count == 0) candidates = pool;
                var groups = candidates.GroupBy(card => card.type).ToArray();
                CardDef chosen = null;
                if (groups.Length > 0)
                {
                    double typeTotal = groups.Sum(group => group.Key == "道具" ? .7 : group.Key == "装备" ? .8 : 1);
                    double typeRoll = rng.Random("shop", "reward") * typeTotal;
                    var selected = groups[groups.Length - 1];
                    foreach (var group in groups) { typeRoll -= group.Key == "道具" ? .7 : group.Key == "装备" ? .8 : 1; if (typeRoll <= 0) { selected = group; break; } }
                    var choices = selected.ToArray(); chosen = choices[(int)(rng.Random("shop", "reward") * choices.Length)];
                }
                if (chosen != null) names.Add(chosen.name);
                slots.Add(chosen == null ? new ShopSlot { empty = true, label = "卡牌库无货" } : new ShopSlot { card = chosen, price = CardLibrary.Price.TryGetValue(chosen.rarity, out var price) ? price : 2 });
            }
            slots.Add(new ShopSlot { card = drink, price = 2, empty = drink == null });
            slots.Add(new ShopSlot { card = CardLibrary.SHA, price = 1, shaReplenish = 5 });
            var remaining = lib.Where(card => !names.Contains(card.name)).ToList();
            var mystery = remaining.Count == 0 ? null : remaining[(int)(rng.Random("shop", "reward") * remaining.Count)];
            slots.Add(new ShopSlot { card = mystery, mystery = true, price = 3, empty = mystery == null });
            return slots;
        }

        string _shopNodeId;
        bool _closed;
        public static bool CanOpen(GameRuntime runtime)
        {
            return runtime != null && runtime.State.runActive && !runtime.State.battleActive && runtime.Map != null
                && !runtime.State.closed.Contains(runtime.CurrentNodeId)
                && runtime.Map.Nodes.Any(node => node.id == runtime.CurrentNodeId && node.type == "shop");
        }
        bool CurrentShop()
        {
            if (!_closed && CanOpen(GameRuntime.I) && _shopNodeId == GameRuntime.I.CurrentNodeId) return true;
            RunLog.Log("商店已离站，当前无法交易", "warn"); return false;
        }
        void RequireCurrentShop()
        {
            if (!CurrentShop()) throw new InvalidOperationException("商店已离站，当前无法交易");
        }
        public static void Open()
        {
            var runtime = GameRuntime.I;
            if (!CanOpen(runtime)) { RunLog.Log("当前地点没有营业中的商店", "warn"); return; }
            if (!runtime.TryPersistMutation(() =>
            {
                if (!CanOpen(runtime)) throw new InvalidOperationException("商店已离站");
                runtime.State.Phase = "modal";
                if (runtime.CurrentNodeReceipt.shopStock == null)
                {
                    var stock = GenerateStock().Select(slot => new ShopOfferReceipt { cardId = slot.card?.id, price = slot.price,
                        sold = slot.sold, empty = slot.empty, mystery = slot.mystery, free = slot.free, label = slot.label,
                        shaReplenish = slot.shaReplenish }).ToList();
                    if (runtime.Base.CarriedPet?.effect.shopFree == true && stock.Count > 0 && !stock[0].empty)
                    { stock[0].price = 0; stock[0].free = true; }
                    runtime.ApplyEventCommission(stock);
                    runtime.CurrentNodeReceipt.shopStock = stock;
                }
            }, out var reason)) { RunLog.Log(reason, "warn"); return; }
            var s = ScreenMount.Show<ShopScreen>("Shop");
            s._shopNodeId = runtime.CurrentNodeId;
            s.ReloadStock();
            runtime.Audio.PlayBgm("shop");
            s.Build();
        }
        void ReloadStock() => _stock = GameRuntime.I.CurrentNodeReceipt.shopStock.Select(slot => new ShopSlot
            { card = CardLibrary.FindById(slot.cardId), price = slot.price, sold = slot.sold, empty = slot.empty,
                mystery = slot.mystery, free = slot.free, label = slot.label, shaReplenish = slot.shaReplenish }).ToList();
        internal override void OnClose()
        {
            _closed = true;
            if (!CanOpen(GameRuntime.I) || _shopNodeId != GameRuntime.I.CurrentNodeId) return;
            GameRuntime.I.FinishNode(); GameRuntime.I.Audio.PlayBgm("board");
        }

        public override void Build()
        {
            var st = GameRuntime.I.State;
            var root = UIKit.Panel("shop-pg", transform);
            var bg = UIKit.Image(root.transform, Sdt.Res.Res.Scene("scene-shop-bg"));
            UiExt.Stretch(bg.rectTransform);
            var dim = UiExt.Box(root.transform, Color.black, 0.35f);
            UiExt.Stretch(dim.rectTransform);

            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(24, 24, 18, 18);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            if (BuildCommission(root.transform)) return;

            // header：金币 chip
            var head = UiExt.Row(root.transform);
            var headHl = head.AddComponent<HorizontalLayoutGroup>();
            headHl.spacing = 12; headHl.childAlignment = TextAnchor.MiddleLeft;
            headHl.childForceExpandWidth = false; headHl.childForceExpandHeight = false;
            var h2 = UIKit.IconText(head.transform, "[[icon:bag]] 拾荒商队");
            h2.fontSize = 26; h2.fontStyle = FontStyle.Bold; h2.color = Color.white;
            UiExt.Chip(head.transform, "[[icon:coin]] <b>" + st.coins + "</b> 币", UiPalette.HexA("#2A2313", 0.9f));

            // .shop-grid：9 货位 + 侧栏
            var gridRow = UiExt.Row(root.transform);
            var grHl = gridRow.AddComponent<HorizontalLayoutGroup>();
            grHl.spacing = 12; grHl.childForceExpandWidth = true; grHl.childForceExpandHeight = true;
            grHl.childControlWidth = true; grHl.childControlHeight = true;
            var leG = gridRow.AddComponent<LayoutElement>(); leG.flexibleHeight = 1;

            var gridScroll = UIKit.Scroll(gridRow.transform);
            var leSc = gridScroll.AddComponent<LayoutElement>(); leSc.flexibleWidth = 3; leSc.flexibleHeight = 1;
            var grid = UIKit.Grid(gridScroll.transform, 3, new Vector2(170, 240), new Vector2(12, 12));

            for (int i = 0; i < _stock.Count; i++)
            {
                var slot = _stock[i];
                var index = i;
                var cell = new GameObject("shop-slot", typeof(RectTransform));
                cell.transform.SetParent(grid.transform, false);
                var cvl = cell.AddComponent<VerticalLayoutGroup>();
                cvl.spacing = 6; cvl.padding = new RectOffset(6, 6, 6, 6); cvl.childAlignment = TextAnchor.MiddleCenter;
                cvl.childForceExpandWidth = false; cvl.childForceExpandHeight = false;
                cvl.childControlWidth = true; cvl.childControlHeight = true;
                var bgBox = UiExt.Box(cell.transform, UiPalette.HexA("#0E2230", 0.85f));
                bgBox.transform.SetAsFirstSibling();
                UiExt.Stretch(bgBox.rectTransform);

                if (slot.empty)
                {
                    var e = UIKit.Label(cell.transform, slot.label ?? "无货", 15, UiPalette.Dim);
                    e.alignment = TextAnchor.MiddleCenter;
                    var le = e.gameObject.AddComponent<LayoutElement>(); le.minHeight = 180; le.flexibleHeight = 1;
                    continue;
                }
                if (slot.sold)
                {
                    var e = UIKit.Label(cell.transform, "已售出", 15, UiPalette.Dim);
                    e.alignment = TextAnchor.MiddleCenter;
                    var le = e.gameObject.AddComponent<LayoutElement>(); le.minHeight = 180; le.flexibleHeight = 1;
                    continue;
                }
                if (slot.mystery)
                {
                    var e = UIKit.IconText(cell.transform, "[[icon:dice]] 随机卡牌");
                    e.fontSize = 18; e.alignment = TextAnchor.MiddleCenter; e.color = UiPalette.AkMint;
                    var le = e.gameObject.AddComponent<LayoutElement>(); le.minHeight = 180; le.flexibleHeight = 1;
                }
                else
                {
                    CardFace.Create(slot.card, CardSize.Md, cell.transform);
                }
                bool afford = st.coins >= slot.price;
                var buy = UIKit.Btn(cell.transform, "[[icon:coin]] " + slot.price + " 币", () => Buy(index));
                buy.interactable = afford;
                ((RectTransform)buy.transform).sizeDelta = new Vector2(120, 30);
            }

            // aside.shop-side：金币箱 + 离开
            var side = new GameObject("shop-side", typeof(RectTransform));
            side.transform.SetParent(gridRow.transform, false);
            var svl = side.AddComponent<VerticalLayoutGroup>();
            svl.spacing = 10; svl.padding = new RectOffset(10, 10, 10, 10); svl.childAlignment = TextAnchor.UpperCenter;
            svl.childForceExpandWidth = true; svl.childForceExpandHeight = false;
            svl.childControlWidth = true; svl.childControlHeight = true;
            var leSide = side.AddComponent<LayoutElement>(); leSide.flexibleWidth = 1; leSide.minWidth = 180;
            var coinbox = new GameObject("shop-coinbox", typeof(RectTransform));
            coinbox.transform.SetParent(side.transform, false);
            var cbImg = UiExt.Box(coinbox.transform, UiPalette.HexA("#2A2313", 0.9f));
            UiExt.Stretch(cbImg.rectTransform);
            var cbT = UIKit.IconText(coinbox.transform, "[[icon:coin]] 持有 <b>" + st.coins + "</b> 币");
            cbT.alignment = TextAnchor.MiddleCenter; cbT.fontSize = 16;
            var leC = coinbox.AddComponent<LayoutElement>(); leC.minHeight = 48; leC.flexibleHeight = 0;
            var leave = UIKit.Btn(side.transform, "[[icon:exit]] 离开商店", () => { Close(); GameRuntime.I.FinishNode(); });
            ((RectTransform)leave.transform).sizeDelta = new Vector2(160, 38);

            // 出售区
            UiExt.SectionLabel(root.transform, "出售卡牌");
            var sellScroll = UIKit.Scroll(root.transform);
            var leSS = sellScroll.AddComponent<LayoutElement>(); leSS.minHeight = 140; leSS.flexibleHeight = 0.5f; leSS.flexibleWidth = 1;
            var sellGrid = UIKit.Grid(sellScroll.transform, 6, new Vector2(120, 190), new Vector2(10, 10));
            var sellables = st.ownedCards.Where(o => o.safe != true && !o.stored && string.IsNullOrEmpty(o.pouchOf) && CardLibrary.IsSellable(o.card)).ToList();
            if (sellables.Count == 0)
            {
                var empty = UIKit.Label(sellScroll.transform, "没有可出售的卡牌——只有带「可出售」备注的卡才能卖给商店（默认不可出售）。", 14, UiPalette.Dim);
            }
            else
            {
                foreach (var owned in sellables)
                {
                    var o = owned;
                    var cell = new GameObject("bag-card", typeof(RectTransform));
                    cell.transform.SetParent(sellGrid.transform, false);
                    var cvl = cell.AddComponent<VerticalLayoutGroup>();
                    cvl.spacing = 4; cvl.childAlignment = TextAnchor.MiddleCenter;
                    cvl.childForceExpandWidth = false; cvl.childForceExpandHeight = false;
                    CardFace.Create(o.card, CardSize.Sm, cell.transform);
                    UIKit.Btn(cell.transform, "出售 ＋" + CardLibrary.SellPrice(o.card) + " 币", () => Sell(o.uid));
                }
            }
        }

        string _commissionFeedback;
        void Buy(int index)
        {
            var runtime = GameRuntime.I;
            if (!CurrentShop()) return;
            if (index < 0 || index >= _stock.Count) return;
            var quote = _stock[index];
            bool ok = runtime.TryPersistMutation(() =>
            {
                RequireCurrentShop();
                var offers = runtime.CurrentNodeReceipt.shopStock;
                if (offers == null || index >= offers.Count) throw new InvalidOperationException("商店已变化，请重新选择");
                var slot = offers[index];
                if (slot.cardId != quote.card?.id || slot.price != quote.price || slot.sold || slot.empty) throw new InvalidOperationException("商品已变化，请重新选择");
                if (slot.price < 0 || runtime.State.coins < slot.price) throw new InvalidOperationException("金币不足");
                var card = CardLibrary.FindById(slot.cardId);
                if (card == null || !runtime.GrantCard(card)) throw new InvalidOperationException("背包需腾位，尚未扣款");
                runtime.State.coins -= slot.price;
                if (slot.shaReplenish.HasValue) { slot.shaReplenish--; slot.sold = slot.shaReplenish <= 0; }
                else slot.sold = true;
            }, out var reason);
            if (!ok) RunLog.Log(reason, "warn");
            ReloadStock(); Rebuild();
        }

        bool BuildCommission(Transform parent)
        {
            var runtime = GameRuntime.I;
            var outcome = runtime.GetCommissionOutcome();
            if (outcome == null) return false;
            UIKit.Label(parent, "商队凭据 · 确认免单货位", 26, Theme.Txt);
            if (!string.IsNullOrEmpty(outcome.Message)) UIKit.Label(parent, outcome.Message, 17, Theme.Sub);
            if (!string.IsNullOrEmpty(_commissionFeedback) && _commissionFeedback != outcome.Message) UIKit.Label(parent, _commissionFeedback, 16, UiPalette.Warn);
            var scroll = UIKit.Scroll(parent);
            if (outcome.PreviewCardIds != null) foreach (var id in outcome.PreviewCardIds)
            {
                var card = CardLibrary.FindById(id);
                if (card != null) CardFace.Create(card, CardSize.Md, scroll.transform);
            }
            if (outcome.DiceLabels != null) foreach (var label in outcome.DiceLabels) UIKit.Label(scroll.transform, label, 17, Theme.Sub);
            if (outcome.Choices.Count == 0) UIKit.BtnOk(parent, "投掷骰子", () => { if (!CurrentShop()) return; _commissionFeedback = runtime.RollCommissionDice()?.Message; ReloadStock(); Rebuild(); });
            else UIKit.BtnOk(parent, "确认本次结果", () => { if (!CurrentShop()) return; _commissionFeedback = runtime.ConfirmCommissionDice()?.Message; ReloadStock(); Rebuild(); });
            UIKit.Btn(parent, "暂离商店", Close);
            return true;
        }

        void Sell(string uid)
        {
            var runtime = GameRuntime.I;
            if (!CurrentShop()) return;
            bool ok = runtime.TryPersistMutation(() =>
            {
                RequireCurrentShop();
                var card = runtime.State.ownedCards.SingleOrDefault(entry => entry.uid == uid && entry.safe != true && !entry.stored);
                if (card == null || !CardLibrary.IsSellable(card.card)) throw new InvalidOperationException("该卡牌不可出售");
                int price = CardLibrary.SellPrice(card.card);
                if (!CardContainerCommands.TryDiscard(runtime, uid, out var discardReason)) throw new InvalidOperationException(discardReason);
                runtime.State.coins += price;
            }, out var reason);
            if (!ok) RunLog.Log(reason, "warn");
            ReloadStock(); Rebuild();
        }

        void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Destroy(transform.GetChild(i).gameObject);
            Build();
        }
    }
}
