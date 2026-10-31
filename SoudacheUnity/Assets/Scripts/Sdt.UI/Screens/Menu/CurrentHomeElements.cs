// Native equivalents of the home cover's DOM elements, not global UI/theme replacements.
using System;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Menu
{
    internal static class CurrentHomeElements
    {
        public static RectTransform Box(Transform parent, string name, float x, float y, float width, float height)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = new Vector2(0, 1); rect.pivot = new Vector2(0, 1);
            rect.anchoredPosition = new Vector2(x, -y); rect.sizeDelta = new Vector2(width, height);
            return rect;
        }
        public static Image Art(Transform parent, string key, float x, float y, float width, float height, string name = null)
        {
            var rect = Box(parent, name ?? key, x, y, width, height);
            var image = rect.gameObject.AddComponent<Image>(); image.sprite = CurrentHomeAssets.Load(key);
            image.raycastTarget = false; return image;
        }
        public static Image Fill(Transform parent, string name, Color colour, float x, float y, float width, float height)
        {
            var rect = Box(parent, name, x, y, width, height);
            var image = rect.gameObject.AddComponent<Image>(); image.color = colour; image.raycastTarget = false;
            return image;
        }
        public static Text Text(Transform parent, string name, string value, int size, Color colour,
                                float x, float y, float width, float height, float tracking = 0, bool bold = false)
        {
            var rect = Box(parent, name, x, y, width, height);
            var text = rect.gameObject.AddComponent<CurrentHomeText>();
            text.font = Theme.Sans; text.text = value; text.fontSize = size; text.color = colour;
            text.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal; text.Tracking = tracking;
            text.raycastTarget = false; text.alignment = TextAnchor.MiddleLeft;
            text.horizontalOverflow = HorizontalWrapMode.Overflow; text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }
        public static Button Hit(RectTransform rect, Action action)
        {
            var image = Sdt.UI.Kit.UIKit.GetOrAdd<Image>(rect);
            if (image.sprite == null) image.color = Color.clear;
            image.raycastTarget = true;
            var button = rect.gameObject.AddComponent<Button>(); button.targetGraphic = image;
            button.transition = Selectable.Transition.None;
            button.onClick.AddListener(() => { if(rect.GetComponent<CurrentHomePlate>()==null)AudioService.I.PlaySfx("click"); action?.Invoke(); });
            return button;
        }
        public static CanvasGroup Group(Transform transform)
        {
            return Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(transform);
        }
        public static Color Hex(string hex) => Theme.Hex(hex);
    }

}
