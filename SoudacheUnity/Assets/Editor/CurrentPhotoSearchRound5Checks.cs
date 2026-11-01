// Real photo-wall controls with a bounded built-in catalog fixture; central driver only, no OS input.
// Fixed expected IDs/counts exercise the actual projection, not a second filter implementation.
// Collection identity is checked; this does not measure allocations, elapsed work, or FPS.
using System;
using System.Collections;
using System.Collections.Generic;
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
    public static class CurrentPhotoSearchRound5Checks
    {
        static readonly string[] CategoryTypes = { "全部", "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" };
        static readonly string[] TabLabels = { "全部", "武术", "法术", "生物", "道具", "装备", "事件", "能力", "资源" };
        static readonly string[] Fixture = { "starter-attack", "tt3-fireball", "tt13-stellar-divination", "tt3-magic-lamp", "foe-rager", "starter-emergency-bandage", "tt3-blooddrinker", "tt6-demondeal", "tt8-hero-assassin", "tt-copper" };
        // native-round5-2 observed this Unity 6000.6.7 Mono order. Name/type ties use the same unchanged zh-CN comparer.
        static readonly string[] CostOrder = { "tt6-demondeal", "starter-emergency-bandage", "foe-rager", "tt-copper", "tt3-blooddrinker", "starter-attack", "tt13-stellar-divination", "tt3-fireball", "tt3-magic-lamp", "tt8-hero-assassin" };
        public static int Assertions { get; private set; }
        static void Check(bool value, string message) { Assertions++; if (!value) throw new InvalidOperationException("Photo search round5: " + message); }
        static FieldInfo Field(object owner, string name) => owner.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic);
        static T Get<T>(object owner, string name) => (T)Field(owner, name).GetValue(owner);
        static Button Button(CardLibraryScreen page, string name) => page.GetComponentsInChildren<Button>().Single(button => button.name == name);
        static void Submit(Button button)
        {
            Check(button != null && button.isActiveAndEnabled && button.interactable, "available real submit control");
            EventSystem.current.SetSelectedGameObject(button.gameObject);
            ExecuteEvents.Execute(button.gameObject, new BaseEventData(EventSystem.current), ExecuteEvents.submitHandler);
        }
        static void Choice(CardLibraryScreen page, string trigger, string label)
        {
            Submit(Button(page, trigger));
            Submit(page.GetComponentsInChildren<Button>().Single(button => button.name.StartsWith("Choice-", StringComparison.Ordinal)
                && button.GetComponentInChildren<Text>().text.TrimEnd(' ', '✓') == label));
        }
        static void Results(CardLibraryScreen page, params string[] ids)
        {
            var actual = Get<List<CardDef>>(page, "_filtered");
            string sort = (string)typeof(CardLibraryScreen).GetField("_sort", BindingFlags.Static | BindingFlags.NonPublic).GetValue(null);
            Check(actual.Select(card => card.id).SequenceEqual(ids), "exact result IDs/order; sort=" + sort
                + "; expected=" + string.Join(",", ids) + "; actual=" + string.Join(" | ", actual.Select(card => card.id + ":" + card.name
                    + ":cost=" + card.cost + ":rawRarity=" + card.rarity + ":effectiveRarity=" + CardLibrary.RarityOf(card))));
        }
        static void Counts(CardLibraryScreen page, params int[] expected)
        {
            Check(expected.Length == 9 && Get<int[]>(page, "_categoryCounts").SequenceEqual(expected), "exact nine category counts");
            var tabs = Get<List<Button>>(page, "_tabs"); Check(tabs.Count == 9, "nine category controls");
            for (int i = 0; i < 9; i++) Check(tabs[i].GetComponentInChildren<Text>().text == TabLabels[i] + "  <size=14>" + expected[i] + "</size>", "rendered count for " + CategoryTypes[i]);
        }
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        static IEnumerator Query(InputField search, string text)
        {
            EventSystem.current.SetSelectedGameObject(search.gameObject); search.ActivateInputField(); search.text = text;
            yield return new WaitForSecondsRealtime(.18f);
        }
        public static IEnumerator Run()
        {
            Assertions = 0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")), "isolated profile required");
            Clear(); var game = GameRuntime.I; game.ResetSlot(5); game.State.Phase = "title";
            CardLibraryScreen.Open(); CurrentRunFilm.CancelActive(); yield return null; Canvas.ForceUpdateCanvases();
            var page = UiStack.Top as CardLibraryScreen; Check(page != null, "formal photo wall opens");
            var search = page.GetComponentsInChildren<InputField>().Single();
            var child = Query(search, "round5-neutral-filter-c934d81c"); while (child.MoveNext()) yield return child.Current;
            Submit(Button(page, "libClearFilter"));
            // Only this screen's catalog is bounded; global CardLibrary and production definitions remain untouched.
            var catalog = Fixture.Select(id => CardDatabase.All.Single(card => card.id == id)).ToList();
            Check(((string[])typeof(CardLibraryScreen).GetField("Types", BindingFlags.Static | BindingFlags.NonPublic).GetValue(null)).SequenceEqual(CategoryTypes)
                && catalog.Single(card => card.id == "tt8-hero-assassin").type == "能力卡", "formal category identities differ from shortened visible labels");
            Field(page, "_catalog").SetValue(page, catalog);
            typeof(CardLibraryScreen).GetMethod("Refresh", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(page, new object[] { true, false });
            var filtered = Get<List<CardDef>>(page, "_filtered"); var counts = Get<int[]>(page, "_categoryCounts");
            try
            {
                Choice(page, "libSort", "费用"); Results(page, CostOrder); Counts(page, 10, 1, 3, 1, 1, 1, 1, 1, 1);
                Submit(Button(page, "libType2")); Results(page, "tt13-stellar-divination", "tt3-fireball", "tt3-magic-lamp");
                Counts(page, 10, 1, 3, 1, 1, 1, 1, 1, 1); // Counts intentionally ignore the active type tab.
                child = Query(search, "  星辰   抽到   施放  "); while (child.MoveNext()) yield return child.Current;
                Results(page, "tt13-stellar-divination"); Counts(page, 1, 0, 1, 0, 0, 0, 0, 0, 0);
                Check(EventSystem.current.currentSelectedGameObject == search.gameObject && search.isFocused
                    && page.GetComponentsInChildren<InputField>().Single() == search, "debounced multiword search retains original input and focus");
                child = Query(search, "星辰 round5-absent-term-c934d81c"); while (child.MoveNext()) yield return child.Current;
                Results(page); Counts(page, 0, 0, 0, 0, 0, 0, 0, 0, 0);
                child = Query(search, "   "); while (child.MoveNext()) yield return child.Current;
                Results(page, "tt13-stellar-divination", "tt3-fireball", "tt3-magic-lamp"); Counts(page, 10, 1, 3, 1, 1, 1, 1, 1, 1);
                Choice(page, "libRar", "史诗"); Results(page, "tt3-magic-lamp"); Counts(page, 2, 0, 1, 0, 0, 1, 0, 0, 0);
                Choice(page, "libCls", "通用"); Results(page, "tt3-magic-lamp"); Counts(page, 2, 0, 1, 0, 0, 1, 0, 0, 0);
                Choice(page, "libCls", CharacterTable.Name("牧师")); Results(page); Counts(page, 0, 0, 0, 0, 0, 0, 0, 0, 0);
                Choice(page, "libRar", "全部"); Results(page, "tt13-stellar-divination"); Counts(page, 1, 0, 1, 0, 0, 0, 0, 0, 0);
                Choice(page, "libCls", CharacterTable.Name("侠客")); Results(page); Counts(page, 1, 0, 0, 0, 0, 0, 0, 1, 0);
                Submit(Button(page, "libType7")); Results(page, "tt8-hero-assassin");
                Choice(page, "libRar", "棱彩"); Results(page, "tt8-hero-assassin"); Counts(page, 1, 0, 0, 0, 0, 0, 0, 1, 0);
                Submit(Button(page, "libClearFilter")); Results(page, CostOrder); Counts(page, 10, 1, 3, 1, 1, 1, 1, 1, 1);
                Choice(page, "libSort", "名称");
                Results(page, "starter-attack", "tt6-demondeal", "starter-emergency-bandage", "tt13-stellar-divination", "foe-rager", "tt3-fireball", "tt8-hero-assassin", "tt3-magic-lamp", "tt-copper", "tt3-blooddrinker");
                Choice(page, "libSort", "稀有度");
                Results(page, "tt8-hero-assassin", "tt13-stellar-divination", "tt6-demondeal", "tt3-fireball", "foe-rager", "tt3-magic-lamp", "tt3-blooddrinker", "starter-emergency-bandage", "tt-copper", "starter-attack");
                Check(ReferenceEquals(filtered, Get<List<CardDef>>(page, "_filtered")) && ReferenceEquals(counts, Get<int[]>(page, "_categoryCounts")), "real refreshes reuse result list and category array");
                Submit(Button(page, "Photo-tt8-hero-assassin")); var detail = UiStack.Top as PhotoDetailScreen;
                Check(detail != null, "current mounted result opens actual reader");
                var readerCards = Get<List<CardDef>>(detail, "_cards");
                Check(!ReferenceEquals(readerCards, filtered) && readerCards.SequenceEqual(filtered), "reader owns ordered snapshot rather than the reusable wall list");
                UiStack.Close(detail);
                child = Query(search, "星辰"); while (child.MoveNext()) yield return child.Current;
                Results(page, "tt13-stellar-divination");
                Check(readerCards.Count == 10 && ReferenceEquals(filtered, Get<List<CardDef>>(page, "_filtered")), "later wall refill cannot clear prior reader snapshot");
                Submit(Button(page, "libClearFilter"));
            }
            finally { Clear(); }
            yield return null;
        }
    }
}
