// shop-commission.js start -> existing EventDie x2 -> applied goods receipt -> saved announcement.
using System;
using System.Collections;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentShopCommission:MonoBehaviour
    {
        ShopScreen _owner;CurrentNodeScene _scene;Action _entered,_leave;Action _retry;
        string _phase,_diceNotice,_focusName;bool _started,_busy,_covered,_rules=true;Coroutine _arrival;
        bool Live=>this!=null&&_owner!=null&&_owner.ShopActive;
        public static CurrentShopCommission Create(ShopScreen owner,Transform parent,Action entered,Action leave)
        {
            var view=UIKit.GetOrAdd<CurrentShopCommission>(parent);view._owner=owner;view._entered=entered;view._leave=leave;
            view._scene=CurrentNodeScene.Create(parent,"scene-shop-bg");view._scene.UseCommissionLayout();view.Prepare();return view;
        }
        void Complete()
        {
            if(!Live)return;
            _scene.Complete();Canvas.ForceUpdateCanvases();var buttons=_scene.GetComponentsInChildren<Button>().Where(button=>button.IsActive()&&button.IsInteractable()).ToArray();
            var focus=buttons.FirstOrDefault(button=>button.name==_focusName);
            if(focus==null&&(_focusName=="eventDiceLeave"||_focusName=="commissionLeave"))focus=buttons.FirstOrDefault(button=>button.name=="commissionLeave"||button.name=="eventDiceLeave");
            if(focus==null)foreach(string action in new[]{"commissionRetry","commissionEnterShop","commissionStart","eventDiceContinue","eventDiceRoll"}){focus=buttons.FirstOrDefault(button=>button.name==action);if(focus!=null)break;}
            if(focus==null)return;_focusName=focus.name;EventSystem.current?.SetSelectedGameObject(focus.gameObject);
            var scroll=focus.GetComponentInParent<ScrollRect>();if(scroll!=null){var viewport=scroll.viewport??(RectTransform)scroll.transform;var bounds=RectTransformUtility.CalculateRelativeRectTransformBounds(viewport,focus.transform);float move=bounds.min.y<viewport.rect.yMin?viewport.rect.yMin-bounds.min.y:bounds.max.y>viewport.rect.yMax?viewport.rect.yMax-bounds.max.y:0;scroll.StopMovement();scroll.content.anchoredPosition+=Vector2.up*move;}
        }
        void Prepare(){if(!Live||_busy)return;if(!GameRuntime.I.TryPrepareShopCommission(out var reason)){Failure("凭据归属尚未保存，商品与投骰均未改变，请重试。\n"+reason,Prepare);return;}Render();}
        void RememberFocus(){var selected=EventSystem.current?.currentSelectedGameObject;if(selected!=null&&selected.transform.IsChildOf(_scene.transform))_focusName=selected.name;}
        void Clear(){RememberFocus();CurrentNodeElements.Clear(_scene.Body);CurrentNodeElements.Clear(_scene.Footer);}
        Text Copy(string name,string text,int size=18,string color="#eef1ed")
        {
            var label=CurrentNodeElements.Text(_scene.Body,name,text,size,color);label.lineSpacing=SourceTextLayout.LineSpacing(label,1.8f);SourceTextLayout.Cjk(label);
            label.verticalOverflow=VerticalWrapMode.Overflow;var fit=UIKit.GetOrAdd<ContentSizeFitter>(label);fit.verticalFit=ContentSizeFitter.FitMode.PreferredSize;return label;
        }
        Button Action(Transform parent,string name,string copy,Action run,bool primary=false)
        {var button=CurrentNodeElements.Button(parent,copy,null,primary);button.name=name;UIKit.GetOrAdd<CurrentShopAction>(button).Bind(button,()=>Live&&!_busy,run);var le=button.GetComponent<LayoutElement>();le.flexibleWidth=1;return button;}
        void Heading(string title,string sub)
        {var heading=Copy("commission-heading",title,30,"#f2d394");heading.font=Sdt.Res.Res.SansBold;Copy("commission-sub",sub);Arrive(title);}
        void Render()
        {
            if(!Live||_busy)return;var g=GameRuntime.I;var outcome=g.GetCommissionOutcome(_started);if(outcome==null){_entered?.Invoke();return;}Clear();Heading(outcome.Title,outcome.Message);
            if(outcome.Stage=="commission-start")
            {
                Copy("commission-start-copy","“老规矩，你亲手投两次。选中的两格货物由运输员付钱，初始攻击不在这张凭据里。”");
                Action(_scene.Body,"commissionStart","交付凭据，投骰免单",()=>Mutate(g.StartCommissionDice),true);
            }
            else if(outcome.Stage=="commission-story")
            {
                Copy("commission-story-copy","“接应的报酬。标亮的两格，免费拿走。”");if(!Goods())return;
                Copy("commission-receipt-note","运输员代付 · 商品仍在货架，进入商店后领取");
                Action(_scene.Body,"commissionEnterShop","查看两格免费商品",Announce,true);
            }
            else if(outcome.Stage=="commission-apply"){Failure(outcome.Message,()=>Mutate(g.StartCommissionDice));return;}
            else BuildDice(outcome);
            Complete();
        }
        void BuildDice(EventOutcome outcome)
        {
            var saved=GameRuntime.I.CurrentCommissionDie;if(saved==null){Failure("本次骰子与凭据进度保留，请重试。",()=>Mutate(GameRuntime.I.StartCommissionDice));return;}
            var panel=CurrentNodeElements.Rect(_scene.Body,"commission-event-dice-panel");UIKit.GetOrAdd<Image>(panel).color=Theme.Hex("#0b1624f5");
            var flow=UIKit.GetOrAdd<VerticalLayoutGroup>(panel);flow.padding=new RectOffset(20,20,16,20);flow.spacing=12;flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandWidth=true;flow.childForceExpandHeight=false;
            var fit=UIKit.GetOrAdd<ContentSizeFitter>(panel);fit.verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            var die=CurrentIllustratedDice.Create(panel,saved.result);string result=saved.result.HasValue?saved.result+" 点 · "+saved.labels[(saved.result.Value-1)*saved.labels.Count/6]:"D6 · 等待投骰";
            var text=CurrentNodeElements.Text(panel,"event-dice-result",result,18,"#ffe1a0",true);text.alignment=TextAnchor.MiddleCenter;
            Action(panel,"commissionDiceRules",(_rules?"▾ ":"▸ ")+"点数与结果",()=>{_rules=!_rules;Render();});
            if(_rules)foreach(var label in outcome.DiceLabels??Enumerable.Empty<string>()){var line=CurrentNodeElements.Text(panel,"event-dice-rule",label,16,"#f3f5f7");SourceTextLayout.Cjk(line);line.lineSpacing=SourceTextLayout.LineSpacing(line,1.6f);var size=UIKit.GetOrAdd<LayoutElement>(line);size.minHeight=size.preferredHeight=36;}
            if(!string.IsNullOrEmpty(_diceNotice)){var notice=CurrentNodeElements.Text(panel,"commission-dice-notice",_diceNotice,18,"#ffe1a0");SourceTextLayout.Cjk(notice);}
            if(!saved.result.HasValue)Action(panel,"eventDiceRoll","投掷骰子",()=>Roll(die),true);
            else Action(panel,"eventDiceContinue","确认结果，继续",()=>Mutate(GameRuntime.I.ConfirmCommissionDice),true);
            Action(panel,"eventDiceLeave","返回地图",()=>{if(!string.IsNullOrEmpty(_diceNotice))Failure("保存未成功，本次骰子与凭据进度保留。",()=>Mutate(GameRuntime.I.StartCommissionDice));else RequestLeave();});
        }
        void Mutate(Func<EventOutcome> run)
        {
            if(!Live||_busy)return;_busy=true;var outcome=run();_busy=false;if(!Live)return;
            if(outcome?.Stage=="commission-dice-save-failed"){_started=true;_diceNotice="保存未成功，请重试确认；本次结果不会改变。";Render();return;}
            if(outcome?.Stage=="commission-retry"||!GameRuntime.I.Saves.LastWriteSucceeded)
            {
                bool secondDieAwaitingRoll=GameRuntime.I.CurrentCommissionSlots?.Count==1&&GameRuntime.I.CurrentCommissionDie?.result.HasValue==false;
                Failure(outcome?.Message??"接应凭据进度保留，请重试保存。",secondDieAwaitingRoll?(Action)(()=>Mutate(GameRuntime.I.StartCommissionDice)):(()=>Mutate(run)));return;
            }
            _started=true;_diceNotice=null;Render();
        }
        void Roll(CurrentIllustratedDice die)
        {
            if(!Live||_busy)return;_busy=true;var g=GameRuntime.I;var outcome=g.RollCommissionDice();var saved=g.CurrentCommissionDie;if(!Live){_busy=false;return;}
            if(outcome?.Stage=="commission-dice-save-failed"){_busy=false;_diceNotice="保存未成功，结果已保留在本局；请先重试保存。";Render();return;}
            if(outcome?.Stage=="commission-retry"||!g.Saves.LastWriteSucceeded||saved?.result.HasValue!=true){_busy=false;Failure(outcome?.Message??"本次骰子与凭据进度保留，请重试保存。",()=>Mutate(g.StartCommissionDice));return;}
            foreach(var button in _scene.GetComponentsInChildren<Button>())button.interactable=false;
            g.Audio.PlaySfx("scene");die.Roll(saved.result.Value,()=>{if(this!=null){_busy=false;if(Live)Render();}});
        }
        void Announce()
        {
            if(!Live||_busy)return;_busy=true;bool saved=GameRuntime.I.TryAnnounceShopCommission(out var reason);_busy=false;if(!Live)return;
            if(!saved){Failure("免费商品已保留，确认保存未成功，请重试。\n"+reason,Render);return;}
            _entered?.Invoke();
        }
        public void RequestLeave()
        {
            if(!Live||_busy)return;_busy=true;bool saved=GameRuntime.I.TryPersistMutation(()=>{},out var reason);_busy=false;if(!Live)return;
            if(!saved){Failure("保存未成功，仍保留在本页；请重试保存后离开。\n"+reason,RequestLeave);return;}_leave?.Invoke();
        }
        void Failure(string message,Action retry)
        {
            if(!Live)return;_retry=retry;Clear();Heading("接应凭据进度保留",message);
            Action(_scene.Body,"commissionRetry","重试并继续",()=>_retry?.Invoke(),true);Action(_scene.Body,"commissionLeave","保存后暂离",RequestLeave);Complete();
        }
        bool Goods()
        {
            var slots=GameRuntime.I.CurrentCommissionSlots;var stock=GameRuntime.I.CurrentNodeReceipt.shopStock;
            if(slots==null||slots.Count!=2||slots.Any(index=>index<0||index>=stock.Count)){Failure("原定免费商品已变化，凭据保留，尚未领取任何商品。",Render);return false;}
            var row=CurrentNodeElements.Rect(_scene.Body,"commission-goods");var layout=UIKit.GetOrAdd<HorizontalLayoutGroup>(row);layout.spacing=20;layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandWidth=layout.childForceExpandHeight=true;
            foreach(int index in slots)
            {
                var slot=stock[index];var entry=CurrentNodeElements.Rect(row,"commission-good-"+index);UIKit.GetOrAdd<Image>(entry).color=Theme.Hex("#15212ce6");var border=UIKit.GetOrAdd<Outline>(entry);border.effectColor=Theme.Hex("#c6b48780");border.effectDistance=Vector2.one;
                var flow=UIKit.GetOrAdd<VerticalLayoutGroup>(entry);flow.padding=new RectOffset(20,20,20,20);flow.spacing=12;flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandHeight=false;
                CurrentNodeElements.Text(entry,"commission-slot","第 "+(index+1)+" 格",18,"#b9c9d2");var name=CurrentNodeElements.Text(entry,"commission-good-name",slot.mystery?"神秘货箱":CardLibrary.FindById(slot.cardId)?.name,24,"#eef1ed",true);SourceTextLayout.Cjk(name);
                var price=CurrentNodeElements.Rect(entry,"commission-price");var prices=UIKit.GetOrAdd<HorizontalLayoutGroup>(price);prices.spacing=16;prices.childControlWidth=prices.childControlHeight=true;prices.childForceExpandWidth=false;UIKit.GetOrAdd<LayoutElement>(price).preferredHeight=42;
                var unpaid=CurrentNodeElements.Text(price,"commission-unpaid","待付款",18,"#b9c9d2");var width=UIKit.GetOrAdd<LayoutElement>(unpaid);width.preferredWidth=60;
                var strike=CurrentNodeElements.Fill(unpaid.transform,"source-del-strike","#b9c9d2");strike.rectTransform.anchorMin=new Vector2(0,.5f);strike.rectTransform.anchorMax=new Vector2(1,.5f);strike.rectTransform.offsetMin=new Vector2(0,-.5f);strike.rectTransform.offsetMax=new Vector2(0,.5f);
                var paid=CurrentNodeElements.Rect(price,"commission-paid");var size=UIKit.GetOrAdd<LayoutElement>(paid);size.preferredWidth=100;size.preferredHeight=42;
                var free=CurrentNodeElements.Text(paid,"commission-free","免费",28,"#c6b487",true);CurrentNodeElements.Stretch(free.rectTransform);UIKit.GetOrAdd<CurrentCommissionPaid>(paid).Begin(free);
            }
            return true;
        }
        void Arrive(string phase)
        {
            if(_phase==phase)return;_phase=phase;if(_arrival!=null)StopCoroutine(_arrival);var root=(RectTransform)_scene.transform;root.anchoredPosition=Vector2.zero;var group=UIKit.GetOrAdd<CanvasGroup>(root);group.alpha=1;if(!CurrentUiPreferences.ReducedMotion)_arrival=StartCoroutine(Arrival(root,group));
        }
        IEnumerator Arrival(RectTransform root,CanvasGroup group){float time=0;while(time<.65f){float ease=1-Mathf.Pow(1-time/.65f,3);group.alpha=ease;root.anchoredPosition=Vector2.right*(35*(1-ease));time+=Time.unscaledDeltaTime;yield return null;}group.alpha=1;root.anchoredPosition=Vector2.zero;_arrival=null;}
        void Update(){bool covered=UiStack.Top!=_owner||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen;if(!covered&&Live)RememberFocus();if(_covered&&!covered&&Live&&!_busy)Render();_covered=covered;}
    }
    public sealed class CurrentCommissionPaid:MonoBehaviour
    {
        Text _text;CanvasGroup _group;float _time;
        public void Begin(Text text){_text=text;_group=UIKit.GetOrAdd<CanvasGroup>(text);}
        void Update(){if(_text==null)return;_time+=Time.unscaledDeltaTime;float p=CurrentUiPreferences.ReducedMotion?1:Mathf.Clamp01(_time/.5f),ease=1-Mathf.Pow(1-p,3);_group.alpha=Mathf.Lerp(.4f,1,ease);_text.rectTransform.anchoredPosition=Vector2.down*(4*(1-ease));if(p>=1)enabled=false;}
    }
}
