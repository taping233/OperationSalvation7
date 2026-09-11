using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>呼吸光驱动：alpha 0.15→peak 0.75、scale 1→1.12，默认 0.8s 循环（sts2-reference §5 结束回合按钮）。</summary>
public partial class BreathingGlowDriver : Node
{
    private readonly Control _glow;
    private readonly float _peak;
    private readonly double _loop;
    private double _t;

    public BreathingGlowDriver(Control glow, float peak, double loop)
    {
        _glow = glow;
        _peak = peak;
        _loop = loop;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _glow != null && IsInstanceValid(_glow))
        {
            _glow.Modulate = Colors.White;
            _glow.Scale = Vector2.One;
        }
        base.Dispose(disposing);
    }

    public override void _Process(double delta)
    {
        _t = (_t + delta) % _loop;
        var u = (float)(_t / _loop);
        // 0.8s 循环的蓄→放节奏：alpha 0.15↔peak，scale 1↔1.12
        var pulse = Mathf.Sin(u * Mathf.Pi);
        _glow.Modulate = new Color(1, 1, 1, Mathf.Lerp(0.15f, _peak, pulse));
        _glow.Scale = Vector2.One * Mathf.Lerp(1f, 1.12f, pulse);
    }
}
