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
        RectTransform _inspection,_detailView,_detailActions;float _actionHeight;CanvasGroup _detailGroup;Coroutine _detailMotion;bool _detailClosing;
        void BuildDetail(bool animate=false)
        {
            var focus=UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;string focusName=!animate&&_detail!=null&&focus!=null&&focus.transform.IsChildOf(_detail)?focus.name:null;
            if(_detailScrollRect!=null)_detailScroll=_detailScrollRect.verticalNormalizedPosition;
            if(_detailMotion!=null){StopCoroutine(_detailMotion);_detailMotion=null;}
            if(_detail!=null){_detail.gameObject.SetActive(false);Destroy(_detail.gameObject);}
            if(_selected<0||_selected>=_stock.Count)return;
            foreach(var offer in _offers)offer.GetComponent<Button>().interactable=false;
            SetMerchantInteractive(false);
            _detail=Rect(_content,"shop-detail");var shade=UIKit.GetOrAdd<Image>(_detail);shade.color=Theme.Hex("#050b10d6");
            var dismiss=Button(_detail,"shop-detail-dismiss","",CloseDetail,"#00000000");UiStack.Stretch((RectTransform)dismiss.transform);
            var close=Button(_detail,"shopCloseInspect","×",CloseDetail,"#0b171be6","#d5dfdc",30);
            _inspection=Rect(_detail,"shop-detail-content");
            var flow=UIKit.Scroll(_inspection);_detailView=flow.transform.parent as RectTransform;_detailView.name="shop-detail-scroll";
            var scroll=flow.GetComponentInParent<ScrollRect>();_detailScrollRect=scroll;scroll.scrollSensitivity=36;scroll.movementType=ScrollRect.MovementType.Clamped;
            var layout=flow.GetComponent<VerticalLayoutGroup>();layout.padding=new RectOffset(28,28,22,14);layout.spacing=16;layout.childControlWidth=false;layout.childForceExpandWidth=false;layout.childAlignment=TextAnchor.UpperCenter;
            var slot=_stock[_selected];
            if(slot.mystery&&!slot.sold){var image=UIKit.Image(flow.transform,CurrentShopAssets.Get("mystery-back"));image.raycastTarget=false;var size=UIKit.GetOrAdd<LayoutElement>(image);size.minWidth=size.preferredWidth=350;size.minHeight=size.preferredHeight=350*406f/272;}
            else{var card=DepartureElements.Card(flow.transform,slot.card,350,"shop-detail-card",new CardFaceOptions{HideCost=false,ScrollDescription=true});var size=UIKit.GetOrAdd<LayoutElement>(card);size.minWidth=size.preferredWidth=350;size.minHeight=size.preferredHeight=525;foreach(var child in card.GetComponentsInChildren<Transform>())if(child.name=="value")child.gameObject.SetActive(false);}
            string rules=slot.mystery&&!slot.sold?"随机卡牌 ×1牌；本次查看不会提前揭晓。":Sdt.Res.CurrentCardPresentation.Description(slot.card);
            if(rules.Length>80&&(!slot.mystery||slot.sold))
            {
                var toggle=Button(flow.transform,"shopRules",(_rules?"▾ ":"▸ ")+"完整规则",()=>{_rules=!_rules;BuildDetail();},"#16282bcc","#b9d3d1",18);var le=toggle.GetComponent<LayoutElement>();le.minWidth=le.preferredWidth=500;le.minHeight=le.preferredHeight=44;
                if(_rules){var text=Label(flow.transform,"shop-full-rules",rules,22,"#d1dfde");SourceTextLayout.Cjk(text);text.lineSpacing=SourceTextLayout.LineSpacing(text,1.65f);text.verticalOverflow=VerticalWrapMode.Overflow;text.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,500);var size=UIKit.GetOrAdd<LayoutElement>(text);size.minWidth=size.preferredWidth=500;var fitter=UIKit.GetOrAdd<ContentSizeFitter>(text);fitter.verticalFit=ContentSizeFitter.FitMode.PreferredSize;}
            }
            _detailActions=Rect(_inspection,"shop-detail-actions");
            bool exhausted=slot.sold||(slot.shaReplenish.HasValue&&slot.shaReplenish<=0),money=GameRuntime.I.State.coins>=slot.price,fits=exhausted||GameRuntime.I.CanReceiveCard(slot.card);
            string facts=exhausted?(slot.mystery?"已购入「"+slot.card?.name+"」，已放入本次远征背包":"本站已售出"):(!money?"还差 "+(slot.price-GameRuntime.I.State.coins)+" 币":"")+(!fits?"  当前卡牌放不下："+GameRuntime.I.UsedSlots()+"/"+GameRuntime.I.BagCap+" 格":"");
            float top=0;if(!string.IsNullOrEmpty(facts)){var t=Label(_detailActions,"shop-detail-facts",facts,18,exhausted?"#b4d0bd":"#e0aa98");SourceTextLayout.Cjk(t);Place(t.transform,0,0,350,54);top=63;}
            var buy=Button(_detailActions,exhausted?"shop-detail-done":(slot.shaReplenish.HasValue?"buySha-":"buyCard-")+_selected,exhausted?"继续浏览":slot.free&&money&&fits?"免费领取":(!money?"金币不足":!fits?"背包装不下":"购买")+"  · [[icon:coin]] "+slot.price+" 币",()=>{if(!Current)return;if(exhausted)CloseDetail();else _buy?.Invoke(_selected);},exhausted?"#253732":money&&fits?"#e0c98c":"#3a3330",exhausted?"#c9ded4":money&&fits?"#20251f":"#ddb5a5",22);
            buy.interactable=exhausted||money&&fits;Place(buy.transform,0,top,350,60);top+=60;
            if(!exhausted&&!fits){var bag=Button(_detailActions,"shop-detail-bag","整理背包",OpenBag,"#30383b","#e1e6e6",18);Place(bag.transform,0,top+9,350,44);top+=53;}
            _actionHeight=top;LayoutDetail();_detail.SetAsLastSibling();Canvas.ForceUpdateCanvases();scroll.verticalNormalizedPosition=_detailScroll;
            var restore=string.IsNullOrEmpty(focusName)?null:System.Array.Find(_detail.GetComponentsInChildren<Button>(),button=>button.name==focusName&&button.IsInteractable());EventSystemSelect(restore==null?close.gameObject:restore.gameObject);
            _detailClosing=false;_detailGroup=UIKit.GetOrAdd<CanvasGroup>(_detail);if(animate&&!CurrentUiPreferences.ReducedMotion)_detailMotion=StartCoroutine(DetailMotion(true));
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
