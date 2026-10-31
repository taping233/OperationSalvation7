// expedition.view.js -> map-floating-tools.css -> run-experience.css, in source cascade order.
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.View;
using Sdt.UI.Screens.Bag;
namespace Sdt.UI.Kit
{
    public sealed class CurrentMapTools : MonoBehaviour
    {
        Text _bag,_safe,_pocket,_bagKey,_focusKey,_overviewKey,_name,_badge,_status,_hint,_actionText;
        Image _capacity,_nodeArt;Button _enter;GameObject _preview;CanvasGroup _group;string _selection,_previewKey;
        Action _confirm;
        public string ContentState { get; private set; }
        public static CurrentMapTools Install(Transform root,Action confirm)
        {
            var rt=CurrentRunHudView.Box(root,"expedition-map-tools",32,0,-64,88,new Vector2(0,0),Vector2.zero);rt.anchorMax=new Vector2(1,0);rt.anchoredPosition=new Vector2(32,18);
            var tools=UIKit.GetOrAdd<CurrentMapTools>(rt);tools._confirm=confirm;tools.Build();return tools;
        }
        public static void OpenBag(string zone="bag")
        {
            if(BagScreen.Current==null)BagScreen.Open();
            if(BagScreen.Current!=null)BagScreen.Current.SelectZone(zone);
        }
        Button Tool(string key,string label,float x,Action click,Vector2? anchor=null,Vector2? pivot=null)
        {
            var button=CurrentRunHudView.Button(transform,"map-tool-"+key,x,0,132,72,click,anchor??new Vector2(0,0),pivot??Vector2.zero);
            CurrentRunHudView.Art(button.transform,"expedition-tool-art",Sdt.Res.CurrentRunHudAssets.Tool(key),4,9,54,54);
            CurrentRunHudView.Text(button.transform,"expedition-tool-copy",label,62,6,72,28,17,"#c5d0cf");return button;
        }
        void Build()
        {
            _group=UIKit.GetOrAdd<CanvasGroup>(this);
            var bag=Tool("bag","背包",5,()=>OpenBag());_bag=CurrentRunHudView.Text(bag.transform,"bag-count","",62,34,70,25,21,"#e3e9e4",true);
            _bagKey=CurrentRunHudView.Text(bag.transform,"bag-key","",110,56,45,14,12,"#73858b",true);
            CurrentRunHudView.Fill(bag.transform,"capacity-track",62,63,70,4,"#283b43");_capacity=CurrentRunHudView.Fill(bag.transform,"capacity-fill",62,63,70,4,"#a3c4c5");
            var safe=Tool("safe","安全格",139,()=>OpenBag("safe"));_safe=CurrentRunHudView.Text(safe.transform,"safe-count","",62,34,70,25,21,"#e3e9e4",true);
            var pocket=Tool("pocket","消耗区",273,()=>OpenBag("pocket"));_pocket=CurrentRunHudView.Text(pocket.transform,"pocket-count","",62,34,70,25,21,"#e3e9e4",true);
            var focus=Tool("focus","定位",-278,()=>BoardViewHost.View?.FrameExploration(false),new Vector2(1,0),Vector2.zero);
            _focusKey=CurrentRunHudView.Text(focus.transform,"focus-key","",62,46,70,18,12,"#73858b",true);
            var overview=Tool("overview","全景",-144,()=>BoardViewHost.View?.FrameExploration(true),new Vector2(1,0),Vector2.zero);
            _overviewKey=CurrentRunHudView.Text(overview.transform,"overview-key","",62,46,70,18,12,"#73858b",true);
            _preview=CurrentRunHudView.Box(App.UiRoot,"expedition-map-preview",-32,140,460,332,new Vector2(1,1),new Vector2(1,1)).gameObject;
            UIKit.GetOrAdd<Image>(_preview).color=Theme.HexA("#111e29",.97f);
            var line=UIKit.GetOrAdd<Outline>(_preview);line.effectColor=Theme.HexA("#aac4cf",.22f);line.effectDistance=new Vector2(1,-1);
            CurrentRunHudView.Fill(_preview.transform,"preview-heading",0,0,460,120,"#0b151f");CurrentRunHudView.Fill(_preview.transform,"heading-accent",0,0,3,120,"#8fd3d0");
            _nodeArt=CurrentRunHudView.Art(_preview.transform,"expedition-preview-icon",null,18,28,58,58);
            CurrentRunHudView.Text(_preview.transform,"expedition-preview-status","地点预览",90,18,220,20,12,"#a8bac0");
            _name=CurrentRunHudView.Text(_preview.transform,"expedition-preview-name","",90,45,234,56,27);
            _badge=CurrentRunHudView.Text(_preview.transform,"expedition-preview-badge","",328,43,116,40,12,"#8fd3d0");
            _status=CurrentRunHudView.Text(_preview.transform,"expedition-node-status","",22,134,416,24,14,"#e6cb86");
            _hint=CurrentRunHudView.Text(_preview.transform,"expedition-preview-hint","",22,166,416,94,18,"#c5d2d4");
            _enter=CurrentRunHudView.Button(_preview.transform,"expedition-preview-enter",14,264,432,54,()=>_confirm?.Invoke());
            _enter.GetComponent<Image>().color=Theme.Hex("#dbe8df");_actionText=CurrentRunHudView.Text(_enter.transform,"label","",18,0,396,54,19,"#142226");
            _preview.SetActive(false);CurrentInputBindings.Changed+=RefreshBindings;RefreshBindings();
        }
        void RefreshBindings(){_bagKey.text=CurrentInputBindings.BindingLabel("backpack");_focusKey.text=CurrentInputBindings.BindingLabel("camFocus");_overviewKey.text=CurrentInputBindings.BindingLabel("camOverview");}
        public void SetSelection(string id){_selection=id;_previewKey=null;}
        public void SetVisible(bool visible){_group.alpha=visible?1:0;_group.interactable=_group.blocksRaycasts=visible;if(!visible)_preview.SetActive(false);}
        public void Refresh(bool visible)
        {
            SetVisible(visible);if(!visible)return;var r=GameRuntime.I;var s=r.State;var cap=CardContainerCommands.Query(r);
            _bag.text=cap.used+"<size=18><color=#91a3a7>/"+cap.totalCap+"</color></size>";_safe.text=cap.safeUsed+"<size=18><color=#91a3a7>/"+r.SafeCap+"</color></size>";_pocket.text=s.usedPocket.Sum(p=>p.count).ToString();
            _capacity.rectTransform.sizeDelta=new Vector2(70*Mathf.Clamp01((float)cap.used/Math.Max(1,cap.totalCap)),4);_capacity.color=Theme.Hex(cap.used>=cap.totalCap?"#e7a18b":cap.totalCap-cap.used<=3?"#d9c996":"#a3c4c5");
            var node=r.Map?.Nodes.FirstOrDefault(n=>n.id==_selection);if(BoardViewHost.View?.Cam!=null)BoardViewHost.View.Cam.detailInset=node==null?0:Mathf.Min(BoardViewHost.View.Cam.viewW*.38f,BoardViewHost.View.Cam.viewW*570/1920);
            if(node==null){_preview.SetActive(false);return;}
            bool current=node.id==r.CurrentNodeId;bool reachable=r.CanMoveToNode(node.id,out _);var status=CurrentMapNodeStatus.Project(r,node);ContentState=status.id;
            bool completed=current&&node.type!="door"&&(status.id=="completed"||status.id=="shop-closed");
            bool supply=current&&!r.EntrySupplyComplete;string name=supply?"入城补给":node.name;
            string label=completed?status.id=="shop-closed"?"本店交易已结束":"本地内容"+status.label:status.id=="pending"?current?"继续领奖":"前往领奖":current&&node.type=="door"?"查看闸门":status.id=="shop-open"?current?"进入商店":"前往商店":current?"查看本地内容":"进入该地点";
            string key=node.id+status.id+status.detail+s.Phase+reachable+s.hp+CurrentUiPreferences.ReadingLarge;if(_previewKey==key){_preview.SetActive(true);return;}_previewKey=key;
            _name.text=name;_badge.text=current?"当前位置":reachable?"可以前往":"暂不可前往";_status.text=status.label;_hint.text=status.detail;
            if(!reachable&&!current)_hint.text+="\n需要先到达与此处相连的地点。";
            if(new[]{"battle","boss","elite","battleElite"}.Contains(node.type)&&status.id!="pending"&&s.hp>0&&(float)s.hp/Math.Max(1,s.maxHp)<=.25f)_hint.text+="\n<color=#ed9a86>生命偏低，建议先恢复再迎战。</color>";
            _nodeArt.sprite=Sdt.Res.Res.NodeIcon(supply?"event":node.type);_actionText.text=label+"     →";_enter.interactable=s.Phase=="idle"&&(reachable||current)&&!completed;
            _hint.fontSize=CurrentUiPreferences.ReadingLarge?21:18;_preview.SetActive(true);
        }
        void OnDestroy()=>CurrentInputBindings.Changed-=RefreshBindings;
    }
    internal static class CurrentMapNodeStatus
    {
        internal struct Status {public string id,label,detail;}
        static Status S(string id,string label,string detail)=>new Status{id=id,label=label,detail=detail};
        public static Status Project(GameRuntime game,MapNode node)
        {
            var s=game.State;string key=node.id,type=node.type;bool door=type=="door"||game.Map.LayerData[node.layerIdx].doors.Any(d=>d.at==node.idx);
            s.nodeRewards.TryGetValue(key,out var r);
            if(s.closed.Contains(key))return door||type=="blank"||type=="entrance"?S("transit","",door?"闸门仍可通行。":""):type=="shop"?S("shop-closed","已离店","本次交易已结束，闸门与道路仍可通行。"):S("completed","已结束","本节点内容已结束，未领奖励与剩余机会已作废，仍可通行。");
            if(r!=null&&r.type=="fire"&&!r.completed&&(!r.healUsed||!r.restoreUsed))return S("pending","待休整","回血与复原各可使用一次，前往下一节点后剩余机会作废。");
            bool supply=key==game.CurrentNodeId&&!game.EntrySupplyComplete;
            if(supply||r!=null&&(!r.completed&&r.chestQueue!=null||r.rewardCardIds!=null&&!r.rewardTaken.HasValue||r.altarRewardPending||r.altarRestoreLeft>0||r.eventProgress!=null&&!r.eventProgress.settled||r.battleWon&&!r.completed))return S("pending","待领奖","可在当前节点整理后继续领取，前往下一节点后未领奖励作废。");
            if(type=="shop")return s.settled.Contains(key)?S("shop-closed","已离店","本次交易已结束，闸门与道路仍可通行。"):S("shop-open","营业中","离开此节点前可反复进店，货架保留。");
            if(!door&&(s.settled.Contains(key)||r?.completed==true||type=="altar"&&s.altarActivated&&r?.altarRewardPending!=true||type=="boss"&&s.bossDefeated))return S("completed","已完成","内容已结算，仍可通行。");
            if(door||new[]{"blank","empty","entrance","extraction","emergencyExit"}.Contains(type))return S("transit","",door?"闸门仍可通行。":"");
            if(type=="boss"&&!s.altarActivated)return S("incomplete","祭坛未激活","先前往污染祭坛，选择「弃 3 张 · 激活祭坛」（普通背包卡牌），或献上 2 枚员工通行证A碎片。仅献祭道具不会激活祭坛。");
            return S("incomplete","未完成",new[]{"battle","boss","elite","battleElite"}.Contains(type)?"战斗中不能整理背包。":type=="event"?"选择前可在当前节点整理，前往下一节点后事件结束。":"可在当前节点整理后重进，前往下一节点后内容结束。");
        }
    }
}
