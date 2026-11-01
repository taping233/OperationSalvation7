using System;
using System.Collections;
using System.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentPhotoMotionRound5Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value, string message)
        {
            Assertions++;
            if (!value) throw new InvalidOperationException("Photo motion round5: " + message);
        }
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        static void Flag(bool value) { Check(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion", value, out var reason), reason); }
        static Vector2[] Positions(RectTransform[] motes) => motes.Select(mote => mote.anchoredPosition).ToArray();
        static bool SamePositions(RectTransform[] motes, Vector2[] positions) => motes.Select((mote, i) => mote.anchoredPosition == positions[i]).All(same => same);

        public static IEnumerator Run()
        {
            Assertions = 0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")), "isolated profile required");
            bool reduced = CurrentUiPreferences.ReducedMotion;
            GameObject backdropRoot = null;
            Texture2D texture = null;
            Sprite square = null, wide = null, sameWide = null;
            try
            {
                Clear(); GameRuntime.I.ResetSlot(5); Flag(true);
                CardLibraryScreen.Open(); CurrentRunFilm.CancelActive();
                yield return null; yield return null;
                var wall = UiStack.Top as CardLibraryScreen;
                Check(wall != null, "formal photo wall opens");
                var room = wall.GetComponentInChildren<PhotoStudioRoom>();
                Check(room != null, "formal wall mounts room motion component");
                var motes = Enumerable.Range(0, 12).Select(i => (RectTransform)room.transform.Find("room-dust-" + i)).ToArray();
                Check(motes.All(mote => mote != null && mote.GetComponent<CanvasGroup>().alpha == 0), "reduced motion hides all existing dust motes");
                var still = Positions(motes);
                foreach (var mote in motes) mote.hasChanged = false;
                for (int i = 0; i < 4; i++) yield return null;
                Check(SamePositions(motes, still) && motes.All(mote => !mote.hasChanged), "hidden dust has no position or transform writes over stable reduced frames");
                Flag(false); yield return null; yield return null;
                Check(!SamePositions(motes, still) && motes.Any(mote => mote.GetComponent<CanvasGroup>().alpha > 0), "switching back restores visible dust animation on the same objects");
                Flag(true); yield return null; yield return null;
                still = Positions(motes);
                foreach (var mote in motes) mote.hasChanged = false;
                for (int i = 0; i < 4; i++) yield return null;
                Check(motes.All(mote => mote.GetComponent<CanvasGroup>().alpha == 0) && SamePositions(motes, still) && motes.All(mote => !mote.hasChanged), "reducing motion again hides once and stops dust writes");

                backdropRoot = new GameObject("~PhotoMotionRound5Backdrop", typeof(RectTransform));
                var parent = (RectTransform)backdropRoot.transform; parent.sizeDelta = new Vector2(800, 500);
                var imageObject = new GameObject("Backdrop", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
                var rect = (RectTransform)imageObject.transform; rect.SetParent(parent, false);
                texture = new Texture2D(8, 8);
                square = Sprite.Create(texture, new Rect(0, 0, 8, 8), Vector2.one * .5f);
                wide = Sprite.Create(texture, new Rect(0, 0, 8, 4), Vector2.one * .5f);
                sameWide = Sprite.Create(texture, new Rect(0, 0, 8, 4), Vector2.one * .5f);
                var image = imageObject.GetComponent<Image>(); image.sprite = square;
                imageObject.AddComponent<PhotoRoomBackdrop>();
                yield return null; yield return null;
                Check(rect.sizeDelta == new Vector2(800, 800) && rect.anchoredPosition == new Vector2(0, 160), "first backdrop layout preserves cover geometry and source vertical offset");
                rect.hasChanged = false;
                for (int i = 0; i < 4; i++) yield return null;
                Check(!rect.hasChanged, "stable backdrop frames do not rewrite the transform");
                parent.sizeDelta = new Vector2(1000, 400); yield return null; yield return null;
                Check(rect.sizeDelta == new Vector2(1000, 1000) && rect.anchoredPosition == new Vector2(0, 460), "parent resize recomputes backdrop cover geometry");
                image.sprite = wide; yield return null; yield return null;
                Check(rect.sizeDelta == new Vector2(1000, 500) && rect.anchoredPosition == new Vector2(0, -40), "different sprite dimensions recompute backdrop geometry");
                rect.hasChanged = false; image.sprite = sameWide;
                yield return null; yield return null;
                Check(!rect.hasChanged && rect.sizeDelta == new Vector2(1000, 500), "different sprite identity with equal dimensions keeps the existing layout");
                imageObject.SetActive(false); parent.sizeDelta = new Vector2(1200, 500); imageObject.SetActive(true);
                yield return null; yield return null;
                Check(rect.sizeDelta == new Vector2(1200, 600) && rect.anchoredPosition == new Vector2(0, -40), "reactivated backdrop lays out resized parent immediately");
            }
            finally
            {
                Clear();
                if (backdropRoot != null) UnityEngine.Object.Destroy(backdropRoot);
                if (square != null) UnityEngine.Object.Destroy(square);
                if (wide != null) UnityEngine.Object.Destroy(wide);
                if (sameWide != null) UnityEngine.Object.Destroy(sameWide);
                if (texture != null) UnityEngine.Object.Destroy(texture);
                if (!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion", reduced, out var reason))
                    throw new InvalidOperationException("Photo motion round5 preference restore: " + reason);
            }
            yield return null;
        }
    }
}
