using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 敌人意图浮动（sts2-reference §3 NIntent）：上下浮动 Position = Up*(sin(now_s·π+phase)·10+8)
/// ——振幅 10px、基线 +8px、周期 2s（sin(t·π)）、每实例随机相位；只动 transform（7b 性能铁律）。
/// 最小 API：IntentFloat.Attach(intentLabel)。
/// </summary>
public static class IntentFloat
{
    public const float AmplitudePx = 10f;
    public const float BaselinePx = 8f;

    public static IntentFloatDriver Attach(Control target)
    {
        var driver = new IntentFloatDriver(target) { Name = "IntentFloatDriver" };
        target.AddChild(driver);
        return driver;
    }
}

public partial class IntentFloatDriver : Node
{
    private readonly Control _target;
    private readonly float _phase;
    private double _t;

    public IntentFloatDriver(Control target)
    {
        _target = target;
        _phase = (float)GD.RandRange(0.0, Mathf.Tau); // 随机相位
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _target != null && IsInstanceValid(_target))
            _target.Position = _basePosition;
        base.Dispose(disposing);
    }

    private Vector2 _basePosition;

    public override void _Ready() => _basePosition = _target.Position;

    public override void _Process(double delta)
    {
        _t += delta;
        // sin(t·π+phase) 周期 2s；基线 +8px（向上为负 Y）
        var offset = IntentFloat.BaselinePx + IntentFloat.AmplitudePx * Mathf.Sin((float)_t * Mathf.Pi + _phase);
        _target.Position = _basePosition + new Vector2(0, -offset);
    }
}
