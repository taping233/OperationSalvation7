// Port of hub/courtyard-vendor/KoiPond.js; MIT Copyright (c) 2026 Rezaye Rabbi (RzX).
using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    /// <summary>庭院页面独立的锦鲤、投喂与发现状态，不参与基地经济或规则随机。</summary>
    public sealed class KoiPondModel
    {
        public sealed class Fish
        {
            public int Id; public double X, Y, Angle, Phase, Wander, Ratio, Pace, Bend, Depth;
        }
        public sealed class Particle { public double X, Y, Age, Power = 1; }
        readonly List<Fish> _fish = new List<Fish>();
        readonly List<Particle> _food = new List<Particle>(), _ripples = new List<Particle>();
        readonly HashSet<int> _found = new HashSet<int>();
        readonly Func<double> _random;
        double _time, _lastRipple = -1;
        (double x, double y)? _cursor;
        public double Width { get; private set; } = 1000;
        public double Height { get; private set; } = 600;
        public int Eaten { get; private set; }
        public int Found => _found.Count;
        public IReadOnlyList<Fish> Fishes => _fish;
        public IReadOnlyList<Particle> Foods => _food;
        public IReadOnlyList<Particle> Ripples => _ripples;
        public double Time => _time;
        public KoiPondModel(Func<double> random = null)
        {
            var generator = new Random(); _random = random ?? generator.NextDouble;
            for (int i = 0; i < 9; i++)
            {
                var bounds = Bounds();
                _fish.Add(new Fish { Id = i, X = bounds.left + _random() * (bounds.right - bounds.left),
                    Y = bounds.top + _random() * (bounds.bottom - bounds.top), Angle = _random() * Math.PI * 2,
                    Phase = _random() * Math.PI * 2, Wander = _random() * Math.PI * 2,
                    Ratio = .036 + _random() * .018, Pace = .011 + _random() * .007, Depth = .18 + i % 3 * .12 });
            }
        }
        static double Clamp(double value, double minimum, double maximum) => Math.Min(Math.Max(value, minimum), maximum);
        public double Length(Fish fish) => Math.Min(Width * fish.Ratio, Height * .15);
        public (double left, double right, double top, double bottom) Bounds()
        {
            double inset = Math.Min(Width * .055, Height * .15) * 1.05;
            return (Width * .1 + inset, Width * .9 - inset, Height * .1 + inset, Height * .9 - inset);
        }
        (double x, double y) Keep(double x, double y)
        { var b = Bounds(); return (Clamp(x, b.left, b.right), Clamp(y, b.top, b.bottom)); }
        static void Add(List<Particle> list, Particle particle) { if (list.Count >= 24) list.RemoveAt(0); list.Add(particle); }
        public void Ripple(double x, double y, double power = 1) => Add(_ripples, new Particle { X = x, Y = y, Power = power });
        public void Resize(double width, double height)
        {
            if (width <= 0 || height <= 0) return;
            double sx = width / Width, sy = height / Height; Width = width; Height = height;
            foreach (var fish in _fish) { var at = Keep(fish.X * sx, fish.Y * sy); fish.X = at.x; fish.Y = at.y; }
            foreach (var list in new[] { _food, _ripples }) foreach (var point in list)
            { var at = Keep(point.X * sx, point.Y * sy); point.X = at.x; point.Y = at.y; }
            _cursor = null;
        }
        public void Pointer(double? x, double? y)
        {
            var b = Bounds();
            if (!x.HasValue || !y.HasValue || x < b.left || x > b.right || y < b.top || y > b.bottom) { _cursor = null; return; }
            _cursor = (x.Value, y.Value);
            if (_time - _lastRipple >= .18) { Ripple(x.Value, y.Value, .45); _lastRipple = _time; }
            foreach (var fish in _fish)
                if (Distance(fish.X - x.Value, fish.Y - y.Value) < Length(fish)) _found.Add(fish.Id);
        }
        public void Tap(double x, double y)
        { var at = Keep(x, y); Add(_food, new Particle { X = at.x, Y = at.y }); Ripple(at.x, at.y); }
        static double Distance(double x, double y) => Math.Sqrt(x * x + y * y);
        public void Step(double dt, bool animate = true)
        {
            double step = animate ? Clamp(dt, 0, .05) : 0; _time += step;
            foreach (var particle in _food) particle.Age += step;
            _food.RemoveAll(particle => particle.Age >= 16);
            if (step > 0) foreach (var fish in _fish) Update(fish, step);
            foreach (var ripple in _ripples) ripple.Age += step;
            _ripples.RemoveAll(particle => particle.Age >= 2.4);
        }
        void Update(Fish fish, double dt)
        {
            Particle target = null; double nearest = double.PositiveInfinity;
            foreach (var food in _food) { double distance = Distance(fish.X - food.X, fish.Y - food.Y); if (distance < nearest) { target = food; nearest = distance; } }
            bool feeding = target != null && nearest < Math.Max(Width, Height) * .7;
            double wander = fish.Angle + Math.Sin(_time * .32 + fish.Wander) * .65;
            double dx = feeding ? (target.X - fish.X) / Math.Max(nearest, 1) : Math.Cos(wander);
            double dy = feeding ? (target.Y - fish.Y) / Math.Max(nearest, 1) : Math.Sin(wander);
            var bounds = Bounds(); double ahead = Length(fish) * 1.4;
            dx += Clamp((bounds.left + ahead - fish.X) / ahead, 0, 1) * 3 - Clamp((fish.X - bounds.right + ahead) / ahead, 0, 1) * 3;
            dy += Clamp((bounds.top + ahead - fish.Y) / ahead, 0, 1) * 3 - Clamp((fish.Y - bounds.bottom + ahead) / ahead, 0, 1) * 3;
            foreach (var other in _fish)
            {
                if (other == fish) continue;
                double ox = fish.X - other.X, oy = fish.Y - other.Y, distance = Distance(ox, oy), reach = Length(fish) * .6;
                if (distance > 0 && distance < reach) { double weight = (1 - distance / reach) * .5; dx += ox / distance * weight; dy += oy / distance * weight; }
            }
            if (_cursor.HasValue && !feeding)
            {
                double ox = fish.X - _cursor.Value.x, oy = fish.Y - _cursor.Value.y, distance = Distance(ox, oy), reach = Length(fish) * 2.5;
                if (distance > 0 && distance < reach) { double weight = (1 - distance / reach) * 2; dx += ox / distance * weight; dy += oy / distance * weight; }
            }
            double desired = Math.Atan2(dy, dx) - fish.Angle;
            double turn = Clamp(Math.Atan2(Math.Sin(desired), Math.Cos(desired)), -dt * .85, dt * .85);
            fish.Angle += turn;
            fish.Bend += (Clamp(turn / Math.Max(dt, .001), -.8, .8) - fish.Bend) * Math.Min(1, dt * 3);
            double speed = Width * fish.Pace * (feeding ? 1.65 : 1);
            var at = Keep(fish.X + Math.Cos(fish.Angle) * speed * dt, fish.Y + Math.Sin(fish.Angle) * speed * dt);
            fish.X = at.x; fish.Y = at.y; fish.Phase += dt * (feeding ? 2.5 : 1.65);
            if (feeding && nearest < Math.Max(4, Length(fish) * .16)) { _food.Remove(target); Ripple(fish.X, fish.Y, .55); Eaten++; }
        }
        public static (double x, double y) Spine(Fish fish, double t) => (-t * .82, (Math.Sin(fish.Phase - t * 2.8) * .032 + fish.Bend * .13) * t * t);
    }
}
