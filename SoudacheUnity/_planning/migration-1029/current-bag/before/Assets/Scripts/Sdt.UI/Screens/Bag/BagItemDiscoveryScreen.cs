using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Bag
{
    public sealed class BagItemDiscoveryScreen : Panel
    {
        string _uid, _reason;
        List<CardDef> _candidates;
        public static void Open(string uid)
        {
            var screen = ScreenMount.Show<BagItemDiscoveryScreen>("BagDiscovery");
            screen._uid = uid;
            screen.Prepare();
        }
        void Prepare()
        {
            BagItemCommands.TryPrepareDiscovery(GameRuntime.I, _uid, out _candidates, out _reason);
            Rebuild();
        }
        public override void Build()
        {
            var root = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, "选择发现的卡牌", wide: true);
            UIKit.Label(root.transform, "选择成功后才消耗道具；候选会保留，整理背包后可继续选择。", 16, Theme.Sub);
            if (!string.IsNullOrEmpty(_reason)) UIKit.Label(root.transform, _reason, 16, UiPalette.Warn);
            if (_candidates == null) UIKit.BtnOk(root.transform, "重试", Prepare);
            else
            {
                var scroll = UIKit.Scroll(root.transform);
                foreach (var candidate in _candidates)
                {
                    var card = candidate;
                    var row = UIKit.Row(scroll.transform);
                    var layout = row.AddComponent<HorizontalLayoutGroup>(); layout.spacing = 14;
                    layout.childControlWidth = true; layout.childControlHeight = true;
                    layout.childForceExpandWidth = false; layout.childForceExpandHeight = false;
                    CardFace.Create(card, CardSize.Md, row.transform);
                    UIKit.BtnOk(row.transform, "选择「" + card.name + "」", () =>
                    {
                        if (!BagItemCommands.TryChooseDiscovery(GameRuntime.I, _uid, card.id, out _reason)) { Rebuild(); return; }
                        AudioService.I.PlaySfx("ding"); Close(); BagScreen.Refresh();
                    });
                }
            }
            UIKit.Btn(root.transform, "返回背包", Close);
        }
    }
}
