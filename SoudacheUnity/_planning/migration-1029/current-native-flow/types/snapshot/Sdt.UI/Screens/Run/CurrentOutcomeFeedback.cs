// Current outcome-feedback.js active compact cue: 720ms, already-settled data only.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentOutcomeFeedback:MonoBehaviour
    {
        Action _done;float _time;Panel _owner;CanvasGroup _group;RectTransform _fill;float _before,_after;bool _finished;Func<bool> _current;
        public static void Play(Transform parent,string kind,int before,int after,int max,CardDef[] cards,Action done,string source=null,string extra=null,Func<bool> current=null)
        {
            if(kind=="restore"&&cards.Length>0)AudioService.I.PlaySfx("cardRestore");
            if(CurrentUiPreferences.ReducedMotion){done?.Invoke();return;}
            var root=CurrentNodeElements.Rect(parent,"outcome-feedback is-"+kind);CurrentNodeElements.Fixed(root,-24,72,340,kind=="heal"?120:218,new Vector2(1,0),new Vector2(1,0));root.anchoredPosition=new Vector2(-24,72);
            var bg=UIKit.GetOrAdd<Image>(root);bg.color=Theme.HexA("#090b0d",.9f);bg.raycastTarget=false;
            var view=UIKit.GetOrAdd<CurrentOutcomeFeedback>(root);view._done=done;view._current=current;view._owner=root.GetComponentInParent<Panel>();view._group=UIKit.GetOrAdd<CanvasGroup>(root);view._group.blocksRaycasts=false;
            view._before=(float)before/Mathf.Max(1,max);view._after=(float)after/Mathf.Max(1,max);
            var art=UIKit.Image(root,Sdt.Res.CurrentNodeAssets.Outcome(kind));art.preserveAspect=true;art.raycastTarget=false;
            CurrentNodeElements.Fixed(art.rectTransform,kind=="heal"?18:286,kind=="heal"?28:6,kind=="heal"?64:48,kind=="heal"?64:48);if(kind!="heal")art.color=new Color(1,1,1,.3f);
            if(!string.IsNullOrEmpty(source)){var sourceText=CurrentNodeElements.Text(root,"outcome-source",source,11,"#c3c5c2");CurrentNodeElements.Fixed(sourceText.rectTransform,98,1,224,16);sourceText.alignment=TextAnchor.MiddleCenter;}
            if(!string.IsNullOrEmpty(extra)){var extraText=CurrentNodeElements.Text(root,"outcome-extra",extra,11,"#bcb9af");CurrentNodeElements.Fixed(extraText.rectTransform,98,111,224,18);extraText.alignment=TextAnchor.MiddleCenter;root.sizeDelta=new Vector2(340,140);}
            var title=CurrentNodeElements.Text(root,"outcome-heading",kind=="heal"?"生命恢复":"卡牌复原",16,"#d8d3c7");CurrentNodeElements.Fixed(title.rectTransform,kind=="heal"?98:14,12,kind=="heal"?224:312,26);title.alignment=TextAnchor.MiddleCenter;
            var summary=CurrentNodeElements.Text(root,"outcome-summary",kind=="heal"?"+"+Math.Max(0,after-before):cards.Length+" 张",28,"#c6d0bc");CurrentNodeElements.Fixed(summary.rectTransform,kind=="heal"?98:14,40,kind=="heal"?224:312,34);summary.alignment=TextAnchor.MiddleCenter;
            var detail=CurrentNodeElements.Text(root,"outcome-detail",kind=="heal"?before+" → "+after+" / "+max:"已回到背包",12,"#bcb9af");CurrentNodeElements.Fixed(detail.rectTransform,kind=="heal"?98:14,kind=="heal"?94:190,kind=="heal"?224:312,18);detail.alignment=TextAnchor.MiddleCenter;
            if(kind=="heal")
            {var rail=CurrentNodeElements.Fill(root,"fire-heal-meter","#8bafa1");CurrentNodeElements.Fixed(rail.rectTransform,98,80,144,3);rail.color=Theme.HexA("#8bafa1",.18f);var fill=CurrentNodeElements.Fill(rail.transform,"fire-heal-fill","#b6c4af");view._fill=fill.rectTransform;view._fill.pivot=Vector2.zero;view._fill.anchorMin=view._fill.anchorMax=Vector2.zero;view._fill.sizeDelta=new Vector2(144*view._before,3);}
            else for(int i=0;i<Math.Min(3,cards.Length);i++){var face=CardFace.Create(cards[i],CardSize.Sm,root);var rt=(RectTransform)face.transform;CurrentNodeElements.Fixed(rt,64+i*76,90,64,96);var paper=face.transform.Find("paper-card") as RectTransform;if(paper!=null)rt.localScale=Vector3.one*(64f/paper.sizeDelta.x);}
        }
        void Update()
        {
            if(_current!=null?!_current():UiStack.Top!=_owner){Finish();return;}_time+=Time.unscaledDeltaTime;float p=_time/.72f;_group.alpha=p<.12f?p/.12f:p>.8f?(1-p)/.2f:1;
            if(_fill!=null)_fill.sizeDelta=new Vector2(144*Mathf.Lerp(_before,_after,Mathf.SmoothStep(0,1,Mathf.Clamp01((_time-.04f)/.55f))),3);
            if(p>=1)Finish();
        }
        void Finish(){if(_finished)return;_finished=true;var done=_done;_done=null;Destroy(gameObject);done?.Invoke();}
        void OnDestroy(){if(!_finished){_finished=true;var done=_done;_done=null;done?.Invoke();}}
    }
}
