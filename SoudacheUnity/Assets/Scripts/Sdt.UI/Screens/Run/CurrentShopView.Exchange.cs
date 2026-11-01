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
        RectTransform _ledger,_catalog,_ledgerPrice;GridLayoutGroup _sellGrid;bool _sellRule;
        Text _ledgerFacts,_ledgerAmount,_catalogTotal,_sellEmpty;Button _sellRuleButton;
        sealed class SaleCell { public RectTransform root,card;public Text source,amount;public Button button;public string faceKey; }
        readonly Dictionary<string,SaleCell> _saleCells=new Dictionary<string,SaleCell>();
        void BuildExchange()
        {
            var sellables=_facts.Sellables;var state=GameRuntime.I.State;
            if(_ledger==null)
            {
                _ledger=Rect(_body,"sell-ledger");UIKit.GetOrAdd<Image>(_ledger).color=Theme.Hex("#1a2023f0");Label(_ledger,"ledger-title","商队收购单",26,"#eef1ed",true);
                var ledgerTotal=Rect(_ledger,"ledger-total");Label(ledgerTotal,"total-label","合计",15,"#b9c9d2");Label(ledgerTotal,"total-unit","币",15,"#b9c9d2");
                var price=new CurrentShopCoin.Row(ledgerTotal,"total-value",50);price.Coin(36);price.Space(8);_ledgerAmount=price.Text("amount","",36,"#e0c98c",true);_ledgerPrice=price.Root;
                _ledgerFacts=Label(_ledger,"ledger-facts","",18,"#b9c9d2");
                _sellRuleButton=Button(_ledger,"shopSellRule","",()=>{_sellRule=!_sellRule;SyncSaleRule();LayoutExchange();},"#00000000","#eef1ed",17);
                var rule=Label(_ledger,"ledger-rule","仅收购带“可出售”备注的货币与宝石类卡牌。点击“确认卖出”后立即成交，价格等于卡面币值。",18,"#b9c9d2");SourceTextLayout.Cjk(rule);rule.lineSpacing=SourceTextLayout.LineSpacing(rule,1.75f);
                _catalog=Rect(_body,"sell-catalog");UIKit.GetOrAdd<Image>(_catalog).color=Theme.Hex("#1a2023e8");Label(_catalog,"catalog-kicker","APPRAISAL LIST",13,"#b9c9d2");Label(_catalog,"catalog-title","待估物清单",25,"#eef1ed",true);_catalogTotal=Label(_catalog,"catalog-total","",18,"#e0c98c");_catalogTotal.alignment=TextAnchor.MiddleRight;
                var content=UIKit.Scroll(_catalog);_sellScrollRect=content.GetComponentInParent<ScrollRect>();_sellScrollRect.name="shop-sell-scroll";_sellScrollRect.scrollSensitivity=36;_sellScrollRect.movementType=ScrollRect.MovementType.Clamped;DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());
                _sellGrid=UIKit.GetOrAdd<GridLayoutGroup>(content);_sellGrid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;_sellGrid.constraintCount=3;_sellGrid.spacing=new Vector2(18,18);_sellGrid.childAlignment=TextAnchor.UpperLeft;
                _sellEmpty=Label(content.transform,"shop-sell-empty","",17,"#b9c9d2");SourceTextLayout.Cjk(_sellEmpty);_sellEmpty.alignment=TextAnchor.MiddleCenter;
            }
            _ledgerAmount.text=sellables.Sum(item=>CardLibrary.SellPrice(item.card)).ToString();float amountWidth=Mathf.Ceil(_ledgerAmount.preferredWidth);_ledgerAmount.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,amountWidth);_ledgerPrice.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,44+amountWidth);
            _ledgerFacts.text="持有卡牌                 "+state.ownedCards.Count+" 张\n符合条件                 "+sellables.Count+" 张\n当前金币                 "+state.coins+" 币";_catalogTotal.text=sellables.Count+" 件";SyncSaleRule();
            var retained=new HashSet<string>();int index=0;
            foreach(var entry in sellables)
            {
                if(!_saleCells.TryGetValue(entry.uid,out var cell))
                {
                    cell=new SaleCell{root=Rect(_sellGrid.transform,"shop-sell-"+entry.uid)};UIKit.GetOrAdd<Image>(cell.root).color=Theme.Hex("#252d30cc");
                    cell.source=Label(cell.root,"sell-item-source","",14,"#b9c9d2");var offer=Rect(cell.root,"sell-item-offer");Label(offer,"offer-label","卖出可得",14,"#b9c9d2");var sale=new CurrentShopCoin.Row(offer,"offer-value",31);sale.Coin(28);sale.Space(5);cell.amount=sale.Text("amount","",22,"#e0c98c",true);CurrentShopCoin.Right(sale.Root,0,0);
                    cell.button=Button(cell.root,"sellCard-"+entry.uid,"确认卖出",null,"#e0c98c","#1c2124",18);_saleCells.Add(entry.uid,cell);
                }
                string faceKey=FaceKey(entry.card);if(cell.faceKey!=faceKey){cell.faceKey=faceKey;if(cell.card!=null){cell.card.gameObject.SetActive(false);Destroy(cell.card.gameObject);}cell.card=DepartureElements.Card(cell.root,entry.card,170,"sell-card-face",new CardFaceOptions{HideCost=false,ScrollDescription=false});cell.card.SetAsFirstSibling();cell.card.anchorMin=cell.card.anchorMax=new Vector2(.5f,1);cell.card.anchoredPosition=new Vector2(0,-26);}
                cell.source.text=(entry.safe==true?"安全格":"随身背包")+" · 出售 ×1";cell.amount.text="+"+CardLibrary.SellPrice(entry.card)+" 币";float valueWidth=Mathf.Ceil(cell.amount.preferredWidth);cell.amount.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,valueWidth);((RectTransform)cell.amount.transform.parent).SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,33+valueWidth);
                var sourceCard=entry.card;Bind(cell.button,()=>{SaveBrowse();_sell?.Invoke(entry,sourceCard);});cell.root.SetSiblingIndex(index++);retained.Add(entry.uid);
            }
            foreach(var uid in _saleCells.Keys.Where(uid=>!retained.Contains(uid)).ToArray()){_saleCells[uid].root.gameObject.SetActive(false);Destroy(_saleCells[uid].root.gameObject);_saleCells.Remove(uid);}
            _sellGrid.enabled=sellables.Count>0;_sellEmpty.gameObject.SetActive(sellables.Count==0);_sellEmpty.text="背包里没有可以卖的卡牌（持有 "+state.ownedCards.Count+" 张）——只有带「可出售」备注的卡（货币卡等）商店才收。";
        }
        void SyncSaleRule(){_sellRuleButton.GetComponentInChildren<Text>().text=(_sellRule?"▾ ":"▸ ")+"收购规则";_ledger.Find("ledger-rule").gameObject.SetActive(_sellRule);}
        void LayoutExchange()
        {
            float width=_body.rect.width,height=_body.rect.height,left=Mathf.Max(240,(width-24)*.28f),right=width-left-24;
            Place(_ledger,0,0,left,Mathf.Min(height,_sellRule?550:410));Place(_catalog,left+24,0,right,height);
            Place(_ledger.Find("ledger-title"),24,24,left-48,44);Place(_ledger.Find("ledger-total"),24,92,left-48,90);Place(_ledger.Find("ledger-facts"),24,206,left-48,112);
            Place(_ledger.Find("ledger-total/total-label"),0,0,left-48,24);var ledgerPrice=_ledger.Find("ledger-total/total-value")as RectTransform;Place(ledgerPrice,0,28,ledgerPrice.sizeDelta.x,50);Place(_ledger.Find("ledger-total/total-unit"),left-66,49,18,24);
            Place(_ledger.Find("shopSellRule"),24,336,left-48,44);Place(_ledger.Find("ledger-rule"),24,390,left-48,140);
            Place(_catalog.Find("catalog-kicker"),24,24,right-48,24);Place(_catalog.Find("catalog-title"),24,53,right-200,38);Place(_catalog.Find("catalog-total"),right-174,50,150,38);
            Place(_boardScroll.transform,24,108,right-48,height-132);float cell=(right-48-36)/3;_sellGrid.cellSize=new Vector2(cell,416);
            foreach(Transform tile in _sellGrid.transform)
            {
                if(tile.name=="shop-sell-empty"){Place(tile,24,20,right-96,190);continue;}
                Place(tile.Find("sell-item-source"),16,295,cell-32,24);Place(tile.Find("sell-item-offer"),16,330,cell-32,30);Place(tile.Find("sellCard-"+tile.name.Substring("shop-sell-".Length)),16,365,cell-32,44);
                Place(tile.Find("sell-item-offer/offer-label"),0,0,cell-32,30);
            }
        }
    }
}
