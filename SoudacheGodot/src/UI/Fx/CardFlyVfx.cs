using System;
using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 二次贝塞尔飞卡 + 变加速（sts2-reference §1 NCardFlyVfx）：
/// t += speed*dt, speed += accel*dt（speed 初始 rand(1.1,1.25)、accel rand(2.0,2.5)，约 0.5-0.6s 到达）；
/// 控制点 = 中点 Y 偏移 arcDir（目标在上半屏 -500，下半 +500+rand(100,400)）；
/// 旋转沿路径切线 LerpAngle(rot, tangent, delta*12)；前 1/3 路程 scale 1→0.1 且 modulate 白→黑，
/// 后段 0.1→-0.15（负 scale 翻转视觉缩没）；到点瞬间回调 onArrive。
/// 最小 API：CardFlyVfx.Launch(parent, card, from, to, arcOffsetY, onArrive)。
/// </summary>
public static class CardFlyVfx
{
    public static CardFly Launch(Node parent, Control card, Vector2 to,
        float? arcOffsetY = null, Action? onArrive = null)
    {
        var fly = new CardFly
        {
            From = card.Position,
            To = to,
            C0 = Sts2Fx.FlyControlPoint(card.Position, to, arcOffsetY),
            InitialRotation = card.Rotation,
        };
        card.Position = fly.From;
        parent.AddChild(fly);
        fly.Bind(card, onArrive);
        return fly;
    }
}

public partial class CardFly : Node
{
    public Vector2 From;
    public Vector2 To;
    public Vector2 C0;
    public float InitialRotation; // 弧度

    private Control _card = null!;
    private Action? _onArrive;
    private float _t;
    private float _speed = (float)GD.RandRange(Sts2Fx.FlySpeedMin, Sts2Fx.FlySpeedMax);
    private readonly float _accel = (float)GD.RandRange(Sts2Fx.FlyAccelMin, Sts2Fx.FlyAccelMax);

    public void Bind(Control card, Action? onArrive)
    {
        _card = card;
        _onArrive = onArrive;
    }

    public override void _Process(double delta)
    {
        if (_card == null || !IsInstanceValid(_card))
        {
            QueueFree();
            return;
        }

        var dt = (float)delta;
        _t = Mathf.Min(1f, _t + _speed * dt);
        _speed += _accel * dt;

        _card.Position = Sts2Fx.Bezier(From, To, C0, _t);

        // 切线方向 = 贝塞尔导数；旋转以 delta*12 追切线
        var tangent = 2f * (1f - _t) * (C0 - From) + 2f * _t * (To - C0);
        if (tangent.LengthSquared() > 0.01f)
        {
            var targetRad = Mathf.Atan2(tangent.Y, tangent.X);
            _card.Rotation = Mathf.LerpAngle(_card.Rotation, targetRad + InitialRotation, (float)Mathf.Clamp(delta * Sts2Fx.FlyTangentRate, 0.0, 1.0));
        }

        // 前 1/3 缩到 0.1 并白→黑，之后 0.1→-0.15 翻转缩没
        _card.Scale = _t < 1f / 3f
            ? Vector2.One * Mathf.Lerp(1f, 0.1f, _t * 3f)
            : Vector2.One * Mathf.Lerp(0.1f, Sts2Fx.FlyShrinkEndScale, (_t - 1f / 3f) / (2f / 3f));
        _card.Modulate = _t < 1f / 3f
            ? new Color(1, 1, 1).Lerp(new Color(0, 0, 0), _t * 3f)
            : new Color(0, 0, 0);

        if (_t >= 1f)
        {
            _onArrive?.Invoke();
            QueueFree();
        }
    }
}
