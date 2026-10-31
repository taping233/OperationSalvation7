using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.Core;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Hub
{
    public sealed class CharacterAppearanceScreen : Panel
    {
        string _character, _preview;
        public static void Open(string characterId)
        {
            var screen = UiStack.Show<CharacterAppearanceScreen>("Appearance");
            screen._character = characterId;
            screen._preview = GameRuntime.I.Base.SelectedSkin(characterId);
            screen.Rebuild();
        }
        public override void Build()
        {
            if (_character == null) return;
            var root = UIKit.Panel("Appearance", transform);
            root.AddComponent<Image>().color = Theme.Bg;
            var layout = root.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = 24; layout.padding = new RectOffset(40, 40, 40, 40);
            var figure = UIKit.Image(root.transform, Sdt.Res.Res.SkinPortrait(_character, _preview));
            figure.preserveAspect = true;
            var figureLayout = figure.gameObject.AddComponent<LayoutElement>(); figureLayout.flexibleWidth = 2; figureLayout.flexibleHeight = 1;
            var side = UIKit.Column(root.transform);
            side.AddComponent<VerticalLayoutGroup>().spacing = 15;
            side.AddComponent<LayoutElement>().flexibleWidth = 1;
            UIKit.Label(side.transform, CharacterTable.Name(_character) + " · 外观", 28, Theme.Txt);
            AddOption(side.transform, "default", "默认外观");
            foreach (var skin in HubCatalog.Current.skins.Where(option => option.characterId == _character)) AddOption(side.transform, skin.id, skin.name);
            var apply = UIKit.BtnOk(side.transform, "应用外观", () =>
            {
                bool ok = GameRuntime.I.Base.TrySelectSkin(_character, _preview, out var reason);
                GameRuntime.I.Bus.Emit(new ToastRequested(ok ? "外观已应用" : reason));
                if (ok) Rebuild();
            });
            apply.interactable = _preview != GameRuntime.I.Base.SelectedSkin(_character);
            UIKit.Btn(side.transform, "返回人物", Close);
        }
        void AddOption(Transform parent, string id, string name)
        {
            bool equipped = GameRuntime.I.Base.SelectedSkin(_character) == id;
            UIKit.Btn(parent, (_preview == id ? "[预览] " : "") + name + (equipped ? " · 已应用" : ""), () => { _preview = id; Rebuild(); });
        }
    }
}
