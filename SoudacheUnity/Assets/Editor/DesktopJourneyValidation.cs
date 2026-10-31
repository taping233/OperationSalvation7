using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    /// <summary>隔离新档的受控完整路线，调用正式命令及页面按钮；真实输入另验。</summary>
    [InitializeOnLoad]
    public static class DesktopJourneyValidation
    {
        const string Active = "Sdt.Journey.Active", Step = "Sdt.Journey.Step";
        static readonly HashSet<int> Layers = new HashSet<int>();
        static readonly List<string> Trace = new List<string>();
        static double _next;
        static int _actions, _battles;
        static int _battleSteps;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static DesktopJourneyValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        static void Observe(string text, string stack, LogType type)
        {
            if (SessionState.GetBool(Active, false) && (type == LogType.Exception || type == LogType.Error))
                Fail(new InvalidOperationException(text + "\n" + stack));
        }
        public static void Run()
        {
            if (string.IsNullOrEmpty(Output)) throw new InvalidOperationException("请指定隔离验收目录");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss")));
            AssetDatabase.DisallowAutoRefresh();
            SessionState.SetBool(Active, true); SessionState.SetInt(Step, 0);
            SessionState.SetFloat("Sdt.Journey.Start", (float)EditorApplication.timeSinceStartup);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
        static void ClearPages() { while (UiStack.Count > 0) UiStack.Pop(); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
            _next = EditorApplication.timeSinceStartup + .15;
            try
            {
                Require(EditorApplication.timeSinceStartup - SessionState.GetFloat("Sdt.Journey.Start", 0) < 480, "路线超时");
                Require(++_actions < 1600, "路线操作数超限");
                var g = GameRuntime.I;
                switch (SessionState.GetInt(Step, 0))
                {
                    case 0:
                        if (App.Canvas == null) return;
                        Require(CardLibrary.All().Count >= 291, "现行卡库未装配");
                        ClearPages(); g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id);
                        for (int i = 0; i < g.GetEntrySupplyCards().Count; i++) Require(g.ClaimEntrySupply(i, out _), "补给失败");
                        // 受控路线排除战斗数值难度，只验证正式流程及持久化接线。
                        g.State.maxHp = g.State.hp = 10000; g.State.atk = 2000;
                        ClearPages(); g.State.Phase = "idle"; g.SaveCurrent();
                        SessionState.SetInt(Step, 1); break;
                    case 1: Journey(g); break;
                    case 2:
                        Require(!g.State.runActive && g.State.Phase == "settlement", "终局撤离未进入整理");
                        Require(g.ExtractStashAll() != null, "撤离入库失败");
                        Require(g.FinishExtract() != null, "完成整理失败");
                        int extracts = g.Base.stats.extracts;
                        g.FinishExtract(); Require(g.Base.stats.extracts == extracts, "重复结算累计次数");
                        Require(g.Saves.GetSettlement(5)?.status == "complete", "撤离回执未完成");
                        Require(Layers.Count == 4 && _battles > 0, "未覆盖四层或战斗");
                        ClearPages(); g.NewRun(5, CharacterTable.All[0].id);
                        for (int i = 0; i < g.GetEntrySupplyCards().Count; i++) g.ClaimEntrySupply(i, out _);
                        ClearPages(); g.State.hp = 1;
                        g.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "失败结算验收", Foes = new List<EnemyStats> { new EnemyStats { id = "check-death", name = "受控敌人", hp = 99999, atk = 99999 } } } });
                        SessionState.SetInt(Step, 3); break;
                    case 3:
                        Require(Sdt.Boot.BattleViewApi.Session != null, "失败战斗未启动");
                        Sdt.Boot.BattleViewApi.Session.EndTurn();
                        Require(!g.State.runActive && g.Saves.GetSettlement(5)?.reason == "dead", "战败结算未持久化");
                        Require(UiStack.Top is Sdt.UI.Screens.Run.DeathScreen, "战败页缺失");
                        Require(!UiStack.CapturePanels().Any(p => p is Sdt.UI.Screens.Battle.BattleScreen), "战败仍残留战斗页");
                        Finish(g); break;
                }
            }
            catch (Exception e) { Fail(e); }
        }
        static void Journey(GameRuntime g)
        {
            Layers.Add(g.State.layerIdx);
            if (g.State.battleActive) { Fight(); return; }
            _battleSteps = 0;
            var receipt = g.CurrentNodeReceipt;
            if (receipt.chestQueue != null && receipt.chestQueue.Any(c => !c.completed))
            { MakeRoom(g); ClaimPage(); return; }
            if (g.State.bossCleanupPending || UiStack.Top is Sdt.UI.Screens.Bag.BossPackCleanup)
            { Require(ClickButton("带走 "), "首脑整理确认按钮缺失"); return; }
            var current = g.Map.Snapshot.layers[g.State.layerIdx].nodes[g.State.trackPos];
            if (current.type == "event" && !receipt.completed && !string.IsNullOrEmpty(receipt.eventCardId)
                && (g.State.Phase != "idle" || UiStack.Top is Sdt.UI.Screens.Run.EventDialogScreen))
            { ResolveEvent(g); return; }
            if (current.type == "resource" && receipt.rewardTaken == null)
            { MakeRoom(g); Require(g.ClaimResourceReward(0, out var reason), "资源领取：" + reason); }
            if (current.type == "altar" && receipt.altarRewardPending)
            { Require(g.TrySelectAltarReward("loot", out var reason), "祭坛回赠：" + reason); return; }
            if (current.type == "altar" && receipt.altarRewardKind == "loot" && !receipt.completed)
            {
                MakeRoom(g);
                int index = Enumerable.Range(0, g.GetAltarRewardCards().Count).First(i => !receipt.altarTaken.Contains(i));
                Require(g.TryClaimAltarReward(index, out var reason), "领取回赠：" + reason); return;
            }
            ClearPages(); g.FinishNode();
            if (current.type == "door")
            {
                var door = g.Map.Snapshot.layers[g.State.layerIdx].doors.First(d => d.at == current.idx && d.toLayer > g.State.layerIdx);
                Trace.Add("door " + g.CurrentNodeId + " -> " + door.toLayer);
                Require(g.TryUseDoor(door.toLayer, door.arriveAt, out var reason), "闸门：" + reason); return;
            }
            if (current.type == "altar" && !g.State.altarActivated)
            {
                Require(g.State.ownedCards.Count >= 3, "祭坛献祭卡不足");
                Require(g.TryActivateAltar(g.State.ownedCards.Where(c => c.safe != true && !c.stored && string.IsNullOrEmpty(c.pouchOf)).Take(3).Select(c => c.uid), out var reason), "祭坛：" + reason);
                return;
            }
            if (current.type == "extraction")
            {
                Require(g.TryFinalExtract(out var reason), "终局撤离：" + reason);
                SessionState.SetInt(Step, 2); return;
            }
            string wanted = g.State.layerIdx < 3 ? "door" : !g.State.altarActivated ? "altar" : !g.State.bossDefeated ? "boss" : "extraction";
            var path = FindPath(g, wanted);
            Require(path != null && path.Count > 0, "没有可用路线到 " + wanted);
            Trace.Add("move " + g.CurrentNodeId + " -> " + path[0] + " / " + wanted);
            // 攻击牌作为受控路线夹具补足；该检查不评估资源消耗和通关难度。
            if (g.State.ownedCards.Count(card => card.card.id == "starter-attack") < 8)
                while (g.State.ownedCards.Count(card => card.card.id == "starter-attack") < 8)
                    if (!g.GrantCard(CardLibrary.FindById("starter-attack"))) break;
            Require(g.TryMoveToNode(path[0], out var moveReason), "移动：" + moveReason);
        }
        static List<string> FindPath(GameRuntime g, string kind)
        {
            int layer = g.State.layerIdx;
            var nodes = g.Map.Snapshot.layers[layer].nodes;
            var previous = new Dictionary<int, int> { [g.State.trackPos] = -1 };
            var queue = new Queue<int>(); queue.Enqueue(g.State.trackPos);
            while (queue.Count > 0)
            {
                int index = queue.Dequeue();
                if (index != g.State.trackPos && nodes[index].type == kind)
                {
                    var result = new List<string>();
                    for (int at = index; previous[at] != -1; at = previous[at]) result.Add(layer + "," + at);
                    result.Reverse(); return result;
                }
                foreach (var next in nodes[index].next)
                    if (next.li == layer && !previous.ContainsKey(next.idx)) { previous[next.idx] = index; queue.Enqueue(next.idx); }
            }
            return null;
        }
        static void Fight()
        {
            var session = Sdt.Boot.BattleViewApi.Session; Require(session != null, "战斗会话缺失");
            var s = session.Snapshot;
            Require(++_battleSteps < 100, "受控战斗无法结束：" + JsonConvert.SerializeObject(new { s.turn, s.hand, foes = s.foes.Select(f => new { f.id, f.hp, f.dead }) }));
            if (s.DeckSelection != null)
            {
                foreach (var card in s.DeckSelection.cards)
                    if (!session.Snapshot.DeckSelection.selected.Contains(card.uid) && session.Snapshot.DeckSelection.selected.Count < session.Snapshot.DeckSelection.need)
                        session.SelectDeckCard(card.uid);
                Sdt.UI.Screens.Battle.BattleView.Commands.ConfirmDeck();
                Require(session.Snapshot.DeckSelection == null, "首脑选牌或保存失败"); return;
            }
            if (s.RuleChoice != null) { Require(session.ChooseRuleOption(0).Ok, "战斗选择失败"); return; }
            if (s.RuleHandSelection != null) { Require(session.SelectRuleHand(s.RuleHandSelection.candidateUids.FirstOrDefault()).Ok, "手牌选择失败"); return; }
            if (s.Discovering != null) { session.PickDiscover(0); return; }
            if (s.Infusing != null) { session.SkipInfusion(); return; }
            foreach (var uid in s.Hand)
            {
                var card = session.FindCard(uid)?.card;
                if (card?.id != "starter-attack") continue;
                int target = s.Foes.ToList().FindIndex(f => !f.dead && f.hp > 0);
                if (session.PlayCard(uid, target, false).Ok)
                { if (session.Snapshot.over) _battles++; return; }
            }
            session.EndTurn(); if (session.Snapshot.over) _battles++;
        }
        static void ResolveEvent(GameRuntime g)
        {
            g.GetEventChoices(g.CurrentNodeReceipt.eventCardId);
            var o = g.GetCurrentEventOutcome(); Require(o != null, "事件状态缺失");
            if (o.Battle != null) { ClearPages(); Require(g.StartEventBattle(o.Battle), "事件开战失败"); return; }
            if (o.Chests?.Count > 0) { ClaimPage(); return; }
            if (o.Settled) { ClearPages(); g.FinishNode(); return; }
            if (o.CanLeave) { ClearPages(); g.ApplyCurrentEventChoice("__leave"); return; }
            if (o.Stage == "dice") { g.RollCurrentEventDice(); return; }
            if (o.CardKeys?.Count >= o.Need) { g.SubmitEventSelection(o.CardKeys.Take(o.Need).ToList()); return; }
            var choice = o.Choices?.FirstOrDefault(c => !c.Disabled);
            Require(choice != null, "事件无法继续：" + o.Stage); g.ApplyCurrentEventChoice(choice.EffectKey);
        }
        static void MakeRoom(GameRuntime g)
        {
            var candidates = g.State.ownedCards.Where(c => c.card.id != "starter-attack" && c.safe != true && !c.stored && string.IsNullOrEmpty(c.pouchOf)).ToList();
            foreach (var card in candidates.Take(Math.Min(4, Math.Max(0, candidates.Count - 3))))
                CardContainerCommands.TryDiscard(g, card.uid, out _);
        }
        static void ClaimPage()
        {
            Require(ClickButton("全部收下") || ClickButton("领取") || ClickButton("继续"), "领取奖励页面缺少按钮：" + UiStack.Names());
        }
        static bool ClickButton(string label)
        {
            if (UiStack.Top == null) return false;
            var button = UiStack.Top.GetComponentsInChildren<Button>().FirstOrDefault(b => b.interactable && b.GetComponentsInChildren<Text>().Any(t => t.text.Contains(label)));
            if (button == null) return false; button.onClick.Invoke(); return true;
        }
        static void Finish(GameRuntime g)
        {
            SessionState.SetBool(Active, false);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, input = "constructed-runtime-commands-and-buttons", controlledStats = true, layers = Layers.OrderBy(x => x), battles = _battles, actions = _actions, finalExtraction = true, idempotentSettlement = true, deathScreen = true, trace = Trace, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
            Debug.Log("SDT_JOURNEY_PASSED"); EditorApplication.Exit(0);
        }
        static void Fail(Exception e)
        {
            SessionState.SetBool(Active, false);
            Directory.CreateDirectory(Output); File.WriteAllText(Path.Combine(Output, "failure.txt"), e + "\n" + string.Join("\n", Trace));
            Debug.LogException(e); EditorApplication.Exit(2);
        }
    }
}
