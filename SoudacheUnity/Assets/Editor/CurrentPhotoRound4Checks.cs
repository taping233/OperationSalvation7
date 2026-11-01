using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentPhotoRound4Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value, string message)
        {
            Assertions++;
            if (!value) throw new InvalidOperationException("Photo round4: " + message);
        }
        static InputField Note(PhotoDetailScreen page) => page.GetComponentsInChildren<InputField>().Single();
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        static void Navigate(PhotoDetailScreen page) => typeof(PhotoDetailScreen)
            .GetMethod("Navigate", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(page, new object[] { 1 });
        public static IEnumerator Run()
        {
            Assertions = 0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")), "isolated profile required");
            Clear(); var game = GameRuntime.I; game.ResetSlot(5);
            var cards = new List<CardDef> { CardLibrary.FindById("tt3-fireball"), CardLibrary.FindById("tt3-magic-lamp") };
            Check(cards.All(card => card != null), "real catalog fixture");
            Check(game.Base.TrySavePhotoNote(cards[0].id, "first original", out var reason), reason);
            Check(game.Base.TrySavePhotoNote(cards[1].id, "second original", out reason), reason);
            PhotoDetailScreen.Open(cards, cards[0].id); yield return null;
            var page = (PhotoDetailScreen)UiStack.Top;
            var first = Note(page); var oldChange = first.onValueChanged; var oldEnd = first.onEndEdit;
            EventSystem.current.SetSelectedGameObject(first.gameObject); first.ActivateInputField();
            yield return new WaitForSecondsRealtime(.5f);
            Check(EventSystem.current.currentSelectedGameObject == first.gameObject && first.isFocused, "entry animation preserves player's active note focus");
            var oldClose = page.GetComponentsInChildren<Button>().Single(button => button.name == "PhotoClose").onClick;
            first.text = "first saved on navigation"; Navigate(page);
            Check(game.Base.PhotoNote(cards[0].id) == "first saved on navigation", "navigation saves departing photo before changing index");
            var second = Note(page); second.text = "second current draft";
            string disk = File.ReadAllText(SaveSystem.ProfilePath);
            oldChange.Invoke("stale change"); oldEnd.Invoke("stale end"); oldClose.Invoke();
            Check(File.ReadAllText(SaveSystem.ProfilePath) == disk && game.Base.PhotoNote(cards[1].id) == "second original", "old photo events cannot save current photo");
            Check(UiStack.Top == page && second.text == "second current draft", "old close cannot dismiss current photo or replace draft");
            second.onEndEdit.Invoke(second.text);
            Check(game.Saves.LastWriteSucceeded && game.Base.PhotoNote(cards[1].id) == second.text, "current end-edit saves current photo");
            var closedEnd = second.onEndEdit; var closedChange = second.onValueChanged;
            second.text = "saved at formal close"; UiStack.Close(page);
            Check(game.Base.PhotoNote(cards[1].id) == "saved at formal close", "formal close saves before delayed destruction");
            disk = File.ReadAllText(SaveSystem.ProfilePath); closedEnd.Invoke("closed end"); closedChange.Invoke("closed change");
            Check(File.ReadAllText(SaveSystem.ProfilePath) == disk, "closed events cannot persist again");
            PhotoDetailScreen.Open(cards, cards[1].id); page = (PhotoDetailScreen)UiStack.Top;
            closedEnd.Invoke("same photo replacement");
            Check(File.ReadAllText(SaveSystem.ProfilePath) == disk, "old events cannot act on same-photo replacement");
            var input = Note(page); input.text = "retained after write failure";
            using (var locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                input.onEndEdit.Invoke(input.text);
                Check(!game.Saves.LastWriteSucceeded && input.text == "retained after write failure", "failed write retains visible draft");
                Check(File.ReadAllText(SaveSystem.ProfilePath) == disk && game.Base.PhotoNote(cards[1].id) == "saved at formal close", "failed write preserves persisted note");
                UiStack.Close(page);
            }
            PhotoDetailScreen.Open(cards, cards[1].id); page = (PhotoDetailScreen)UiStack.Top; input = Note(page);
            Check(input.text == "retained after write failure", "reopening retains failed session draft");
            input.onEndEdit.Invoke(input.text);
            Check(game.Saves.LastWriteSucceeded && game.Base.PhotoNote(cards[1].id) == input.text, "unchanged pending draft retries successfully");
            var reopened = new SaveSystem();
            Check((string)reopened.Global.GetJson("sdt-card-photo-notes-v1")[cards[1].id] == input.text, "retry persisted independently readable bytes");
            Clear(); CardLibraryScreen.Open(); CurrentRunFilm.CancelActive(); yield return null;
            var wall = UiStack.Top as CardLibraryScreen;
            Check(wall != null, "formal photo wall opens");
            var updateTiles = (Action)Delegate.CreateDelegate(typeof(Action), wall, typeof(CardLibraryScreen).GetMethod("UpdateTiles", BindingFlags.Instance | BindingFlags.NonPublic));
            updateTiles(); long allocated = GC.GetAllocatedBytesForCurrentThread();
            for (int i = 0; i < 100; i++) updateTiles();
            Check(GC.GetAllocatedBytesForCurrentThread() == allocated, "unchanged wall mount range has no managed allocations across 100 updates");
            var tile = wall.GetComponentsInChildren<Button>().First(button => button.name.StartsWith("Photo-", StringComparison.Ordinal));
            var inspect = tile.onClick; inspect.Invoke(); var detail = UiStack.Top;
            Check(detail is PhotoDetailScreen, "current wall tile opens detail");
            int count = UiStack.Count; inspect.Invoke();
            Check(UiStack.Top == detail && UiStack.Count == count, "covered wall tile cannot open another detail");
            var animated = (PhotoDetailScreen)detail;
            Note(animated).text = "saved before close animation";
            animated.GetComponentsInChildren<Button>().Single(button => button.name == "PhotoClose").onClick.Invoke();
            yield return new WaitForSecondsRealtime(.18f);
            Check(UiStack.Top == wall && EventSystem.current.currentSelectedGameObject == tile.gameObject, "normal close animation returns to current wall tile focus");
            var search = wall.GetComponentsInChildren<InputField>().Single(); search.text = "round4-no-photo-6cf4c54dd46b4ee1";
            yield return new WaitForSecondsRealtime(.2f);
            Check(!wall.GetComponentsInChildren<Button>().Any(button => button.name.StartsWith("Photo-", StringComparison.Ordinal)), "formal search removes old tile from current results");
            inspect.Invoke(); Check(UiStack.Top == wall, "filtered-out tile cannot open unrelated first result");
            wall.GetComponentsInChildren<Button>().Single(button => button.name == "libClearFilter").onClick.Invoke();
            UiStack.Close(wall); inspect.Invoke();
            Check(UiStack.Count == 0, "closed wall tile cannot reopen photo detail");
            Clear(); yield return null;
        }
    }
}
