// Local projection primitives for roster-departure-v2.css and departure-selected.css.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    internal static class DepartureElements
    {
        internal static readonly Color Ink = Theme.Hex("#EDF5F4"), Muted = Theme.Hex("#BFD0D0"), Accent = Theme.Hex("#ACD6CE");
        static Sprite _round;
        static Sprite Rounded
        {
            get
            {
                if (_round != null) return _round;
                const int side = 64; const float radius = 16;
                var tex = new Texture2D(side, side, TextureFormat.RGBA32, false) { name = "departure-css-radius", wrapMode = TextureWrapMode.Clamp };
                for (int y = 0; y < side; y++) for (int x = 0; x < side; x++)
                {
                    float dx = Mathf.Max(0, Mathf.Abs(x - 31.5f) - 16), dy = Mathf.Max(0, Mathf.Abs(y - 31.5f) - 16);
                    tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(radius - Mathf.Sqrt(dx * dx + dy * dy))));
                }
                tex.Apply(); return _round = Sprite.Create(tex, new Rect(0, 0, side, side), Vector2.one * .5f, 100, 0, SpriteMeshType.FullRect, new Vector4(18, 18, 18, 18));
            }
        }
        internal static RectTransform Area(Transform parent, string name, Vector2 min, Vector2 max, Vector2? low = null, Vector2? high = null)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>(); rect.SetParent(parent, false);
            Place(rect, min, max, low ?? Vector2.zero, high ?? Vector2.zero); return rect;
        }
        internal static void Place(RectTransform rect, Vector2 min, Vector2 max, Vector2 low, Vector2 high)
        { rect.anchorMin = min; rect.anchorMax = max; rect.offsetMin = low; rect.offsetMax = high; }
        internal static Image Surface(Transform parent, Color color, bool rounded = false, bool glass = false, float radius = 16)
        {
            var image = Sdt.UI.Kit.UIKit.GetOrAdd<Image>(parent); image.color = color;
            if (rounded) { image.sprite = Rounded; image.type = Image.Type.Sliced; image.pixelsPerUnitMultiplier = 16f / Mathf.Max(1, radius); }
            if (glass) Sdt.UI.Screens.Hub.HubCurrentGlass.Apply(image);
            return image;
        }
        internal static void Line(Transform parent, Color color)
        { var line = Area(parent, "css-border", new Vector2(0, 0), new Vector2(1, 0), Vector2.zero, new Vector2(0, 1)); Surface(line, color).raycastTarget = false; }
        internal static Text Copy(Transform parent, string text, int size, Color? color = null, float height = 0)
        {
            var label = UIKit.Label(parent, text, size, color ?? Ink); label.alignment = TextAnchor.UpperLeft;
            var le = label.gameObject.AddComponent<LayoutElement>(); le.minHeight = height > 0 ? height : size * 1.5f; le.preferredHeight = height > 0 ? height : -1; le.flexibleWidth = 1; return label;
        }
        internal static Text TextAt(Transform parent, string text, int size, Vector2 min, Vector2 max, Vector2 low, Vector2 high, Color? color = null)
        { var label = UIKit.Label(parent, text, size, color ?? Ink); Place(label.rectTransform, min, max, low, high); label.alignment = TextAnchor.MiddleLeft; return label; }
        internal static Button Command(Transform parent, string name, string caption, Action clicked, Color? background = null, Color? ink = null, int size = 19)
        {
            var button = UIKit.Btn(parent, caption, clicked); button.name = name;
            Surface(button.transform, background ?? Theme.HexA("#102D3A", .5f), true, false, 8);
            foreach (var text in button.GetComponentsInChildren<Text>()) { text.fontSize = size; text.color = ink ?? Ink; }
            var border = button.GetComponent<Outline>(); if (border != null) border.effectColor = Theme.HexA("#BDD8DC", .36f);
            return button;
        }
        internal static Button CommandAt(Transform parent, string name, string caption, Action clicked, Vector2 min, Vector2 max, Vector2 low, Vector2 high, Color? background = null, Color? ink = null, int size = 19)
        { var b = Command(parent, name, caption, clicked, background, ink, size); Place((RectTransform)b.transform, min, max, low, high); return b; }
        internal static Transform Flow(Transform parent, string name, bool horizontal, float gap = 12, RectOffset padding = null)
        {
            var rect = Area(parent, name, Vector2.zero, Vector2.one);
            var group = horizontal ? (HorizontalOrVerticalLayoutGroup)rect.gameObject.AddComponent<HorizontalLayoutGroup>() : rect.gameObject.AddComponent<VerticalLayoutGroup>();
            group.spacing = gap; group.padding = padding ?? new RectOffset(); group.childControlWidth = group.childControlHeight = true;
            group.childForceExpandWidth = true; group.childForceExpandHeight = false; return rect;
        }
        internal static Transform Scroll(Transform parent, string name, Vector2 min, Vector2 max, Vector2 low, Vector2 high)
        {
            var content = UIKit.Scroll(parent); content.transform.parent.name = name;
            Place((RectTransform)content.transform.parent, min, max, low, high); return content.transform;
        }
        internal static GridLayoutGroup Grid(Transform content, float width = 240, float height = 400, int fixedColumns = 0)
        {
            UnityEngine.Object.DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());
            var grid = content.gameObject.AddComponent<GridLayoutGroup>(); grid.padding = new RectOffset(12, 12, 14, 26); grid.spacing = new Vector2(16, 22); grid.childAlignment = TextAnchor.UpperLeft;
            grid.cellSize = new Vector2(width, height); grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = Math.Max(1, fixedColumns);
            var responsive = content.gameObject.AddComponent<DepartureGrid>(); responsive.MinimumWidth = width; responsive.FixedColumns = fixedColumns; return grid;
        }
        internal static RectTransform Card(Transform parent, CardDef card, float width, string name = "dep-card-face")
        {
            var host = Area(parent, name, new Vector2(.5f, 1), new Vector2(.5f, 1)); host.pivot = new Vector2(.5f, 1); host.sizeDelta = new Vector2(width, width * 1.5f);
            var face = CardFace.Create(card, CardSize.Xl, host); var rect = (RectTransform)face.transform;
            face.GetComponent<LayoutElement>().ignoreLayout = true; rect.anchorMin = rect.anchorMax = Vector2.one * .5f; rect.anchoredPosition = Vector2.zero;
            rect.localScale = Vector3.one * width / (392f * 2f / 3f); return host;
        }
        internal static void Cover(Image image, Sprite sprite, Vector2? focus = null)
        {
            image.sprite = sprite; image.color = sprite != null ? Color.white : Color.clear; image.raycastTarget = false;
            if (sprite == null) return;
            var fit = image.gameObject.AddComponent<AspectRatioFitter>(); fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent; fit.aspectRatio = sprite.rect.width / sprite.rect.height;
            image.rectTransform.pivot = focus ?? Vector2.one * .5f;
        }
    }
    internal sealed class DepartureGrid : MonoBehaviour
    {
        public float MinimumWidth = 240;
        public int FixedColumns;
        void LateUpdate()
        {
            var grid = GetComponent<GridLayoutGroup>(); float width = ((RectTransform)transform).rect.width - grid.padding.horizontal;
            int columns = FixedColumns > 0 ? FixedColumns : Mathf.Max(1, Mathf.FloorToInt((width + grid.spacing.x) / (MinimumWidth + grid.spacing.x)));
            grid.constraintCount = columns;
            // auto-fill source distributes remaining space, while each face stays <=240.
            var size = grid.cellSize; size.x = Mathf.Max(1, (width - grid.spacing.x * (columns - 1)) / columns); grid.cellSize = size;
        }
    }
    internal sealed class DepartureCardZoom : Panel
    {
        CardDef[] _cards; int _index;
        public static void Open(CardDef[] cards, int index = 0)
        { if (cards == null || cards.Length == 0) return; var page = ScreenMount.Show<DepartureCardZoom>("DepartureCardZoom"); page._cards = cards; page._index = Mathf.Clamp(index, 0, cards.Length - 1); page.Build(); }
        public override void Build()
        {
            var root = UIKit.Panel("cardZoom", transform).transform; DepartureElements.Surface(root, Theme.HexA("#071922", .9f));
            var card = DepartureElements.Card(root, _cards[_index], 340, "card-zoom-current"); card.anchorMin = card.anchorMax = Vector2.one * .5f; card.pivot = Vector2.one * .5f; card.anchoredPosition = new Vector2(0, 25);
            DepartureElements.CommandAt(root, "zoom-close", "返回", Close, new Vector2(.5f, 0), new Vector2(.5f, 0), new Vector2(-100, 24), new Vector2(100, 76));
            if (_cards.Length > 1)
            {
                DepartureElements.CommandAt(root, "zoom-prev", "‹", () => { _index = (_index + _cards.Length - 1) % _cards.Length; Rebuild(); }, new Vector2(.5f, .5f), new Vector2(.5f, .5f), new Vector2(-270, -24), new Vector2(-210, 40));
                DepartureElements.CommandAt(root, "zoom-next", "›", () => { _index = (_index + 1) % _cards.Length; Rebuild(); }, new Vector2(.5f, .5f), new Vector2(.5f, .5f), new Vector2(210, -24), new Vector2(270, 40));
            }
        }
    }
}
