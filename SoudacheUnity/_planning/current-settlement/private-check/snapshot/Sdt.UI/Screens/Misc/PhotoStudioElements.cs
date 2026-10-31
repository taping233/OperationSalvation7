using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Sdt.Core;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using System.Linq;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>Native presentation primitives for the current studio-unified/studio-archive module.</summary>
    static class PhotoStudioElements
    {
        public static readonly Color Ink = Theme.Hex("#30302e"), Muted = Theme.Hex("#756b58"), Light = Theme.Hex("#e5ddcd");
        public const string DrawExplanation = "普通战斗中，抽牌效果从本场牌库取牌，牌库抽空时停止；开局和每回合开始不自动抽牌。";
        public static bool Reduced => GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion") == "1";
        public static bool Tab(Transform root)
        {
            if (!Input.GetKeyDown(KeyCode.Tab) || Input.compositionString.Length > 0) return false;
            var options = root.GetComponentsInChildren<Selectable>().Where(s => s.IsActive() && s.IsInteractable() && !(s is Scrollbar) && s.name != "PhotoBackdropClose" && s.name != "ChoiceDismiss" && (!s.name.StartsWith("libType", StringComparison.Ordinal) || s.transform.Find("CategoryMarker").gameObject.activeSelf)).ToArray();
            if (options.Length == 0) return true;
            var current = EventSystem.current?.currentSelectedGameObject; int index = Array.FindIndex(options, s => s.gameObject == current);
            var field = current != null ? current.GetComponent<InputField>() : null; if (field != null) field.DeactivateInputField();
            index = (index + (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) ? -1 : 1) + options.Length) % options.Length;
            EventSystem.current?.SetSelectedGameObject(options[index].gameObject); var next = options[index] as InputField; if (next != null) next.ActivateInputField(); return true;
        }
        public static RectTransform Node(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }
        public static void Fill(RectTransform rt, float left = 0, float top = 0, float right = 0, float bottom = 0)
        { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = new Vector2(left, bottom); rt.offsetMax = new Vector2(-right, -top); }
        public static void Place(RectTransform rt, float x, float y, float width, float height)
        { rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 1); rt.anchoredPosition = new Vector2(x, -y); rt.sizeDelta = new Vector2(width, height); }
        public static Image Paint(Transform parent, string name, Color color, Sprite sprite = null)
        {
            var rt = Node(parent, name); var image = UIKit.GetOrAdd<Image>(rt); image.sprite = sprite; image.color = color; image.raycastTarget = false; Fill(rt); return image;
        }
        public static Image Texture(Transform parent, string key, Color? tint = null)
            => Paint(parent, key, tint ?? Color.white, CurrentPhotoAssets.Get(key));
        public static Text Text(Transform parent, string name, string value, int size, Color color, bool serif = false)
        {
            var text = UIKit.Label(parent, value, size, color); text.name = name; if (serif) text.font = Theme.Serif;
            text.alignment = TextAnchor.UpperLeft; text.lineSpacing = 1.25f; return text;
        }
        public static Text Flow(Transform parent, string name, string value, int size, Color color, bool serif = false)
        {
            var text = Text(parent, name, value, size, color, serif); var le = UIKit.GetOrAdd<LayoutElement>(text);
            le.minWidth = 0; le.flexibleWidth = 1; return text;
        }
        public static Button Button(Transform parent, string name, string value, Action click, bool paper = false)
        {
            var rt = Node(parent, name); var image = UIKit.GetOrAdd<Image>(rt); image.color = Color.clear;
            var button = UIKit.GetOrAdd<Button>(rt); button.targetGraphic = image;
            var colors = button.colors; colors.normalColor = Color.white; colors.highlightedColor = Theme.HexA(paper ? "#ad9776" : "#d0d8bc", .12f);
            colors.pressedColor = Theme.HexA("#d1ac78", .22f); colors.disabledColor = new Color(1, 1, 1, .35f); button.colors = colors;
            var label = Text(rt, "Label", value, 20, paper ? Ink : Light); label.alignment = TextAnchor.MiddleCenter; Fill(label.rectTransform, 5, 2, 5, 2);
            button.onClick.AddListener(() => { AudioService.I.PlaySfx("click"); click?.Invoke(); });
            var navigation = button.navigation; navigation.mode = Navigation.Mode.Automatic; button.navigation = navigation;
            return button;
        }
        public static RectTransform Scroll(Transform parent, string name, out ScrollRect scroll)
        {
            var viewport = Node(parent, name); var background = UIKit.GetOrAdd<Image>(viewport); background.color = new Color(0, 0, 0, .001f);
            UIKit.GetOrAdd<RectMask2D>(viewport); scroll = UIKit.GetOrAdd<ScrollRect>(viewport); scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped; scroll.scrollSensitivity = 48; scroll.viewport = viewport;
            var content = Node(viewport, "Content"); content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(.5f, 1); content.sizeDelta = Vector2.zero; scroll.content = content;
            var rail = Node(viewport, "Scrollbar"); rail.anchorMin = new Vector2(1, 0); rail.anchorMax = Vector2.one; rail.offsetMin = new Vector2(-12, 0); rail.offsetMax = Vector2.zero;
            var railImage = UIKit.GetOrAdd<Image>(rail); railImage.color = Theme.HexA("#d7c8a1", .05f);
            var handle = Paint(rail, "Handle", Theme.HexA("#d7bf94", .85f)); Fill(handle.rectTransform, 2, 2, 2, 2); handle.raycastTarget = true;
            var bar = UIKit.GetOrAdd<Scrollbar>(rail); bar.handleRect = handle.rectTransform; bar.targetGraphic = handle; bar.direction = Scrollbar.Direction.BottomToTop;
            scroll.verticalScrollbar = bar; scroll.verticalScrollbarVisibility = ScrollRect.ScrollbarVisibility.AutoHide;
            return content;
        }
        public static void Vertical(RectTransform root, int gap = 16)
        {
            var layout = UIKit.GetOrAdd<VerticalLayoutGroup>(root); layout.spacing = gap;
            layout.childControlHeight = layout.childControlWidth = true; layout.childForceExpandHeight = false; layout.childForceExpandWidth = true;
            UIKit.GetOrAdd<ContentSizeFitter>(root).verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }
        public static string Mount(CardDef card)
        {
            switch (CardLibrary.RarityOf(card))
            { case "初始": return "proof"; case "稀有": return "rare"; case "史诗": return "epic"; case "传说": return "legendary"; case "衍生": return "derived"; case "职业": return "class"; case "棱彩": return "prismatic"; default: return "plain"; }
        }
        public static float Stroke(string mount)
        { switch (mount) { case "proof": return 3; case "rare": case "class": return 7; case "epic": return 14; case "legendary": return 17; case "prismatic": return 16; case "derived": return 5; default: return 4; } }
        public static int Number(string id) { unchecked { uint h = 7; foreach (char ch in id ?? "") h = h * 31 + ch; return 10 + (int)(h % 90); } }
        public static float Stable(string id, int salt)
        { unchecked { uint h = 2166136261u ^ (uint)salt; foreach (char ch in id ?? "card") { h ^= ch; h *= 16777619; } return h / (float)uint.MaxValue; } }
        public static Color RarityColor(string rarity)
        { switch (rarity) { case "史诗": return Theme.Hex("#755989"); case "传说": return Theme.Hex("#705826"); case "职业": return Theme.Hex("#994d47"); case "棱彩": return Theme.Hex("#78377c"); default: return Theme.Hex("#52585f"); } }
        public static Color Metal(string mount)
        { switch (mount) { case "rare": return Theme.Hex("#6f9fc6"); case "epic": return Theme.Hex("#b6a6c3"); case "legendary": return Theme.Hex("#edce68"); case "prismatic": return Theme.Hex("#c9cacc"); case "class": return Theme.Hex("#ba7770"); default: return Theme.Hex("#af9e68"); } }
        public static void Frame(RectTransform parent, string mount, bool zoom)
        {
            var key = mount == "legendary" ? "frame-atelier-v1" : (zoom && (mount == "plain" || mount == "rare" || mount == "epic" || mount == "class" || mount == "prismatic") ? "rails-" : zoom ? "mount-" : "mount-thumbnail-") + mount;
            var frame = Paint(parent, "studio-photo-ornament", Color.white, CurrentPhotoAssets.Get(key, true)); frame.type = Image.Type.Sliced; frame.fillCenter = false;
            float border = Stroke(mount) * (zoom ? 2.5f * .8f : .85f);
            frame.pixelsPerUnitMultiplier = (mount == "legendary" ? 170 : 48) / border;
            if (zoom && (mount == "rare" || mount == "epic" || mount == "class" || mount == "prismatic" || mount == "plain"))
            {
                float width = Stroke(mount) * 2.5f; float size = width * (mount == "epic" || mount == "prismatic" ? 2.2f : 3) * 1.2f;
                for (int i = 0; i < 4; i++)
                {
                    var corner = Texture(parent, "corner-" + mount); var rt = corner.rectTransform;
                    rt.anchorMin = rt.anchorMax = new Vector2(i == 1 || i == 2 ? 1 : 0, i < 2 ? 1 : 0); rt.pivot = new Vector2(.5f, .5f);
                    rt.anchoredPosition = new Vector2(rt.anchorMin.x == 1 ? -size / 2 : size / 2, rt.anchorMin.y == 1 ? -size / 2 : size / 2);
                    rt.sizeDelta = new Vector2(size, size); rt.localEulerAngles = new Vector3(0, 0, -90 * i);
                }
            }
            var clip = Paint(parent, "studio-mount-mark", Metal(mount));
            clip.rectTransform.anchorMin = clip.rectTransform.anchorMax = new Vector2(.5f, 1); clip.rectTransform.pivot = new Vector2(.5f, 1);
            clip.rectTransform.anchoredPosition = new Vector2(0, 4 * (zoom ? 1.65f : 1)); clip.rectTransform.sizeDelta = new Vector2(34, 13) * (zoom ? 1.65f : 1);
            clip.rectTransform.localEulerAngles = new Vector3(0, 0, -2); UIKit.GetOrAdd<Outline>(clip).effectColor = Theme.HexA("#242018", .6f);
            var shine = Paint(clip.transform, "ClipHighlight", Theme.HexA("#fff4db", .53f)); Fill(shine.rectTransform, 1, 1, 1, zoom ? 18 : 11);
            float k = zoom ? 1.65f : 1; var loop = Node(clip.transform, "ClipLoop"); Place(loop, 10.9f * k, -5 * k, 12.2f * k, 5.9f * k);
            var top = Paint(loop, "LoopTop", Metal(mount)); Fill(top.rectTransform, 0, 0, 0, 3.9f * k);
            var left = Paint(loop, "LoopLeft", Metal(mount)); Fill(left.rectTransform, 0, 0, 10.2f * k, 0);
            var right = Paint(loop, "LoopRight", Metal(mount)); Fill(right.rectTransform, 10.2f * k, 0, 0, 0);
        }
        public static bool Contain(CardDef card) => card.type == "道具" || card.type == "装备" || card.type == "资源" || card.type == "生物" || Focus.ContainsKey(card.id);
        static readonly Dictionary<string, float> Focus = new Dictionary<string, float> { {"tt8-curse1", .2f}, {"tt8-curse2", .2f}, {"tt8-curse3", .2f}, {"tt8-curse4", .25f}, {"tt8-hero-mage", 0}, {"tt8-hero-descender", .2f}, {"tt8-hero-summoner", 0}, {"tt8-hero-warlock", 0} };
        public static void Artwork(RectTransform area, CardDef card, bool full)
        {
            Paint(area, "studio-art-matte", Theme.Hex("#252527")); UIKit.GetOrAdd<RectMask2D>(area);
            var sprite = Sdt.Res.Res.CardIllustration(card.id, card.art, card.type, card.name, !full);
            var picture = Paint(area, "PhotoPixels", Color.white, sprite); var fit = UIKit.GetOrAdd<AspectRatioFitter>(picture);
            fit.aspectMode = full || Contain(card) ? AspectRatioFitter.AspectMode.FitInParent : AspectRatioFitter.AspectMode.EnvelopeParent;
            fit.aspectRatio = sprite == null ? 1 : sprite.rect.width / sprite.rect.height;
            UIKit.GetOrAdd<PhotoGlass>(Node(area, "GlassReflection")).raycastTarget = false;
            if (full) UIKit.GetOrAdd<PhotoNegativeGesture>(area);
        }
        public static string Description(CardDef card)
        {
            var value = App.StripIcons(CurrentCardPresentation.Description(card));
            value = Regex.Replace(value, "<[^>]+>", "");
            return Regex.Replace(value, @"(?<![A-Za-z])(-?\d+(?:\.\d+)?)", "<color=#934529><b>$1</b></color>");
        }
        public static Text DescriptionFlow(Transform parent, string name, CardDef card, int size, bool dossier = false)
        {
            var doc = CurrentCardPresentation.RichDescription(card, CardLibrary.All(), null, dossier);
            var text = Flow(parent, name, doc.Rich, size, Ink, true);
            var links = UIKit.GetOrAdd<PhotoInlineLinks>(text); links.Document = doc;
            links.OpenCard = target => PhotoDetailScreen.Open(new List<CardDef> { target }, target.id);
            return text;
        }
        public static bool HasDraw(CardDef card) => CardLibrary.DeriveDraw(card) > 0 || Regex.IsMatch(card.desc ?? "", @"抽(?:牌|卡|取[^。；]*[牌张]|\s*[0-9一二三四五六七八九十两]+\s*张)");
    }

    /// <summary>CSS glass stripe, geometry and alpha from the final 122 degree gradient.</summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhotoGlass : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear(); var r = rectTransform.rect;
            Add(vh, r, .13f, .2f, 0, .071f); Add(vh, r, .2f, .23f, .071f, .094f); Add(vh, r, .23f, .31f, .094f, 0);
        }
        static void Add(VertexHelper vh, Rect r, float a, float b, float alphaA, float alphaB)
        {
            int start = vh.currentVertCount; float drift = r.height * .625f;
            vh.AddVert(new Vector3(r.x + r.width * a - drift, r.y, 0), new Color(1, .97f, .91f, alphaA), Vector2.zero);
            vh.AddVert(new Vector3(r.x + r.width * b - drift, r.y, 0), new Color(.90f, .94f, .98f, alphaB), Vector2.zero);
            vh.AddVert(new Vector3(r.x + r.width * b, r.yMax, 0), new Color(.90f, .94f, .98f, alphaB), Vector2.zero);
            vh.AddVert(new Vector3(r.x + r.width * a, r.yMax, 0), new Color(1, .97f, .91f, alphaA), Vector2.zero);
            vh.AddTriangle(start, start + 1, start + 2); vh.AddTriangle(start, start + 2, start + 3);
        }
        protected override void Awake() { base.Awake(); PhotoStudioElements.Fill(rectTransform); }
    }
}
