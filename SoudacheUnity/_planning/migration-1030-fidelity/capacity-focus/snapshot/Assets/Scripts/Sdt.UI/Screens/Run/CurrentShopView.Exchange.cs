using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class CurrentShopView
    {
        RectTransform _ledger,_catalog;GridLayoutGroup _sellGrid;bool _sellRule;
        List<OwnedCard> Sellables()=>GameRuntime.I.State.ownedCards.Where(item=>!item.stored&&string.IsNullOrEmpty(item.pouchOf)&&CardLibrary.IsSellable(item.card)).ToList();
        void BuildExchange()
        {
            var sellables=Sellables();var state=GameRuntime.I.State;
            _ledger=Rect(_body,"sell-ledger");UIKit.GetOrAdd<Image>(_ledger).color=Theme.Hex("#1a2023f0");
            Label(_ledger,"ledger-title","商队收购单",26,"#eef1ed",true);
            Label(_ledger,"ledger-total","合计\n<size=36><color=#e0c98c>[[icon:coin]] "+sellables.Sum(item=>CardLibrary.SellPrice(item.card))+"</color></size> 币",18,"#b9c9d2");
            Label(_ledger,"ledger-facts","持有卡牌                 "+state.ownedCards.Count+" 张\n符合条件                 "+sellables.Count+" 张\n当前金币                 "+state.coins+" 币",18,"#b9c9d2");
            Button(_ledger,"shopSellRule",(_sellRule?"▾ ":"▸ ")+"收购规则",()=>{_sellRule=!_sellRule;Render();},"#00000000","#eef1ed",17);
            var rule=Label(_ledger,"ledger-rule","仅收购带“可出售”备注的货币与宝石类卡牌。点击“确认卖出”后立即成交，价格等于卡面币值。",18,"#b9c9d2");SourceTextLayout.Cjk(rule);rule.lineSpacing=SourceTextLayout.LineSpacing(rule,1.75f);rule.gameObject.SetActive(_sellRule);
            _catalog=Rect(_body,"sell-catalog");UIKit.GetOrAdd<Image>(_catalog).color=Theme.Hex("#1a2023e8");
            Label(_catalog,"catalog-kicker","APPRAISAL LIST",13,"#b9c9d2");Label(_catalog,"catalog-title","待估物清单",25,"#eef1ed",true);
            var total=Label(_catalog,"catalog-total",sellables.Count+" 件",18,"#e0c98c");total.alignment=TextAnchor.MiddleRight;
            var content=UIKit.Scroll(_catalog);_boardScroll=content.GetComponentInParent<ScrollRect>();_boardScroll.name="shop-sell-scroll";_boardScroll.scrollSensitivity=36;_boardScroll.movementType=ScrollRect.MovementType.Clamped;
            DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());
            _sellGrid=UIKit.GetOrAdd<GridLayoutGroup>(content);_sellGrid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;_sellGrid.constraintCount=3;_sellGrid.spacing=new Vector2(18,18);_sellGrid.childAlignment=TextAnchor.UpperLeft;
            foreach(var owned in sellables)
            {
                var entry=owned;var tile=Rect(content.transform,"shop-sell-"+owned.uid);UIKit.GetOrAdd<Image>(tile).color=Theme.Hex("#252d30cc");
                var card=DepartureElements.Card(tile,entry.card,170,"sell-card-face",new CardFaceOptions{HideCost=false,ScrollDescription=false});card.anchorMin=card.anchorMax=new Vector2(.5f,1);card.anchoredPosition=new Vector2(0,-26);
                Label(tile,"sell-item-source",(entry.safe==true?"安全格":"随身背包")+" · 出售 ×1",14,"#b9c9d2");
                var offer=Label(tile,"sell-item-offer","卖出可得     [[icon:coin]] +"+CardLibrary.SellPrice(entry.card)+" 币",18,"#e0c98c");
                Button(tile,"sellCard-"+entry.uid,"确认卖出",()=>{if(Current){SaveBrowse();_sell?.Invoke(entry.uid);}},"#e0c98c","#1c2124",18);
            }
            if(sellables.Count==0){_sellGrid.enabled=false;var empty=Label(content.transform,"shop-sell-empty","背包里没有可以卖的卡牌（持有 "+state.ownedCards.Count+" 张）——只有带「可出售」备注的卡（货币卡等）商店才收。",17,"#b9c9d2");SourceTextLayout.Cjk(empty);empty.alignment=TextAnchor.MiddleCenter;}
        }
        void LayoutExchange()
        {
            float width=_body.rect.width,height=_body.rect.height,left=Mathf.Max(240,(width-24)*.28f),right=width-left-24;
            Place(_ledger,0,0,left,Mathf.Min(height,_sellRule?550:410));Place(_catalog,left+24,0,right,height);
            Place(_ledger.Find("ledger-title"),24,24,left-48,44);Place(_ledger.Find("ledger-total"),24,92,left-48,90);Place(_ledger.Find("ledger-facts"),24,206,left-48,112);
            Place(_ledger.Find("shopSellRule"),24,336,left-48,44);Place(_ledger.Find("ledger-rule"),24,390,left-48,140);
            Place(_catalog.Find("catalog-kicker"),24,24,right-48,24);Place(_catalog.Find("catalog-title"),24,53,right-200,38);Place(_catalog.Find("catalog-total"),right-174,50,150,38);
            Place(_boardScroll.transform,24,108,right-48,height-132);float cell=(right-48-36)/3;_sellGrid.cellSize=new Vector2(cell,416);
            foreach(Transform tile in _sellGrid.transform)
            {
                if(tile.name=="shop-sell-empty"){Place(tile,24,20,right-96,190);continue;}
                Place(tile.Find("sell-item-source"),16,295,cell-32,24);Place(tile.Find("sell-item-offer"),16,330,cell-32,30);Place(tile.Find("sellCard-"+tile.name.Substring("shop-sell-".Length)),16,365,cell-32,44);
            }
        }
    }
}
