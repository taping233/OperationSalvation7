using System;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class CurrentShopView
    {
        RectTransform _merchantPanel,_board;GridLayoutGroup _grid;
        void BuildMarket()
        {
            if(_board==null)
            {
            _board=Rect(_body,"shop-board");
            var content=UIKit.Scroll(_board);_boardScroll=content.GetComponentInParent<ScrollRect>();_boardScroll.name="shop-board-scroll";_boardScroll.scrollSensitivity=36;_boardScroll.movementType=ScrollRect.MovementType.Clamped;
            _marketScrollRect=_boardScroll;
            DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());_grid=UIKit.GetOrAdd<GridLayoutGroup>(content);_grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;_grid.constraintCount=5;_grid.spacing=new Vector2(18,22);_grid.childAlignment=TextAnchor.UpperLeft;
            _merchantPanel=Rect(_body,"shop-merchant");
            var talk=Button(_merchantPanel,"shopTalk","",()=>{if(!Current||_selected>=0)return;_merchant=(_merchant+1)%Lines.Length;_merchantPanel.Find("shop-merchant-line").GetComponent<Text>().text="“"+Lines[_merchant]+"”";},"#07151aac");
            var name=Label(talk.transform,"merchant-name","神秘人",23,"#c4e0d5",true);Place(name.transform,6,18,400,33);
            var quote=Label(_merchantPanel,"shop-merchant-line","“"+Lines[_merchant]+"”",21,"#e0e6e0");SourceTextLayout.Cjk(quote);quote.lineSpacing=SourceTextLayout.LineSpacing(quote,1.65f);
            var sell=Button(_merchantPanel,"openSell","",()=>{if(!Current||_selected>=0)return;_exchange=true;Render();});
            CurrentShopCoin.Icon(sell.transform,36);Label(sell.transform,"sellpost-name","出售卡牌",21,"#eef1ed",true);Label(sell.transform,"sellpost-hint","",14,"#b9c9d2");
            var bag=Button(_merchantPanel,"shopOpenBag","[[icon:bag]] 整理背包",()=>{if(_selected<0)OpenBag();});
            bag.GetComponentInChildren<Text>().alignment=TextAnchor.MiddleLeft;
            }
            for(int i=_offers.Count-1;i>=_stock.Count;i--){_offers[i].gameObject.SetActive(false);Destroy(_offers[i].gameObject);_offers.RemoveAt(i);}
            for(int i=0;i<_stock.Count;i++)
            {
                int index=i;
                if(i==_offers.Count)_offers.Add(UIKit.GetOrAdd<CurrentShopOffer>(Rect(_grid.transform,"shop-slot-"+i)));
                _offers[i].Sync(_stock[i],i==_selected,()=>Current,()=>Inspect(index),_facts,GameRuntime.I.IsCommissionFreeShopSlot(i));
            }
            _merchantPanel.Find("openSell/sellpost-hint").GetComponent<Text>().text=_facts.Sellables.Count>0?_facts.Sellables.Count+" 张可出售":"暂无可出售卡牌";
            SetMerchantInteractive(_selected<0);
        }
        void SetMerchantInteractive(bool enabled)
        {
            if(_merchantPanel==null)return;
            foreach(var button in _merchantPanel.GetComponentsInChildren<Button>()){var colors=button.colors;colors.disabledColor=colors.normalColor;button.colors=colors;button.interactable=enabled;}
            foreach(var text in _merchantPanel.GetComponentsInChildren<InlineIconText>())text.DisabledOpacity=1;
        }
        void LayoutMarket()
        {
            float width=_body.rect.width,height=_body.rect.height,left=Mathf.Max(230,(width-40)*.26f),right=width-left-40;
            Place(_board,left+40,4,right,height-14);Place(_merchantPanel,0,0,left-20,height);
            float gridHeight=Mathf.Max(580,height-14),cellWidth=(right-4*18)/5,cellHeight=(gridHeight-22)/2;
            _grid.cellSize=new Vector2(cellWidth,cellHeight);
            foreach(var offer in _offers)offer.Layout(cellWidth,cellHeight);
            float services=122,talkHeight=156,talkTop=height-services-26-talkHeight;
            Place(_merchantPanel.Find("shopTalk"),0,talkTop,left-20,talkHeight);Place(_merchantPanel.Find("shop-merchant-line"),6,talkTop+60,left-32,82);
            Place(_merchantPanel.Find("openSell"),0,height-services,left-20,68);Place(_merchantPanel.Find("openSell/shop-coin-icon"),4,16,36,36);Place(_merchantPanel.Find("openSell/sellpost-name"),52,8,left-89,30);Place(_merchantPanel.Find("openSell/sellpost-hint"),52,38,left-89,24);
            Place(_merchantPanel.Find("shopOpenBag"),0,height-44,left-20,44);
        }
        void OpenBag(){if(Current){SaveBrowse();Sdt.UI.Screens.Bag.BagScreen.Open();}}
        void Inspect(int index){if(!Current||index<0||index>=_stock.Count||_stock[index].empty)return;_selected=index;for(int i=0;i<_offers.Count;i++)_offers[i].SetSelected(i==index);_rules=false;_detailScroll=1;BuildDetail(true);}
        void CloseDetail()
        {
            if(_detailClosing)return;
            if(_detail!=null&&!CurrentUiPreferences.ReducedMotion){if(_detailMotion!=null)StopCoroutine(_detailMotion);_detailClosing=true;_detailMotion=StartCoroutine(DetailMotion(false));return;}
            FinishCloseDetail();
        }
        void FinishCloseDetail(){int previous=_selected;_selected=-1;_detailClosing=false;if(_detail!=null)_detail.gameObject.SetActive(false);for(int i=0;i<_offers.Count;i++){_offers[i].GetComponent<Button>().interactable=!_stock[i].empty;_offers[i].SetSelected(false);}SetMerchantInteractive(true);if(Current&&previous>=0&&previous<_offers.Count){_marketFocus="shop-slot-"+previous;EventSystemSelect(_offers[previous].gameObject);}}
        public void Purchased(int index,bool mystery)
        {if(index<0||index>=_offers.Count)return;CurrentShopCarry.Play(transform,_offers[index].ArtRect,()=>_merchantPanel==null?null:_merchantPanel.Find("shopOpenBag")as RectTransform,_stock[index].card,mystery);}
        public override string ToString()=>"Current shop shelf/inspection/exchange";
    }
    public sealed class CurrentShopOffer:MonoBehaviour
    {
        RectTransform _art,_card,_price;Text _state,_owned,_mysteryTitle,_empty;Material _material;ShopScreen.ShopSlot _slot;string _faceKey,_priceKey;
        public RectTransform ArtRect=>_card;
        internal void Sync(ShopScreen.ShopSlot slot,bool selected,Func<bool> current,Action inspect,CurrentShopView.ShopFacts facts,bool commissionFree=false)
        {
            _slot=slot;var image=UIKit.GetOrAdd<Image>(this);image.color=Theme.Hex(selected?"#8b754b2e":"#12212666");
            var b=UIKit.GetOrAdd<Button>(this);b.targetGraphic=image;b.transition=Selectable.Transition.ColorTint;UIKit.GetOrAdd<CurrentShopAction>(b).Bind(b,current,inspect);b.interactable=!slot.empty;
            if(_art==null)_art=CurrentNodeElements.Rect(transform,"shop-item-art");
            if(_empty==null){_empty=UIKit.Label(transform,"",16,Theme.Hex("#b9c9d2"));_empty.name="shop-empty";_empty.alignment=TextAnchor.MiddleCenter;}
            _empty.text=slot.label??"无货";_empty.gameObject.SetActive(slot.empty);_art.gameObject.SetActive(!slot.empty);
            var oldOffer=transform.Find("shop-offer");if(oldOffer!=null)oldOffer.gameObject.SetActive(!slot.empty);
            if(_mysteryTitle!=null)_mysteryTitle.gameObject.SetActive(!slot.empty);
            if(slot.empty)return;
            string key=slot.mystery&&!slot.sold?"mystery":CurrentShopView.FaceKey(slot.card);
            if(_faceKey!=key)
            {
            _faceKey=key;foreach(Transform child in _art){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            if(_mysteryTitle!=null){_mysteryTitle.gameObject.SetActive(false);Destroy(_mysteryTitle.gameObject);_mysteryTitle=null;}
            if(slot.mystery&&!slot.sold){var art=UIKit.Image(_art,CurrentShopAssets.Get("mystery-back"));art.raycastTarget=false;_card=art.rectTransform;_card.sizeDelta=new Vector2(226,226*406f/272);_mysteryTitle=UIKit.Label(transform,"神秘货箱",17,Theme.Hex("#eef1ed"));}
            else{_card=DepartureElements.Card(_art,slot.card,226,"shop-card-face",new CardFaceOptions{HideCost=false,ScrollDescription=false});foreach(var child in _card.GetComponentsInChildren<Transform>())if(child.name=="value")child.gameObject.SetActive(false);foreach(var graphic in _card.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;}
            }
            bool exhausted=slot.sold||(slot.shaReplenish.HasValue&&slot.shaReplenish<=0),money=GameRuntime.I.State.coins>=slot.price,fits=exhausted||facts.Fits(slot.card);
            var group=UIKit.GetOrAdd<CanvasGroup>(_art);group.alpha=exhausted?.38f:!money?.5f:1;
            if((exhausted||!money)&&_material==null){var shader=Resources.Load<Shader>("CurrentHomeScene");if(shader!=null)_material=new Material(shader);}
            if(_material!=null){_material.SetFloat("_Gray",exhausted?.75f:!money?1:0);_material.SetFloat("_Brightness",!exhausted&&!money?.72f:1);}
            foreach(var img in _art.GetComponentsInChildren<Image>())img.material=exhausted||!money?_material:null;
            var offer=oldOffer!=null?oldOffer.GetComponent<Image>():CurrentNodeElements.Fill(transform,"shop-offer","#09131873");
            string state=exhausted?(slot.shaReplenish.HasValue?"补充已售罄":"已售出"):!money?"还差 "+(slot.price-GameRuntime.I.State.coins)+" 币":!fits?"背包装不下":slot.free?"可免费领取":"可购买";
            int owned=facts.Owned(slot.card);
            string status=exhausted?(slot.shaReplenish.HasValue?"本站已补满":slot.mystery?"已购入 · 已揭晓":""):slot.shaReplenish.HasValue?"持有 "+owned+" · 余 "+slot.shaReplenish:slot.mystery?"购买后揭晓":owned>0?"已持有 "+owned:"";
            if(_state==null){_state=UIKit.Label(offer.transform,"",17);_owned=UIKit.Label(offer.transform,"",14,Theme.Hex("#a8bbbf"));}
            _state.text=state;_state.color=Theme.Hex(exhausted?"#c6d1ce":!money||!fits?"#edb7a4":"#e0c98c");_owned.text=status;
            string priceKey=slot.price+":"+slot.free+":"+exhausted+":"+money;
            if(_priceKey!=priceKey)
            {
            _priceKey=priceKey;if(_price!=null){_price.gameObject.SetActive(false);Destroy(_price.gameObject);}
            var price=new CurrentShopCoin.Row(offer.transform,"shop-v14-price",46);_price=price.Root;
            string priceInk=exhausted?"#99a5a3":!money?"#9da9a7":"#e0c98c";
            if(slot.free)price.Text("shop-money-value","免费",30,priceInk,true);
            else{price.Coin(36);price.Space(3);price.Text("shop-money-value",slot.price.ToString(),30,priceInk,true);price.Space(4);price.Text("shop-money-unit","币",14,"#b9c9d2");}
            if(exhausted)UIKit.GetOrAdd<CanvasGroup>(_price).alpha=.65f;
            }
            foreach(var text in GetComponentsInChildren<Text>()){text.raycastTarget=false;if(text is InlineIconText inline)inline.DisabledOpacity=1;}
            if(transform.Find("commission-top")==null){Edge("commission-top",new Vector2(0,1),new Vector2(1,1),new Vector2(0,-2),Vector2.zero);Edge("commission-bottom",Vector2.zero,Vector2.right,Vector2.zero,new Vector2(0,2));Edge("commission-left",Vector2.zero,Vector2.up,Vector2.zero,new Vector2(2,0));Edge("commission-right",Vector2.right,Vector2.one,new Vector2(-2,0),Vector2.zero);}
            foreach(string edge in new[]{"commission-top","commission-bottom","commission-left","commission-right"})transform.Find(edge).gameObject.SetActive(commissionFree&&!exhausted);
            SetSelected(selected);
        }
        void Edge(string name,Vector2 min,Vector2 max,Vector2 lower,Vector2 upper){var image=CurrentNodeElements.Fill(transform,name,"#f2d394");image.rectTransform.anchorMin=min;image.rectTransform.anchorMax=max;image.rectTransform.offsetMin=lower;image.rectTransform.offsetMax=upper;}
        public void SetSelected(bool selected){GetComponent<Image>().color=Theme.Hex(selected?"#8b754b2e":"#12212666");var edge=transform.Find("shop-selected-edge");if(edge==null){Edge("shop-selected-edge",Vector2.zero,Vector2.right,Vector2.zero,new Vector2(0,2));edge=transform.Find("shop-selected-edge");}edge.gameObject.SetActive(selected);}
        public void Layout(float width,float height)
        {
            if(_slot.empty){CurrentNodeElements.Fixed(_empty.rectTransform,0,0,width,height);return;}
            float title=_mysteryTitle==null?0:29,artHeight=height-66-title,cardWidth=Mathf.Min(226,Mathf.Min(width,(artHeight-12)*2f/3));
            CurrentNodeElements.Fixed(_art,0,0,width,artHeight);_card.anchorMin=_card.anchorMax=_card.pivot=Vector2.one*.5f;_card.anchoredPosition=Vector2.zero;_card.localScale=Vector3.one*cardWidth/226;
            var offer=transform.Find("shop-offer")as RectTransform;CurrentNodeElements.Fixed(offer,0,height-66,width,66);
            if(_mysteryTitle!=null)CurrentNodeElements.Fixed(_mysteryTitle.rectTransform,12,artHeight,width-24,29);
            float copyWidth=Mathf.Max(0,width-24-_price.sizeDelta.x-10);CurrentNodeElements.Fixed(_state.rectTransform,12,string.IsNullOrEmpty(_owned.text)?20.5f:9,copyWidth,25);CurrentNodeElements.Fixed(_owned.rectTransform,12,36,copyWidth,22);CurrentShopCoin.Right(_price,12,0);
        }
        void OnDestroy(){if(_material!=null)Destroy(_material);}
    }
}
