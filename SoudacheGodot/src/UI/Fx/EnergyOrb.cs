using Godot;
using System.Collections.Generic;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 能量球（sts2-reference §3 NEnergyCounter + 网页 battle.css .sts-energy 88px 圆）：
/// - 待机差速旋转：每层 RotationDegrees += delta·30·(层号+1)，能量 0 时降速 5·(层号+1)；
/// - 增减脉冲：brightness 1→1.9(×saturate 1.3)→1 共 380ms ease-out（网页 animateBattleTransition 能量脉冲）；
/// - 视觉：暗色圆底 + 白 35% 边 + 内嵌环（battle.css .sts-energy），中央大数字 30px + /上限 13px。
/// 最小 API：EnergyOrb.Create() → SetEnergy(current,max) → 需要时 Pulse()。
/// </summary>
public partial class EnergyOrb : Control
{
    private const float SizePx = 88f;                     // battle.css .sts-energy 88×88
    private const float IdleRatePerLayer = 30f;           // °/s × (层号+1)
    private const float EmptyRatePerLayer = 5f;           // 能量 0 时降速 5
    public const double PulseSeconds = 0.38;              // 网页能量脉冲 380ms

    private readonly List<RingLayer> _rings = new();
    private Label _value = null!;
    private Label _max = null!;
    private Tween? _pulse;
    private float _glow; // 0=常态，1=脉冲峰值；驱动 selfModulate

    /// <summary>创建 88×88 能量球（宿主负责加入容器）。</summary>
    public static EnergyOrb Create()
    {
        var orb = new EnergyOrb
        {
            CustomMinimumSize = new Vector2(SizePx, SizePx),
            Size = new Vector2(SizePx, SizePx),
            MouseFilter = Control.MouseFilterEnum.Ignore,
            TooltipText = "能量：每回合固定回复",
        };
        return orb;
    }

    public override void _Ready()
    {
        var backdrop = new Panel { MouseFilter = Control.MouseFilterEnum.Ignore };
        backdrop.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var box = new StyleBoxFlat
        {
            BgColor = new Color(0.10f, 0.085f, 0.05f, 0.85f), // radial 暗金底（battle.css energy-orb 渐变近似）
            CornerRadiusTopLeft = (int)SizePx / 2, CornerRadiusTopRight = (int)SizePx / 2,
            CornerRadiusBottomLeft = (int)SizePx / 2, CornerRadiusBottomRight = (int)SizePx / 2,
            BorderColor = new Color(1, 1, 1, 0.35f),          // border 2px rgba(255,255,255,.35)
            BorderWidthLeft = 2, BorderWidthRight = 2, BorderWidthTop = 2, BorderWidthBottom = 2,
        };
        backdrop.AddThemeStyleboxOverride("panel", box);
        AddChild(backdrop);

        // 两层差速旋转装饰环（碎弧），层号 0/1 → 30/60 °/s
        _rings.Add(new RingLayer(0, new Color(0.94f, 0.82f, 0.55f, 0.5f)) { Size = new Vector2(SizePx, SizePx) });
        _rings.Add(new RingLayer(1, new Color(0.55f, 0.85f, 0.8f, 0.4f)) { Size = new Vector2(SizePx, SizePx) });
        foreach (var ring in _rings) AddChild(ring);

        // 中央数字（sts-energy b 30px Cascadia）+ /上限（13px）
        var center = new VBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        center.Alignment = BoxContainer.AlignmentMode.Center;
        AddChild(center);
        var valueRow = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center, MouseFilter = Control.MouseFilterEnum.Ignore };
        center.AddChild(valueRow);
        _value = new Label { Text = "0" };
        _value.AddThemeFontSizeOverride("font_size", 30);
        _value.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        _value.AddThemeColorOverride("font_color", new Color("f0f0f0"));
        _value.AddThemeColorOverride("font_outline_color", new Color(0, 0, 0, 0.92f));
        _value.AddThemeConstantOverride("outline_size", 4);
        valueRow.AddChild(_value);
        _max = new Label { Text = "/3" };
        _max.AddThemeFontSizeOverride("font_size", 13);
        _max.AddThemeFontOverride("font", ThemeTokens.Mono);
        _max.AddThemeColorOverride("font_color", new Color("a8a8a8"));
        _max.AddThemeColorOverride("font_outline_color", new Color(0, 0, 0, 0.9f));
        _max.AddThemeConstantOverride("outline_size", 3);
        valueRow.AddChild(_max);
    }

    public void SetEnergy(int current, int max)
    {
        if (_value == null) return;
        _value.Text = current.ToString();
        _max.Text = $"/{max}";
        // 能量 0：红字 outline #501717（sts2-reference §3 能量 0 红字）
        var empty = current <= 0;
        _value.AddThemeColorOverride("font_color", empty ? new Color("e0523c") : new Color("f0f0f0"));
        _value.AddThemeColorOverride("font_outline_color", empty ? new Color("501717") : new Color(0, 0, 0, 0.92f));
        foreach (var ring in _rings) ring.Empty = empty;
    }

    /// <summary>能量增减脉冲：brightness 1→1.9→1 / 380ms（网页 filter brightness 脉冲）。</summary>
    public void Pulse()
    {
        _pulse?.Kill();
        _pulse = CreateTween();
        _pulse.TweenMethod(Callable.From<float>(v => _glow = v), 0.0f, 1.0f, PulseSeconds * 0.4);
        _pulse.TweenMethod(Callable.From<float>(v => _glow = 1f - v), 0.0f, 1.0f, PulseSeconds * 0.6)
            .SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.Out);
        _pulse.Finished += () => _glow = 0f;
    }

    public override void _Process(double delta)
    {
        foreach (var ring in _rings) ring.Advance(delta);
        if (_glow > 0.001f)
        {
            var b = 1f + 0.9f * _glow;             // brightness 1→1.9
            var s = 1f + 0.3f * _glow;             // saturate 1.3
            SelfModulate = new Color(Mathf.Clamp(b, 0, 2), Mathf.Clamp(b * 0.99f, 0, 2), Mathf.Clamp(b * 0.95f * s, 0, 2));
        }
        else if (SelfModulate != Colors.White)
        {
            SelfModulate = Colors.White;
        }
    }

    /// <summary>单层旋转碎弧（_Draw 弧段），Advance 里按差速公式累计角度。</summary>
    private sealed partial class RingLayer : Control
    {
        private readonly int _layer;
        private readonly Color _color;
        private float _degrees;
        private double _accum;

        public bool Empty;

        public RingLayer(int layer, Color color)
        {
            _layer = layer;
            _color = color;
            MouseFilter = Control.MouseFilterEnum.Ignore;
        }

        public void Advance(double delta)
        {
            var rate = (Empty ? Sts2Fx.EmptyRingRatePerLayer : Sts2Fx.RingRatePerLayer) * (_layer + 1);
            _degrees += (float)(rate * delta);
            if (_degrees >= 360f) _degrees -= 360f;
            RotationDegrees = _degrees;
        }

        public override void _Draw()
        {
            var c = Size * 0.5f;
            var r = Size.X * 0.5f - 9f - _layer * 4f;
            // 碎弧：3 段 40° 弧均布（旋转时呈能量流动感）
            for (var i = 0; i < 3; i++)
            {
                var start = Mathf.DegToRad(i * 120f);
                DrawArc(c, r, start, start + Mathf.DegToRad(40f), 20, _color, 2f, antialiased: true);
            }
        }
    }
}
