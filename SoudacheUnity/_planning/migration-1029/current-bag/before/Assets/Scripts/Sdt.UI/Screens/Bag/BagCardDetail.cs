// ported from src/game.bag.js showBagCardDetail()/showDiscardConfirm()/discardOwnedCard()/useOwnedCard()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//【卡牌详情 overlay】
//   .bag-card-detail > 卡面(lg) + p.ov-note（名 · 类型 · 稀有度 · 位于安全格?）
//   .ov-btns → 使用这张道具(ok，仅背包内道具) / 移入安全格 / 移回背包 / 丢弃 1 张(danger) / 返回背包
//   （初始攻击：无「移入安全格」「丢弃」，有 [[icon:pen]] 保护）
//【丢弃确认 overlay】
//   p.ov-note = 你把【名】拖到了背包外。确认后将永久丢弃 1 张，无法从消耗口袋或墓地取回。
//   .ov-btns → 确认丢弃(danger) / 取消，放回背包
// Item effects use current structured bag rules through BagItemCommands.
using System;
using Sdt.Run;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;

namespace Sdt.UI.Screens.Bag
{
    /// <summary>背包卡牌详情 + 丢弃确认。</summary>
    public class BagCardDetail : Panel
    {
        string _name; bool _fromSafe; bool _confirmMode;

        public static void Show(string name, bool fromSafe)
        {
            var st = GameRuntime.I.State;
            var o = st.ownedCards.FirstOrDefault(x => (x.safe == true) == fromSafe && !x.stored && x.card.name == name);
            if (o == null) { BagScreen.Refresh(); return; }
            var s = ScreenMount.Show<BagCardDetail>("BagCardDetail");
            s._name = name; s._fromSafe = fromSafe; s._confirmMode = false;
            s.Build();
        }

        public static void ShowDiscardConfirm(string name, bool fromSafe)
        {
            var s = ScreenMount.Show<BagCardDetail>("DiscardConfirm");
            s._name = name; s._fromSafe = fromSafe; s._confirmMode = true;
            s.Build();
        }

        public override void Build()
        {
            var root = UIKit.Panel("detail", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.9f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 12; vl.padding = new RectOffset(80, 80, 60, 60);
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            if (_confirmMode)
            {
                var title = UIKit.IconText(root.transform, "[[icon:question]] 丢弃卡牌？");
                title.fontSize = 26; title.fontStyle = FontStyle.Bold; title.color = Color.white;
                var note = UIKit.Label(root.transform, "你把【<b>" + _name + "</b>】拖到了背包外。确认后将永久丢弃 1 张，无法从消耗口袋或墓地取回。", 16, UiPalette.Hex("#D8E4EC"));
                note.alignment = TextAnchor.MiddleCenter;
                var cBtns = UiExt.Row(root.transform);
                var cHl = cBtns.AddComponent<HorizontalLayoutGroup>();
                cHl.spacing = 12; cHl.childAlignment = TextAnchor.MiddleCenter;
                UIKit.Btn(cBtns.transform, "确认丢弃", () => { DiscardOwnedCard(_name, _fromSafe); Close(); });
                UIKit.Btn(cBtns.transform, "取消，放回背包", () => { Close(); BagScreen.Refresh(); });
                return;
            }

            var st = GameRuntime.I.State;
            var o = st.ownedCards.FirstOrDefault(x => (x.safe == true) == _fromSafe && !x.stored && x.card.name == _name);
            if (o == null) { Close(); BagScreen.Refresh(); return; }
            bool usable = !_fromSafe && o.card.type == "道具";
            bool isSha = o.card.id == CardLibrary.SHA.id;

            UIKit.IconText(root.transform, "[[icon:cards]] 卡牌详情").fontSize = 22;
            var wrap = new GameObject("bag-card-detail", typeof(RectTransform));
            wrap.transform.SetParent(root.transform, false);
            var wvl = wrap.AddComponent<VerticalLayoutGroup>();
            wvl.spacing = 8; wvl.childAlignment = TextAnchor.UpperCenter;
            wvl.childForceExpandWidth = false; wvl.childForceExpandHeight = false;
            wvl.childControlWidth = true; wvl.childControlHeight = true;
            var leW = wrap.AddComponent<LayoutElement>(); leW.minHeight = 340; leW.flexibleHeight = 1;
            CardFace.Create(o.card, CardSize.Lg, wrap.transform);
            UIKit.Label(wrap.transform, o.card.name + " · " + o.card.type + " · " + (o.card.rarity ?? "") + (_fromSafe ? " · 位于安全格" : ""), 15, UiPalette.Dim)
                .alignment = TextAnchor.MiddleCenter;

            var btns = UiExt.Row(root.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 10; hl.childAlignment = TextAnchor.MiddleCenter;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            if (usable) UIKit.Btn(btns.transform, "使用这张道具", () => { Close(); UseOwnedCard(o.uid); });
            if (o.card.id == "tt-token-gold" || o.card.id == "tt-token-color")
            {
                string recipe = o.card.id == "tt-token-gold" ? "gold" : "fragments";
                string label = recipe == "gold" ? "合成通行证A · 3张B" : "合成本职业通行证 · 2碎片（现有 " + st.fragments + "）";
                UIKit.Btn(btns.transform, label, () =>
                {
                    if (!BagItemCommands.TryCraftTokens(GameRuntime.I, recipe, out var reason)) { RunLog.Log(reason, "warn"); return; }
                    Close(); AudioService.I.PlaySfx("ding"); BagScreen.Refresh();
                });
            }
            if (_fromSafe) UIKit.Btn(btns.transform, "移回背包", () => { Close(); BagScreen.MoveStackSafe(_name, false); });
            else if (!isSha) UIKit.Btn(btns.transform, "移入安全格", () => { Close(); BagScreen.MoveStackSafe(_name, true); });
            if (!isSha) UIKit.Btn(btns.transform, "丢弃 1 张", () => { Close(); ShowDiscardConfirm(_name, _fromSafe); });
            UIKit.Btn(btns.transform, "返回背包", () => { Close(); BagScreen.Refresh(); });
        }

        /// <summary>discardOwnedCard：初始牌不可丢弃；丢弃 1 张（无法取回，warn 日志照抄）。</summary>
        public static bool DiscardOwnedCard(string name, bool fromSafe)
        {
            var runtime = GameRuntime.I;
            var entry = runtime.State.ownedCards.FirstOrDefault(card => (card.safe == true) == fromSafe && !card.stored && string.IsNullOrEmpty(card.pouchOf) && card.card.name == name);
            if (entry == null) return false;
            bool success = CardContainerCommands.TryDiscard(runtime, entry.uid, out var reason);
            if (!success) RunLog.Log(reason, "warn");
            BagScreen.Refresh(); return success;
        }

        /// <summary>Map item use shares the structured rules and atomic commands.</summary>
        public static void UseOwnedCard(string uid)
        {
            var runtime = GameRuntime.I;
            if (BagItemCommands.NeedsDiscovery(runtime, uid)) { BagItemDiscoveryScreen.Open(uid); return; }
            if (!BagItemCommands.TryUse(runtime, uid, out var reason)) RunLog.Log(reason, "warn");
            else { AudioService.I.PlaySfx("ding"); RunLog.Log("道具已使用", "ok"); }
            BagScreen.Refresh();
        }
    }
}
