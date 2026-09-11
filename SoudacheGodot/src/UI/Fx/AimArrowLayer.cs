using Godot;
using System;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 目标指示箭头（sts2-reference §1 NTargetingArrow 19 节贝塞尔 + 网页 aimArrowUpdate 弓背朝上）：
/// 19 个圆点沿二次贝塞尔布点、scale 沿线 0.28→0.42；控制点 = 网页/STS2 公式
/// cx = from.x - (head.x-from.x)·0.25，cy = from.y &gt; 540 ? head.y+(head.y-from.y)·0.5 : head.y·0.75+from.y·0.25；
/// 箭头锚点偏移 (0,88) 缩放后 ≈ 头部后退；敌红 #e0523c / 友绿 #4ecf8e / 空地金 #d9c07a（网页 AIM_COLOR）。
/// 单 Control _Draw 实现（19 节点等价的矢量绘制）。最小 API：
/// AimArrowLayer.Create(parent) → Show(from, head, color) / Hide()。
/// </summary>
public partial class AimArrowLayer : Control
{
    public const int NodeCount = 19;                      // 19 节
    public const float NodeScaleFrom = 0.28f;             // 沿线 0.28→0.42
    public const float NodeScaleTo = 0.42f;
    public static readonly Color EnemyColor = new("e0523c");
    public static readonly Color SelfColor = new("4ecf8e");
    public static readonly Color AnyColor = new("d9c07a");

    private Vector2 _from;
    private Vector2 _head;
    private Color _color = EnemyColor;
    private bool _visible;

    public static AimArrowLayer Create(Control parent)
    {
        var layer = new AimArrowLayer
        {
            MouseFilter = Control.MouseFilterEnum.Ignore,
            ZIndex = 60,                                     // 网页 #aimArrow z-index 60
            Visible = false,                                 // 初始隐藏（拖拽演示/真实拖拽共用 Show 唤醒）
        };
        layer.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        parent.AddChild(layer);
        return layer;
    }

    public void Show(Vector2 from, Vector2 head, Color color)
    {
        _from = from;
        _head = head;
        _color = color;
        if (!_visible)
        {
            _visible = true;
            Visible = true;
        }
        QueueRedraw();
    }

    public new void Hide()
    {
        _visible = false;
        Visible = false;
    }

    /// <summary>STS2 控制点公式（§1 NTargetingArrow；540=1080 基准半高，按视口高缩放）。</summary>
    public static Vector2 ControlPoint(Vector2 from, Vector2 head, float referenceHeight = 1080f)
    {
        var cx = from.X - (head.X - from.X) * 0.25f;
        var halfH = referenceHeight * 0.5f;
        var cy = from.Y > halfH
            ? head.Y + (head.Y - from.Y) * 0.5f
            : head.Y * 0.75f + from.Y * 0.25f;
        return new Vector2(cx, cy);
    }

    public override void _Draw()
    {
        if (!_visible) return;
        var c0 = ControlPoint(_from, _head, GetViewportRect().Size.Y);
        for (var i = 0; i < NodeCount; i++)
        {
            var t = (i + 1) / (float)NodeCount;
            var p = Sts2Fx.Bezier(_from, _head, c0, t);
            var scale = Mathf.Lerp(NodeScaleFrom, NodeScaleTo, t);
            var radius = 7f * scale;
            DrawCircle(p, radius, new Color(_color, 0.95f));
            DrawArc(p, radius + 1.5f, 0, Mathf.Tau, 20, new Color(0.03f, 0.04f, 0.05f, 0.9f), 1.5f);
        }
        // 箭头头部：沿末端切线方向的三角（网页 moveTo x2,y2 + 两侧 8px）
        var tangent = 2f * (1f - 1f) * (c0 - _from) + 2f * 1f * (_head - c0);
        if (tangent.LengthSquared() < 0.01f) tangent = _head - _from;
        var dir = tangent.Normalized();
        var side = new Vector2(-dir.Y, dir.X);
        var tip = _head + dir * 17f;
        DrawColoredPolygon(new[] { tip, _head + side * 8f, _head - side * 8f }, _color);
        DrawPolyline(new[] { tip, _head + side * 8f, _head - side * 8f, tip }, new Color(0.03f, 0.04f, 0.05f), 1.5f);
        // 起点小圆（网页 arc x1,y1 r6）
        DrawCircle(_from, 6f, _color);
        DrawArc(_from, 7.5f, 0, Mathf.Tau, 24, new Color(0.03f, 0.04f, 0.05f), 2f);
    }
}
