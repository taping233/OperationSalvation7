// Explicit native checks; the central driver supplies Play mode and an isolated profile.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentPhotoSaveRound5Checks
    {
        const string Key = "sdt-card-photo-notes-v1";
        public static int Assertions { get; private set; }
        static void Check(bool value, string message)
        { Assertions++; if (!value) throw new InvalidOperationException("Photo save round5: " + message); }
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        static JObject WithoutNotes(string text)
        { var profile = JObject.Parse(text); ((JObject)profile["global"]).Remove(Key); return profile; }
        static InputField Note(PhotoDetailScreen page) => page.GetComponentsInChildren<InputField>().Single();

        public static IEnumerator Run()
        {
            Assertions = 0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")), "isolated profile required");
            Clear(); var game = GameRuntime.I; game.ResetSlot(5); game.NewRun(5, "wu"); Clear();
            game.State.entrySupply = null; game.State.myClass = "牧师"; game.SaveCurrent();
            Check(game.Saves.LastWriteSucceeded && game.State.runActive && game.ActiveSlot == 5, "formal active-run fixture saved");
            var card = CardLibrary.FindById("tt3-fireball"); var other = CardLibrary.FindById("tt3-magic-lamp");
            Check(card != null && other != null && HubCatalog.Current.baseNotes.ContainsKey(card.id), "real photos and default note");
            Check(game.Base.TrySavePhotoNote(other.id, "other photo unchanged", out var reason), reason);
            string disk = File.ReadAllText(SaveSystem.ProfilePath);
            game.Base.wood += 17; game.State.coins += 13; game.State.elapsed += 7;
            var baseOwner = game.Base; var stateOwner = game.State;
            string baseState = SaveJson.Stringify(game.Base), state = SaveJson.Stringify(game.State), rng = game.Rng.SaveState();
            int saves = 0; bool observing = true;
            game.Bus.On<SaveCompleted>(_ => { if (observing) saves++; });
            try
            {
                Check(game.Base.TrySavePhotoNote(card.id, "  shared note  ", out reason), reason);
                Check(game.Saves.LastWriteSucceeded && reason == null && game.Base.PhotoNote(card.id) == "shared note", "trimmed note persisted");
                Check(JToken.DeepEquals(WithoutNotes(disk), WithoutNotes(File.ReadAllText(SaveSystem.ProfilePath))), "only the photo global key changes, not pending Base/State or other slots");
                Check(ReferenceEquals(game.Base, baseOwner) && ReferenceEquals(game.State, stateOwner)
                    && SaveJson.Stringify(game.Base) == baseState && SaveJson.Stringify(game.State) == state && game.Rng.SaveState() == rng, "photo write leaves live Base/State/RNG untouched");
                Check(saves == 0, "photo write cannot emit run SaveCompleted or clear run save-failure observers");
                var reopened = new SaveSystem();
                Check((string)reopened.Global.GetJson(Key)[card.id] == "shared note"
                    && (string)reopened.Global.GetJson(Key)[other.id] == "other photo unchanged", "independent read sees both photos");
                game.EnterSlot(4);
                Check(game.Base.PhotoNote(card.id) == "shared note", "notes shared across active slots");
                game.EnterSlot(5);
                Check(game.Base.TrySavePhotoNote(card.id, new string('x', 245), out reason), reason);
                Check(game.Base.PhotoNote(card.id) == new string('x', 240), "240-character limit preserved");
                Check(game.Base.TrySavePhotoNote(card.id, " \t\n", out reason), reason);
                Check(game.Saves.Global.GetJson(Key)[card.id] == null && game.Base.PhotoNote(card.id) == HubCatalog.Current.baseNotes[card.id], "clearing removes override and shows default note");
                disk = File.ReadAllText(SaveSystem.ProfilePath);
                Check(!game.Base.TrySavePhotoNote("round5-missing-photo-c934d81c", "invalid", out reason)
                    && !string.IsNullOrEmpty(reason) && File.ReadAllText(SaveSystem.ProfilePath) == disk, "invalid photo rejected without touching disk");

                string fallback = game.Base.PhotoNote(card.id);
                game.Saves.BeginTransaction();
                Check(game.Base.TrySavePhotoNote(card.id, "outer transaction draft", out reason), reason);
                Check(game.Base.PhotoNote(card.id) == "outer transaction draft" && File.ReadAllText(SaveSystem.ProfilePath) == disk, "nested global write stays buffered for outer owner");
                game.Saves.CancelTransaction();
                Check(game.Base.PhotoNote(card.id) == fallback && File.ReadAllText(SaveSystem.ProfilePath) == disk, "outer cancellation restores original global note");
                bool rejected = false; game.Saves.BeginTransaction();
                try { game.Base.TrySavePhotoNote("round5-missing-photo-c934d81c", "invalid", out reason); }
                catch (InvalidOperationException) { rejected = true; }
                finally { game.Saves.CancelTransaction(); }
                Check(rejected && File.ReadAllText(SaveSystem.ProfilePath) == disk, "nested errors propagate to outer transaction owner");

                PhotoDetailScreen.Open(new List<CardDef> { card }, card.id); yield return null;
                var page = (PhotoDetailScreen)UiStack.Top; var input = Note(page);
                input.text = "pending after atomic failure";
                baseState = SaveJson.Stringify(game.Base); state = SaveJson.Stringify(game.State); rng = game.Rng.SaveState();
                using (var locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    input.onEndEdit.Invoke(input.text);
                    Check(!game.Saves.LastWriteSucceeded && input.text == "pending after atomic failure", "failed write retains visible pending draft");
                    Check(File.ReadAllText(SaveSystem.ProfilePath) == disk && game.Base.PhotoNote(card.id) == fallback, "atomic failure preserves disk and loaded global value");
                    Check(SaveJson.Stringify(game.Base) == baseState && SaveJson.Stringify(game.State) == state && game.Rng.SaveState() == rng, "global failure does not rebuild or roll back unrelated live state");
                    Check(page.GetComponentsInChildren<Text>().Any(text => text.name == "PhotoNoteStatus" && text.text.Contains("未存档")), "failure receipt remains local and visible");
                    UiStack.Close(page);
                }
                PhotoDetailScreen.Open(new List<CardDef> { card }, card.id); yield return null;
                page = (PhotoDetailScreen)UiStack.Top; input = Note(page);
                Check(input.text == "pending after atomic failure", "pending draft survives close and reopen");
                state = SaveJson.Stringify(game.State); baseState = SaveJson.Stringify(game.Base); rng = game.Rng.SaveState();
                input.onEndEdit.Invoke(input.text);
                Check(game.Saves.LastWriteSucceeded && game.Base.PhotoNote(card.id) == input.text, "unchanged pending draft retries successfully");
                Check((string)new SaveSystem().Global.GetJson(Key)[card.id] == input.text, "retry is independently readable on disk");
                Check(JToken.DeepEquals(WithoutNotes(disk), WithoutNotes(File.ReadAllText(SaveSystem.ProfilePath)))
                    && SaveJson.Stringify(game.Base) == baseState && SaveJson.Stringify(game.State) == state && game.Rng.SaveState() == rng, "retry still writes no Base or run checkpoint");
                Check(page.GetComponentsInChildren<Text>().Any(text => text.name == "PhotoNoteStatus" && text.text == "已存档") && saves == 0, "retry clears local pending receipt without emitting run completion");
            }
            finally
            {
                observing = false;
                if (game.Saves.InTransaction) game.Saves.CancelTransaction();
                Clear();
            }
        }
    }
}
