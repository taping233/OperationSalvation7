using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 全屏受击红闪（网页 battle.css .sts-hurtflash + stsHurtFlash 关键帧）：
/// 径向暗角（椭圆 50% 55%，transparent 42% → rgba(168,26,26,.5) 边缘），600ms ease-out 淡出，
/// 连续受击不叠层（复用同一层）。canvas_item shader 实现，只动 alpha。
/// 最小 API：HurtFlash.Attach(battleRoot) → Flash()。
/// </summary>
public partial class HurtFlash : Control
{
    public const double FadeSeconds = 0.6;   // stsHurtFlash .6s
    private ShaderMaterial _material = null!;
    private Tween? _tween;

    private const string ShaderCode = """
        shader_type canvas_item;
        uniform float strength : hint_range(0.0, 1.0) = 0.0;
        void fragment() {
            vec2 d = (UV - vec2(0.5, 0.55)) / vec2(0.5, 0.5);
            float dist = length(d);
            float edge = smoothstep(0.42, 1.0, dist);
            COLOR = vec4(0.659, 0.102, 0.102, edge * strength * 0.5); // rgba(168,26,26,.5)
        }
        """;

    public static HurtFlash Attach(Control parent)
    {
        var flash = new HurtFlash
        {
            MouseFilter = Control.MouseFilterEnum.Ignore,
            ZIndex = 70,                       // 网页 .sts-hurtflash z-index 70
            Visible = false,
        };
        flash.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var shader = new Shader { Code = ShaderCode };
        flash._material = new ShaderMaterial { Shader = shader };
        flash.Material = flash._material;
        parent.AddChild(flash);
        return flash;
    }

    /// <summary>红闪一次：0→1（15% 处峰值）→0，共 600ms；进行中则重放（不叠层）。</summary>
    public void Flash()
    {
        _tween?.Kill();
        Visible = true;
        _tween = CreateTween();
        _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("strength", v)), 0.0f, 1.0f, FadeSeconds * 0.15);
        _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("strength", 1f - v)), 0.0f, 1.0f, FadeSeconds * 0.85)
            .SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.Out);
        _tween.Finished += () => Visible = false;
    }

    public override void _ExitTree() => _tween?.Kill();
}
