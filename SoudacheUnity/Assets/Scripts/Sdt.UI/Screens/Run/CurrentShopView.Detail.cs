using System;
using System.Collections;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class CurrentShopView
    {
        RectTransform _inspection,_detailView,_detailActions,_detailCard,_buyPrice;
        float _actionHeight;CanvasGroup _detailGroup;Coroutine _detailMotion;bool _detailClosing;
        Button _detailClose,_detailDismiss,_detailBuy,_detailBag,_rulesButton;Text _detailFacts,_rulesText;string _detailFaceKey;
        CurrentShopCoin.Row _detailPriceRow;Text _detailPriceAmount;
        void BuildDetail(bool animate=false)
        {
            if(!Current||_selected<0||_selected>=_stock.Count)return;
            if(_detailMotion!=null){StopCoroutine(_detailMotion);_detailMotion=null;}
            if(!animate&&_detailScrollRect!=null)_detailScroll=_detailScrollRect.verticalNormalizedPosition;
            foreach(var offer in _offers)offer.GetComponent<Button>().interactable=false;
            SetMerchantInteractive(false);
            if(_detail==null)
            {
                _detail=Rect(_content,"shop-detail");UIKit.GetOrAdd<Image>(_detail).color=Theme.Hex("#050b10d6");
                _detailDismiss=Button(_detail,"shop-detail-dismiss","",CloseDetail,"#00000000");UiStack.Stretch((RectTransform)_detailDismiss.transform);
                _detailClose=Button(_detail,"shopCloseInspect","×",CloseDetail,"#0b171be6","#d5dfdc",30);
                _inspection=Rect(_detail,"shop-detail-content");var flow=UIKit.Scroll(_inspection);_detailView=flow.transform.parent as RectTransform;_detailView.name="shop-detail-scroll";
                _detailScrollRect=flow.GetComponentInParent<ScrollRect>();_detailScrollRect.scrollSensitivity=36;_detailScrollRect.movementType=ScrollRect.MovementType.Clamped;
                var layout=flow.GetComponent<VerticalLayoutGroup>();layout.padding=new RectOffset(28,28,22,14);layout.spacing=16;layout.childControlWidth=false;layout.childForceExpandWidth=false;layout.childAlignment=TextAnchor.UpperCenter;
                _detailCard=Rect(flow.transform,"shop-detail-art");var artSize=UIKit.GetOrAdd<LayoutElement>(_detailCard);artSize.minWidth=artSize.preferredWidth=350;artSize.minHeight=artSize.preferredHeight=525;
                _rulesButton=Button(flow.transform,"shopRules","",ToggleRules,"#16282bcc","#b9d3d1",18);var le=_rulesButton.GetComponent<LayoutElement>();le.minWidth=le.preferredWidth=500;le.minHeight=le.preferredHeight=44;
                _rulesText=Label(flow.transform,"shop-full-rules","",22,"#d1dfde");SourceTextLayout.Cjk(_rulesText);_rulesText.lineSpacing=SourceTextLayout.LineSpacing(_rulesText,1.65f);_rulesText.verticalOverflow=VerticalWrapMode.Overflow;_rulesText.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,500);var rulesSize=UIKit.GetOrAdd<LayoutElement>(_rulesText);rulesSize.minWidth=rulesSize.preferredWidth=500;UIKit.GetOrAdd<ContentSizeFitter>(_rulesText).verticalFit=ContentSizeFitter.FitMode.PreferredSize;
                _detailActions=Rect(_inspection,"shop-detail-actions");_detailFacts=Label(_detailActions,"shop-detail-facts","",18,"#b4d0bd");SourceTextLayout.Cjk(_detailFacts);
                _detailBuy=Button(_detailActions,"buyCard","",null,font:22);_detailBag=Button(_detailActions,"shop-detail-bag","整理背包",OpenBag,"#30383b","#e1e6e6",18);
            }
            _detail.gameObject.SetActive(true);var slot=_stock[_selected];int index=_selected;bool hidden=slot.mystery&&!slot.sold;
            Bind(_detailDismiss,CloseDetail);Bind(_detailClose,CloseDetail);Bind(_rulesButton,ToggleRules);Bind(_detailBag,OpenBag);
            var detailArtSize=_detailCard.GetComponent<LayoutElement>();detailArtSize.minHeight=detailArtSize.preferredHeight=hidden?350*406f/272:525;
            string key=hidden?"mystery":FaceKey(slot.card);
            if(_detailFaceKey!=key)
            {
                _detailFaceKey=key;Clear(_detailCard);
                if(hidden){var image=UIKit.Image(_detailCard,CurrentShopAssets.Get("mystery-back"));image.raycastTarget=false;UiStack.Stretch(image.rectTransform);}
                else{var card=DepartureElements.Card(_detailCard,slot.card,350,"shop-detail-card",new CardFaceOptions{HideCost=false,ScrollDescription=true});CurrentNodeElements.Fixed(card,0,0,350,525);foreach(var child in card.GetComponentsInChildren<Transform>())if(child.name=="value")child.gameObject.SetActive(false);}
            }
            string rules=hidden?"随机卡牌 ×1牌；本次查看不会提前揭晓。":Sdt.Res.CurrentCardPresentation.Description(slot.card);bool showRules=rules.Length>80&&!hidden;
            _rulesButton.gameObject.SetActive(showRules);_rulesButton.GetComponentInChildren<Text>().text=(_rules?"▾ ":"▸ ")+"完整规则";_rulesText.text=rules;_rulesText.gameObject.SetActive(showRules&&_rules);
            bool exhausted=slot.sold||(slot.shaReplenish.HasValue&&slot.shaReplenish<=0),money=GameRuntime.I.State.coins>=slot.price,fits=exhausted||_facts.Fits(slot.card);
            string facts=exhausted?(slot.mystery?"已购入「"+slot.card?.name+"」，已放入本次远征背包":"本站已售出"):(!money?"还差 "+(slot.price-GameRuntime.I.State.coins)+" 币":"")+(!fits?"  当前卡牌放不下："+_facts.Capacity.used+"/"+_facts.Capacity.totalCap+" 格":"");
            _detailFacts.text=facts;_detailFacts.color=Theme.Hex(exhausted?"#b4d0bd":"#e0aa98");_detailFacts.gameObject.SetActive(facts!="");float top=0;if(facts!=""){Place(_detailFacts.transform,0,0,350,54);top=63;}
            string buyInk=exhausted?"#c9ded4":money&&fits?"#20251f":"#ddb5a5";
            _detailBuy.name=exhausted?"shop-detail-done":(slot.shaReplenish.HasValue?"buySha-":"buyCard-")+index;_detailBuy.image.color=Theme.Hex(exhausted?"#253732":money&&fits?"#e0c98c":"#3a3330");
            var label=_detailBuy.GetComponentInChildren<Text>();label.text=exhausted?"继续浏览":slot.free&&money&&fits?"免费领取":!money?"金币不足":!fits?"背包装不下":"购买";label.color=Theme.Hex(buyInk);label.alignment=TextAnchor.MiddleCenter;label.rectTransform.offsetMin=label.rectTransform.offsetMax=Vector2.zero;
            if(_buyPrice!=null)_buyPrice.gameObject.SetActive(false);
            if(!exhausted&&!(slot.free&&money&&fits))
            {
                label.alignment=TextAnchor.MiddleLeft;label.rectTransform.offsetMin=new Vector2(24,0);label.rectTransform.offsetMax=new Vector2(-24,0);
                if(_detailPriceRow==null){var price=new CurrentShopCoin.Row(_detailBuy.transform,"shop-buy-price",42);_detailPriceRow=price;price.Text("separator"," · ",22,buyInk);price.Space(4);price.Coin(30);price.Space(4);_detailPriceAmount=price.Text("amount","",22,buyInk);CurrentShopCoin.Right(price.Root,24,0);_buyPrice=price.Root;}
                _buyPrice.gameObject.SetActive(true);_detailPriceAmount.text=slot.price+" 币";foreach(var text in _buyPrice.GetComponentsInChildren<Text>())text.color=Theme.Hex(buyInk);_detailPriceRow.Relayout();
            }
            Bind(_detailBuy,()=>{if(exhausted)CloseDetail();else _buy?.Invoke(index,slot);});_detailBuy.interactable=exhausted||money&&fits;Place(_detailBuy.transform,0,top,350,60);top+=60;
            _detailBag.gameObject.SetActive(!exhausted&&!fits);if(!exhausted&&!fits){Place(_detailBag.transform,0,top+9,350,44);top+=53;}
            _actionHeight=top;LayoutDetail();_detail.SetAsLastSibling();Canvas.ForceUpdateCanvases();_detailScrollRect.verticalNormalizedPosition=_detailScroll;if(animate)EventSystemSelect(_detailClose.gameObject);
            _detailClosing=false;_detailGroup=UIKit.GetOrAdd<CanvasGroup>(_detail);_detailGroup.alpha=1;_detailGroup.interactable=true;_inspection.localScale=Vector3.one;
            if(animate&&!CurrentUiPreferences.ReducedMotion)_detailMotion=StartCoroutine(DetailMotion(true));
        }
        void ToggleRules()
        {
            float position=_detailScrollRect.verticalNormalizedPosition;_rules=!_rules;_rulesButton.GetComponentInChildren<Text>().text=(_rules?"▾ ":"▸ ")+"完整规则";_rulesText.gameObject.SetActive(_rules);
            LayoutDetail();Canvas.ForceUpdateCanvases();_detailScrollRect.verticalNormalizedPosition=position;
        }
        IEnumerator DetailMotion(bool entering)
        {
            var panel=_detail;var content=_inspection;var group=_detailGroup;float duration=entering?.28f:.18f,time=0;var anchor=content.anchoredPosition;
            group.interactable=entering;
            while(time<duration&&panel!=null){float p=Mathf.Clamp01(time/duration),ease=entering?1-Mathf.Pow(1-p,3):p*p;group.alpha=entering?ease:1-ease;content.localScale=Vector3.one*Mathf.Lerp(entering?.94f:1,entering?1:.94f,ease);content.anchoredPosition=anchor+Vector2.down*(entering?18*(1-ease):12*ease);time+=Time.unscaledDeltaTime;yield return null;}
            _detailMotion=null;if(!entering){FinishCloseDetail();yield break;}if(panel!=null){group.alpha=1;content.localScale=Vector3.one;content.anchoredPosition=anchor;}
        }
        void LayoutDetail()
        {
            if(_detail==null)return;float width=_body.rect.width,height=_body.rect.height;
            Place(_detail,36,100,width+12,height+36);float popupWidth=width+12,popupHeight=height+36;
            Place(_detail.Find("shopCloseInspect"),popupWidth-62,14,44,44);
            float scrollHeight=Mathf.Min(_rules?690:650,Mathf.Max(300,popupHeight-_actionHeight-58)),full=scrollHeight+10+_actionHeight;
            Place(_inspection,(popupWidth-620)*.5f,Mathf.Max(24,(popupHeight-full)*.5f),620,full);
            Place(_detailView,0,0,620,scrollHeight);Place(_detailActions,135,scrollHeight+10,350,_actionHeight);
        }
        static void EventSystemSelect(GameObject target)=>UnityEngine.EventSystems.EventSystem.current?.SetSelectedGameObject(target);
    }
}
