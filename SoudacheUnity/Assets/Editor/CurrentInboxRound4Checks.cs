using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentInboxRound4Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value, string message)
        {
            Assertions++;
            if (!value) throw new InvalidOperationException("Inbox round4: " + message);
        }
        static Button Button(Panel page, string name) => page.GetComponentsInChildren<Button>().Single(button => button.name == name);
        static JArray Records => (JArray)GameRuntime.I.Saves.Global.GetJson(HomeInboxScreen.StoreKey);
        static void Fixture() => GameRuntime.I.Saves.Global.SetJson(HomeInboxScreen.StoreKey,
            new JArray(new JObject { { "ts", "2026-11-01T00:00:00Z" }, { "text", "round4 isolated feedback" }, { "done", false } }));
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        public static IEnumerator Run()
        {
            Assertions = 0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")), "isolated profile required");
            Clear(); Fixture(); var page = UiStack.Show<HomeInboxScreen>("Round4Inbox");
            var oldDone = Button(page, "sugDone").onClick; var oldDelete = Button(page, "sugDel").onClick;
            oldDone.Invoke(); Check((bool)Records.Single()["done"], "current mark-done persists");
            string disk = File.ReadAllText(SaveSystem.ProfilePath);
            oldDelete.Invoke(); oldDone.Invoke();
            Check(UiStack.Top == page && File.ReadAllText(SaveSystem.ProfilePath) == disk, "old rendered row cannot mutate or open deletion");
            Clear(); Fixture(); page = UiStack.Show<HomeInboxScreen>("Round4Inbox");
            var closedDone = Button(page, "sugDone").onClick;
            Button(page, "sugDel").onClick.Invoke(); var dialog = UiStack.Top;
            Check(dialog is HomeInboxDeleteDialog, "current delete opens formal confirmation");
            int count = UiStack.Count; Button(page, "sugBack").onClick.Invoke();
            Check(UiStack.Count == count && UiStack.Top == dialog, "covered inbox back cannot remove its owner");
            var cancelled = Button(dialog, "confirm").onClick; UiStack.Close(dialog); cancelled.Invoke();
            Check(UiStack.Top == page && Records.Count == 1 && !(bool)Records.Single()["done"], "cancelled confirmation cannot delete when its event is replayed");
            Button(page, "sugDel").onClick.Invoke(); dialog = UiStack.Top;
            var confirmed = Button(dialog, "confirm").onClick; confirmed.Invoke();
            Check(UiStack.Top == page && Records.Count == 0, "formal confirmation returns to live owner and deletes once");
            disk = File.ReadAllText(SaveSystem.ProfilePath); confirmed.Invoke();
            Check(File.ReadAllText(SaveSystem.ProfilePath) == disk, "closed confirmation does not repeat write");
            Clear(); Fixture(); page = UiStack.Show<HomeInboxScreen>("Round4Inbox");
            var done = Button(page, "sugDone").onClick; disk = File.ReadAllText(SaveSystem.ProfilePath);
            var notice = (Text)typeof(HomeInboxScreen).GetField("_notice", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(page);
            string previousNotice = notice.text;
            using (var locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read)) done.Invoke();
            Check(File.ReadAllText(SaveSystem.ProfilePath) == disk && !(bool)Records.Single()["done"], "failed write preserves disk and pending record");
            Check(UiStack.Top == page && !string.IsNullOrEmpty(notice.text) && notice.text != previousNotice, "failed write remains in inbox with a local error");
            done.Invoke(); Check((bool)Records.Single()["done"], "same current row can retry failed mark-done");
            Clear(); Fixture(); page = UiStack.Show<HomeInboxScreen>("Round4Inbox");
            closedDone = Button(page, "sugDone").onClick; UiStack.Close(page);
            var replacement = UiStack.Show<HomeInboxScreen>("Round4InboxReplacement"); disk = File.ReadAllText(SaveSystem.ProfilePath);
            closedDone.Invoke();
            Check(UiStack.Top == replacement && File.ReadAllText(SaveSystem.ProfilePath) == disk && !(bool)Records.Single()["done"], "closed owner callback cannot target replacement inbox");
            Clear(); yield return null;
        }
    }
}
