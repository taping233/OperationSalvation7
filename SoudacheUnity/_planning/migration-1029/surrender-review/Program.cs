using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Sdt.Boot;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Screens.Battle;
using UnityEngine;
using UnityEngine.UI;

static class Program
{
    static readonly List<string> Checks = new List<string>();
    static readonly List<BattleResult> Results = new List<BattleResult>();
    static string Output;
    static void Check(bool value, string label) { if (!value) throw new Exception(label); Checks.Add(label); }
    static int StashCount(GameRuntime game, string id) => game.Base.stash.Where(s => s.card.id == id).Sum(s => s.count);
    static BattleSession Start(GameRuntime g, bool boss = false)
    {
        g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id); g.State.entrySupply = null;
        g.Base.stash.Clear(); g.State.ownedCards.Clear(); g.State.usedPocket.Clear(); g.State.inventory.Clear();
        g.State.inventory.Add(new InvSlot { name = "验证物资", value = 100, count = 1 });
        g.State.ownedCards.Add(new OwnedCard { uid = "safe", card = CardLibrary.FindById("tt-jinchuangyao").Clone(), safe = true });
        g.State.ownedCards.Add(new OwnedCard { uid = "smoke", card = CardLibrary.FindById("tt4-smoke-bomb").Clone() });
        for (int i = 0; i < 6; i++) g.State.ownedCards.Add(new OwnedCard { uid = "fight-" + i, card = CardLibrary.FindById("tt3-fireball").Clone() });
        g.State.Phase = "idle"; g.SaveCurrent(); Check(g.Saves.LastWriteSucceeded, "isolated profile written");
        var context = new BattleStartContext { host = new GameBattleHost(g), isBoss = boss, name = "surrender review", rng = g.Rng,
            enemies = new[] { new EnemyInput { id = "controlled", name = "controlled", hp = 500, atk = 1 } } };
        Check(g.TryBeginBattleCheckpoint(BattleSession.PrepareCheckpoint(context), out var reason), "production battle checkpoint: " + reason);
        g.State.battleActive = true; g.State.Phase = "modal";
        var session = new BattleSession(); BattleViewApi.Session = session;
        Results.Clear(); session.Start(context); return session;
    }
    static void Continue(GameRuntime g, BattleSession s, string label)
    {
        Check(g.State.runActive && g.State.battleActive && !s.Snapshot.Over && Results.Count == 0 && g.Saves.GetSettlement(5) == null, label);
    }
    static void TickButton(BattleSurrenderButton component) => typeof(BattleSurrenderButton).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(component, null);
    static int Main()
    {
        Output = Path.GetFullPath(Path.Combine("_planning/migration-1029/surrender-review", "run-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff")));
        Directory.CreateDirectory(Output); Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile"));
        try
        {
            CardLibrary.Init(() => CardDatabase.All); var g = GameRuntime.I;
            BattleSession.BattleEnded += result => Results.Add(result);
            var s = Start(g); var button = new Button(); var component = new BattleSurrenderButton(); int calls = 0;
            component.Configure(button, false, () => { calls++; Check(s.Surrender().Ok, "confirmed ordinary Surrender accepted"); });
            string label = button.Label.text; Color ink = button.Label.color, background = button.Background.color;
            Time.unscaledTime = 10; button.onClick.Invoke();
            Check(calls == 0 && button.Label.text.Contains("确认撤离") && button.Label.text.Contains("本局判负"), "production component first click arms without invoking surrender");
            Check(button.Background.color != background && button.Label.color != ink, "production component danger colors change");
            Continue(g, s, "first click keeps run and battle active");
            Time.unscaledTime = 12.59f; TickButton(component);
            Check(button.Label.text.Contains("确认撤离") && calls == 0, "confirmation retained before 2.6 second deadline");
            Time.unscaledTime = 12.61f; TickButton(component);
            Check(button.Label.text == label && button.Label.color == ink && button.Background.color == background && calls == 0, "production Update resets label and colors after deadline");
            button.onClick.Invoke(); Check(calls == 0, "first click after timeout re-arms");
            button.onClick.Invoke(); Check(calls == 1, "second click invokes surrender once");
            Check(Results.Count == 1 && Results[0].Win == false && !Results[0].IsBoss, "ordinary result is failure exactly once");
            Check(!g.State.runActive && !g.State.battleActive && g.State.Phase == "done" && g.BattleCheckpoint == null, "production host failure settlement ends run and removes checkpoint");
            var receipt = new SaveSystem().GetSettlement(5);
            Check(receipt.reason == "dead" && receipt.status == "complete" && receipt.death.SavedN == 1 && receipt.death.LostValue == 100, "fresh disk read contains death receipt, exact rescue and inventory loss");
            Check(receipt.death.SavedStacks.Single().card.id == "tt-jinchuangyao" && StashCount(g, "tt-jinchuangyao") == 1, "safe card identity and single deposit retained");
            Check(StashCount(g, "tt3-fireball") == 0 && StashCount(g, "tt4-smoke-bomb") == 0 && !new SaveSystem().HasRun(5), "ordinary backpack lost and active run removed on disk");
            Check(!s.Surrender().Ok && Results.Count == 1 && StashCount(g, "tt-jinchuangyao") == 1, "repeated surrender cannot duplicate failure result or safe deposit");

            s = Start(g); button = new Button(); component = new BattleSurrenderButton(); calls = 0;
            component.Configure(button, false, () => calls++); Time.unscaledTime = 20; button.onClick.Invoke();
            Time.unscaledTime = 22.61f; button.onClick.Invoke(); // UI Update has not yet observed expiry.
            Check(calls == 0, "expired second click re-arms even before next Update");

            s = Start(g, true);
            Check(!s.Surrender().Ok, "Core refuses boss surrender during deck selection"); Continue(g, s, "boss selection refusal never settles");
            var selection = s.Snapshot.DeckSelection;
            foreach (var entry in selection.Cards.Take(selection.Need)) Check(s.SelectDeckCard(entry.uid).Ok, "boss selected card " + entry.uid);
            Check(s.ConfirmDeck().Ok && s.Snapshot.DeckSelection == null, "boss battle begins through production selection commands");
            button = new Button(); component = new BattleSurrenderButton(); calls = 0;
            var toasts = new List<string>(); g.Bus.On<ToastRequested>(toast => toasts.Add(toast.Text));
            component.Configure(button, true, () => calls++); label = button.Label.text;
            button.onClick.Invoke(); button.onClick.Invoke();
            Check(calls == 0 && button.Label.text == label && toasts.Count == 2 && toasts.All(t => t.Contains("首脑战不可撤离")), "boss component refuses both clicks and explains why");
            Check(AudioService.I.Effects.TakeLast(2).All(key => key == "deny"), "boss component emits deny sounds");
            Check(!s.Surrender().Ok, "Core refuses boss surrender after battle starts"); Continue(g, s, "boss refusal preserves active run and no receipt");

            s = Start(g); Check(s.PlayCard("fight-0", 0, false).Ok, "play real current fireball before smoke");
            Check(s.UseItem("smoke").Ok, "use real current smoke item through production command");
            Check(Results.Count == 1 && Results[0].Win == null, "smoke result uses nullable escape exemption");
            Check(g.State.runActive && !g.State.battleActive && g.State.Phase == "idle" && g.BattleCheckpoint == null, "production host smoke settlement returns run to idle");
            Check(g.Saves.GetSettlement(5) == null && new SaveSystem().HasRun(5), "smoke creates no death receipt and retains disk run");
            Check(!g.State.ownedCards.Any(c => c.uid == "smoke" || c.uid == "fight-0") && g.State.ownedCards.Any(c => c.uid == "safe"), "smoke and played card removed while safety remains");
            Check(g.State.usedPocket.Where(p => p.card.id == "tt3-fireball").Sum(p => p.count) == 1 && g.State.usedPocket.Where(p => p.card.id == "tt4-smoke-bomb").Sum(p => p.count) == 1, "smoke and previously played card each settle once into used pocket");
            Check(g.State.inventory.Single().value == 100 && g.Base.stash.Count == 0 && BattleBridge.RewardCalls == 0, "smoke preserves inventory without rescuing safe card or victory rewards");

            s = Start(g); Check(s.Retract().Ok && Results.Count == 1 && Results[0].Win == null, "effect-level Retract remains null escape");
            Check(g.State.runActive && !g.State.battleActive && g.BattleCheckpoint == null && new SaveSystem().HasRun(5), "effect-level Retract also continues run");
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, checks = Checks, count = Checks.Count,
                evidence = "current Core and Run sources; verbatim production GameBattleHost extraction; production BattleSurrenderButton with synthetic Unity adapters",
                nativeUnityRun = false, actualPointerDispatch = false, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
            Console.WriteLine("PASS " + Checks.Count + " checks; " + Output); return 0;
        }
        catch (Exception exception)
        {
            File.WriteAllText(Path.Combine(Output, "failure.json"), JsonConvert.SerializeObject(new { passed = false, checks = Checks, error = exception.ToString() }, Formatting.Indented));
            Console.Error.WriteLine(exception); return 2;
        }
    }
}
