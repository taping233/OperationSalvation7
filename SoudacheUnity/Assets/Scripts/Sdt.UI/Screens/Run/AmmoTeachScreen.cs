using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed class AmmoTeachScreen : Panel
    {
        public override bool CanCloseWithEscape => false;
        public static void Open() => UiStack.Show<AmmoTeachScreen>("AmmoTeach");
        internal override void OnClose()
        {
            var runtime = GameRuntime.I;
            if (runtime.State.runActive && !runtime.State.battleActive) runtime.State.Phase = "idle";
        }
        public override void Build()
        {
            var root = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, "卡牌是消耗品", wide: true);
            var scroll = UIKit.Scroll(root.transform);
            CardFlow(scroll.transform, CardLibrary.FindById("tt3sp-silverthorn") ?? CardLibrary.SHA,
                "➜ 消耗区", "所有用过的牌都进消耗区，复原后可以再用。");
            CardFlow(scroll.transform, CardLibrary.FindById(CardLibrary.SHA.id) ?? CardLibrary.SHA,
                "➜ 复原回背包", "复原回背包，就能再用。具体方法在背包查看。");
            UIKit.IconText(scroll.transform, "[[icon:archive]] 多开箱 · [[icon:bag]] 常逛商店").fontSize = 23;
            UIKit.Label(scroll.transform, "牌快用完时，去搜刮点或商店补牌。", 19, Theme.Sub);
            UIKit.BtnOk(root.transform, "知道了", Close);
        }
        static void CardFlow(Transform parent, CardDef card, string destination, string explanation)
        {
            var row = UIKit.Row(parent);
            var layout = row.AddComponent<HorizontalLayoutGroup>(); layout.spacing = 24;
            layout.childControlWidth = true; layout.childControlHeight = true;
            layout.childForceExpandWidth = false; layout.childForceExpandHeight = false;
            CardFace.Create(card, CardSize.Sm, row.transform);
            var text = UIKit.Column(row.transform);
            var column = text.AddComponent<VerticalLayoutGroup>(); column.spacing = 12;
            column.childControlWidth = true; column.childControlHeight = true;
            column.childForceExpandWidth = true; column.childForceExpandHeight = false;
            text.AddComponent<LayoutElement>().flexibleWidth = 1;
            UIKit.Label(text.transform, destination, 25, Theme.Txt);
            UIKit.Label(text.transform, explanation, 18, Theme.Sub);
        }
    }
}
