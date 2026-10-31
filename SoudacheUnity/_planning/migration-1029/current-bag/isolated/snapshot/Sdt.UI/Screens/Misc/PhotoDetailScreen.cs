using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>照相馆放大照片、连续浏览和人工备注；备注与底稿分别保存。</summary>
    public sealed class PhotoDetailScreen : Panel
    {
        List<CardDef> _cards;
        int _index;
        InputField _noteInput;
        string _originalNote;
        public static void Open(List<CardDef> cards, string id)
        {
            var screen = ScreenMountPhoto();
            screen._cards = cards; screen._index = Mathf.Max(0, cards.FindIndex(card => card.id == id));
            screen.Build();
        }
        static PhotoDetailScreen ScreenMountPhoto()
        {
            var go = new GameObject("PhotoDetail", typeof(RectTransform));
            var screen = go.AddComponent<PhotoDetailScreen>(); UiStack.Push(screen); UiStack.Stretch((RectTransform)screen.transform); return screen;
        }
        public override void Build()
        {
            if (_cards == null || _cards.Count == 0) return;
            var card = _cards[_index];
            var root = UIKit.Panel("Photo", transform); root.AddComponent<Image>().color = Theme.Bg;
            var row = root.AddComponent<HorizontalLayoutGroup>(); row.spacing = 24; row.padding = new RectOffset(35, 35, 35, 35);
            var picture = UIKit.Image(root.transform, Sdt.Res.Res.CardIllustration(card.id, card.art, card.type, card.name));
            picture.preserveAspect = true;
            picture.gameObject.AddComponent<LayoutElement>().flexibleWidth = 2;
            var side = UIKit.Column(root.transform); side.AddComponent<VerticalLayoutGroup>().spacing = 12;
            side.AddComponent<LayoutElement>().flexibleWidth = 1;
            UIKit.Label(side.transform, card.name, 26, Theme.Txt);
            UIKit.Label(side.transform, card.type + " · " + card.rarity + " · " + (_index + 1) + "/" + _cards.Count, 16, Theme.Sub);
            _originalNote = GameRuntime.I.Base.PhotoNote(card.id);
            var note = InputArea(side.transform, _originalNote);
            _noteInput = note;
            UIKit.Btn(side.transform, "保存备注", () =>
            {
                bool ok = GameRuntime.I.Base.TrySavePhotoNote(card.id, note.text, out var reason);
                GameRuntime.I.Bus.Emit(new ToastRequested(ok ? "照片备注已保存" : reason));
            });
            UIKit.Label(side.transform, "清空手写备注后恢复已收录底稿；最多240字", 14, Theme.Sub);
            UIKit.Btn(side.transform, "上一张", () => Navigate(-1));
            UIKit.Btn(side.transform, "下一张", () => Navigate(1));
            UIKit.Btn(side.transform, "返回照相馆", ClosePhoto);
        }
        bool SavePending()
        {
            if (_noteInput == null || _noteInput.text == _originalNote) return true;
            if (!GameRuntime.I.Base.TrySavePhotoNote(_cards[_index].id, _noteInput.text, out var reason))
            { GameRuntime.I.Bus.Emit(new ToastRequested(reason)); return false; }
            _originalNote = _noteInput.text;
            return true;
        }
        void Navigate(int direction) { if (!SavePending()) return; _index = (_index + direction + _cards.Count) % _cards.Count; Rebuild(); }
        void ClosePhoto() { if (SavePending()) Close(); }
        public override void CloseFromEscape() => ClosePhoto();
        static InputField InputArea(Transform parent, string text)
        {
            var go = new GameObject("PhotoNote", typeof(RectTransform), typeof(Image), typeof(InputField));
            go.transform.SetParent(parent, false); go.GetComponent<Image>().color = Theme.Inset;
            var layout = go.AddComponent<LayoutElement>(); layout.preferredHeight = 210; layout.flexibleWidth = 1;
            var label = UIKit.Label(go.transform, "", 18, Theme.Txt); UiStack.Stretch(label.rectTransform);
            label.rectTransform.offsetMin = new Vector2(12, 10); label.rectTransform.offsetMax = new Vector2(-12, -10);
            var input = go.GetComponent<InputField>(); input.textComponent = label; input.lineType = InputField.LineType.MultiLineNewline;
            input.characterLimit = 240; input.text = text ?? "";
            return input;
        }
    }
}
