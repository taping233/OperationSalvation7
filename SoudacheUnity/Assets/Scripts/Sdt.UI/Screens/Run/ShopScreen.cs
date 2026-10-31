using System.Collections.Generic;
// Current game.run.shop.js: persistent offers, five-column shelf, inspection and separate exchange.
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>现行补给站：持久货架、商品检视购买与独立收购台；呈现由 CurrentShopView 维护。</summary>
    public class ShopScreen : Panel
    {
        /// <summary>货位：card+price / sold / empty / mystery（对齐 game.shopStock 条目语义）。</summary>
        public sealed class ShopSlot { public CardDef card; public int price; public bool sold; public bool empty; public string label; public bool mystery; public bool free; public int? shaReplenish; }

        System.Collections.Generic.List<ShopSlot> _stock;

        /// <summary>现行 generateShopStock：6 个同名去重随机位、饮料、初始攻击及神秘货箱；由节点回执持久保存。</summary>
        public static System.Collections.Generic.List<ShopSlot> GenerateStock()
        {
            var runtime = GameRuntime.I;
            var rng = runtime.Rng;
            var lib = CardLibrary.All().Where(card => CardLibrary.IsRandomObtainable(card) && CardLibrary.DropTypes.Contains(card.type) && card.id != "tt-token-color").ToList();
            var slots = new List<ShopSlot>();
            var drink = lib.FirstOrDefault(card => card.id == "tt4-woodify") ?? CardLibrary.FindById("tt4-woodify");
            var names = new HashSet<string>();
            if (drink != null) names.Add(drink.name);
            double total = CardLibrary.ShopWeights.Values.Sum();
            string PickWeightedRarity()
            {
                double roll = rng.Random("shop", "reward") * total;
                foreach (var weight in CardLibrary.ShopWeights) { roll -= weight.Value; if (roll <= 0) return weight.Key; }
                return "古朴";
            }
            CardDef PickRandomCard()
            {
                for (int tries = 0; tries < 50; tries++)
                {
                    var card = CardLibrary.PickOfRarity(rng, PickWeightedRarity());
                    if (card != null && !names.Contains(card.name)) return card;
                }
                var fallback = lib.Where(card => !names.Contains(card.name)).ToList();
                return fallback.Count > 0 ? fallback[(int)(rng.Random("shop", "reward") * fallback.Count)] : null;
            }
            bool catFree = runtime.Base?.CarriedPet?.effect?.shopFree == true;
            for (int index = 0; index < 6; index++)
            {
                var chosen = PickRandomCard();
                if (chosen != null) names.Add(chosen.name);
                slots.Add(chosen == null ? new ShopSlot { empty = true, label = "卡牌库无货" } : new ShopSlot { card = chosen,
                    price = catFree && index == 0 ? 0 : CardLibrary.Price.TryGetValue(chosen.rarity, out var price) ? price : 2, free = catFree && index == 0 });
            }
            slots.Add(new ShopSlot { card = drink, price = 2 });
            slots.Add(new ShopSlot { card = CardLibrary.SHA.Clone(), price = 1, shaReplenish = 5 });
            CardDef mystery = null;
            for (int tries = 0; tries < 50; tries++)
            {
                double roll = rng.Random("shop", "reward");
                var card = lib.Count > 0 ? lib[(int)(roll * lib.Count)] : null;
                if (card != null && !names.Contains(card.name)) { mystery = card; break; }
            }
            slots.Add(mystery != null ? new ShopSlot { card = mystery, mystery = true, price = 3 }
                : new ShopSlot { empty = true, label = "卡牌库无货" });
            return slots;
        }

        string _shopNodeId;
        bool _closed,_unsaved,_departed;
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
            if(runtime.HasPendingShopAcquisition){ChestOpenScreen.OpenPending(null);return;}
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
            if(!_departed)GameRuntime.I.FinishNode();
            GameRuntime.I.Audio.PlayBgm("board");
        }

        void Leave()
        {
            var runtime=GameRuntime.I;
            if(!CurrentShop())return;
            if(_unsaved&&!runtime.TryPersistMutation(()=>{},out var reason))
            {
                _view?.Notice("本局已成交，保存仍未成功；请再次点击返回地图重试保存。"+reason);
                return;
            }
            _unsaved=false;_departed=true;
            bool bonus=runtime.HasPendingShopAcquisition;
            runtime.State.Phase="idle";
            Close();
            if(bonus)ChestOpenScreen.OpenPending(null);
        }

        CurrentShopView _view;
        public override void Build()
        {
            if(GameRuntime.I.GetCommissionOutcome()!=null)
            {
                var root=CurrentNodeElements.Rect(transform,"shop-source-root");UiStack.Stretch(root);
                CurrentShopView.Background(root);
                var form=CurrentNodeElements.Rect(root,"shop-commission");CurrentNodeElements.Stretch(form,42,118,42,24);
                var layout=UIKit.GetOrAdd<VerticalLayoutGroup>(form);layout.spacing=18;layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandHeight=false;
                BuildCommission(form);return;
            }
            _view=CurrentShopView.Create(this,_stock,Buy,Sell,Leave);
        }
        public override void CloseFromEscape(){if(_commissionView!=null){_commissionView.RequestLeave();return;}if(_view!=null&&_view.BackFromSubpage())return;Leave();}

        CurrentShopCommission _commissionView;
        void Buy(int index)
        {
            var runtime = GameRuntime.I;
            if (!CurrentShop()) return;
            if (index < 0 || index >= _stock.Count) return;
            var quote = _stock[index];
            bool saved = runtime.TryPersistMutation(() =>
            {
                RequireCurrentShop();
                var offers = runtime.CurrentNodeReceipt.shopStock;
                if (offers == null || index >= offers.Count) throw new InvalidOperationException("商店已变化，请重新选择");
                var slot = offers[index];
                if (slot.cardId != quote.card?.id || slot.price != quote.price || slot.sold || slot.empty) throw new InvalidOperationException("商品已变化，请重新选择");
                if (slot.price < 0 || runtime.State.coins < slot.price) throw new InvalidOperationException("金币不足");
                var card = CardLibrary.FindById(slot.cardId);
                if (card == null || !runtime.GrantCard(card)) throw new InvalidOperationException("背包需腾位，尚未扣款");
                if(slot.mystery)runtime.ReserveShopAcquisition(card);
                runtime.State.coins -= slot.price;
                if (slot.shaReplenish.HasValue) { slot.shaReplenish--; slot.sold = slot.shaReplenish <= 0; }
                else slot.sold = true;
            }, out var reason,true,out bool applied);
            if(!applied){if(_view!=null)_view.Notice("交易未成交，未扣款，可重试。"+reason);RunLog.Log(reason,"warn");}
            else
            {
                _unsaved=!saved;
                _view?.Purchased(index,quote.mystery);
                _view?.Notice(saved?(quote.price==0?"免费领取":"已购入")+"「"+quote.card?.name+"」 · 已入本次远征背包 · 剩余 "+runtime.State.coins+" 币"
                    :runtime.HasPendingShopAcquisition?"本次已成交，附赠卡已保留；点击返回地图重试保存，成功后继续领取附赠"
                    :"本局已成交，币、背包与货架已同步更新；保存未成功，离店时可重试保存。");
                runtime.Audio.PlaySfx("tradeBuy");
                if(saved&&runtime.HasPendingShopAcquisition){Leave();return;}
            }
            ReloadStock(); Rebuild();
        }

        bool BuildCommission(Transform parent)
        {
            if(GameRuntime.I.GetCommissionOutcome()==null)return false;
            var old=parent.GetComponent<VerticalLayoutGroup>();if(old!=null)DestroyImmediate(old);CurrentNodeElements.Stretch((RectTransform)parent);
            _commissionView=CurrentShopCommission.Create(this,parent,()=>{ReloadStock();_commissionView=null;Rebuild();},Leave);
            return true;
        }

        void Sell(string uid)
        {
            var runtime = GameRuntime.I;
            if (!CurrentShop()) return;
            bool saved = runtime.TryPersistMutation(() =>
            {
                RequireCurrentShop();
                var card = runtime.State.ownedCards.SingleOrDefault(entry => entry.uid == uid && !entry.stored && string.IsNullOrEmpty(entry.pouchOf));
                if (card == null || !CardLibrary.IsSellable(card.card)) throw new InvalidOperationException("该卡牌不可出售");
                int price = CardLibrary.SellPrice(card.card);
                if (!CardContainerCommands.TryDiscard(runtime, uid, out var discardReason)) throw new InvalidOperationException(discardReason);
                runtime.State.coins += price;
            }, out var reason,true,out bool applied);
            if(!applied){if(_view!=null)_view.Notice("交易未成交，卡牌与金币已保留，可重试。"+reason);RunLog.Log(reason,"warn");}
            else{_unsaved=!saved;runtime.Audio.PlaySfx("tradeSell");_view?.Notice(saved?"已出售 ×1 · 当前金币 "+runtime.State.coins+" 币"
                :"本局已成交，币、背包与货架已同步更新；保存未成功，离店时可重试保存。");}
            ReloadStock(); Rebuild();
        }

        void Rebuild()
        {
            if(_view!=null&&GameRuntime.I.GetCommissionOutcome()==null){_view.Refresh(_stock);return;}
            for(int i=transform.childCount-1;i>=0;i--){transform.GetChild(i).gameObject.SetActive(false);Destroy(transform.GetChild(i).gameObject);}
            _view=null;Build();
        }
    }
}
