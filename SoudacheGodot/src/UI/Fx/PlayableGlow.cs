using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 卡牌可打出高亮（sts2-reference §5 稀有度视觉③ 可打高亮 shader width 参数体系）：
/// 显示 → width 0.075 用 0.5s CubicOut；点击闪光 0.1s → 0.15 再 0.35s CubicOut 回 0.075；
/// 可打色 (0, 0.957, 0.988, 0.98)（aqua 系）。圆角矩形 SDF 只画卡体外的辉光环，
/// 作为卡按钮子层覆盖（卡面区域内 alpha=0，不遮内容）。
/// 最小 API：PlayableGlow.AttachCard(cardButton) → SetPlayable(true/false) → Flash()。
/// </summary>
public partial class PlayableGlow : ColorRect
{
    public const float IdleWidth = 0.075f;      // 常亮 width 0.075
    public const float FlashWidth = 0.15f;      // 点击闪光 0.15
    public static readonly Color GlowColor = new(0f, 0.957f, 0.988f, 0.98f);
    public const double ShowSeconds = 0.5;      // 显示 0.5s CubicOut
    public const double FlashOutSeconds = 0.1;
    public const double FlashBackSeconds = 0.35;

    private const string ShaderCode = """
        shader_type canvas_item;
        uniform float width = 0.075;            // 辉光带宽度（相对卡宽 UV）
        uniform vec4 glow_color : source_color = vec4(0.0, 0.957, 0.988, 0.98);
        uniform float card_half_w = 0.403;      // 卡体半宽 UV（142×180 卡在 176×214 宿主内：71/176）
        uniform float card_half_h = 0.421;      // 90/214
        uniform float corner = 0.045;
        void fragment() {
            vec2 p = UV - vec2(0.5);
            vec2 half_size = vec2(card_half_w, card_half_h);
            vec2 q = abs(p) - half_size + vec2(corner);
            float sd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - corner;
            // 卡体内透明；体外沿法线方向 [0, width] 内线性衰减出辉光环
            float band = 1.0 - clamp(sd / width, 0.0, 1.0);
            float ring = sd > 0.0 ? band : 0.0;
            COLOR = vec4(glow_color.rgb, glow_color.a * ring);
        }
        """;

    private ShaderMaterial _material = null!;
    private Tween? _tween;
    private bool _playable;

    public static PlayableGlow AttachCard(Control card)
    {
        // 宿主比卡大 34×34，辉光环画在卡体外缘（子层随卡移动，children 覆盖父绘制但不遮卡体：shader 内部透明）
        var glow = new PlayableGlow
        {
            MouseFilter = Control.MouseFilterEnum.Ignore,
            Visible = false,
        };
        glow.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        glow.OffsetLeft = -17; glow.OffsetTop = -17; glow.OffsetRight = 17; glow.OffsetBottom = 17;
        glow._material = new ShaderMaterial { Shader = new Shader { Code = ShaderCode } };
        glow.Material = glow._material;
        card.AddChild(glow);
        return glow;
    }

    /// <summary>可打性变化：true 常亮（0.5s CubicOut 浮现），false 熄灭。</summary>
    public void SetPlayable(bool playable)
    {
        if (_playable == playable) return;
        _playable = playable;
        _tween?.Kill();
        _tween = CreateTween();
        if (playable)
        {
            Visible = true;
            _material.SetShaderParameter("width", 0f);
            _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("width", v)), 0.0f, IdleWidth, ShowSeconds)
                .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        }
        else
        {
            var current = _material.GetShaderParameter("width");
            var from = current.VariantType == Variant.Type.Nil ? IdleWidth : current.AsSingle();
            _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("width", v)), from, 0f, 0.25);
            _tween.Finished += () => Visible = false;
        }
    }

    /// <summary>点击闪光：0.1s → 0.15 再 0.35s CubicOut 回 0.075。</summary>
    public void Flash()
    {
        if (!_playable) return;
        _tween?.Kill();
        _tween = CreateTween();
        _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("width", v)), IdleWidth, FlashWidth, FlashOutSeconds);
        _tween.TweenMethod(Callable.From<float>(v => _material.SetShaderParameter("width", v)), FlashWidth, IdleWidth, FlashBackSeconds)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
    }

    public override void _ExitTree() => _tween?.Kill();
}
