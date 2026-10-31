// Active event-recode-result.js presentation; the existing event command owns the mutation.
using System;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public partial class EventDialogScreen
    {
        CurrentRecodeResultView _recodeResult;
        string _recodeSignature;
        GameObject _recodeBagReturn;

        bool TryRenderRecodeResult()
        {
            if(_outcome?.Stage!="recodeConfirm")return false;
            var runtime=GameRuntime.I;
            var progress=runtime.CurrentNodeReceipt.eventProgress;
            string signature=string.Join("|",progress.sources.Select(s=>s.uid+":"+s.name))+"=>"+string.Join("|",progress.drawn);
            if(_reward!=null)_reward.gameObject.SetActive(false);
            if(_illustrated==null)_illustrated=CurrentIllustratedNode.Create(transform,"scene-event-recode","重编结果","新卡已确定，确认后替换原卡。");
            _illustrated.gameObject.SetActive(true);
            if(_recodeResult==null||_recodeSignature!=signature)
            {
                _recodeSignature=signature;
                _illustrated.ClearContent();
                _illustrated.Set("重编结果","新卡已确定，确认后替换原卡。");
                BodyRoot=_illustrated.Body;FootRoot=_illustrated.Footer;
                var root=CurrentNodeElements.Rect(BodyRoot,"recode-result");
                _recodeResult=UIKit.GetOrAdd<CurrentRecodeResultView>(root);
                _recodeResult.Build(progress.sources.ToArray(),progress.drawn.Select(CardLibrary.FindById).ToArray(),FootRoot,
                    ()=>EventLive&&!_eventBusy,
                    trigger=>{_recodeBagReturn=trigger;runtime.Bus.Emit(new BagOpened());},
                    ()=>RunCurrent(()=>runtime.ApplyCurrentEventChoice("__recode_confirm")));
            }
            _illustrated.OnResume=()=>
            {
                if(!runtime.State.runActive||runtime.State.battleActive)return;
                runtime.State.Phase="modal";Build();
                if(_recodeBagReturn!=null&&_recodeBagReturn.activeInHierarchy)
                    EventSystem.current?.SetSelectedGameObject(_recodeBagReturn);
                _recodeBagReturn=null;
            };
            bool failed=!string.IsNullOrEmpty(_eventFeedback)&&_eventFeedback!=_outcome.Message;
            _recodeResult.SetNotice(failed?"本次更换尚未完成，原卡和结果已保留；可整理背包后重试。":null);
            _illustrated.Complete(false);
            return true;
        }
    }

    // The source uses the original name and arrow above each frozen new face.
    // Reading and bag navigation never draw, replace, charge or persist an event.
    public sealed class CurrentRecodeResultView:MonoBehaviour
    {
        public const float CardWidth=13.08f*14;
        Text _notice;
        public Button BagButton{get;private set;}
        public Button ConfirmButton{get;private set;}
        public void Build(EventSource[] sources,CardDef[] cards,Transform footer,Func<bool> active,Action<GameObject> openBag,Action confirm)
        {
            var flow=UIKit.GetOrAdd<CurrentRewardFlow>(this);
            flow.Spacing=new Vector2(40,24);flow.padding=new RectOffset(12,12,24,36);flow.childAlignment=TextAnchor.UpperCenter;
            for(int i=0;i<Math.Min(sources.Length,cards.Length);i++)
            {
                var card=cards[i];if(card==null)continue;
                var item=CurrentNodeElements.Rect(transform,"recode-result-item-"+i);
                var name=CurrentNodeElements.Text(item,"recode-result-source",sources[i].name,20,"#b4c8d3");
                name.supportRichText=false;name.horizontalOverflow=HorizontalWrapMode.Overflow;name.lineSpacing=SourceTextLayout.LineSpacing(name,1.4f);
                float nameWidth=name.preferredWidth;
                var arrow=CurrentNodeElements.Text(item,"recode-result-arrow","→",30,"#e0d2a8");
                arrow.horizontalOverflow=HorizontalWrapMode.Overflow;arrow.alignment=TextAnchor.MiddleCenter;
                float arrowWidth=arrow.preferredWidth,width=Mathf.Max(CardWidth,nameWidth+24+arrowWidth);
                float labelWidth=nameWidth+24+arrowWidth;
                CurrentNodeElements.Fixed(name.rectTransform,(width-labelWidth)*.5f,0,nameWidth,42);name.alignment=TextAnchor.MiddleLeft;
                CurrentNodeElements.Fixed(arrow.rectTransform,(width-labelWidth)*.5f+nameWidth+24,0,arrowWidth,42);
                var readRoot=DepartureElements.Card(item,card,CardWidth,"eventRecodeInspect-"+i);
                CurrentNodeElements.Fixed(readRoot,(width-CardWidth)*.5f,62,CardWidth,CardWidth*1.5f);
                var hit=UIKit.GetOrAdd<Image>(readRoot);hit.color=Color.clear;
                var read=UIKit.GetOrAdd<Button>(readRoot);read.targetGraphic=hit;read.transition=Selectable.Transition.None;
                read.onClick.AddListener(()=>
                {
                    if(active())DepartureCardZoom.Open(new[]{card},returnFocus:_=>read.gameObject);
                });
                var size=UIKit.GetOrAdd<LayoutElement>(item);size.minWidth=size.preferredWidth=width;
                size.minHeight=size.preferredHeight=62+CardWidth*1.5f;size.flexibleWidth=size.flexibleHeight=0;
            }
            var footerColumn=CurrentNodeElements.Rect(footer,"recode-result-footer");
            var footerSize=UIKit.GetOrAdd<LayoutElement>(footerColumn);footerSize.flexibleWidth=1;
            var column=UIKit.GetOrAdd<VerticalLayoutGroup>(footerColumn);column.spacing=12;column.childControlWidth=column.childControlHeight=true;column.childForceExpandHeight=false;column.childForceExpandWidth=true;
            var actions=CurrentNodeElements.Rect(footerColumn,"recode-result-actions");
            var row=UIKit.GetOrAdd<HorizontalLayoutGroup>(actions);row.spacing=12;row.childAlignment=TextAnchor.MiddleRight;row.childControlWidth=row.childControlHeight=true;row.childForceExpandHeight=row.childForceExpandWidth=false;
            BagButton=CurrentNodeElements.Button(actions,"整理背包",()=>{if(active())openBag(BagButton.gameObject);});BagButton.name="eventRecodeResultBag";
            ConfirmButton=CurrentNodeElements.Button(actions,"确认更换，继续探索",()=>{if(active())confirm();},true);ConfirmButton.name="eventRecodeAccept";
            UIKit.GetOrAdd<LayoutElement>(ConfirmButton).preferredWidth=280;
            _notice=CurrentNodeElements.Text(footerColumn,"recode-confirm-notice","",18,"#e4c6aa");
            _notice.lineSpacing=SourceTextLayout.LineSpacing(_notice,1.5f);SourceTextLayout.Cjk(_notice);_notice.gameObject.SetActive(false);
        }
        public void SetNotice(string notice)
        {
            _notice.text=notice??"";_notice.gameObject.SetActive(!string.IsNullOrEmpty(notice));
            LayoutRebuilder.MarkLayoutForRebuild((RectTransform)_notice.transform.parent);
        }
    }
}
