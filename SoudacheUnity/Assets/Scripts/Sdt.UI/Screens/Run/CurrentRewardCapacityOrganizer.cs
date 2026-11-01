// ui/reward-capacity-organizer.js + hub/game.reward-organizer.js; inventory commands remain authoritative.
using System;using System.Collections.Generic;using UnityEngine;using UnityEngine.UI;using UnityEngine.EventSystems;
using Sdt.Core;using Sdt.Run;using Sdt.UI.Kit;using Sdt.UI.Screens.Bag;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentRewardCapacityOrganizer:Panel
    {
        CurrentRewardItem _item;Panel _owner;RunState _run;string _node,_receipt="",_pending;bool _busy,_closed;int _revision;int? _slot,_seed;RectTransform _root,_list,_actions;Text _heading,_capacity,_notice,_empty,_claimLabel;ScrollRect _scroll;
        Button _return,_bag,_claim;
        readonly Dictionary<(string action,string uid),Button> _focusButtons=new Dictionary<(string,string),Button>();
        readonly List<string> _stackUids=new List<string>();
        readonly Dictionary<string,StackRow> _rows=new Dictionary<string,StackRow>();
        readonly HashSet<string> _visible=new HashSet<string>();
        readonly List<string> _removed=new List<string>();
        sealed class StackRow
        {public RectTransform Root;public Text Label,Reason,Warning;public Button Safe,Discard,Keep,Confirm;}
        readonly struct DecisionFocus
        {
            public readonly string Action,Uid;public readonly int Index;
            public DecisionFocus(string action,string uid="",int index=0){Action=action;Uid=uid;Index=index;}
        }
        bool Live=>!_closed&&isActiveAndEnabled&&UiStack.Top==this&&CurrentRewardCardZoom.OwnerMounted(_owner)
            &&GameRuntime.I.State==_run&&_run.seed==_seed&&GameRuntime.I.ActiveSlot==_slot&&_run.runActive&&!_run.battleActive
            &&GameRuntime.I.CurrentNodeId==_node&&(_item.LiveState?.Invoke()??_item.State)=="pending";
        public static void Open(CurrentRewardItem item,Panel owner)
        {var page=ScreenMount.Show<CurrentRewardCapacityOrganizer>("RewardCapacityOrganizer");page._item=item;page._owner=owner;page._run=GameRuntime.I.State;page._seed=page._run.seed;page._slot=GameRuntime.I.ActiveSlot;page._node=GameRuntime.I.CurrentNodeId;page.Build();}
        public override void Build()
            =>Render(CaptureFocus()??new DecisionFocus("return"));
        void Render(DecisionFocus? focus)
        {
            if(_closed)return;int revision=++_revision;
            var g=GameRuntime.I;float position=_scroll!=null?_scroll.verticalNormalizedPosition:1;
            if(_root==null)
            {
                var dim=CurrentNodeElements.Fill(transform,"organizer-shade","#07121b");CurrentNodeElements.Stretch(dim.rectTransform);dim.color=Theme.HexA("#07121b",.88f);dim.raycastTarget=true;
                _root=CurrentNodeElements.Rect(transform,"reward-capacity-organizer");_root.anchorMin=_root.anchorMax=_root.pivot=Vector2.one*.5f;
                _root.sizeDelta=new Vector2(Mathf.Min(1320,((RectTransform)transform).rect.width-48),Mathf.Min(800,((RectTransform)transform).rect.height-48));
                UIKit.GetOrAdd<Image>(_root).color=Theme.Hex("#101d30");var layout=UIKit.GetOrAdd<VerticalLayoutGroup>(_root);layout.padding=new RectOffset(24,24,24,24);layout.spacing=18;layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandWidth=true;layout.childForceExpandHeight=false;
                _heading=CurrentNodeElements.Text(_root,"organizer-heading","",28,"#e9f2ff",true);_capacity=CurrentNodeElements.Text(_root,"organizer-capacity","",22,"#e9f2ff");
                CurrentNodeElements.Text(_root,"organizer-immediate","整理操作立即生效，返回奖励不会撤销。",22,"#e9f2ff");_notice=CurrentNodeElements.Text(_root,"organizer-receipt","",22,"#c7e1fa");
                var content=UIKit.Scroll(_root);_list=(RectTransform)content.transform;_scroll=content.GetComponentInParent<ScrollRect>();UIKit.GetOrAdd<LayoutElement>(_scroll).flexibleHeight=1;
                _empty=CurrentNodeElements.Text(_list,"organizer-empty","没有可直接腾位的卡牌，可打开完整背包整理道具。",22,"#e9f2ff");
                _actions=CurrentNodeElements.Rect(_root,"organizer-actions");var buttons=UIKit.GetOrAdd<HorizontalLayoutGroup>(_actions);buttons.spacing=12;buttons.childControlWidth=buttons.childControlHeight=true;buttons.childForceExpandWidth=false;buttons.childForceExpandHeight=false;
                _return=CurrentNodeElements.Button(_actions,"返回奖励",null);_bag=CurrentNodeElements.Button(_actions,"完整背包",null);_claim=CurrentNodeElements.Button(_actions,"收下此牌",null,true);_claimLabel=_claim.GetComponentInChildren<Text>();
            }
            var safePreview=CardContainerCommands.CreateSafeStoragePreview(g);
            _heading.text="待领取："+_item.Card.name;_capacity.text="背包 "+safePreview.used+"/"+safePreview.totalCap+" 格 · 安全格 "+safePreview.SafeUsed+"/"+g.SafeCap+" 格";
            var stacks=BagScreen.CardStacks(g.State,false);stacks.RemoveAll(stack=>stack.supply||BaseData.IsSha(stack.card));
            bool fits=g.CanReceiveCard(_item.Card);_notice.text=_receipt.Length>0?_receipt:fits?"已有位置，可以领取":"先移入安全格，或丢弃不需要的卡牌";
            _focusButtons.Clear();_stackUids.Clear();_visible.Clear();foreach(var stack in stacks){_stackUids.Add(stack.uids[0]);_visible.Add(stack.uids[0]);}
            if(_pending!=null&&!_visible.Contains(_pending))_pending=null;
            for(int i=0;i<stacks.Count;i++)
            {
                var stack=stacks[i];string uid=stack.uids[0];int index=i;
                if(!_rows.TryGetValue(uid,out var row))
                {
                    var root=CurrentNodeElements.Rect(_list,"organizer-stack "+uid);UIKit.GetOrAdd<Image>(root).color=Theme.Hex("#192b42");var hl=UIKit.GetOrAdd<HorizontalLayoutGroup>(root);hl.padding=new RectOffset(16,16,16,16);hl.spacing=18;hl.childControlWidth=hl.childControlHeight=true;hl.childForceExpandWidth=false;hl.childForceExpandHeight=false;
                    row=new StackRow{Root=root,Label=CurrentNodeElements.Text(root,"stack-name","",22,"#e9f2ff",true)};UIKit.GetOrAdd<LayoutElement>(row.Label).flexibleWidth=1;
                    row.Safe=CurrentNodeElements.Button(root,"移入安全格",null);row.Reason=CurrentNodeElements.Text(root,"safe-reason","",20,"#d2c3b0");row.Discard=CurrentNodeElements.Button(root,"丢弃1张",null);_rows.Add(uid,row);
                }
                if(row.Root.GetSiblingIndex()!=i)row.Root.SetSiblingIndex(i);row.Label.text=stack.card.name+" ×"+stack.count;
                bool confirming=_pending==uid;
                if(confirming&&row.Confirm==null)
                {
                    row.Warning=CurrentNodeElements.Text(row.Root,"discard-warning","丢弃 1 张，无法取回",22,"#f0c5ad");row.Keep=CurrentNodeElements.Button(row.Root,"保留",null);row.Confirm=CurrentNodeElements.Button(row.Root,"确认丢弃",null);
                }
                bool safe=safePreview.CanStore(stack.card,stack.count,out int delta);int room=Math.Max(0,g.SafeCap-safePreview.SafeUsed);
                row.Safe.gameObject.SetActive(!confirming);row.Discard.gameObject.SetActive(!confirming);row.Reason.gameObject.SetActive(!confirming&&!safe);row.Safe.interactable=safe;
                if(!safe)row.Reason.text=delta>room?"整叠需 "+delta+" 格，安全格余 "+room+" 格":"移入后背包仍超出容量，请先继续整理";
                if(row.Confirm!=null){row.Warning.gameObject.SetActive(confirming);row.Keep.gameObject.SetActive(confirming);row.Confirm.gameObject.SetActive(confirming);}
                if(confirming)
                {
                    Bind(row.Keep,"keep",revision,()=>{_pending=null;Render(new DecisionFocus("discard",uid,index));});
                    Bind(row.Confirm,"confirm",revision,()=>{if(_pending==uid)Perform(()=>CardContainerCommands.TryDiscard(g,uid,out _receipt),"已丢弃："+stack.card.name+" ×1",new DecisionFocus("confirm",uid,index));},uid);
                }
                else
                {
                    Bind(row.Safe,"safe",revision,()=>Perform(()=>CardContainerCommands.TryMoveSafe(g,stack.uids,true,out _receipt),"已移入安全格："+stack.card.name+" ×"+stack.count,new DecisionFocus("safe",uid,index)),uid);
                    Bind(row.Discard,"discard",revision,()=>{_pending=uid;Render(new DecisionFocus("keep"));},uid);
                }
            }
            _removed.Clear();foreach(var uid in _rows.Keys)if(!_visible.Contains(uid))_removed.Add(uid);
            foreach(var uid in _removed){var root=_rows[uid].Root;root.gameObject.SetActive(false);root.SetParent(null,false);Destroy(root.gameObject);_rows.Remove(uid);}
            _empty.gameObject.SetActive(stacks.Count==0);
            Bind(_return,"return",revision,CloseFromEscape);
            Bind(_bag,"bag",revision,()=>{Close();g.Bus.Emit(new BagOpened());});
            _claimLabel.text=fits?"收下此牌":"还需腾出位置";_claim.interactable=fits;
            Bind(_claim,"claim",revision,()=>{if(!g.CanReceiveCard(_item.Card)){_receipt="空间已变化，请继续整理";Render(new DecisionFocus("return"));return;}_busy=true;Close();_item.Claim?.Invoke();});
            RestoreFocus(focus);
            _scroll.verticalNormalizedPosition=position;
        }
        void Bind(Button button,string action,int revision,Action activate,string uid="")
        {
            button.name="organizer-"+action+(uid.Length>0?"-"+uid:"");_focusButtons[(action,uid)]=button;
            // Replace the event object: a caller retaining an earlier UnityEvent keeps its expired revision.
            button.onClick=new Button.ButtonClickedEvent();button.onClick.AddListener(()=>{if(revision!=_revision||!Live||_busy||!button.IsActive()||!button.IsInteractable())return;AudioService.I.PlaySfx("click");activate();});
        }
        DecisionFocus? CaptureFocus()
        {
            var selected=EventSystem.current?.currentSelectedGameObject;
            if(selected!=null)foreach(var entry in _focusButtons)if(entry.Value!=null&&entry.Value.gameObject==selected)
                return new DecisionFocus(entry.Key.action,entry.Key.uid,_stackUids.IndexOf(entry.Key.uid));
            return null;
        }
        void RestoreFocus(DecisionFocus? requested)
        {
            if(!requested.HasValue||!Live)return;var focus=requested.Value;Button target=null;
            if(focus.Action=="keep"||focus.Action=="return"||focus.Action=="bag"||focus.Action=="claim")
                _focusButtons.TryGetValue((focus.Action,""),out target);
            else if(_stackUids.Count>0)
            {
                int same=_stackUids.IndexOf(focus.Uid),index=same>=0?same:Mathf.Clamp(focus.Index,0,_stackUids.Count-1);string uid=_stackUids[index];
                _focusButtons.TryGetValue((focus.Action,uid),out target);
                if(target==null||!target.IsInteractable())_focusButtons.TryGetValue(("discard",uid),out target);
            }
            if(target==null||!target.IsInteractable())_focusButtons.TryGetValue(("return",""),out target);
            if(target!=null)EventSystem.current?.SetSelectedGameObject(target.gameObject);
        }
        void Perform(Func<bool> command,string receipt,DecisionFocus focus)
        {if(!Live||_busy)return;_busy=true;try{if(command()){_pending=null;_receipt=receipt+(GameRuntime.I.CanReceiveCard(_item.Card)?"":"；还需腾出位置");}}finally{_busy=false;}Render(focus);}
        public override void CloseFromEscape(){if(Live&&!_busy)Close();}
        internal override void OnClose(){_closed=true;_revision++;}
    }
}
