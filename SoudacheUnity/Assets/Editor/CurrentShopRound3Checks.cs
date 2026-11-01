// Retained shop controls on controlled stock; real native submit, no OS keyboard/mouse.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Bag;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public static class CurrentShopRound3Checks
{
    public static int Assertions { get; private set; }
    public static string Step { get; private set; }
    static void Require(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Shop round3: "+message);}
    static void Clear(){CurrentRunFilm.CancelActive();Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();while(UiStack.Count>0)UiStack.Pop();}
    static Button Find(string name)=>UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.name==name);
    static void Submit(Button button){Require(button!=null&&button.isActiveAndEnabled&&button.interactable,"native submit target available");EventSystem.current.SetSelectedGameObject(button.gameObject);ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);}
    static ShopScreen Fixture()
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.entrySupply=null;game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.coins=40;game.State.battleActive=false;game.State.Phase="idle";
        var shopNode=game.Map.Snapshot.layers.SelectMany(layer=>layer.nodes).First(node=>node.type=="shop");
        game.State.layerIdx=shopNode.li;game.State.trackPos=shopNode.idx;
        var library=CardLibrary.All();var longCard=library.First(card=>card.type!="资源"&&!BaseData.IsSha(card)&&Sdt.Res.CurrentCardPresentation.Description(card).Length>80);
        var second=library.First(card=>card.type=="法术"&&!BaseData.IsSha(card)&&card.id!=longCard.id);
        var sale=library.First(card=>CardLibrary.IsSellable(card)&&CardLibrary.SellPrice(card)>0);
        game.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="shop-r3-start",card=CardLibrary.SHA.Clone()},new OwnedCard{uid="shop-r3-sale-a",card=sale.Clone(),safe=true},new OwnedCard{uid="shop-r3-sale-b",card=sale.Clone()}};
        game.CurrentNodeReceipt.shopStock=Enumerable.Range(0,9).Select(index=>new ShopOfferReceipt{cardId=(index==0?longCard:index==1?second:CardLibrary.SHA).id,price=2}).ToList();
        ShopScreen.Open();return UiStack.Top as ShopScreen;
    }
    static Transform Face(Transform parent)=>parent.GetComponentsInChildren<Transform>().First(item=>item.name=="paper-card");
    static IEnumerator Wait(){yield return new WaitForSecondsRealtime(.4f);}
    public static IEnumerator Run()
    {
        Assertions=0;Require(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        bool coverAfterSave=false;GameRuntime.I.Bus.On<SaveCompleted>(_=>{if(coverAfterSave){coverAfterSave=false;BagScreen.Open();}});
        try
        {
            Step="retained shelf/detail/rules/bag";var shop=Fixture();yield return Wait();var game=GameRuntime.I;
            Require(shop!=null,"formal shop opened");var view=shop.GetComponentInChildren<CurrentShopView>();
            var shelf=shop.GetComponentsInChildren<ScrollRect>().Single(scroll=>scroll.name=="shop-board-scroll");
            var offer=Find("shop-slot-0");var offerFace=Face(offer.transform);var content=view.transform.Find("shop-page-content");
            Submit(offer);yield return Wait();var close=Find("shopCloseInspect");var detail=close.transform.parent;var detailFace=Face(detail);var detailScroll=detail.GetComponentsInChildren<ScrollRect>().Single(scroll=>scroll.name=="shop-detail-scroll");
            Submit(Find("shopRules"));yield return null;
            Require(Face(detail)==detailFace&&detail.GetComponentsInChildren<ScrollRect>().Single(scroll=>scroll.name=="shop-detail-scroll")==detailScroll,"rule disclosure retains face and scroll");
            detailScroll.verticalNormalizedPosition=.31f;float position=detailScroll.verticalNormalizedPosition;
            var beforeBagBuy=Find("buyCard-0").onClick;string cards=SaveJson.Stringify(game.State.ownedCards),rng=game.Rng.SaveState();int coins=game.State.coins;
            BagScreen.Open();yield return null;UiStack.Top.CloseFromEscape();yield return Wait();
            Require(view.transform.Find("shop-page-content")==content&&Find("shop-slot-0")==offer&&Face(offer.transform)==offerFace,"bag return retains shelf and face");
            Require(Find("shopCloseInspect")==close&&Face(detail)==detailFace&&detail.GetComponentsInChildren<ScrollRect>().Single(scroll=>scroll.name=="shop-detail-scroll")==detailScroll,"bag return retains detail controls and face");
            Require(Mathf.Abs(detailScroll.verticalNormalizedPosition-position)<.04f&&detail.Find("shop-detail-content/shop-detail-scroll")!=null,"detail scroll retained");
            beforeBagBuy.Invoke();Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards&&game.Rng.SaveState()==rng,"pre-refresh captured quote event is inert");
            Step="one purchase, same control, actionable focus";var oldBuy=Find("buyCard-0").onClick;Submit(Find("buyCard-0"));yield return null;
            Require(game.State.coins==coins-2&&game.State.ownedCards.Count==4&&game.CurrentNodeReceipt.shopStock[0].sold,"purchase commits one owned card and one offer");
            Require(Find("shop-slot-0")==offer&&Face(offer.transform)==offerFace&&Find("shopCloseInspect")==close&&Face(detail)==detailFace,"purchase retains unchanged paper faces and detail");
            Require(EventSystem.current.currentSelectedGameObject==Find("shop-detail-done").gameObject,"sold purchase focuses same retained done action");
            Submit(Find("shop-detail-done"));yield return Wait();Submit(Find("shop-slot-1"));yield return Wait();
            coins=game.State.coins;cards=SaveJson.Stringify(game.State.ownedCards);rng=game.Rng.SaveState();oldBuy.Invoke();
            Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards&&game.Rng.SaveState()==rng&&!game.CurrentNodeReceipt.shopStock[1].sold,"old detail action cannot buy newly selected offer");
            Step="backpack rollback refreshes receipt identity";BagScreen.Open();yield return null;
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))
            {Require(!game.TryPersistMutation(()=>game.State.coins--,out _),"controlled I/O fault rejects default mutation");}
            UiStack.Top.CloseFromEscape();yield return Wait();Submit(Find("buyCard-1"));yield return null;
            Require(game.CurrentNodeReceipt.shopStock[1].sold&&game.State.coins==coins-2,"first post-rollback purchase accepts fresh receipt identity");
            Submit(Find("shop-detail-done"));yield return Wait();
            Step="retained exchange UID and next focus";Submit(Find("openSell"));yield return null;
            var saleB=Find("sellCard-shop-r3-sale-b");var saleBFace=Face(saleB.transform.parent);var saleA=Find("sellCard-shop-r3-sale-a");
            var changed=game.State.ownedCards.Single(entry=>entry.uid=="shop-r3-sale-a");changed.card=changed.card.Clone();changed.card.name+="（来源已变）";
            coins=game.State.coins;cards=SaveJson.Stringify(game.State.ownedCards);rng=game.Rng.SaveState();Submit(saleA);yield return null;
            Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards&&game.Rng.SaveState()==rng,"same UID with replaced card rejects old sale quote");
            saleA=Find("sellCard-shop-r3-sale-a");var staleSale=saleA.onClick;
            int price=CardLibrary.SellPrice(game.State.ownedCards.Single(entry=>entry.uid=="shop-r3-sale-a").card);coins=game.State.coins;
            Submit(saleA);yield return null;
            Require(game.State.ownedCards.All(entry=>entry.uid!="shop-r3-sale-a")&&game.State.ownedCards.Count(entry=>entry.uid=="shop-r3-sale-b")==1&&game.State.coins==coins+price,"sale consumes exactly observed UID including safe source");
            Require(Find("sellCard-shop-r3-sale-b")==saleB&&Face(saleB.transform.parent)==saleBFace,"remaining UID sale face and button retained");
            Require(EventSystem.current.currentSelectedGameObject==saleB.gameObject,"sale focuses next current UID");
            cards=SaveJson.Stringify(game.State.ownedCards);coins=game.State.coins;staleSale.Invoke();Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards,"old sale event cannot consume another UID");
            Submit(Find("shopSellRule"));Require(Find("sellCard-shop-r3-sale-b")==saleB&&Face(saleB.transform.parent)==saleBFace,"sale rule disclosure retains UID face");
            Submit(Find("backShop"));yield return null;Require(Find("shop-slot-0")==offer&&shop.GetComponentsInChildren<ScrollRect>().Single(scroll=>scroll.name=="shop-board-scroll")==shelf,"market/exchange navigation retains shelf scroll");
            Step="old owner cannot transact after seed changes";Submit(Find("shop-slot-2"));yield return Wait();var staleOwner=Find("buyCard-2").onClick;
            game.State.seed++;cards=SaveJson.Stringify(game.State.ownedCards);coins=game.State.coins;rng=game.Rng.SaveState();staleOwner.Invoke();
            Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards&&game.Rng.SaveState()==rng,"changed source rejects old owner action");
            Step="changed offer rejects stale terms without applying";shop=Fixture();yield return Wait();Submit(Find("shop-slot-1"));yield return Wait();
            game.CurrentNodeReceipt.shopStock[1].price=3;coins=game.State.coins;cards=SaveJson.Stringify(game.State.ownedCards);rng=game.Rng.SaveState();string disk=File.ReadAllText(SaveSystem.ProfilePath);
            Submit(Find("buyCard-1"));yield return null;
            Require(game.State.coins==coins&&SaveJson.Stringify(game.State.ownedCards)==cards&&game.Rng.SaveState()==rng&&!game.CurrentNodeReceipt.shopStock[1].sold&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"changed live price rejects old terms without card, coin, RNG or disk mutation");
            Step="save observer covers owner without stealing focus";shop=Fixture();yield return Wait();Submit(Find("shop-slot-1"));yield return Wait();coins=game.State.coins;coverAfterSave=true;
            Submit(Find("buyCard-1"));yield return null;var cover=UiStack.Top;var focus=EventSystem.current.currentSelectedGameObject;
            Require(cover is BagScreen&&game.State.coins==coins-2&&game.CurrentNodeReceipt.shopStock[1].sold,"save observer cover preserves committed trade");
            yield return null;Require(UiStack.Top==cover&&EventSystem.current.currentSelectedGameObject==focus,"old shop post-save feedback does not steal cover focus");
            cover.CloseFromEscape();yield return Wait();Require(Find("shop-detail-done")!=null,"return refreshes completed trade without replay");
            Step="complete";
        }
        finally{coverAfterSave=false;Clear();}
    }
}
