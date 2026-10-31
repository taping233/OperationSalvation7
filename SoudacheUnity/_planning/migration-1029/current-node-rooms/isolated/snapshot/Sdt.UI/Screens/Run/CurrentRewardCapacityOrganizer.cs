// ui/reward-capacity-organizer.js + hub/game.reward-organizer.js; inventory commands remain authoritative.
using System;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEngine.UI;
using Sdt.Core;using Sdt.Run;using Sdt.UI.Kit;using Sdt.UI.Screens.Bag;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentRewardCapacityOrganizer:Panel
    {
        CurrentRewardItem _item;Panel _owner;RunState _run;string _node,_receipt="",_pending;bool _busy;RectTransform _root,_list;Text _heading,_capacity,_notice;ScrollRect _scroll;
        bool Live=>UiStack.Top==this&&_owner!=null&&GameRuntime.I.State==_run&&_run.runActive&&!_run.battleActive&&GameRuntime.I.CurrentNodeId==_node&&(_item.LiveState?.Invoke()??_item.State)=="pending";
        public static void Open(CurrentRewardItem item,Panel owner)
        {var page=ScreenMount.Show<CurrentRewardCapacityOrganizer>("RewardCapacityOrganizer");page._item=item;page._owner=owner;page._run=GameRuntime.I.State;page._node=GameRuntime.I.CurrentNodeId;page.Build();}
        public override void Build()
        {
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
            }
            _heading.text="待领取："+_item.Card.name;_capacity.text="背包 "+g.UsedSlots()+"/"+g.BagCap+" 格 · 安全格 "+g.SafeUsed()+"/"+g.SafeCap+" 格";
            var stacks=BagScreen.CardStacks(g.State,false).Where(s=>!s.supply&&!BaseData.IsSha(s.card)).ToArray();
            bool fits=g.CanReceiveCard(_item.Card);_notice.text=_receipt.Length>0?_receipt:fits?"已有位置，可以领取":"先移入安全格，或丢弃不需要的卡牌";
            CurrentNodeElements.Clear(_list);
            foreach(var stack in stacks)
            {
                var row=CurrentNodeElements.Rect(_list,"organizer-stack "+stack.uids[0]);UIKit.GetOrAdd<Image>(row).color=Theme.Hex("#192b42");var hl=UIKit.GetOrAdd<HorizontalLayoutGroup>(row);hl.padding=new RectOffset(16,16,16,16);hl.spacing=18;hl.childControlWidth=hl.childControlHeight=true;hl.childForceExpandWidth=false;hl.childForceExpandHeight=false;
                var label=CurrentNodeElements.Text(row,"stack-name",stack.card.name+" ×"+stack.count,22,"#e9f2ff",true);UIKit.GetOrAdd<LayoutElement>(label).flexibleWidth=1;
                if(_pending==stack.uids[0])
                {
                    CurrentNodeElements.Text(row,"discard-warning","丢弃 1 张，无法取回",22,"#f0c5ad");CurrentNodeElements.Button(row,"保留",()=>{_pending=null;Build();});
                    CurrentNodeElements.Button(row,"确认丢弃",()=>Perform(()=>CardContainerCommands.TryDiscard(g,stack.uids[0],out _receipt),"已丢弃："+stack.card.name+" ×1"));
                }
                else
                {
                    var projected=g.State.ownedCards.Select(o=>stack.uids.Contains(o.uid)?new OwnedCard{uid=o.uid,card=o.card,safe=true}:o).ToList();int delta=CardContainerCommands.Query(g,projected).safeUsed-g.SafeUsed(),room=Math.Max(0,g.SafeCap-g.SafeUsed());bool safe=delta<=room;
                    var move=CurrentNodeElements.Button(row,"移入安全格",()=>Perform(()=>CardContainerCommands.TryMoveSafe(g,stack.uids,true,out _receipt),"已移入安全格："+stack.card.name+" ×"+stack.count));move.interactable=safe;
                    if(!safe)CurrentNodeElements.Text(row,"safe-reason","整叠需 "+delta+" 格，安全格余 "+room+" 格",20,"#d2c3b0");
                    CurrentNodeElements.Button(row,"丢弃1张",()=>{if(Live&&!_busy){_pending=stack.uids[0];Build();}});
                }
            }
            if(stacks.Length==0)CurrentNodeElements.Text(_list,"organizer-empty","没有可直接腾位的卡牌，可打开完整背包整理道具。",22,"#e9f2ff");
            var old=_root.Find("organizer-actions");if(old!=null){old.gameObject.SetActive(false);Destroy(old.gameObject);}
            var actions=CurrentNodeElements.Rect(_root,"organizer-actions");var buttons=UIKit.GetOrAdd<HorizontalLayoutGroup>(actions);buttons.spacing=12;buttons.childControlWidth=buttons.childControlHeight=true;buttons.childForceExpandWidth=false;buttons.childForceExpandHeight=false;
            CurrentNodeElements.Button(actions,"返回奖励",CloseFromEscape);
            CurrentNodeElements.Button(actions,"完整背包",()=>{if(!Live||_busy)return;Close();g.Bus.Emit(new BagOpened());});
            var claim=CurrentNodeElements.Button(actions,fits?"收下此牌":"还需腾出位置",()=>{if(!Live||_busy||!g.CanReceiveCard(_item.Card))return;_busy=true;Close();_item.Claim?.Invoke();},true);claim.interactable=fits;
            _scroll.verticalNormalizedPosition=position;
        }
        void Perform(Func<bool> command,string receipt)
        {if(!Live||_busy)return;_busy=true;try{if(command()){_pending=null;_receipt=receipt+(GameRuntime.I.CanReceiveCard(_item.Card)?"":"；还需腾出位置");}}finally{_busy=false;}Build();}
        public override void CloseFromEscape(){if(Live&&!_busy)Close();}
    }
}
