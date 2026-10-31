using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    /// <summary>祭坛激活与紧急撤离复用同一献祭选择，最终费用由领域命令复检。</summary>
    public sealed class CardSacrificeScreen : NodeShellPanel
    {
        readonly HashSet<string> _selected = new HashSet<string>();
        bool _emergency;
        string _error;

        public static void Open(bool emergency)
        {
            var screen = ScreenMount.Show<CardSacrificeScreen>("CardSacrifice");
            screen._emergency = emergency;
            screen.Tone = emergency ? "exit" : "altar";
            screen.TitleIcon = emergency ? "[[icon:runner]]" : "[[icon:crystal]]";
            screen.Title = emergency ? "紧急撤离" : "激活祭坛";
            screen.Build();
        }

        protected override void OnPrepare() => Sub = "选择 3 张随身卡牌献祭（安全格中的卡牌不参与）；已选 " + _selected.Count + "/3";

        protected override void OnBody()
        {
            var runtime = GameRuntime.I;
            if (!string.IsNullOrEmpty(_error)) UIKit.Label(BodyRoot, _error, 16, UiPalette.Warn);
            foreach (var entry in runtime.State.ownedCards)
            {
                if (entry.safe == true || entry.stored || !string.IsNullOrEmpty(entry.pouchOf)) continue;
                string uid = entry.uid;
                bool selected = _selected.Contains(uid);
                var button = UIKit.Btn(BodyRoot, (selected ? "[已选] " : "[选择] ") + entry.card.name, () =>
                {
                    if (!_selected.Remove(uid) && _selected.Count < 3) _selected.Add(uid);
                    _error = null;
                    Rebuild();
                });
                button.GetComponent<LayoutElement>().minHeight = 38;
            }
            var confirm = UIKit.BtnOk(FootRoot, _emergency ? "确认献祭并撤离" : "确认献祭并激活", () =>
            {
                string reason;
                bool success = _emergency ? runtime.TryEmergencyExtract(_selected, out reason)
                    : runtime.TryActivateAltar(_selected, out reason);
                if (!success) { _error = reason; Rebuild(); return; }
                Close();
                if (!_emergency) AltarRitualScreen.Open();
            });
            confirm.interactable = _selected.Count == 3;
            UIKit.Btn(FootRoot, "取消", Close);
        }
    }
}
