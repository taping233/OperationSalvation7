using System;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    public sealed class AltarRitualScreen : NodeShellPanel
    {
        bool _selectItem;
        string _error;
        public static void Open()
        {
            var page = ScreenMount.Show<AltarRitualScreen>("AltarRitual");
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
        protected override void OnBody()
        {
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
                    int index = i; var stack = runtime.State.usedPocket[i];
                    if (stack.card == null || stack.count <= 0 || stack.card.type == "装备" || stack.card.type == "道具") continue;
                    UIKit.Btn(BodyRoot, "复原「" + stack.card.name + "」 · 消耗区×" + stack.count, () =>
                    { bool ok = runtime.TryAltarRestore(index, out var reason); Act(ok, reason); });
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
            UIKit.Btn(FootRoot, "返回地图", Close);
        }
    }
}
