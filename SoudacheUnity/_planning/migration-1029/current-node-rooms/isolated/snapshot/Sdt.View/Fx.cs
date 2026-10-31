// ported from src/renderer.fx.js（FX 队列 / shakeOffset / drawFX 语义照抄，简化为世界空间实现）
// 源绘制项 → Unity 实现映射表：
// | 源 (renderer.fx.js)                  | Unity 实现                                  |
// |--------------------------------------|---------------------------------------------|
// | FX.float(text,wx,wy,color,big)       | Float(worldPos,text,kind)：世界空间 TextMesh |
// |   上升 y-T0*(0.5+ease*0.95)（y 向下） | y + T0*(0.5+ease*0.95)（Unity y 向上）        |
// |   dur big?2.1:1.7，k>0.72 后淡出      | 同公式                                       |
// |   字高 big?26:19，随机 ±10px 水平抖动  | 同公式                                       |
// | FX.pulse(wx,wy,color) dur 0.55        | Pulse(nodeId)：节点处扩散圆环                |
// |   r=T0*(0.3+k*0.75)                   | RingSprite 缩放 + alpha (1-k)*0.85           |
// | FX.shake(power,dur)                   | Shake(strength)：相机偏移（BoardView 消费）   |
// | shakeOffset: dx=Σsin(t*93)*d, dy=Σcos(t*81)*d, d=power*(1-k) | GetShakeOffset 同公式 |
// | 对象池                                | TextMesh / 圆环 SpriteRenderer 池化复用       |
using System.Collections.Generic;
using Sdt.Res;
using UnityEngine;

namespace Sdt.View
{
    public enum FxKind { Info, Coin, Damage, Heal, Big }

    /// <summary>
    /// 全局特效服务（对应 SDT.FX；TODO 契约：UI 可直接调用 Float/Shake/Pulse）。
    /// 逐帧驱动由惰性创建的常驻 FxDriver 承担；所有对象挂在 Board layer（被专用相机渲染）。
    /// </summary>
    public static class Fx
    {
        public static System.Func<bool> ReducedMotion;
        public static System.Func<bool> ReduceShake;
        const float T0 = 48f; // MAP.tile：飘字上升幅度 / 脉冲半径基准
        const float PulseDur = 0.55f;
        const float ShakeDur = 0.4f;

        sealed class FloatItem { public Vector2 pos; public string text; public Color color; public bool big; public float t0 = -1f, dur; public TextMesh mesh; }
        sealed class PulseItem { public Vector2 pos; public Color color; public float t0 = -1f; public SpriteRenderer ring; }
        sealed class ShakeItem { public float power, dur, t0 = -1f; }

        static readonly List<FloatItem> _floats = new List<FloatItem>();
        static readonly List<PulseItem> _pulses = new List<PulseItem>();
        static readonly List<ShakeItem> _shakes = new List<ShakeItem>();

        static FxDriver _driver;
        static Transform _poolRoot;
        static readonly Stack<TextMesh> _textPool = new Stack<TextMesh>();
        static readonly Stack<SpriteRenderer> _ringPool = new Stack<SpriteRenderer>();
        static int _boardLayer = -1;
        static float _time; // FxDriver 累计时间（对齐源 game.time，震屏相位用）

        static int BoardLayer
        {
            get
            {
                if (_boardLayer < 0)
                {
                    int l = LayerMask.NameToLayer("Board");
                    _boardLayer = l < 0 ? 8 : l; // TagManager 已定义 Board=8，取不到回退 8
                }
                return _boardLayer;
            }
        }

        static string FxSorting => System.Array.Exists(SortingLayer.layers, l => l.name == "BoardFx") ? "BoardFx" : "Default";

        static void EnsureDriver()
        {
            if (_driver != null) return;
            var go = new GameObject("Sdt.Fx");
            go.layer = BoardLayer;
            _driver = go.AddComponent<FxDriver>();
            _poolRoot = new GameObject("Pool") { transform = { parent = go.transform } }.transform;
            _poolRoot.gameObject.layer = BoardLayer;
            Object.DontDestroyOnLoad(go);
        }

