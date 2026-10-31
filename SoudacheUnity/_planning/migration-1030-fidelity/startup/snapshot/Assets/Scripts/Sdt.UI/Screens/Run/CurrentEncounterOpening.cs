// encounter-presentation.js + run-presentation.css. Rebuilds retain the source once-per-run/node opening.
using System.Collections.Generic;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public static class CurrentEncounterOpening
    {
        static object _token;
        static readonly HashSet<string> Seen = new HashSet<string>();
        public static RectTransform Create(Transform parent, string id)
        {
            var spec = CurrentRunFilm.Encounter(id); if (spec == null) return null;
            var runtime = GameRuntime.I;
            if (!ReferenceEquals(_token, runtime.State.discoveredPairs)) { _token = runtime.State.discoveredPairs; Seen.Clear(); }
            bool animate = Seen.Add(runtime.CurrentNodeId + ":" + id);
            var root = CurrentNodeElements.Rect(parent, "encounter-opening-" + id);
            var le = UIKit.GetOrAdd<LayoutElement>(root); le.minHeight = le.preferredHeight = 116; le.flexibleHeight = 0;
            var top = CurrentNodeElements.Fill(root, "encounter-top-rule", "#b6cbd7"); top.color = Theme.HexA("#b6cbd7", .25f);
            top.rectTransform.anchorMin = new Vector2(0, 1); top.rectTransform.anchorMax = Vector2.one; top.rectTransform.sizeDelta = new Vector2(0, 1);
            var bottom = CurrentNodeElements.Fill(root, "encounter-bottom-rule", "#b6cbd7"); bottom.color = top.color;
            bottom.rectTransform.anchorMin = Vector2.zero; bottom.rectTransform.anchorMax = new Vector2(1, 0); bottom.rectTransform.sizeDelta = new Vector2(0, 1);
            var emblem = CurrentNodeElements.Rect(root, "encounter-emblem"); CurrentNodeElements.Fixed(emblem, 0, 22, 60, 56);
            var glyph = UIKit.GetOrAdd<CurrentEncounterEmblem>(emblem); glyph.Kind = spec.kind; glyph.Animate = animate; glyph.raycastTarget = false;
            var copy = CurrentNodeElements.Rect(root, "encounter-copy"); copy.anchorMin = Vector2.zero; copy.anchorMax = Vector2.one; copy.offsetMin = new Vector2(80, 16); copy.offsetMax = new Vector2(0, -16);
            var flow = UIKit.GetOrAdd<VerticalLayoutGroup>(copy); flow.spacing = 8; flow.childControlWidth = flow.childControlHeight = true; flow.childForceExpandWidth = true; flow.childForceExpandHeight = false;
            var title = CurrentNodeElements.Text(copy, "encounter-title", spec.title, 22, "#eef1ed", true); title.gameObject.AddComponent<LayoutElement>().preferredHeight = 33;
            var line = CurrentNodeElements.Text(copy, "encounter-line", spec.line, 18, "#b9c9d2"); line.lineSpacing = 1.5f; line.gameObject.AddComponent<LayoutElement>().minHeight = 27;
            var size = root.gameObject.AddComponent<CurrentEncounterOpeningLayout>(); size.Title = title; size.Line = line; size.Emblem = emblem;
            return root;
        }
    }
    public sealed class CurrentEncounterOpeningLayout : MonoBehaviour
    {
        public Text Title, Line; public RectTransform Emblem; float _width=-1;
        void LateUpdate()
        {
            float width=((RectTransform)transform).rect.width;
            if(Mathf.Abs(width-_width)<.5f||width<=80)return;_width=width;
            Title.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,width-80);
            Line.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,width-80);
            var size=GetComponent<LayoutElement>();size.preferredHeight=size.minHeight=Mathf.Max(88,Title.preferredHeight+8+Line.preferredHeight+32);
            if(Emblem!=null)Emblem.anchoredPosition=new Vector2(0,-(size.preferredHeight-56)/2);
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentEncounterEmblem : MaskableGraphic
    {
        public string Kind; public bool Animate;
        float _started;
        protected override void OnEnable() { base.OnEnable(); _started = Time.unscaledTime; }
        void Update() { if (Animate && Time.unscaledTime - _started < .86f) SetVerticesDirty(); }
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear(); var r = rectTransform.rect;
            for (int i = 0; i < 3; i++)
            {
                float age = Time.unscaledTime - _started - i * .1f;
                float a = !Animate || CurrentUiPreferences.ReducedMotion ? 1 : Mathf.Lerp(.2f, 1, CurrentRunFilm.SourceEaseOut(age / .65f));
                var ink = Theme.Hex(Kind == "boss" ? "#df9d96" : Kind == "altar" ? "#c6b487" : "#b6cbd7"); ink.a *= a;
                float height = Kind == "signal" ? 10 : i == 1 ? 36 : 22;
                var box = new Rect(r.center.x - 21 + i * 16, r.center.y - height / 2, 10, height);
                if (Kind == "signal")
                {
                    int first = vh.currentVertCount; vh.AddVert(box.center, ink, Vector2.zero);
                    for (int p = 0; p <= 16; p++) { float angle = p * Mathf.PI / 8; vh.AddVert(box.center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * 5, ink, Vector2.zero); if (p > 0) vh.AddTriangle(first, first + p, first + p + 1); }
                }
                else if (Kind == "altar")
                { Quad(vh, new Rect(box.x, box.y, 1, box.height), ink, r.center); Quad(vh, new Rect(box.xMax - 1, box.y, 1, box.height), ink, r.center); Quad(vh, new Rect(box.x, box.y, 10, 1), ink, r.center); Quad(vh, new Rect(box.x, box.yMax - 1, 10, 1), ink, r.center); }
                else Quad(vh, box, ink, r.center);
            }
        }
        void Quad(VertexHelper vh, Rect box, Color ink, Vector2 origin)
        {
            int first = vh.currentVertCount; var points = new[] { new Vector2(box.xMin, box.yMin), new Vector2(box.xMin, box.yMax), new Vector2(box.xMax, box.yMax), new Vector2(box.xMax, box.yMin) };
            foreach (var point in points) { var p = point; if (Kind == "altar") { var d = point - origin; p = origin + new Vector2((d.x - d.y) * .7071068f, (d.x + d.y) * .7071068f); } if (Kind == "boss") p.x -= Mathf.Tan(18 * Mathf.Deg2Rad) * (p.y - origin.y); vh.AddVert(p, ink, Vector2.zero); }
            vh.AddTriangle(first, first + 1, first + 2); vh.AddTriangle(first, first + 2, first + 3);
        }
    }
}
