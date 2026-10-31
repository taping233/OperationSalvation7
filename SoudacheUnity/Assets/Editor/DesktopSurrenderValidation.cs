using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    /// <summary>隔离新档的后台原生验证。程序派发真实 Button 指针事件；不代表操作系统输入或命中测试。</summary>
    [InitializeOnLoad]
    public static class DesktopSurrenderValidation
    {
        const string Active = "Sdt.SurrenderReview.Active", Step = "Sdt.SurrenderReview.Step", Start = "Sdt.SurrenderReview.Start";
        static readonly List<string> Checks = new List<string>(), Errors = new List<string>();
        static readonly List<BattleResult> Outcomes = new List<BattleResult>();
        static double _next;
        static float _armedAt;
        static string _normalText;
        static Color _normalInk, _normalBackground;
        static Button _button;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static DesktopSurrenderValidation()
        {
            EditorApplication.update += Tick;
            Application.logMessageReceived += ObserveLog;
            BattleSession.BattleEnded += result => { if (SessionState.GetBool(Active, false)) Outcomes.Add(result); };
        }
        static void ObserveLog(string message, string stack, LogType type)
        {
            if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception)) Errors.Add(message + "\n" + stack);
        }
        public static void Run()
        {
            if (string.IsNullOrWhiteSpace(Output)) throw new InvalidOperationException("必须提供 SDT_UNITY_CHECK_OUTPUT 隔离证据目录");
            Directory.CreateDirectory(Output);
            string profile = Path.Combine(Path.GetFullPath(Output), "profile-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + "-" + Guid.NewGuid().ToString("N"));
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", profile);
            SessionState.SetString("Sdt.SurrenderReview.Profile", profile);
            SessionState.SetString(Start, EditorApplication.timeSinceStartup.ToString("R", CultureInfo.InvariantCulture));
            SessionState.SetInt(Step, 0); SessionState.SetBool(Active, true);
            Checks.Clear(); Errors.Clear(); Outcomes.Clear(); _next = 0;
            AssetDatabase.DisallowAutoRefresh();
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");
            EditorApplication.EnterPlaymode();
        }
        static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
            Checks.Add(message);
        }
        static void ClearPages() { while (UiStack.Count > 0) UiStack.Pop(); }
        static void StartBattle(bool boss)
        {
            var g = GameRuntime.I;
            ClearPages(); g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id);
            for (int i = 0; i < g.GetEntrySupplyCards().Count; i++)
                Require(g.ClaimEntrySupply(i, out _), "入场补给领取成功");
            ClearPages();
            g.Base.stash.Clear(); g.State.ownedCards.Clear(); g.State.usedPocket.Clear(); g.State.inventory.Clear();
            for (int i = 0; i < 6; i++) g.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "fight-" + i, card = CardLibrary.FindById("tt3-fireball").Clone() });
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "safe", card = CardLibrary.FindById("tt-jinchuangyao").Clone(), safe = true });
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "smoke", card = CardLibrary.FindById("tt4-smoke-bomb").Clone() });
            g.State.inventory.Add(new InvSlot { name = "撤离验证物资", count = 1, value = 100 });
            g.State.Phase = "idle"; g.SaveCurrent();
            Require(g.Saves.LastWriteSucceeded, "受控新档保存成功");
            Outcomes.Clear();
            g.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "撤离语义验证", IsBoss = boss, Layer = 0,
                Foes = new List<EnemyStats> { new EnemyStats { id = "surrender-review", name = "受控敌人", hp = 500, atk = 1 } } } });
            Require(g.State.runActive && g.State.battleActive && g.BattleCheckpoint != null, "真实 Boot 开战并保存检查点");
        }
        static Button CurrentButton()
        {
            var screen = UiStack.Top as BattleScreen;
            Require(screen != null, "当前顶层为正式战斗页");
            var surrender = screen.GetComponentsInChildren<BattleSurrenderButton>().Where(c => c.gameObject.activeInHierarchy).Single();
            var button = surrender.GetComponent<Button>();
            Require(button != null && button.IsInteractable() && button.gameObject.activeInHierarchy, "正式撤离按钮可接收程序指针事件");
            return button;
        }
        static void Click(Button button)
        {
            Require(EventSystem.current != null, "真实 EventSystem 已建立");
            Require(button != null && button.IsInteractable() && button.gameObject.activeInHierarchy, "点击目标仍为活动按钮");
            var pointer = new PointerEventData(EventSystem.current) { button = PointerEventData.InputButton.Left };
            Require(ExecuteEvents.Execute(button.gameObject, pointer, ExecuteEvents.pointerClickHandler), "派发正式 Button 指针点击回调");
        }
        static string Label(Button button) => button.GetComponentInChildren<Text>().text;
        static void StillFighting(string check)
        {
            var g = GameRuntime.I;
            Require(g.State.runActive && g.State.battleActive && g.BattleCheckpoint != null && !Sdt.Boot.BattleViewApi.Session.Snapshot.Over && Outcomes.Count == 0, check);
            Require(g.Saves.GetSettlement(5) == null && !BattleEvents.SettlementPending, "尚未创建结算回执或重试入口");
        }
        static void Advance(int stage) { SessionState.SetInt(Step, stage); _next = EditorApplication.timeSinceStartup + .25; }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            try
            {
                double start = double.Parse(SessionState.GetString(Start, "0"), CultureInfo.InvariantCulture);
                if (EditorApplication.timeSinceStartup - start > 100) throw new TimeoutException("撤离原生验证超时，阶段=" + SessionState.GetInt(Step, 0));
                EditorApplication.QueuePlayerLoopUpdate();
                if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
                _next = EditorApplication.timeSinceStartup + .1;
                if (Errors.Count > 0) throw new InvalidOperationException(string.Join("\n", Errors));
                var g = GameRuntime.I;
                switch (SessionState.GetInt(Step, 0))
                {
                    case 0:
                        if (App.Canvas == null) return;
                        Require(Path.GetFullPath(SaveSystem.Dir) == SessionState.GetString("Sdt.SurrenderReview.Profile", ""), "存档严格指向本次唯一隔离目录");
                        StartBattle(false); Advance(1); break;
                    case 1:
                        _button = CurrentButton(); _normalText = Label(_button);
                        _normalInk = _button.GetComponentInChildren<Text>().color; _normalBackground = _button.GetComponent<Image>().color;
                        Click(_button); _armedAt = Time.unscaledTime;
                        StillFighting("普通战首次点击仅进入确认，未结束战斗");
                        Require(Label(_button).Contains("确认撤离") && Label(_button).Contains("本局判负"), "确认文案明确提示判负");
                        Require(_button.GetComponent<Image>().color != _normalBackground, "确认阶段升级危险背景色");
                        Advance(2); break;
                    case 2:
                        // 让生产组件 Update 经真实 Play 循环复位，禁止反射或手调 Update。
                        if (Time.unscaledTime < _armedAt + 2.8f) return;
                        Require(Label(_button) == _normalText, "超过2.6秒后生产 Update 自动还原文案");
                        Require(_button.GetComponentInChildren<Text>().color == _normalInk && _button.GetComponent<Image>().color == _normalBackground, "超时同时还原文字与背景色");
                        StillFighting("超时确认未产生结算");
                        Click(_button); StillFighting("超时后的首次点击重新进入确认");
                        Require(Label(_button).Contains("确认撤离"), "超时后必须重新二次确认");
                        Click(_button);
                        Require(Outcomes.Count == 1 && Outcomes[0].Win == false, "再次二次点击仅发出一次失败结果");
                        Require(!g.State.runActive && !g.State.battleActive && g.BattleCheckpoint == null && g.State.Phase == "done", "主动撤离终结本局并清除战斗检查点");
                        var receipt = new SaveSystem().GetSettlement(5);
                        Require(receipt?.reason == "dead" && receipt.status == "complete" && receipt.death.SavedN == 1, "磁盘保存失败结算与一张安全格抢运回执");
                        Require(receipt.death.SavedStacks.Single().card.id == "tt-jinchuangyao", "安全格卡牌身份保留");
                        Require(g.Base.stash.Where(s => s.card.id == "tt-jinchuangyao").Sum(s => s.count) == 1 && !g.Base.stash.Any(s => s.card.id == "tt3-fireball" || s.card.id == "tt4-smoke-bomb"), "只抢运安全格，普通背包未带回基地");
                        Require(!new SaveSystem().HasRun(5) && UiStack.Top is DeathScreen, "对局存档移除并呈现正式失败页面");
                        Advance(3); break;
                    case 3:
                        StartBattle(true);
                        var selection = Sdt.Boot.BattleViewApi.Session.Snapshot.DeckSelection;
                        Require(selection != null, "首脑战进入正式编组阶段");
                        foreach (var entry in selection.Cards.Take(selection.Need)) BattleView.Commands.SelectDeckCard(entry.uid);
                        BattleView.Commands.ConfirmDeck();
                        Require(Sdt.Boot.BattleViewApi.Session.Snapshot.DeckSelection == null, "通过正式命令完成首脑编组");
                        Advance(4); break;
                    case 4:
                        _button = CurrentButton(); _normalText = Label(_button);
                        Click(_button); Click(_button);
                        Require(Label(_button) == _normalText && !Label(_button).Contains("确认"), "首脑两次点击都不会进入撤离确认");
                        StillFighting("首脑按钮拒绝撤离且不结算");
                        var rejected = Sdt.Boot.BattleViewApi.Session.Surrender();
                        Require(!rejected.Ok && rejected.Reason.Contains("首脑"), "Core 同时拒绝首脑主动撤离");
                        BattleView.Commands.Flee(); StillFighting("命令门面同样拒绝首脑主动撤离");
                        Advance(5); break;
                    case 5:
                        StartBattle(false); Advance(6); break;
                    case 6:
                        Require(BattleView.Commands.PlayCard("fight-0", 0, false).Ok, "烟雾前通过正式命令打出普通卡");
                        Require(BattleView.Commands.UseItem("smoke").Ok, "通过正式道具命令使用当前烟雾弹");
                        Require(Outcomes.Count == 1 && Outcomes[0].Win == null, "烟雾仅发出脱战结果");
                        Require(g.State.runActive && !g.State.battleActive && g.State.Phase == "idle" && g.BattleCheckpoint == null, "烟雾后本局继续并清除战斗检查点");
                        Require(g.Saves.GetSettlement(5) == null && new SaveSystem().HasRun(5), "烟雾不创建失败回执且对局仍可续档");
                        Require(!g.State.ownedCards.Any(c => c.uid == "fight-0" || c.uid == "smoke") && g.State.ownedCards.Any(c => c.uid == "safe"), "已打出牌与烟雾移出口袋前背包，安全格保留");
                        Require(g.State.usedPocket.Where(p => p.card.id == "tt3-fireball").Sum(p => p.count) == 1 && g.State.usedPocket.Where(p => p.card.id == "tt4-smoke-bomb").Sum(p => p.count) == 1, "已打出牌与烟雾各进入消耗口袋一次");
                        Require(g.State.inventory.Single().value == 100 && g.Base.stash.Count == 0 && !UiStack.CapturePanels().Any(p => p is BattleScreen || p is DeathScreen), "烟雾保留本局物资并退出战斗页");
                        Complete(); break;
                }
            }
            catch (Exception exception) { Fail(exception); }
        }
        static void Complete()
        {
            SessionState.SetBool(Active, false);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new {
                passed = true, input = "programmatic-pointerClick-on-real-BattleScreen-Button-and-production-commands",
                operatingSystemInput = false, hitTesting = false, nativePlayLoopTimeoutReset = true,
                ordinaryFirstClick = true, timeoutRearm = true, ordinaryConfirmedFailure = true,
                safeCardRescued = true, bossButtonAndCommandDenied = true, smokeItemContinuesRun = true,
                checks = Checks, dataDirectory = SaveSystem.Dir
            }, Formatting.Indented));
            AssetDatabase.AllowAutoRefresh(); EditorApplication.Exit(0);
        }
        static void Fail(Exception exception)
        {
            SessionState.SetBool(Active, false);
            if (!string.IsNullOrEmpty(Output))
            {
                Directory.CreateDirectory(Output);
                File.WriteAllText(Path.Combine(Output, "failure.json"), JsonConvert.SerializeObject(new { passed = false, stage = SessionState.GetInt(Step, 0), checks = Checks, error = exception.ToString(), logs = Errors }, Formatting.Indented));
            }
            Debug.LogException(exception); AssetDatabase.AllowAutoRefresh(); EditorApplication.Exit(2);
        }
    }
}
