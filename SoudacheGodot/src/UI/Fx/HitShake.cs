using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 受击抖动（sts2-reference §2 NCreature.AnimShake，抖受击者非相机）：
/// offset.x = 10·sin(4t)·sin(0.5t)，t: 0→2π 历时 1.0s，CubicOut 包络。
/// 最小 API：HitShake.Shake(control)。
/// </summary>
public static class HitShake
{
    public static void Shake(Control target, float amplitudePx = Sts2Fx.ShakeAmplitudePx, double durationS = Sts2Fx.ShakeDurationS)
    {
        // 重复触发时先移除旧驱动，避免偏移叠加
        var existing = target.GetNodeOrNull<HitShakeDriver>("HitShakeDriver");
        existing?.QueueFree();
        var driver = new HitShakeDriver(target, amplitudePx, durationS) { Name = "HitShakeDriver" };
        target.AddChild(driver);
    }
}

/// <summary>HitShake 的逐帧驱动器。</summary>
public partial class HitShakeDriver : Node
{
    private readonly Control _target;
    private readonly float _amplitude;
    private readonly double _duration;
    private Vector2 _basePosition;
    private double _elapsed;

    public HitShakeDriver(Control target, float amplitude, double duration)
    {
        _target = target;
        _amplitude = amplitude;
        _duration = duration;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _target != null && IsInstanceValid(_target))
            _target.Position = _basePosition;
        base.Dispose(disposing);
    }

    public override void _Ready() => _basePosition = _target.Position;

    public override void _Process(double delta)
    {
        _elapsed += delta;
        var u = (float)Mathf.Clamp(_elapsed / _duration, 0.0, 1.0);
        var t = u * Mathf.Tau; // t: 0→2π
        var envelope = 1f - Sts2Fx.CubicOut(u);
        _target.Position = _basePosition + new Vector2(_amplitude * envelope * Mathf.Sin(4f * t) * Mathf.Sin(0.5f * t), 0);
        if (u >= 1f)
        {
            _target.Position = _basePosition;
            QueueFree();
        }
    }
}
