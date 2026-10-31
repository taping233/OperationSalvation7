// ported from src/renderer.primitives.js（hash2/mixHex/shade 数学照抄）
// + 运行时代码生成的共享 Sprite（圆面/圆环/虚线圆环），替代 Canvas 2D 的 arc/stroke 手绘。
using UnityEngine;

namespace Sdt.View
{
    /// <summary>
    /// 绘图原语移植：
    /// - Hash2 / MixHex / Shade 与 renderer.primitives.js 逐算符一致（>>>0 → unchecked uint 截断）；
    /// - CircleSprite / RingSprite / DashedRingSprite 为运行时生成的白色贴图 Sprite
    ///   （靠 SpriteRenderer.color 着色），对应 Canvas 的 circle()/stroke()。
    /// 1 世界单位 = 1 源世界像素。
    /// </summary>
    internal static class BoardGfx
    {
        internal const float TAU = Mathf.PI * 2f;

        // renderer.primitives.js hash2(x, y)：确定性 hash → [0,1)
        internal static float Hash2(float x, float y)
        {
            uint v =unchecked((uint)((int)x * 374761393 + (int)y * 668265263));
            v = unchecked((v ^ (v >> 13)) * 1274126177u);
            v = (v ^ (v >> 16));
            return v / 4294967296f;
        }

        // renderer.primitives.js mixHex(a, b, ratio)：两色线性插值 → Color
        internal static Color MixHex(string aHex, string bHex, float ratio)
        {
            Color a = Hex(aHex), b = Hex(bHex);
            return Color.Lerp(a, b, ratio);
        }

        // renderer.primitives.js shade(hex, amount)：每通道 ±255*amount 后夹 0–255
        internal static Color Shade(Color c, float amount)
        {
            return new Color(
                Mathf.Clamp01(c.r + amount),
                Mathf.Clamp01(c.g + amount),
                Mathf.Clamp01(c.b + amount),
                c.a);
        }

        internal static Color Hex(string hex)
        {
            if (hex.StartsWith("#")) hex = hex.Substring(1);
            uint v = uint.Parse(hex, System.Globalization.NumberStyles.HexNumber);
            return new Color(((v >> 16) & 255) / 255f, ((v >> 8) & 255) / 255f, (v & 255) / 255f, 1f);
        }

        // rgba(r,g,b,a) 字符串 → Color（源码中大量颜色写成 rgba）
        internal static Color Rgba(byte r, byte g, byte b, float a)
        {
            return new Color(r / 255f, g / 255f, b / 255f, a);
        }

        // ---------- 运行时生成的共享 Sprite（白色，靠 color 着色） ----------

        static Sprite _circle, _ring, _dashed;

        /// <summary>实心圆（对应 Canvas circle()+fill），边缘 1px 反走样。直径 = 1 世界单位 × localScale。</summary>
        internal static Sprite Circle()
        {
            if (_circle != null) return _circle;
            return _circle = Bake(64, (x, y, r) => r >= 0.5f ? 1f - Mathf.Min(1f, (r - 0.5f) * 64f / 2f) : 1f);
        }

        /// <summary>细圆环（对应 circle()+stroke），线宽约 6%。直径 = 1 × localScale。</summary>
        internal static Sprite Ring()
        {
            if (_ring != null) return _ring;
            return _ring = Bake(128, (x, y, r) => AA(Mathf.Abs(r - 0.47f), 0.03f));
        }

        /// <summary>虚线圆环（对应 setLineDash 的微光环绕/法阵），12 段弧。直径 = 1 × localScale。</summary>
        internal static Sprite DashedRing()
        {
            if (_dashed != null) return _dashed;
            return _dashed = Bake(256, (x, y, r) =>
            {
                float a = Mathf.Atan2(y, x); // [-π,π)
                float seg = TAU / 12f;
                float f = Mathf.Repeat(a, seg) / seg;           // 段内相位
                bool on = f < 0.55f;                            // 55% 弧长着色
                return on ? AA(Mathf.Abs(r - 0.47f), 0.028f) : 0f;
            });
        }

        // 采样回调：返回 [0,1] alpha（x,y ∈ [-0.5,0.5]）
        delegate float Pix(float x, float y, float r);

        static Sprite Bake(int size, Pix f)
        {
            var tex = new Texture2D(size, size, TextureFormat.ARGB32, false)
            { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (int j = 0; j < size; j++)
                for (int i = 0; i < size; i++)
                {
                    float x = (i + 0.5f) / size - 0.5f, y = (j + 0.5f) / size - 0.5f;
                    float a = Mathf.Clamp01(f(x, y, new Vector2(x, y).magnitude));
                    byte b = (byte)(a * 255f);
                    px[j * size + i] = new Color32(255, 255, 255, b);
                }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size); // pixelsPerUnit=size ⇒ 导入尺寸=1 世界单位
        }

        // d = 距描边中心线的偏差，half = 半线宽（归一化比例）：d=0 全实，d≥half 透明
        static float AA(float d, float half) => Mathf.Clamp01((half - d) / half);
    }
}
