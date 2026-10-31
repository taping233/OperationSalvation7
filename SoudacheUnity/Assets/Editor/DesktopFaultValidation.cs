using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Sdt.Editor
{
    /// <summary>在真实原生页面上锁住隔离存档，验证失败后的入口与重试。</summary>
    [InitializeOnLoad]
    public static class DesktopFaultValidation
    {
        const string Active = "Sdt.Fault.Active";
        static int _step;
        static double _next, _start;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static BattleRequest Request => new BattleRequest { Name = "保存失败验收", Foes = new List<EnemyStats> { new EnemyStats { id = "fault-foe", name = "受控敌人", hp = 50, atk = 1 } } };
        static DesktopFaultValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        static void Observe(string message, string stack, LogType type)
        {
            if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception))
                Fail(new InvalidOperationException(message + "\n" + stack));
        }
        public static void Run()
        {
            if (string.IsNullOrEmpty(Output)) throw new InvalidOperationException("缺少隔离目录");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss")));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
        static void ClearPages() { while (UiStack.Count > 0) UiStack.Pop(); }
        static FileStream LockProfile() => new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
            _next = EditorApplication.timeSinceStartup + .6;
            if (_start == 0) _start = EditorApplication.timeSinceStartup;
            try
            {
                Require(EditorApplication.timeSinceStartup - _start < 100, "原生保存故障检查超时，阶段 " + _step);
                var g = GameRuntime.I;
                switch (_step)
                {
                    case 0:
                        if (App.Canvas == null) return;
                        ClearPages(); g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id);
                        for (int i = 0; i < g.GetEntrySupplyCards().Count; i++) Require(g.ClaimEntrySupply(i, out _), "补给未完成");
                        ClearPages(); g.State.Phase = "idle"; g.SaveCurrent();
                        _step++; break;
                    case 1:
                        string original = File.ReadAllText(SaveSystem.ProfilePath);
                        using (LockProfile())
                        {
                            g.State.Phase = "modal";
                            g.Bus.Emit(new BattleRequested { Request = Request });
                            Require(!g.State.battleActive && g.State.Phase == "idle" && g.BattleCheckpoint == null, "入场失败卡住地图");
                            Require(!UiStack.CapturePanels().Any(p => p is BattleScreen), "入场失败展示半开战斗页");
                            Require(File.ReadAllText(SaveSystem.ProfilePath) == original, "失败覆写原档");
                        }
                        g.Bus.Emit(new BattleRequested { Request = Request });
                        Require(g.State.battleActive && g.BattleCheckpoint != null && UiStack.Top is BattleScreen, "解除故障后无法重试开战");
                        _step++; break;
                    case 2:
                        original = File.ReadAllText(SaveSystem.ProfilePath);
                        using (LockProfile())
                        {
                            Sdt.Boot.BattleViewApi.Session.Retract();
                            Require(BattleEvents.SettlementPending && g.State.battleActive, "战后失败缺少可重试入口");
                            Require(UiStack.Top is BattleScreen && File.ReadAllText(SaveSystem.ProfilePath) == original, "失败结算离开页面或损坏原档");
                        }
                        BattleEvents.RetrySettlement();
                        Require(!g.State.battleActive && !BattleEvents.SettlementPending && g.BattleCheckpoint == null, "战后重试未完成");
                        _step++; break;
                    case 3:
                        ClearPages();
                        var node = g.Map.Snapshot.layers[0].nodes.First(n => n.type == "event");
                        g.State.layerIdx = 0; g.State.trackPos = node.idx;
                        g.State.nodeRewards[g.CurrentNodeId] = new NodeVisitReceipt { type = "event", eventCardId = "tt6-goldmine" };
                        g.State.Phase = "modal"; g.SaveCurrent();
                        original = File.ReadAllText(SaveSystem.ProfilePath);
                        int coins = g.State.coins, owned = g.State.ownedCards.Count;
                        EventDialogScreen screen;
                        using (LockProfile())
                        {
                            EventDialogScreen.Open(CardLibrary.FindById("tt6-goldmine"), null);
                            screen = UiStack.Top as EventDialogScreen;
                            Require(screen != null && screen.ValidationInitializationBlocked, "当前事件初始化失败退入旧效果");
                            screen.ValidationRetryInitialization();
                            Require(screen.ValidationInitializationBlocked && g.State.coins == coins && g.State.ownedCards.Count == owned, "失败重试改变资源");
                            Require(File.ReadAllText(SaveSystem.ProfilePath) == original, "事件初始化失败覆写原档");
                        }
                        screen.ValidationRetryInitialization();
                        Require(!screen.ValidationInitializationBlocked && g.GetCurrentEventOutcome() != null, "初始化重试未恢复当前事件");
                        _step++; break;
                    case 4:
                        ClearPages();
                        g.State.nodeRewards[g.CurrentNodeId] = new NodeVisitReceipt { type = "event", eventCardId = "tt6-bandits", eventProgress = new EventProgress {
                            eventId = "tt6-bandits", stage = "battle", enemies = new List<MonsterDef> { new MonsterDef { id = "event-fault", name = "受控拦路人", hp = 30, atk = 1 } } } };
                        g.State.Phase = "modal"; g.SaveCurrent();
                        EventDialogScreen.Open(CardLibrary.FindById("tt6-bandits"), null);
                        screen = UiStack.Top as EventDialogScreen;
                        Require(screen != null, "事件页面缺失");
                        using (LockProfile())
                        {
                            screen.ValidationAcceptOutcome(g.GetCurrentEventOutcome());
                            Require(screen.ValidationBattleEntryFailed && UiStack.Top == screen && !g.State.battleActive, "事件开战失败吞掉原页面");
                        }
                        screen.ValidationAcceptOutcome(g.GetCurrentEventOutcome());
                        Require(g.State.battleActive && UiStack.Top is BattleScreen && !UiStack.CapturePanels().Contains(screen), "事件开战重试失败");
                        Sdt.Boot.BattleViewApi.Session.Retract();
                        Require(g.CurrentNodeReceipt.completed && g.CurrentNodeReceipt.eventProgress.settled, "事件战撤退仍可重复触发");
                        _step++; break;
                    case 5:
                        SessionState.SetBool(Active, false);
                        File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, input = "constructed-runtime-commands-with-real-profile-file-locks", failedEntryRetry = true, failedSettlementRetry = true, eventInitializationDoesNotUseLegacyEffects = true, eventEntryRetainsPageOnFailure = true, eventRetreatConsumesNode = true, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
                        EditorApplication.Exit(0); break;
                }
            }
            catch (Exception exception) { Fail(exception); }
        }
        static void Fail(Exception exception)
        {
            SessionState.SetBool(Active, false);
            Directory.CreateDirectory(Output); File.WriteAllText(Path.Combine(Output, "failure.txt"), "stage=" + _step + "\n" + exception);
            Debug.LogException(exception); EditorApplication.Exit(2);
        }
    }
}
