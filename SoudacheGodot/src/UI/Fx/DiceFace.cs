using System;
using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 骰面（对齐 ui.js buildDiceCube 的点阵与 base.css #diceFace 尺寸/配色）：
/// 54×54 米白圆角面（linear-gradient(160deg,#f4f2ec,#cfcabd) 近似 + 1px 边 #918a78），
/// 点为 radial 深色圆（#4a4a4a→#1b1b1b）。点阵 PIP_CELLS 与网页一致。
/// 网页为 CSS 3D 立方体翻滚；此处以旋转+落定弹跳（diceLand .38s cubic-bezier(.28,1.6,.4,1)）呈现。
/// </summary>
public partial class DiceFace : Control
{
    // ui.js PIP_CELLS：3×3 格位 → 点数
    private static readonly int[][] Pips =
    {
        Array.Empty<int>(),                                 // 0（未掷）
        new[] { 4 },                                        // 1
        new[] { 0, 8 },                                     // 2
        new[] { 0, 4, 8 },                                  // 3
        new[] { 0, 2, 6, 8 },                               // 4
        new[] { 0, 2, 4, 6, 8 },                            // 5
        new[] { 0, 2, 3, 5, 6 },                            // 6
    };

    private const float SizePx = 54f;
    private int _face = 1;

    public DiceFace()
    {
        CustomMinimumSize = new Vector2(SizePx, SizePx);
        MouseFilter = Control.MouseFilterEnum.Ignore;
    }

    public override void _Draw()
    {
        var rect = new Rect2(Vector2.Zero, new Vector2(SizePx, SizePx));
        // 面底：左上亮、右下暗的米白
        DrawRect(rect, new Color("cfcabd"));
        var inner = rect.Grow(-2f);
        DrawRect(inner, new Color("f4f2ec"));
        DrawRect(rect, new Color("918a78"), false, 1f);
        var face = Pips[Math.Clamp(_face, 0, 6)];
        if (face.Length == 0) return;
        var cell = (SizePx - 14f) / 3f;
        foreach (var cellIndex in face)
        {
            var column = cellIndex % 3;
            var row = cellIndex / 3;
            var center = new Vector2(7f + column * cell + cell / 2f, 7f + row * cell + cell / 2f);
            DrawCircle(center, cell * 0.28f, new Color("1b1b1b"));
            DrawCircle(center + new Vector2(-1f, -1f), cell * 0.28f * 0.5f, new Color("4a4a4a"));
        }
    }

    /// <summary>显示点数并播放落定弹跳（同点数跳过，对齐 drawDice 的 _drawn 判断）。</summary>
    public void ShowFace(int value)
    {
        var next = Math.Clamp(value, 1, 6);
        if (next == _face) return;
        _face = next;
        QueueRedraw();
        PivotOffset = new Vector2(SizePx / 2f, SizePx / 2f);
        var tween = CreateTween();
        RotationDegrees = 5f;
        Scale = new Vector2(1.05f, 1.05f);
        Position = Position;
        tween.TweenProperty(this, "rotation:degrees", 0.0, 0.38)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.Parallel().TweenProperty(this, "scale", Vector2.One, 0.38)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
    }
}
