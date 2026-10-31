// Explicit isolated-profile Standalone review; mounted after player-returned-base.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Hub;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ParityHub()
        {
            var g = GameRuntime.I; var b = g.Base;
            string normalId = null, variantKey = null, conversionId = null;
            Button.ButtonClickedEvent staleProtect = null, staleConversion = null;
            void Need(bool ok, string why) { if (!ok) throw new InvalidOperationException(why); }
            Button Caption(string prefix) => UiStack.Top.GetComponentsInChildren<Button>().First(button => button.isActiveAndEnabled
                && button.GetComponentInChildren<Text>()?.text.StartsWith(prefix, StringComparison.Ordinal) == true);
            void Press(string prefix) { var button = Caption(prefix); Need(button.IsInteractable(), "Hub control unavailable: " + prefix); ClickButton(button); }
            int Count(string key) => b.stash.Where(stack => GameRuntime.DepartureStackKey(stack) == key).Sum(stack => stack.count);
            long SoundSequence() => (long)typeof(AudioService).GetField("_sequence", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic).GetValue(g.Audio);
            IEnumerator SettleControls() { int from=Time.frameCount; yield return null;
                Canvas.ForceUpdateCanvases(); yield return new WaitForEndOfFrame(); yield return null;
                _records.Add(new { kind="hub-rendered-controls-ready", fromFrame=from, frame=Time.frameCount });
            }
            void RejectOld(Button.ButtonClickedEvent callback, string target)
            {
                var owner = UiStack.Top; string before = SaveJson.Stringify(g.Base), state = SaveJson.Stringify(g.State), rng = g.Rng.SaveState(); callback.Invoke();
                Need(UiStack.Top == owner && SaveJson.Stringify(g.Base) == before && SaveJson.Stringify(g.State) == state && g.Rng.SaveState() == rng, "Old Hub detail callback changed its source or current page: " + target);
                _records.Add(new { kind = "constructed-stale-callback-rejected", target, sameProfile = true, playerInput = false });
            }
            if (!Guard(() => {
                Need(Enabled && !g.State.runActive && g.ActiveSlot == 5 && UiStack.Top is HubScreen, "Hub parity requires the returned isolated base.");
                var ordinary = CardLibrary.All().First(card => card.type == "武术" && card.rarity == "古朴" && !CardLibrary.IsSellable(card)).Clone();
                ordinary.value = 37; var variant = ordinary.Clone(); variant.variantKey = "display-hub-variant";
                var collectible = CardLibrary.All().First(card => card.cls == "侠客" && card.rarity == "职业").Clone();
                var keyCard = CardLibrary.All().First(card => BaseData.MaterialInfo(card)?.kind == "keys").Clone();
                normalId = ordinary.id; conversionId = collectible.id;
                var altered = new StashStack { card = variant, count = 3, variantKey = variant.variantKey };
                variantKey = GameRuntime.DepartureStackKey(altered);
                Need(g.TryPersistMutation(() => {
                    b.stash = new List<StashStack> { altered, new StashStack { card = ordinary, count = 2 },
                        new StashStack { card = collectible, count = 1 }, new StashStack { card = keyCard, count = 2 } };
                    b.pocket = new List<StashStack> { new StashStack { card = ordinary.Clone(), count = 1 } };
                    b.collection = new Dictionary<string, CollectionEntry>(); b.collectionProtection = new Dictionary<string, bool>();
                    b.characters["wu"] = new ClassProgress { lv = 9, xp = MetaProgress.XpForNext(9) - 1 };
                    b.coins = 10; b.keys = 0;
                }, out var why), why);
                Need(BaseData.StashSalePrice(ordinary) == 2 && b.KeyCount > 0, "Hub source price/key fixture invalid.");
                _records.Add(new { kind = "constructed-current-hub-fixture", normalId, variantKey, ordinaryPrintedValue = 37, sourceStashSalePrice = 2, conversionId, isolatedProfile = SaveSystem.ProfilePath, osHardwareInput = false });
                ClickNamed("hub-tab stash");
            })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            yield return Capture("player-hub-variant-stock", false);
            if (!Guard(() => {
                var cells = UiStack.Top.GetComponentsInChildren<Button>().Where(button => button.name == "warehouse-card-cell " + normalId).ToArray();
                Need(cells.Length == 2, "Both same-name variants must remain independently visible."); ClickButton(cells[0]);
            })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => {
                Need(UiStack.Top is HubScreen.HubInventoryCardScreen, "Warehouse card detail absent.");
                Need(!UiStack.Top.GetComponentsInChildren<Button>().Any(button => button.GetComponentInChildren<Text>()?.text.Contains("出售") == true), "Warehouse detail must not offer sales; the trade desk owns selling.");
                Press("保护卡牌"); Need(b.collection.ContainsKey(normalId) && b.IsProtected(b.stash[0].card) && Count(variantKey) == 3
                    && b.characters["wu"].lv == 9 && b.characters["wu"].xp == MetaProgress.XpForNext(9) - 1, "Ordinary protection must not consume stock or award XP.");
            })) yield break;
            // Rebuilt controls join the rendered Canvas before another player click.
            yield return SettleControls();
            if (!Guard(() => { Press("取消保护"); Need(b.collection.ContainsKey(normalId) && !b.IsProtected(b.stash[0].card), "Removing protection must preserve the gallery record."); })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            yield return Capture("player-hub-warehouse-actions", false);
            if (!Guard(() => {
                Need(Count(variantKey) == 3 && Count("card:" + normalId) == 2 && b.coins == 10, "Warehouse inspection must not sell cards.");
                staleProtect = Caption("保护卡牌").onClick; Press("返回仓库"); RejectOld(staleProtect, "warehouse-protect-after-close-same-frame");
            })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => ClickNamed("warehouse-card-cell " + conversionId))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => { RejectOld(staleProtect, "warehouse-protect-after-replacement"); Press("返回仓库"); })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => ClickNamed("hub-tab shop"))) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => Press("⇄ 出售卡牌"))) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => { ClickNamed("trade-v5-item " + variantKey); })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => Need(Caption("出售 ×1 · +2 币").IsInteractable(), "Trade desk must allow the ordinary variant at 2 coins."))) yield break;
            yield return Capture("player-hub-trade-variant", false);
            if (!Guard(() => { long sound=SoundSequence(); Press("出售 ×1 · +2 币"); Need(Count(variantKey) == 2 && Count("card:" + normalId) == 2 && b.coins == 12 && SoundSequence()==sound+1, "Low-price multi-copy sale must commit immediately with one ding and preserve its same-name neighbor."); })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => ClickNamed("trade-v5-item card:" + normalId))) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            yield return Capture("player-hub-trade-base-variant", false);
            if (!Guard(() => { long sound=SoundSequence(); Press("出售 ×1 · +2 币"); Need(Count(variantKey) == 2 && Count("card:" + normalId) == 1 && b.coins == 14 && SoundSequence()==sound+1, "Low-price base sale must commit immediately with one ding and preserve the alternate variant."); })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => { long sound=SoundSequence(); Press("出售 ×1 · +2 币"); Need(Count("card:" + normalId) == 1 && b.coins == 14 && SoundSequence()==sound && Caption("确认此操作？").IsInteractable(), "Last-card sale must only arm confirmation without stock, coin or ding changes."); })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => { ClickNamed("hub-tab stash"); Need(Count("card:" + normalId) == 1 && Count(variantKey) == 2 && b.coins == 14, "Navigating away from armed last-card sale must not commit it."); })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => ClickNamed("warehouse-card-cell " + conversionId))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => {
                Need(!UiStack.Top.GetComponentsInChildren<Button>().Any(button => button.GetComponentInChildren<Text>()?.text.Contains("保护") == true), "Unregistered class card must not bypass conversion through protection.");
                Press("转化为人物经验");
            })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => {
                var text = UiStack.Top.GetComponentsInChildren<Text>().Select(label => label.text).ToArray();
                Need(new[] { "实际经验", "1 XP", "末张溢出", "9 XP", "Lv.9 → Lv.10" }.All(text.Contains), "Conversion must show actual 1 XP and 9 XP overflow.");
                Need(Caption("确认消耗并转化").IsInteractable(), "Conversion confirmation unavailable.");
            })) yield break;
            yield return Capture("player-hub-conversion-overflow", false);
            if (!Guard(() => { staleConversion = Caption("确认消耗并转化").onClick; Press("取消转化"); })) yield break;
            yield return SettleControls();
            if (!Guard(() => { Press("返回仓库"); RejectOld(staleConversion, "warehouse-convert-after-close-same-frame"); })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => ClickNamed("warehouse-card-cell " + normalId))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => { RejectOld(staleConversion, "warehouse-convert-after-replacement"); Press("返回仓库"); })) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => ClickNamed("warehouse-card-cell " + conversionId))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => Press("转化为人物经验"))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => {
                Press("确认消耗并转化"); Need(b.characters["wu"].lv == 10 && b.characters["wu"].xp == 0 && b.collection.ContainsKey(conversionId)
                    && !b.stash.Any(stack => stack.card.id == conversionId) && b.coins == 14 && Count(variantKey) == 2, "Conversion must consume one card, register it and add only needed XP.");
            })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => Press("待复原 "))) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            if (!Guard(() => ClickNamed("warehouse-card-cell " + normalId))) yield break;
            yield return new WaitForSecondsRealtime(.2f);
            if (!Guard(() => Need(!Caption("复原 1 张").IsInteractable() && b.keys == 0 && b.KeyCount > 0 && b.pocket.Single().count == 1, "Unused key cards must not enable restoration."))) yield break;
            yield return Capture("player-hub-restore-unbanked-keys", false);
            if (!Guard(() => Press("返回仓库"))) yield break;
            yield return SettleControls();
            if (!Guard(() => { ClickNamed("hub-tab deploy"); _records.Add(new { kind = "current-hub-parity-effects", coins = b.coins, variantCount = Count(variantKey), baseVariantCount = Count("card:" + normalId), level = b.characters["wu"].lv, xp = b.characters["wu"].xp, registered = b.collection.ContainsKey(conversionId), unbankedRestoreBlocked = true, inputPath = "mounted-player-controls", osHardwareInput = false }); })) yield break;
            yield return new WaitForSecondsRealtime(.75f);
            yield return Capture("player-hub-parity-returned-base", false);
        }
    }
}
