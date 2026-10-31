// Actual altar callbacks and EventSystem submit; driven by CurrentParityValidation.
using System;
using System.Collections;
using System.IO;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public static class CurrentAltarRestoreFocusChecks
{
    public static string Step { get; private set; }
    static void Require(bool value, string message)
    { if (!value) throw new InvalidOperationException("Altar restore focus: " + message); }
    static void Clear()
    { CurrentRunFilm.CancelActive(); Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen(); while (UiStack.Count > 0) UiStack.Pop(); }
    static Button Find(string name) => UiStack.Top?.GetComponentsInChildren<Button>().FirstOrDefault(button => button.name == name);
    static void Focus(string name)
    {
        var button = Find(name);
        Require(button != null && button.IsInteractable(), "missing usable " + name);
        EventSystem.current.SetSelectedGameObject(button.gameObject);
    }
    static void Selected(string name)
    {
        var button = Find(name);
        Require(button != null && button.IsInteractable() && EventSystem.current.currentSelectedGameObject == button.gameObject,
            "expected " + name + ", actual " + EventSystem.current.currentSelectedGameObject?.name);
    }
    static void Submit(string name)
    {
        Selected(name);
        Require(ExecuteEvents.Execute(Find(name).gameObject, new BaseEventData(EventSystem.current), ExecuteEvents.submitHandler),
            "submit rejected " + name);
    }
    static void Fixture()
    {
        Clear(); var game = GameRuntime.I;
        game.ResetSlot(5); game.NewRun(5, "wu");
        for (int i = 0; i < game.GetEntrySupplyCards().Count; i++) Require(game.ClaimEntrySupply(i, out var error), error);
        Clear();
        var altar = game.Map.Nodes.First(node => node.type == "altar");
        game.State.layerIdx = altar.layerIdx; game.State.trackPos = altar.idx; game.State.Phase = "modal";
        game.State.ownedCards.Clear(); game.State.inventory.Clear(); game.State.usedPocket.Clear(); game.State.altarActivated = true;
        var first = CardLibrary.FindById("tt3-fireball").Clone();
        var second = first.Clone(); second.variantKey = "altar-focus-variant";
        game.State.usedPocket.Add(new PocketStack { card = first, count = 2 });
        game.State.usedPocket.Add(new PocketStack { card = second, count = 1 });
        var receipt = game.CurrentNodeReceipt;
        receipt.altarRewardKind = "restore"; receipt.altarRestoreLeft = 3; receipt.altarRewardPending = false;
        game.SaveCurrent(); Require(game.Saves.LastWriteSucceeded, "fixture save failed");
        AltarRitualScreen.Open();
    }
    public static IEnumerator Run()
    {
        GameObject outside = null;
        Action afterSave = null;
        GameRuntime.I.Bus.On<SaveCompleted>(_ => afterSave?.Invoke());
        try
        {
            Step = "same card, next variant, then return";
            Fixture(); yield return null;
            Focus("altarRestore-0"); var stale = Find("altarRestore-0").onClick;
            Submit("altarRestore-0"); Selected("altarRestore-0");
            Require(GameRuntime.I.State.usedPocket[0].count == 1 && GameRuntime.I.State.ownedCards.Count == 1, "first restore was not exactly one");
            stale.Invoke(); Require(GameRuntime.I.State.ownedCards.Count == 1, "old rendered action restored twice");
            Submit("altarRestore-0"); Selected("altarRestore-0");
            Require(GameRuntime.I.State.usedPocket.Single().card.variantKey == "altar-focus-variant", "next same-name variant was lost");
            Submit("altarRestore-0"); Selected("altarRestoreReturn");
            Require(GameRuntime.I.State.usedPocket.Count == 0 && GameRuntime.I.State.ownedCards.Count == 3, "restores were lost or duplicated");
            Require(GameRuntime.I.CurrentNodeReceipt.altarRestoreLeft == 0 && Find("altarRestore-0") == null, "completed restore retained a candidate");

            Step = "failed save rolls back and keeps the same usable decision";
            Fixture(); yield return null; Focus("altarRestore-0");
            using (var locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                Submit("altarRestore-0");
            Selected("altarRestore-0");
            Require(GameRuntime.I.State.ownedCards.Count == 0 && GameRuntime.I.State.usedPocket[0].count == 2
                && GameRuntime.I.CurrentNodeReceipt.altarRestoreLeft == 3 && !GameRuntime.I.Saves.InTransaction,
                "failed checkpoint changed cards/count or leaked the transaction");
            Submit("altarRestore-0"); Selected("altarRestore-0");
            Require(GameRuntime.I.State.ownedCards.Count == 1 && GameRuntime.I.CurrentNodeReceipt.altarRestoreLeft == 2, "save retry did not restore exactly once");

            Step = "covered and expired source callbacks cannot act or take focus";
            Fixture(); yield return null; var covered = Find("altarRestore-0").onClick;
            var cover = ScreenMount.Show<CurrentAltarFocusCover>("altar-focus-cover"); cover.Build();
            var coverButton = cover.GetComponentInChildren<Button>(); EventSystem.current.SetSelectedGameObject(coverButton.gameObject);
            covered.Invoke();
            Require(GameRuntime.I.State.ownedCards.Count == 0 && EventSystem.current.currentSelectedGameObject == coverButton.gameObject,
                "covered restore changed cards or focus");
            UiStack.Close(cover); Focus("altarRestore-0");
            GameRuntime.I.State.seed++;
            covered.Invoke();
            Require(GameRuntime.I.State.ownedCards.Count == 0 && GameRuntime.I.CurrentNodeReceipt.altarRestoreLeft == 3,
                "old run restore changed the new source");

            Step = "save observer moves focus without being overridden";
            Fixture(); yield return null; Focus("altarRestore-0");
            outside = UIKit.Btn(App.UiRoot, "other-focus", () => { }).gameObject;
            afterSave = () => { afterSave = null; EventSystem.current.SetSelectedGameObject(outside); };
            Submit("altarRestore-0");
            Require(EventSystem.current.currentSelectedGameObject == outside && GameRuntime.I.State.ownedCards.Count == 1,
                "restore stole user/observer focus after the committed save");

            Step = "source change during save completion cannot restore old page focus";
            Fixture(); yield return null; Focus("altarRestore-0");
            afterSave = () => { afterSave = null; GameRuntime.I.State.seed++; EventSystem.current.SetSelectedGameObject(outside); };
            Submit("altarRestore-0");
            Require(EventSystem.current.currentSelectedGameObject == outside && GameRuntime.I.State.ownedCards.Count == 1,
                "completed old-source restore took the new source focus");
        }
        finally
        {
            afterSave = null; if (outside != null) UnityEngine.Object.Destroy(outside); Clear();
        }
    }
}

public sealed class CurrentAltarFocusCover : Panel
{
    public override void Build() => UIKit.Btn(transform, "covered altar focus", () => { });
}
