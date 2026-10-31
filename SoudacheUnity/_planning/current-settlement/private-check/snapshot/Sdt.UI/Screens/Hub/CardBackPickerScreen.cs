using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Hub
{
    public sealed class CardBackPickerScreen : Panel
    {
        public override void Build()
        {
            var root = UIKit.Panel("CardBackPicker", transform); root.AddComponent<Image>().color = Theme.Bg;
            var layout = root.AddComponent<VerticalLayoutGroup>(); layout.spacing = 12;
            layout.padding = new RectOffset(30, 30, 24, 24);
            layout.childControlWidth = true; layout.childControlHeight = true;
            layout.childForceExpandWidth = true; layout.childForceExpandHeight = false;
            UIKit.Label(root.transform, "卡背图鉴", 26, Theme.Txt);
            var scroll = UIKit.Scroll(root.transform);
            foreach (var definition in CardLibrary.CardBacks)
            {
                var back = definition;
                bool unlocked = GameRuntime.I.Base.IsBackUnlocked(back.id);
                var row = UIKit.Row(scroll.transform);
                var rowLayout = row.AddComponent<HorizontalLayoutGroup>(); rowLayout.spacing = 18;
                rowLayout.childControlWidth = true; rowLayout.childControlHeight = true;
                rowLayout.childForceExpandWidth = false; rowLayout.childForceExpandHeight = false;
                var image = UIKit.Image(row.transform, Sdt.Res.Res.CardBack(back.id)); image.preserveAspect = true;
                var imageLayout = image.gameObject.AddComponent<LayoutElement>(); imageLayout.preferredWidth = 85; imageLayout.preferredHeight = 125;
                UIKit.Label(row.transform, back.name + " · " + back.from, 17, Theme.Sub);
                bool equipped = GameRuntime.I.Base.BackSel == back.id;
                var choose = UIKit.Btn(row.transform, equipped ? "已应用" : unlocked ? "应用" : "尚未解锁", () =>
                {
                    if (!GameRuntime.I.TryPersistMutation(() =>
                    {
                        if (!GameRuntime.I.Base.SetBack(back.id)) throw new System.InvalidOperationException("该卡背尚未解锁");
                    }, out var reason)) { GameRuntime.I.Bus.Emit(new ToastRequested(reason)); return; }
                    Rebuild();
                });
                choose.interactable = unlocked && !equipped;
            }
            UIKit.Btn(root.transform, "返回", Close);
        }
    }
}
