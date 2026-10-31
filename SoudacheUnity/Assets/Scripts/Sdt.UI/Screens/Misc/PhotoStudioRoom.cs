using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    public sealed class PhotoRoomBackdrop : MonoBehaviour
    {
        void LateUpdate()
        {
            var image = GetComponent<Image>(); var parent = transform.parent as RectTransform; if (parent == null || image == null || image.sprite == null) return;
            float ratio = image.sprite.rect.width / image.sprite.rect.height;
            float width = Mathf.Max(parent.rect.width, parent.rect.height * ratio), height = width / ratio;
            PhotoStudioElements.Place((RectTransform)transform, (parent.rect.width - width) / 2, parent.rect.height - height + 140, width, height);
        }
    }
    /// <summary>Source photo-studio-room-effects: rail, two lamps, film strip, floor and twelve dust motes.</summary>
    public sealed class PhotoStudioRoom : MonoBehaviour
    {
        RectTransform _root;
        RectTransform[] _dust = new RectTransform[12];
        CanvasGroup[] _dustAlpha = new CanvasGroup[12];
        RectTransform _beam, _second;
        CanvasGroup _group;
        void Awake()
        {
            _root = (RectTransform)transform; PhotoStudioElements.Fill(_root); _group = UIKit.GetOrAdd<CanvasGroup>(_root); _group.blocksRaycasts = false; _group.interactable = false;
            var rail = PhotoStudioElements.Paint(_root, "room-gantry", Theme.HexA("#c4b28b", .17f));
            rail.rectTransform.anchorMin = new Vector2(.05f, .945f); rail.rectTransform.anchorMax = new Vector2(.96f, .96f); rail.rectTransform.offsetMin = rail.rectTransform.offsetMax = Vector2.zero;
            _beam = PhotoStudioElements.Node(_root, "room-beam"); _beam.anchorMin = new Vector2(.2f, .04f); _beam.anchorMax = new Vector2(.72f, .96f); _beam.offsetMin = _beam.offsetMax = Vector2.zero;
            var beamGraphic = UIKit.GetOrAdd<PhotoRoomBeam>(_beam); beamGraphic.color = Theme.HexA("#f4d9a4", .18f); beamGraphic.raycastTarget = false;
            _second = PhotoStudioElements.Node(_root, "room-beam-second"); _second.anchorMin = new Vector2(.55f, .02f); _second.anchorMax = new Vector2(.85f, .96f); _second.offsetMin = _second.offsetMax = Vector2.zero;
            var secondGraphic = UIKit.GetOrAdd<PhotoRoomBeam>(_second); secondGraphic.color = Theme.HexA("#c9e4e6", .05f); secondGraphic.raycastTarget = false;
            var film = PhotoStudioElements.Node(_root, "room-film"); film.anchorMin = new Vector2(.94f, .17f); film.anchorMax = new Vector2(.98f, .78f); film.offsetMin = film.offsetMax = Vector2.zero; film.localEulerAngles = new Vector3(0, 0, -9);
            PhotoStudioElements.Paint(film, "FilmBase", Theme.HexA("#101b17", .2f));
            for (int i = 0; i < 3; i++) { var panel = PhotoStudioElements.Paint(film, "FilmCell" + i, Theme.HexA("#b9aa84", .035f)); panel.rectTransform.anchorMin = new Vector2(.2f, .08f + i * .31f); panel.rectTransform.anchorMax = new Vector2(.8f, .34f + i * .31f); panel.rectTransform.offsetMin = panel.rectTransform.offsetMax = Vector2.zero; }
            for (int i = 0; i < 12; i++)
            { _dust[i] = PhotoStudioElements.Node(_root, "room-dust-" + i); _dust[i].sizeDelta = new Vector2(3, 3); PhotoStudioElements.Paint(_dust[i], "DustPixel", Theme.Hex("#f3e1b4")); _dustAlpha[i] = UIKit.GetOrAdd<CanvasGroup>(_dust[i]); }
        }
        void Update()
        {
            var owner = GetComponentInParent<CardLibraryScreen>(); bool visible = owner != null && UiStack.Top == owner; _group.alpha = visible ? 1 : 0; if (!visible) return;
            float now = Time.unscaledTime;
            if (!PhotoStudioElements.Reduced)
            { _beam.localEulerAngles = new Vector3(0, 0, Mathf.Lerp(-5, 2, (Mathf.Sin(now / 19 * Mathf.PI) + 1) * .5f)); _second.localEulerAngles = new Vector3(0, 0, 12 + Mathf.Sin((now - 11) / 27 * Mathf.PI) * 3); }
            for (int i = 0; i < 12; i++)
            {
                float p = Mathf.Repeat((now - i * 2.3f) / (18 + i % 7), 1); _dustAlpha[i].alpha = PhotoStudioElements.Reduced ? 0 : Mathf.Sin(p * Mathf.PI) * .38f;
                _dust[i].anchorMin = _dust[i].anchorMax = new Vector2((19 + i * 13 % 57) / 100f, 1 - (21 + i * 19 % 62) / 100f);
                _dust[i].anchoredPosition = new Vector2(p * 22, Mathf.Lerp(-20, 65, p));
            }
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhotoRoomBeam : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear(); var r = rectTransform.rect; var zero = color; zero.a = 0;
            vh.AddVert(new Vector3(r.x + r.width * .07f, r.yMax, 0), zero, Vector2.zero);
            vh.AddVert(new Vector3(r.x + r.width * .18f, r.y, 0), zero, Vector2.zero);
            vh.AddVert(new Vector3(r.x + r.width * .55f, r.y, 0), color, Vector2.zero);
            vh.AddVert(new Vector3(r.xMax, r.y, 0), zero, Vector2.zero);
            vh.AddTriangle(0, 1, 2); vh.AddTriangle(0, 2, 3);
        }
    }
}
