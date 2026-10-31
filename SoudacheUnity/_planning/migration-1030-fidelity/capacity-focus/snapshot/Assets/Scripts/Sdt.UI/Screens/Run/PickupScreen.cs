// Current openPickupPage: 950ms search, claim once, retry save, guarded map return.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class PickupScreen:NodeShellPanel
    {
        string _kind,_gain,_node,_error;
        int? _seed;Action _onDone;
        float _searchAt;bool _revealed,_busy,_copyChosen;
        public static void Open(string kind,string gain,Action onDone)
        {
            var page=ScreenMount.Show<PickupScreen>("Pickup");
            page._kind=kind;page._gain=gain;page._onDone=onDone;page._node=GameRuntime.I.CurrentNodeId;page._seed=GameRuntime.I.State.seed;
            page.Tone="pickup";page.AssetKey="scene-pickup-"+kind;
            var scene=System.Linq.Enumerable.FirstOrDefault(Sdt.Core.SceneCopy.SCENES,item=>item.Key==kind).Value;
            page.Title=scene?.title??"发现物资";page._searchAt=Time.unscaledTime+.95f;page.Build();
            AudioService.I.PlaySfx("searchStart");
        }
        bool Current=>GameRuntime.I.State.runActive&&GameRuntime.I.State.seed==_seed&&GameRuntime.I.CurrentNodeId==_node&&UiStack.Top==this;
        protected override void OnPrepare()
        {
            if(_copyChosen)return;_copyChosen=true;
            var scene=System.Linq.Enumerable.FirstOrDefault(Sdt.Core.SceneCopy.SCENES,item=>item.Key==_kind).Value;
            Sub=scene?.lines?.Length>0?scene.lines[(int)(GameRuntime.I.Rng.Random("gameplay")*scene.lines.Length)]:"";
            if(GameRuntime.I.CurrentNodeReceipt.pickupClaimed)_revealed=true;
        }
        protected override void OnBody()
        {
            if(!_revealed)
            {
                var lantern=CurrentNodeElements.Text(BodyRoot,"pickup-search-lantern","[[icon:lantern]]",42,"#d4c38d");lantern.alignment=TextAnchor.MiddleCenter;UIKit.GetOrAdd<LayoutElement>(lantern).preferredHeight=120;
                var ground=CurrentNodeElements.Rect(BodyRoot,"ps-ground");UIKit.GetOrAdd<LayoutElement>(ground).preferredHeight=6;
                var rail=CurrentNodeElements.Fill(ground,"ps-progress-track","#ffffff");CurrentNodeElements.Stretch(rail.rectTransform);rail.color=Theme.HexA("#ffffff",.14f);
                var fill=CurrentNodeElements.Fill(ground,"ps-progress-fill","#fcebb1");CurrentNodeElements.Stretch(fill.rectTransform);fill.rectTransform.anchorMax=new Vector2(0,1);
                var search=UIKit.GetOrAdd<CurrentPickupSearch>(ground);search.Bind(lantern.rectTransform,fill.rectTransform,_searchAt-.95f);
                var tip=CurrentNodeElements.Text(BodyRoot,"ps-tip","正在搜索物资…",22,"#c9d2d7");tip.alignment=TextAnchor.MiddleCenter;
                return;
            }
            var gain=CurrentNodeElements.Text(BodyRoot,"gain-big",_gain,38,"#b6cbd7",true);gain.alignment=TextAnchor.MiddleCenter;UIKit.GetOrAdd<LayoutElement>(gain).preferredHeight=80;
            if(!string.IsNullOrEmpty(_error))CurrentNodeElements.Text(BodyRoot,"pickup-save-notice","本次操作已保留，保存尚未完成。\n"+_error,19,"#f0c5ad");
            bool claimed=GameRuntime.I.CurrentNodeReceipt.pickupClaimed;
            EventOptButton.Create(BodyRoot,_error!=null?"重试保存":claimed?"继续":"获取并离开",null,"ok",Claim);
        }
        void Update()
        {
            if(!Current||_revealed)return;
            if(Time.unscaledTime>=_searchAt){_revealed=true;AudioService.I.PlaySfx("searchReveal");Rebuild();}
        }
        void Claim()
        {
            if(!Current||_busy||!_revealed)return;_busy=true;
            try
            {
                if(!GameRuntime.I.TryClaimCurrentPickup(_node,out _error)){Rebuild();return;}
                if(!GameRuntime.I.TryLeaveCurrentPickup(_node,out _error)){Rebuild();return;}
                var done=_onDone;_onDone=null;Close();done?.Invoke();
            }
            finally{_busy=false;}
        }
        public override void CloseFromEscape()
        {
            if(!Current||_busy)return;
            if(!GameRuntime.I.TryLeaveCurrentPickup(_node,out _error)){_revealed=true;Rebuild();return;}
            var done=GameRuntime.I.CurrentNodeReceipt.pickupClaimed?_onDone:null;_onDone=null;Close();done?.Invoke();
        }
    }
}
