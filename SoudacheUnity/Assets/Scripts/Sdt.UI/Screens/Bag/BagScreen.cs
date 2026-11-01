// Current source: hub/game.bag.js, core/bag-render-derivation.js and hub/bag-pane-view.js.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Bag
{
    public partial class BagScreen : Panel
    {
        public override bool CoversBoard=>true;
        public static BagScreen Current;
        public string Zone { get; private set; } = "bag";
        string _filter = "all", _sortKey = "rarity", _notice;
        RunState _run;
        int _generation;
        public sealed class Stack
        {
            public CardDef card;
            public int count, pocketIndex = -1;
            public bool supply;
            public string key, zone, supplyName, tier;
            public readonly List<string> uids = new List<string>();
        }
        public static string Identity(CardDef card) => GameRuntime.DepartureStackKey(new StashStack { card = card });
        sealed class StackGroup
        {
            public CardDef card;
            public string key;
            public bool safe;
            public readonly List<string> uids = new List<string>();
        }
        static (List<Stack> bag,List<Stack> safe) BuildCardStacks(RunState state,bool? onlySafe=null)
        {
            var bag=new List<Stack>();var safe=new List<Stack>();
            var groups=new Dictionary<(bool safe,string key),StackGroup>();var ordered=new List<StackGroup>();
            foreach(var entry in state.ownedCards)
            {
                bool isSafe=entry.safe==true;
                if(entry.card==null||entry.stored||!string.IsNullOrEmpty(entry.pouchOf)||onlySafe.HasValue&&onlySafe.Value!=isSafe)continue;
                string key=Identity(entry.card);
                if(!groups.TryGetValue((isSafe,key),out var group))
                {
                    group=new StackGroup{card=entry.card,key=key,safe=isSafe};groups.Add((isSafe,key),group);ordered.Add(group);
                }
                group.uids.Add(entry.uid);
            }
            foreach(var group in ordered)
            {
                int cap=CardContainerCommands.StackCap(group.card);var target=group.safe?safe:bag;
                for(int i=0;i<group.uids.Count;i+=cap)
                {
                    var stack=new Stack{card=group.card,count=Math.Min(cap,group.uids.Count-i),key=group.key,zone=group.safe?"safe":"bag"};
                    for(int j=i;j<i+stack.count;j++)stack.uids.Add(group.uids[j]);
                    target.Add(stack);
                }
            }
            return(bag,safe);
        }
        public static List<Stack> CardStacks(RunState state,bool safe)
        {
            var stacks=BuildCardStacks(state,safe);return safe?stacks.safe:stacks.bag;
        }
        public static void SyncCardOrder(RunState state)
        {
            var stacks=BuildCardStacks(state);SyncCardOrder(state,stacks.bag.Concat(stacks.safe));
        }
        static void SyncCardOrder(RunState state,IEnumerable<Stack> stacks)
        {
            var known=new List<string>();var keys=new HashSet<string>();var names=new Dictionary<string,List<string>>();var rank=new Dictionary<string,int>();
            foreach(var stack in stacks)
            {
                if(keys.Add(stack.key)){rank.Add(stack.key,known.Count);known.Add(stack.key);}
                if(stack.card.name==null)continue;
                if(!names.TryGetValue(stack.card.name,out var matches))names.Add(stack.card.name,matches=new List<string>());
                if(!matches.Contains(stack.key))matches.Add(stack.key);
            }
            foreach(var matches in names.Values)matches.Sort((a,b)=>rank[a].CompareTo(rank[b]));
            var order=new List<string>();var included=new HashSet<string>();
            foreach(var old in (IEnumerable<string>)state.cardOrder??Enumerable.Empty<string>())
            {
                if(old==null)continue;
                if(keys.Contains(old)&&included.Add(old))order.Add(old);
                if(names.TryGetValue(old,out var matches))foreach(var key in matches)if(included.Add(key))order.Add(key);
            }
            foreach(var key in known)if(included.Add(key))order.Add(key);
            state.cardOrder=order;
        }
        static List<Stack> Sorted(RunState state,List<Stack> stacks)
        {
            var index=new Dictionary<string,int>();int position=0;
            foreach(var key in (IEnumerable<string>)state.cardOrder??Enumerable.Empty<string>()){if(key!=null&&!index.ContainsKey(key))index.Add(key,position);position++;}
            return stacks.OrderBy(s=>index.TryGetValue(s.key,out var i)||index.TryGetValue(s.card.name,out i)?i:int.MaxValue).ToList();
        }
        public static void MoveStackOrder(RunState state,string source,string before)
        {
            var zones=BuildCardStacks(state);var stacks=zones.bag.Concat(zones.safe).ToList();SyncCardOrder(state,stacks);
            string Resolve(string value)=>state.cardOrder.Contains(value??"")?value:stacks.FirstOrDefault(s=>s.card.name==value)?.key;
            source=Resolve(source);before=Resolve(before);
            if(source==null||source==before)return;
            var order=state.cardOrder.Where(k=>k!=source).ToList();
            int index=before==null?-1:order.IndexOf(before);order.Insert(index<0?order.Count:index,source);state.cardOrder=order;
        }
        public static void Open()
        {
            var state = GameRuntime.I.State;
            if (Current != null)
            {
                if (UiStack.Top != Current) { UiStack.Top?.CloseFromEscape(); return; }
                Current.CloseBag(); return;
            }
            if (state == null || !state.runActive) return;
            if (state.battleActive || state.bossCleanupPending || string.IsNullOrEmpty(state.myClass))
            {
                RunLog.Log(state.battleActive ? "战斗中无法打开背包；战斗结束后可回地图整理" : state.bossCleanupPending ? "请先完成 BOSS 战后的整理背包" : "先选择本局角色，再整理背包", "warn"); return;
            }
            var screen = ScreenMount.Show<BagScreen>("Bag"); screen._run = state; screen.Build(); App.RegisterKey(KeyCode.B, Open);
        }
        public override void Build()
        {
            Current = this; _run ??= GameRuntime.I.State;
            BuildShell(); RefreshView(false);
        }
        public static void Refresh() { if (Current != null) Current.RefreshView(true); }
        public void SelectZone(string zone)
        {
            if (zone != "bag" && zone != "safe" && zone != "pocket") return;
            bool changed = Zone != zone; Zone = zone; _filter = "all"; RefreshView(!changed);
            if (_railButtons.TryGetValue(zone, out var button)) EventSystem.current?.SetSelectedGameObject(button.gameObject);
        }
        public bool IsCurrent(int generation) => this == Current && _run == GameRuntime.I.State && generation == _generation && isActiveAndEnabled;
        public int Generation => _generation;
        public static void MoveStackSafe(string name, bool toSafe, IEnumerable<string> sourceUids = null)
        {
            var runtime = GameRuntime.I;
            var ids = sourceUids ?? CardStacks(runtime.State, !toSafe).FirstOrDefault(s => s.card.name == name)?.uids;
            if (!CardContainerCommands.TryMoveSafe(runtime, ids, toSafe, out var reason)) Report(reason);
            else Current?._SetNotice(toSafe ? "已移入安全格；撤离失败也能带回基地。" : "已移回随身背包。");
            Refresh();
        }
        static void Report(string reason) { if (string.IsNullOrEmpty(reason)) return; Current?._SetNotice(reason); RunLog.Log(reason, "warn"); }
        void _SetNotice(string text) { _notice = text; }
        void Sort(bool tidy)
        {
            string next = tidy ? "rarity" : _sortKey == "rarity" ? "type" : "rarity";
            var runtime = GameRuntime.I;
            if (runtime.TryPersistMutation(() => {
                var stacks = CardStacks(runtime.State, false).Concat(CardStacks(runtime.State, true));
                int R(CardDef c) {switch(CardVisual.EffectiveRarity(c)){case "传说":return 5;case "史诗":return 4;case "稀有":return 3;case "古朴":return 2;case "初始":return 1;default:return 0;}}
                int T(CardDef c) {int i=Array.IndexOf(new[] { "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" }, c.type);return i<0?99:i;}
                runtime.State.cardOrder = (next == "rarity" ? stacks.OrderByDescending(s => R(s.card)).ThenBy(s => T(s.card)) : stacks.OrderBy(s => T(s.card)).ThenByDescending(s => R(s.card)))
                    .ThenBy(s => s.card.name, StringComparer.Create(System.Globalization.CultureInfo.GetCultureInfo("zh-CN"), false)).Select(s => s.key).Distinct().ToList();
            }, out var reason)) _sortKey = next; else Report(reason);
            RefreshView(true);
        }
        internal void Drop(Stack source, BagCell over, DropZoneKind? zone)
        {
            if (source == null || source.supply || source.pocketIndex >= 0 || _run != GameRuntime.I.State) return;
            bool fromSafe = source.zone == "safe";
            if (zone == DropZoneKind.Safe) { if (!fromSafe) MoveStackSafe(source.card.name, true, source.uids); return; }
            if (zone == null && over == null) { BagCardDetail.ShowDiscardConfirm(source.card.name, fromSafe, source.uids.FirstOrDefault()); return; }
            if (!fromSafe && over?.Entry?.card?.id == CardContainerCommands.PearlId && over.Entry != source)
            {
                if (!CardContainerCommands.TryTransferStack(GameRuntime.I, "pearl", false, source.card.name, out var reason, source.uids)) Report(reason);
                else _notice = "已整叠存入珍珠盒。";
                RefreshView(true); return;
            }
            if (fromSafe) {
                var runtime=GameRuntime.I;
                if(!runtime.TryPersistMutation(()=>{MoveStackOrder(runtime.State,source.key,over?.Entry?.key);if(!CardContainerCommands.TryMoveSafe(runtime,source.uids,false,out var reason))throw new InvalidOperationException(reason);},out var safeFailure))Report(safeFailure);
                RefreshView(true);return;
            }
            if (!GameRuntime.I.TryPersistMutation(() => MoveStackOrder(GameRuntime.I.State, source.key, over?.Entry?.key), out var failure)) Report(failure);
            RefreshView(true);
        }
        public List<Stack> VisibleEntries()
        {
            var stacks=BuildCardStacks(_run);return VisibleEntries(stacks.bag,stacks.safe);
        }
        List<Stack> VisibleEntries(List<Stack> bag,List<Stack> safe)
        {
            if (Zone == "safe") return Sorted(_run, safe);
            if (Zone == "pocket") return _run.usedPocket.Select((p, i) => new Stack { card = p.card, count = p.count, zone = "pocket", pocketIndex = i, key = "pocket:" + i }).ToList();
            var cards = Sorted(_run, bag);
            if (_filter != "all") return cards.Where(s => _filter == "move" ? new[] { "武术", "法术", "能力卡" }.Contains(s.card.type) : s.card.type == _filter).ToList();
            var supplies = new List<Stack>();
            var resources=_run.inventory.Count>0?CardLibrary.All().Where(c=>c.type=="资源").ToList():null;
            foreach (var item in _run.inventory)
            {
                var match = resources.FirstOrDefault(c => c.name == item.name) ?? resources.FirstOrDefault(c => c.name.Count(ch => item.name.Contains(ch)) >= 2);
                for (int i = 0; i < Math.Max(1, item.count); i += 3)
                {
                    var card = match?.Clone(); if (card != null) card.value = item.value;
                    supplies.Add(new Stack { card = card, count = Math.Min(3, Math.Max(1, item.count) - i), supply = true, supplyName = item.name, tier = item.tier, zone = "bag", key = "supply:" + item.name + ":" + supplies.Count });
                }
            }
            return supplies.Concat(cards).ToList();
        }
        void CancelInteractions()
        {
            _generation++;
            foreach (var cell in GetComponentsInChildren<BagCell>(true)) cell.CancelInteraction();
            BagCell.BagCellHover.Current = null; DropZoneHover.Current = null;
        }
        public void CloseBag()
        {
            foreach (var panel in UiStack.CapturePanels().Where(p => p is BagCardDetail || p is ContainerScreen || p is BagItemDiscoveryScreen).ToArray()) UiStack.Close(panel);
            Close();
        }
        internal override void OnClose() { CancelInteractions(); App.UnregisterKey(KeyCode.B); if (Current == this) Current = null; }
        protected override void OnDestroy() { CancelInteractions(); if(_backdropMaterial!=null)Destroy(_backdropMaterial); if (Current == this) { Current = null; App.UnregisterKey(KeyCode.B); } }
    }
}