        // FxKind → 源调用方颜色口径（金币金 / 伤害红 / 治疗绿 / Big 米金加大 / 中性米金）
        static Color ColorOf(FxKind kind)
        {
            switch (kind)
            {
                case FxKind.Coin: return BoardGfx.Hex("#f5c542");
                case FxKind.Damage: return BoardGfx.Rgba(255, 122, 110, 1f);
                case FxKind.Heal: return BoardGfx.Rgba(126, 226, 168, 1f);
                case FxKind.Big: return BoardGfx.Hex("#f2e2b8");
                default: return BoardGfx.Hex("#e8d4ac");
            }
        }

        /// <summary>飘字：源 FX.float(text, wx, wy, color, big)。dur = big?2.1:1.7（v0.22 加大加久）。</summary>
        public static void Float(Vector3 worldPos, string text, FxKind kind)
        {
            EnsureDriver();
            bool big = kind == FxKind.Big;
            var mesh = TakeText(big);
            var f = new FloatItem
            {
                // 源：x 抖动 ±10px 随机；y 原样
                pos = new Vector2(worldPos.x + (Random.value - 0.5f) * 10f, worldPos.y),
                text = text, color = ColorOf(kind), big = big,
                dur = big ? 2.1f : 1.7f, mesh = mesh,
            };
            mesh.text = text;
            mesh.color = f.color;
            mesh.transform.position = new Vector3(f.pos.x, f.pos.y, 0f);
            _floats.Add(f);
        }

        /// <summary>相机震屏：源 FX.shake(power, dur)。偏移经 BoardView.GetShakeOffset 消费。</summary>
        public static void Shake(float strength, float dur = ShakeDur)
        {
            if(ReducedMotion?.Invoke()==true||ReduceShake?.Invoke()==true)return;
            EnsureDriver();
            _shakes.Add(new ShakeItem { power = strength, dur = dur });
        }

        /// <summary>节点落点脉冲：源 FX.pulse(wx, wy, color)，dur 0.55；nodeId 经 BoardViewHost 解析，找不到则忽略。</summary>
        public static void Pulse(string nodeId)
        {
            if(ReducedMotion?.Invoke()==true)return;
            var view = BoardViewHost.View;
            if (view == null) return;
            var pos = view.NodePosition(nodeId);
            if (pos == new Vector2(float.MinValue, float.MinValue)) return;
            EnsureDriver();
            var ring = TakeRing();
            var p = new PulseItem { pos = pos, color = BoardGfx.Rgba(245, 197, 66, 1f), ring = ring };
            ring.color = p.color;
            ring.transform.position = new Vector3(pos.x, pos.y, 0f);
            _pulses.Add(p);
        }

        public static void Clear()
        {
            foreach (var f in _floats) Recycle(f.mesh, _textPool);
            foreach (var p in _pulses) Recycle(p.ring);
            _floats.Clear(); _pulses.Clear(); _shakes.Clear();
        }

        // renderer.fx.js shakeOffset(t)：dx=Σsin(t*93)*d，dy=Σcos(t*81)*d，d=power*(1-k)。
        // t 用 FxDriver 累计时间（BoardView 每帧读取套到相机位置上）。
        internal static Vector2 GetShakeOffset() { if(ReducedMotion?.Invoke()==true||ReduceShake?.Invoke()==true){_shakes.Clear();return Vector2.zero;} float t = _time; return ShakeOffsetCore(t); }

        static Vector2 ShakeOffsetCore(float t)
        {
            float dx = 0f, dy = 0f;
            for (int i = _shakes.Count - 1; i >= 0; i--)
            {
                var s = _shakes[i];
                if (s.t0 < 0f) s.t0 = t;
                float k = (t - s.t0) / s.dur;
                if (k >= 1f) { _shakes.RemoveAt(i); continue; }
                float d = s.power * (1f - k);
                dx += Mathf.Sin(t * 93f) * d;
                dy += Mathf.Cos(t * 81f) * d;
            }
            return new Vector2(dx, dy);
        }

