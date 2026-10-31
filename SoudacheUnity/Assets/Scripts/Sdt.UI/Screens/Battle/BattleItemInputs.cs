using System;
using System.Linq;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Battle
{
    public partial class BattleScreen
    {
        string _itemTargetUid;
        void BuildBattleItems(BattleSnapshot snapshot, IBattleCommands commands)
        {
            if (snapshot.Items == null || !snapshot.Items.Any(item => item.uid == _itemTargetUid && item.usable)) _itemTargetUid = null;
            string signature = InputLocked(snapshot) + "|" + _itemTargetUid + "|" + (snapshot.Items == null ? "" : string.Join("|", snapshot.Items.Select(i => i.uid + i.usable + i.reason)));
            if (_itemSignature == signature) return; _itemSignature = signature; ClearRegion(_items);
            _items.gameObject.SetActive(snapshot.Items?.Count > 0 && snapshot.Infusing == null);
            var flow = Sdt.UI.Kit.UIKit.GetOrAdd<HorizontalLayoutGroup>(_items);
            flow.spacing = 8; flow.childAlignment = TextAnchor.MiddleLeft;
            flow.childControlWidth = flow.childControlHeight = true; flow.childForceExpandWidth = flow.childForceExpandHeight = false;
            if (snapshot.Items == null) return;
            foreach (var group in snapshot.Items.GroupBy(i => i.card.id))
            {
                var item = group.First(); string uid = item.uid;
                var button = BtBtn.Create(_items, "[[icon:flask]] " + item.card.name + (group.Count() > 1 ? " ×" + group.Count() : ""), () =>
                {
                    var current = GameSnapshotRef.Current; if (InputLocked(current)) return;
                    var live = current.Items?.FirstOrDefault(i => i.uid == uid); if (live == null) return;
                    BattleItemConfirmScreen.Open(live, () =>
                    {
                        var now = GameSnapshotRef.Current; if (InputLocked(now)) return;
                        _skillTargeting = false;
                        if (live.targetSide == "enemy") { _itemTargetUid = live.uid; BuildStage(now); }
                        else { var result = commands.UseItem(live.uid); if (!result.Ok) RunLog.Log(result.Reason, "warn"); }
                    });
                }, "ghost", !InputLocked(snapshot));
                var size = button.GetComponent<LayoutElement>(); size.minWidth = 150; size.preferredWidth = Mathf.Max(150, item.card.name.Length * 20 + 60); size.minHeight = size.preferredHeight = 48;
                if (!item.usable) button.gameObject.AddComponent<CanvasGroup>().alpha = .5f;
                button.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout(item.card.name, item.reason ?? Sdt.Res.CurrentCardPresentation.Description(item.card,CardFace.BattleDescription(GameSnapshotRef.Current,item.uid))));
            }
        }
    }
    public sealed class BattleItemConfirmScreen : Panel
    {
        BattleItemSnapshot _item; Action _use;
        public static void Open(BattleItemSnapshot item, Action use)
        {
            var page = ScreenMount.Show<BattleItemConfirmScreen>("BattlePotionUse"); page._item = item; page._use = use; page.Build();
        }
        public override void Build()
        {
            var card = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, _item.card.name);
            UIKit.Label(card.transform, Sdt.Res.CurrentCardPresentation.Description(_item.card,CardFace.BattleDescription(GameSnapshotRef.Current,_item.uid)), 24, Theme.Txt);
            if (!string.IsNullOrEmpty(_item.reason)) UIKit.Label(card.transform, _item.reason, 20, Theme.Sub);
            var use = BtBtn.Create(card.transform, _item.targetSide == "enemy" ? "使用并选择目标" : "使用", () => { var callback = _use; Close(); callback?.Invoke(); }, "ok");
            use.interactable = _item.usable;
            BtBtn.Create(card.transform, "取消", Close, "ghost");
        }
    }
}
