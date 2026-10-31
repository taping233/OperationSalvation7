using System;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed class AltarRitualScreen : NodeShellPanel
    {
        bool _selectItem;
        string _error;
        RunState _run;
        string _node;
        int? _seed, _slot;
        int _revision;
        readonly List<Button> _restoreButtons = new List<Button>();
        readonly List<CardDef> _restoreCards = new List<CardDef>();
        Button _return;
        bool SourceCurrent => this != null && GameRuntime.I.State == _run && _run.runActive && !_run.battleActive
            && _run.seed == _seed && GameRuntime.I.ActiveSlot == _slot && GameRuntime.I.CurrentNodeId == _node;
        bool Current => SourceCurrent && UiStack.Top == this && !Sdt.UI.Screens.Menu.SuggestionBox.IsOpen;
        public static void Open()
        {
            var page = ScreenMount.Show<AltarRitualScreen>("AltarRitual");
            var runtime = GameRuntime.I;
            page._run = runtime.State; page._node = runtime.CurrentNodeId; page._seed = runtime.State.seed; page._slot = runtime.ActiveSlot;
            page.Tone = "altar"; page.TitleIcon = "[[icon:crystal]]"; page.Title = "祭坛仪式";
            page.Build();
        }
        protected override void OnPrepare()
        {
            var runtime = GameRuntime.I;
            Sub = "生命 " + runtime.State.hp + "/" + runtime.State.maxHp + " · 通行证碎片 " + runtime.State.fragments
                + (runtime.State.altarActivated ? " · 祭坛已激活" : " · 尚未激活");
        }
        void Act(bool success, string reason)
        {
            _error = success ? null : reason;
            Rebuild();
        }
        void Restore(PocketStack source, CardDef card, int count, int visibleIndex, int revision, Button trigger)
        {
            if (!Current || revision != _revision || trigger == null || !trigger.isActiveAndEnabled
                || source.card != card || source.count != count) return;
            int index = _run.usedPocket.IndexOf(source);
            if (index < 0) return;
            var events = EventSystem.current;
            var previous = events?.currentSelectedGameObject;
            bool hadFocus = previous == trigger.gameObject;
            string id = card.id, variant = card.variantKey ?? "";
            bool success = GameRuntime.I.TryAltarRestore(index, out var reason);
            if (!SourceCurrent) return;
            Act(success, reason);
            if (!hadFocus || !Current || events == null
                || events.currentSelectedGameObject != null && events.currentSelectedGameObject != previous) return;
            Button target = null;
            for (int i = 0; i < _restoreButtons.Count; i++)
                if (_restoreCards[i].id == id && (_restoreCards[i].variantKey ?? "") == variant && _restoreButtons[i].IsInteractable())
                { target = _restoreButtons[i]; break; }
            if (target == null && _restoreButtons.Count > 0)
                target = _restoreButtons[Mathf.Clamp(visibleIndex, 0, _restoreButtons.Count - 1)];
            if (target == null || !target.IsInteractable()) target = _return;
            if (target != null && target.IsInteractable()) events.SetSelectedGameObject(target.gameObject);
        }
        protected override void OnBody()
        {
            int revision = ++_revision;
            _restoreButtons.Clear(); _restoreCards.Clear();
            CurrentEncounterOpening.Create(BodyRoot, "altar");
            var runtime = GameRuntime.I;
            var receipt = runtime.CurrentNodeReceipt;
            if (!string.IsNullOrEmpty(_error)) UIKit.Label(BodyRoot, _error, 16, UiPalette.Warn);
            if (receipt.altarRewardPending)
            {
                UIKit.Label(BodyRoot, "选择一种祭坛回赠；离开此地点后未领机会作废。", 17, Theme.Sub);
                EventOptButton.Create(BodyRoot, "恢复与复原", "回复10生命，并手选复原最多3张卡牌", "ok", () =>
                { bool ok = runtime.TrySelectAltarReward("restore", out var reason); Act(ok, reason); });
                EventOptButton.Create(BodyRoot, "领取战利品", "一张传说卡牌和一张装备", "ok", () =>
                { bool ok = runtime.TrySelectAltarReward("loot", out var reason); Act(ok, reason); });
            }
            if (receipt.altarRestoreLeft > 0)
            {
                UIKit.Label(BodyRoot, "还可复原 " + receipt.altarRestoreLeft + " 张；装备与道具不参与。", 17, Theme.Sub);
                for (int i = 0; i < runtime.State.usedPocket.Count; i++)
                {
                    var stack = runtime.State.usedPocket[i];
                    if (stack.card == null || stack.count <= 0 || stack.card.type == "装备" || stack.card.type == "道具") continue;
                    int visibleIndex = _restoreButtons.Count, count = stack.count; var card = stack.card;
                    Button restore = null;
                    restore = UIKit.Btn(BodyRoot, "复原「" + card.name + "」 · 消耗区×" + count,
                        () => Restore(stack, card, count, visibleIndex, revision, restore));
                    restore.name = "altarRestore-" + visibleIndex;
                    _restoreButtons.Add(restore); _restoreCards.Add(card);
                }
            }
            if (receipt.altarRewardKind == "loot")
            {
                var cards = runtime.GetAltarRewardCards();
                for (int i = 0; i < cards.Count; i++)
                {
                    int index = i;
                    if (cards[i] == null) continue;
                    CardFace.Create(cards[i], CardSize.Md, BodyRoot);
                    var claim = UIKit.Btn(BodyRoot, receipt.altarTaken.Contains(i) ? "已领取" : "领取「" + cards[i].name + "」", () =>
                    { bool ok = runtime.TryClaimAltarReward(index, out var reason); Act(ok, reason); });
                    claim.interactable = !receipt.altarTaken.Contains(i);
                }
            }
            if (!runtime.State.altarActivated)
            {
                EventOptButton.Create(BodyRoot, "献祭3张随身卡牌", "激活祭坛，并选择一份回赠；安全格与容器内卡牌不参与", "ok", () =>
                { Close(); CardSacrificeScreen.Open(false); });
                var fragment = EventOptButton.Create(BodyRoot, "献祭2枚通行证碎片", "获得一张本职业能力卡，并激活祭坛", "ok", () =>
                { bool ok = runtime.TryActivateAltarWithFragments(out var reason); Act(ok, reason); });
                fragment.interactable = runtime.State.fragments >= 2;
                if (!receipt.altarItemSacrificed)
                {
                    EventOptButton.Create(BodyRoot, _selectItem ? "收起道具选择" : "献祭1张道具", "手选复原最多2张卡牌；此项不会激活祭坛", "", () => { _selectItem = !_selectItem; Rebuild(); });
                    if (_selectItem) foreach (var entry in runtime.State.ownedCards)
                    {
                        if (entry.safe == true || entry.stored || !string.IsNullOrEmpty(entry.pouchOf) || entry.card.type != "道具") continue;
                        string uid = entry.uid;
                        UIKit.Btn(BodyRoot, "献祭「" + entry.card.name + "」", () =>
                        { bool ok = runtime.TrySacrificeAltarItem(uid, out var reason); if (ok) _selectItem = false; Act(ok, reason); });
                    }
                }
            }
            UIKit.Btn(FootRoot, "整理背包", () => runtime.Bus.Emit(new BagOpened()));
            _return = UIKit.Btn(FootRoot, "返回地图", Close);
            _return.name = "altarRestoreReturn";
        }
    }
}