        // ---------- 逐帧驱动（FxDriver 调用；t 为累计时间，对齐源 game.time） ----------
        internal static void Tick(float t)
        {
            _time = t;
            if(ReducedMotion?.Invoke()==true){foreach(var pulse in _pulses)Recycle(pulse.ring);_pulses.Clear();}
            // 落点脉冲：r = T0*(0.3+k*0.75)，alpha = (1-k)*0.85
            for (int i = _pulses.Count - 1; i >= 0; i--)
            {
                var p = _pulses[i];
                if (p.t0 < 0f) p.t0 = t;
                float k = (t - p.t0) / PulseDur;
                if (k >= 1f) { Recycle(p.ring); _pulses.RemoveAt(i); continue; }
                float d = T0 * (0.3f + k * 0.75f) * 2f;
                p.ring.transform.localScale = new Vector3(d, d, 1f);
                var c = p.color; c.a = (1f - k) * 0.85f; p.ring.color = c;
            }
            // 飘字：ease = 1-(1-k)^3；k>0.72 后淡出；上升 T0*(0.5+ease*0.95)
            for (int i = _floats.Count - 1; i >= 0; i--)
            {
                var f = _floats[i];
                if (f.t0 < 0f) f.t0 = t;
                float k = (t - f.t0) / f.dur;
                if (k >= 1f) { Recycle(f.mesh, _textPool); _floats.RemoveAt(i); continue; }
                float ease = 1f - Mathf.Pow(1f - k, 3f);
                var c = f.color; c.a = k > 0.72f ? (1f - k) / 0.28f : 1f; f.mesh.color = c;
                f.mesh.transform.position = new Vector3(f.pos.x, f.pos.y + (ReducedMotion?.Invoke()==true?0:T0 * (0.5f + ease * 0.95f)), 0f);
            }
        }

        // ---------- 对象池 ----------
        static TextMesh TakeText(bool big)
        {
            var m = _textPool.Count > 0 ? _textPool.Pop() : CreateText();
            m.characterSize = (big ? 26f : 19f) / 10f;  // 源字号 big?26:19（世界像素字高）
            m.gameObject.SetActive(true);
            return m;
        }

        static TextMesh CreateText()
        {
            var go = new GameObject("FxText");
            go.layer = BoardLayer;
            go.transform.SetParent(_poolRoot, false);
            var m = go.AddComponent<TextMesh>();
            m.anchor = TextAnchor.MiddleCenter;
            m.alignment = TextAlignment.Center;
            m.fontSize = 100;
            m.font = Res.Res.MonoBold ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            m.GetComponent<MeshRenderer>().sortingLayerName = FxSorting;
            return m;
        }

        static SpriteRenderer TakeRing()
        {
            var r = _ringPool.Count > 0 ? _ringPool.Pop() : CreateRing();
            r.gameObject.SetActive(true);
            return r;
        }

        static SpriteRenderer CreateRing()
        {
            var go = new GameObject("FxRing");
            go.layer = BoardLayer;
            go.transform.SetParent(_poolRoot, false);
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = BoardGfx.Ring();
            r.sortingLayerName = FxSorting;
            return r;
        }

        static void Recycle(TextMesh m, Stack<TextMesh> pool) { m.gameObject.SetActive(false); pool.Push(m); }
        static void Recycle(SpriteRenderer r) { r.gameObject.SetActive(false); _ringPool.Push(r); }

        // ---------- 驱动组件（常驻，DontDestroyOnLoad） ----------
        sealed class FxDriver : MonoBehaviour
        {
            float _t;
            void Update()
            {
                float dt = Mathf.Min(0.05f, Time.deltaTime); // 契约 §0：可变步长钳制
                _t += dt;
                Tick(_t);
            }
        }
    }
}
