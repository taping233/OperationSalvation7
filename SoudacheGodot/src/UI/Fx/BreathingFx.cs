using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 呼吸光 / 呼吸缩放（sts2-reference §4 NNormalMapPoint：scale = 1.2+0.25·sin(4t) 随机初相位；
/// §5 结束回合按钮：glow alpha 0.8s 循环到 0.75）。
/// 只动 transform/modulate（批次 7b 性能铁律：常驻动画不碰尺寸/结构）。
/// 最小 API：BreathingFx.StartScale(node) / BreathingFx.StartGlow(glowNode) / Stop(node)。
/// </summary>
public static class BreathingFx
{
    public const float MapBaseScale = 1.2f;   // 地图可走节点基准
    public const float MapAmplitude = 0.25f;  // ±0.25
    public const float MapAngFreq = 4f;       // sin(4t)
    public const double GlowLoopS = 0.8;      // 结束回合呼吸光循环
    public const float GlowPeakAlpha = 0.75f;

    public static BreathingScaleDriver StartScale(Control target, float baseScale = MapBaseScale,
        float amplitude = MapAmplitude, float angFreq = MapAngFreq, float? phaseDeg = null)
    {
        StopScale(target);
        var driver = new BreathingScaleDriver(target, baseScale, amplitude, angFreq,
            phaseDeg ?? (float)GD.RandRange(0.0, 360.0)) { Name = "BreathingScaleDriver" };
        target.AddChild(driver);
        return driver;
    }

    public static BreathingGlowDriver StartGlow(Control glow, float peakAlpha = GlowPeakAlpha, double loopSeconds = GlowLoopS)
    {
        StopGlow(glow);
        var driver = new BreathingGlowDriver(glow, peakAlpha, loopSeconds) { Name = "BreathingGlowDriver" };
        glow.AddChild(driver);
        return driver;
    }

    public static void StopScale(Control target)
    {
        target.GetNodeOrNull<BreathingScaleDriver>("BreathingScaleDriver")?.QueueFree();
        target.Scale = Vector2.One;
    }

    public static void StopGlow(Control glow)
    {
        glow.GetNodeOrNull<BreathingGlowDriver>("BreathingGlowDriver")?.QueueFree();
        glow.Modulate = Colors.White;
        glow.Scale = Vector2.One;
    }
}

/// <summary>呼吸缩放驱动：scale = base + amplitude·sin(angFreq·t + phase)，随机初相位。</summary>
public partial class BreathingScaleDriver : Node
{
    private readonly Control _target;
    private readonly float _baseScale;
    private readonly float _amplitude;
    private readonly float _angFreq;
    private readonly float _phaseRad;
    private double _t;

    public BreathingScaleDriver(Control target, float baseScale, float amplitude, float angFreq, float phaseDeg)
    {
        _target = target;
        _baseScale = baseScale;
        _amplitude = amplitude;
        _angFreq = angFreq;
        _phaseRad = Mathf.DegToRad(phaseDeg);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _target != null && IsInstanceValid(_target))
            _target.Scale = Vector2.One;
        base.Dispose(disposing);
    }

    public override void _Process(double delta)
    {
        _t += delta;
        _target.Scale = Vector2.One * (_baseScale + _amplitude * Mathf.Sin(_angFreq * (float)_t + _phaseRad));
    }
}
