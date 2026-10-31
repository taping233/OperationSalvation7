using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattleHoverInfo : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, ISelectHandler, IDeselectHandler
    {
        Action _show;
        public void Setup(Action show) { _show = show; }
        public void OnPointerEnter(PointerEventData e) { _show?.Invoke(); }
        public void OnPointerExit(PointerEventData e) { BattleReadout.Hide(); }
        public void OnSelect(BaseEventData e) { _show?.Invoke(); }
        public void OnDeselect(BaseEventData e) { BattleReadout.Hide(); }
        void OnDisable() { BattleReadout.Hide(); }
    }
    public static class BattleReadout
    {
        static GameObject _root;
        public static void Hide() { if (_root != null) { _root.SetActive(false); UnityEngine.Object.Destroy(_root); _root = null; } }
        public static void Show(Transform parent, string title, string detail)
        {
            Hide(); var rt = BattleScreen.BattleRect("battle-tooltip", parent); _root = rt.gameObject;
            BattleScreen.Fixed(rt, new Vector2(0, 1), new Vector2(0, 1), new Vector2(56, -230), new Vector2(400, 180));
            _root.AddComponent<Image>().color = BtColors.HexA("#10232B", .97f);
            var layout = _root.AddComponent<VerticalLayoutGroup>(); layout.padding = new RectOffset(16,16,12,12); layout.spacing = 8;
            layout.childForceExpandHeight = false; layout.childControlWidth = layout.childControlHeight = true;
            UIKit.Label(rt, title ?? "", 22, BtColors.Hex("#F0E0B8")).raycastTarget = false;
            UIKit.Label(rt, detail ?? "", 20, BtColors.Hex("#D5E1E3")).raycastTarget = false;
            _root.GetComponent<Image>().raycastTarget = false;
        }
    }
    public sealed class BattlePileScreen : Panel
    {
        string _title; IReadOnlyList<string> _uids;
        public static void Open(string title, IReadOnlyList<string> uids)
        {
            var page = ScreenMount.Show<BattlePileScreen>("BattlePile"); page._title = title; page._uids = uids; page.Build();
        }
        public override void Build()
        {
            var root = BattleScreen.BattleRect("battle-decision pile", transform);
            root.anchorMin = new Vector2(.03f,.03f); root.anchorMax = new Vector2(.97f,.97f); root.offsetMin = root.offsetMax = Vector2.zero;
            root.gameObject.AddComponent<Image>().color = BtColors.Hex("#10232B");
            var title = UIKit.Label(root, _title + " · " + _uids.Count, 34, BtColors.Hex("#F0E0B8"));
            BattleScreen.Fixed(title.rectTransform, new Vector2(0,1), new Vector2(0,1), new Vector2(24,-16), new Vector2(1200,64));
            var body = BattleScreen.BattleRect("battle-decision-content", root);
            body.anchorMin = new Vector2(0,0); body.anchorMax = Vector2.one; body.offsetMin = new Vector2(24,108); body.offsetMax = new Vector2(-24,-88);
            var scroll = UIKit.Scroll(body);
            var oldFlow = scroll.GetComponent<VerticalLayoutGroup>(); if (oldFlow != null) { oldFlow.enabled = false; Destroy(oldFlow); }
            var grid = scroll.gameObject.AddComponent<GridLayoutGroup>(); grid.cellSize = new Vector2(320,480); grid.spacing = new Vector2(20,24);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = Mathf.Max(1, Mathf.FloorToInt((((RectTransform)transform).rect.width * .94f - 48) / 340));
            foreach (string uid in _uids)
            {
                var entry = BattleView.Api.FindCard(uid); if (entry == null) continue;
                var face = CardFace.Create(entry.Card, CardSize.Xl, scroll.transform, options:new CardFaceOptions { HideCost=false, ScrollDescription=true, CostOverride=BattleView.Api.EffCostOf(entry.Card), DescriptionContext=CardFace.BattleDescription(GameSnapshotRef.Current,uid) });
                var paper = face.transform.Find("paper-card") as RectTransform; if (paper != null) { paper.sizeDelta = new Vector2(320,480); }
            }
            if (_uids.Count == 0) UIKit.Label(scroll.transform, "这里还没有卡牌", 24, BtColors.Silver);
            var back = BtBtn.Create(root, "返回战斗", Close, "ok");
            BattleScreen.Fixed((RectTransform)back.transform, new Vector2(.5f,0), new Vector2(.5f,0), new Vector2(0,20), new Vector2(300,64));
        }
    }
    public sealed class BattleLogScreen : Panel
    {
        IReadOnlyList<string> _entries;
        public static void Open(IReadOnlyList<string> entries)
        { var page = ScreenMount.Show<BattleLogScreen>("BattleLog"); page._entries = new List<string>(entries); page.Build(); }
        public override void Build()
        {
            var root = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, "战斗日志", wide:true);
            var scroll = UIKit.Scroll(root.transform);
            foreach (string entry in _entries) { var copy = UIKit.IconText(scroll.transform, entry); copy.fontSize = 20; CurrentReadingPreference.Bind(copy); }
            if (_entries.Count == 0) UIKit.Label(scroll.transform, "还没有战斗记录", 24, Theme.Sub);
            BtBtn.Create(root.transform, "返回战斗", Close, "ok");
        }
    }
}
