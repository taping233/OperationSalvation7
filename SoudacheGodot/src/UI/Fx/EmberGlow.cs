using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 「开始探索」余烬光（winter.css .ak-start::before + akEmber 1:1）：
/// 230×160 椭圆径向光 radial-gradient(ellipse at 62% 72%, #ff9a3c5c, #c23c2a30 45%, transparent 72%)
/// blur(6px)，透明度 .7↔1 以 3.2s ease-in-out 无限交替。
/// </summary>
public partial class EmberGlow : Control
{
    private const string ShaderCode = """
        shader_type canvas_item;
        void fragment() {
            vec2 at = vec2(0.62, 0.72);
            vec2 scaled = (UV - at) / vec2(0.55, 1.0);
            float d = length(scaled) * 1.44;
            float inner = 1.0 - smoothstep(0.0, 0.45, d);
            float outer = 1.0 - smoothstep(0.0, 0.72, d);
            vec4 c1 = vec4(1.0, 0.604, 0.235, 0.36);  // #ff9a3c5c
            vec4 c2 = vec4(0.761, 0.235, 0.165, 0.19); // #c23c2a30
            vec4 col = mix(c2, c1, inner);
            float a = col.a * outer;
            COLOR = vec4(col.rgb, a);
        }
        """;

    private double _clockS;
    private ShaderMaterial? _material;

    public override void _Ready()
    {
        MouseFilter = Control.MouseFilterEnum.Ignore;
        CustomMinimumSize = new Vector2(230, 160);
        _material = new ShaderMaterial { Shader = new Shader { Code = ShaderCode } };
        Material = _material;
    }

    public override void _Process(double delta)
    {
        _clockS += delta;
        // akEmber: from opacity .7 to 1，3.2s ease-in-out alternate
        var phase = _clockS % 6.4 / 3.2;
        if (phase > 1) phase = 2 - phase;
        var alpha = Mathf.Lerp(0.7f, 1f, (float)phase);
        Modulate = new Color(1, 1, 1, alpha);
    }
}
