// Native rendering for the existing courtyard KoiPond model (source MIT notice retained in migration evidence).
using System;
using System.Collections.Generic;
using Sdt.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Hub
{
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class KoiPondGraphic : MaskableGraphic, IPointerClickHandler, IPointerMoveHandler, IPointerExitHandler
    {
        public KoiPondModel Model { get; private set; } = new KoiPondModel();
        public bool Paused, Rain = true;
        public int Intensity = 40;
        public string Palette = "slate";
        float _lastRain;
        readonly System.Random _rainRandom = new System.Random(1707);
        readonly List<KoiPondModel.Particle> _rain = new List<KoiPondModel.Particle>();
        static readonly string[][] FishColors = {
            new[]{"#e6dfce","#c46548","#334746"},new[]{"#dddcd0","#b95643","#43524d"},
            new[]{"#ceb578","#a97745","#576157"},new[]{"#c46c51","#e5d9bc","#3e4c47"}};
        protected override void OnRectTransformDimensionsChange()
        { base.OnRectTransformDimensionsChange(); if (Model != null) Model.Resize(Math.Max(1, rectTransform.rect.width), Math.Max(1, rectTransform.rect.height)); }
        void Update()
        {
            if (Paused) return;
            float dt = Mathf.Min(.05f, Time.unscaledDeltaTime); Model.Step(dt);
            foreach (var ripple in _rain) ripple.Age += dt;
            _rain.RemoveAll(ripple => ripple.Age > 2.4);
            _lastRain += dt;
            if (Rain && _lastRain > .12f)
            {
                _lastRain = 0;
                var bounds = Model.Bounds();
                int maximum = Intensity == 80 ? 36 : 18;
                if (_rain.Count >= maximum) _rain.RemoveAt(0);
                _rain.Add(new KoiPondModel.Particle { X = bounds.left + _rainRandom.NextDouble() * (bounds.right - bounds.left), Y = bounds.top + _rainRandom.NextDouble() * (bounds.bottom - bounds.top) });
            }
            SetVerticesDirty();
        }
        Vector2 At(double x, double y) => new Vector2(rectTransform.rect.xMin + (float)x, rectTransform.rect.yMax - (float)y);
        static Color Hex(string value, float alpha = 1) { ColorUtility.TryParseHtmlString(value, out var color); color.a = alpha; return color; }
        static Vector2 Local(KoiPondModel.Fish fish, double x, double y, double size)
        { double c = Math.Cos(fish.Angle), s = Math.Sin(fish.Angle); return new Vector2((float)(fish.X + (x * c - y * s) * size), (float)(fish.Y + (x * s + y * c) * size)); }
        void Polygon(VertexHelper mesh, List<Vector2> points, Color color)
        {
            if (points.Count < 3) return;
            var center = Vector2.zero; foreach (var point in points) center += point; center /= points.Count;
            int first = mesh.currentVertCount;
            mesh.AddVert(At(center.x, center.y), color, Vector2.zero);
            foreach (var point in points) mesh.AddVert(At(point.x, point.y), color, Vector2.zero);
            for (int i = 0; i < points.Count; i++) mesh.AddTriangle(first, first + 1 + i, first + 1 + (i + 1) % points.Count);
        }
        void Ellipse(VertexHelper mesh, double x, double y, double rx, double ry, Color color, double angle = 0)
        {
            var points = new List<Vector2>(24); double c = Math.Cos(angle), s = Math.Sin(angle);
            for (int i = 0; i < 24; i++) { double a = i * Math.PI / 12, dx = Math.Cos(a) * rx, dy = Math.Sin(a) * ry; points.Add(new Vector2((float)(x + dx * c - dy * s), (float)(y + dx * s + dy * c))); }
            Polygon(mesh, points, color);
        }
        void Line(VertexHelper mesh, Vector2 from, Vector2 to, float width, Color color)
        {
            var perpendicular = new Vector2(-(to.y - from.y), to.x - from.x).normalized * (width / 2);
            Polygon(mesh, new List<Vector2> { from + perpendicular, to + perpendicular, to - perpendicular, from - perpendicular }, color);
        }
        void Ring(VertexHelper mesh, double x, double y, double radius, Color color)
        {
            for (int i = 0; i < 40; i++) { double a = i * Math.PI / 20, b = (i + 1) * Math.PI / 20;
                Line(mesh, new Vector2((float)(x + Math.Cos(a) * radius), (float)(y + Math.Sin(a) * radius)), new Vector2((float)(x + Math.Cos(b) * radius), (float)(y + Math.Sin(b) * radius)), Mathf.Max(.6f, (float)Model.Width * .0008f), color); }
        }
        List<Vector2> Body(KoiPondModel.Fish fish, double offsetX = 0, double offsetY = 0)
        {
            double[] widths = { .035, .087, .105, .086, .052, .023, .009 }; var outline = new List<Vector2>();
            foreach (int side in new[] { -1, 1 }) for (int n = 0; n < widths.Length; n++)
            { int i = side == -1 ? n : widths.Length - n - 1; var at = KoiPondModel.Spine(fish, i / 6.0); outline.Add(new Vector2((float)(at.x + offsetX), (float)(at.y + widths[i] * side + offsetY))); }
            var points = new List<Vector2>(); double length = Model.Length(fish);
            for (int i = 0; i < outline.Count; i++)
            {
                var previous = outline[(i + outline.Count - 1) % outline.Count]; var control = outline[i]; var next = outline[(i + 1) % outline.Count];
                var from = (previous + control) / 2; var to = (control + next) / 2;
                for (int j = 0; j < 4; j++) { float t = j / 4f; var p = (1 - t) * (1 - t) * from + 2 * (1 - t) * t * control + t * t * to; points.Add(Local(fish, p.x, p.y, length)); }
            }
            return points;
        }
        void DrawFish(VertexHelper mesh, KoiPondModel.Fish fish)
        {
            double length = Model.Length(fish); var colors = FishColors[fish.Id % 4]; float alpha = (float)(.94 - fish.Depth * .32);
            Polygon(mesh, Body(fish, .025 + fish.Depth * .06, .038 + fish.Depth * .12), Hex("#284241", .16f));
            var fin = KoiPondModel.Spine(fish, .25); var tail = KoiPondModel.Spine(fish, 1);
            foreach (int side in new[] { -1, 1 }) Polygon(mesh, new List<Vector2> {
                Local(fish,fin.x+.04,fin.y+side*.065,length),Local(fish,fin.x-.035,fin.y+side*.19,length),
                Local(fish,fin.x-.15,fin.y+side*.15,length),Local(fish,fin.x-.11,fin.y+side*.08,length)},Hex("#dcdabd",.48f));
            double swing = Math.Sin(fish.Phase - 2.8) * .055;
            Polygon(mesh,new List<Vector2>{Local(fish,tail.x+.025,tail.y,length),Local(fish,-1,tail.y-.1+swing,length),Local(fish,-.94,tail.y+swing,length),Local(fish,-1,tail.y+.11+swing,length)},Hex("#dbd8b9",.63f));
            Polygon(mesh, Body(fish), Hex(colors[0], alpha));
            var locations = new[] { .19, .54, .73 }; var sizes = new[] { .08, .065, .025 };
            for (int i = 0; i < 3; i++) { var p = KoiPondModel.Spine(fish, locations[i]); var at = Local(fish, p.x, p.y, length); Ellipse(mesh, at.x, at.y, length * sizes[i], length * sizes[i] * .7, Hex(colors[i == 2 ? 2 : 1], alpha), fish.Angle); }
            Polygon(mesh, Body(fish), Hex("#396264", (float)(.10 + fish.Depth * .22)));
            foreach (int side in new[] { -1, 1 }) { var at = Local(fish, -.043, side * .036, length); Ellipse(mesh, at.x, at.y, length * .009, length * .009, Hex("#293c3c")); }
        }
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear(); if (Model == null) return;
            foreach (var food in Model.Foods) Ellipse(mesh, food.X, food.Y, Math.Max(1.2, Model.Width * .0014), Math.Max(1.2, Model.Width * .0014), Hex("#d7aa66", (float)Math.Min(1, (16 - food.Age) / 4)));
            foreach (var fish in Model.Fishes) DrawFish(mesh, fish);
            foreach (var ripple in Model.Ripples) { double progress = ripple.Age / 2.4; Ring(mesh, ripple.X, ripple.Y, 2 + progress * Model.Width * .055 * ripple.Power, Hex("#e1edda", (float)((1 - progress) * .26))); }
            if (!Rain) return;
            foreach (var rain in _rain)
            {
                double progress = rain.Age / 2.4; Ring(mesh, rain.X, rain.Y, 2 + progress * Model.Width * .018, Hex("#e0e6d8", (float)((1 - progress) * .10)));
                if (rain.Age < .3) Line(mesh, new Vector2((float)rain.X - 3, (float)rain.Y - 18), new Vector2((float)rain.X, (float)rain.Y), 1, Hex("#e0e6d8", .35f));
            }
        }
        Vector2 Pointer(PointerEventData data)
        { RectTransformUtility.ScreenPointToLocalPointInRectangle(rectTransform, data.position, data.pressEventCamera, out var p); return new Vector2(p.x - rectTransform.rect.xMin, rectTransform.rect.yMax - p.y); }
        public void OnPointerClick(PointerEventData data) { if (Paused) return; var p = Pointer(data); Model.Tap(p.x, p.y); }
        public void OnPointerMove(PointerEventData data) { if (Paused) return; var p = Pointer(data); Model.Pointer(p.x, p.y); }
        public void OnPointerExit(PointerEventData data) => Model.Pointer(null, null);
    }
}
