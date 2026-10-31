using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Bag
{
    public sealed class ContainerScreen : Panel
    {
        string _kind;
        public static void Open(string kind)
        {
            var screen = ScreenMount.Show<ContainerScreen>("CardContainer"); screen._kind = kind; screen.Build();
        }
        public override void Build()
        {
            if (_kind == null) return;
            var runtime = GameRuntime.I;
            var stored = CardContainerCommands.StoredCards(runtime, _kind);
            var root = UIKit.Panel("Container", transform); root.AddComponent<Image>().color = Theme.Bg;
            var layout = root.AddComponent<VerticalLayoutGroup>(); layout.spacing = 12; layout.padding = new RectOffset(40, 40, 30, 30);
            UIKit.Label(root.transform, (_kind == "pouch" ? "锦囊" : "珍珠盒") + " · " + stored.Count + "/" + CardContainerCommands.Capacity(runtime, _kind), 25, Theme.Txt);
            var scroll = UIKit.Scroll(root.transform);
            UIKit.Label(scroll.transform, "已存入", 20, Theme.Sub);
            foreach (var group in stored.GroupBy(entry => entry.card.name))
            {
                string name = group.Key;
                UIKit.Btn(scroll.transform, "取出 " + name + " ×" + group.Count(), () => Transfer(true, name, null));
            }
            UIKit.Label(scroll.transform, "可存入的随身卡牌", 20, Theme.Sub);
            foreach (var stack in BagScreen.CardStacks(runtime.State, false).Where(item => item.card.type == (_kind == "pouch" ? "法术" : "资源")))
            {
                string name = stack.card.name; var ids = stack.uids.ToArray();
                UIKit.Btn(scroll.transform, "存入 " + name + " ×" + stack.count, () => Transfer(false, name, ids));
            }
            UIKit.Btn(root.transform, "返回背包", Close);
        }
        void Transfer(bool take, string name, string[] source)
        {
            if (!CardContainerCommands.TryTransferStack(GameRuntime.I, _kind, take, name, out var reason, source))
                GameRuntime.I.Bus.Emit(new ToastRequested(reason));
            BagScreen.Refresh(); Rebuild();
        }
    }
}
