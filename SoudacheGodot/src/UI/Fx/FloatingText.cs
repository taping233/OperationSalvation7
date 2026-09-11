using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 伤害/治疗/格挡飘字（sts2-reference §2 NDamageNumVfx 及治疗/格挡条目）。
/// 伤害：生成位=喷点+(0,-100)+rand(±10,-5..5)；初速 (rand(-100,100), rand(-800,-700))，重力 (0,2000) 抛物线；
///       初始 scale 2.5→1.0 1.2s QuadOut、颜色→奶油色 #FFF6E2 0.5s CubicOut、alpha→0 2.0s QuadIn、旋转 ±5°。
/// 治疗：scale 放大态→1.0 0.5s QuadOut，alpha 延迟 1.0s 后 0.3s 淡出。
/// 格挡：上浮 -250px/2.0s QuadOut，scale 1→0.6/2s，白→#21C0FF。
/// 最小 API：FloatingText.Spawn(parent, text, at, FloatKind.Damage)。
/// </summary>
public enum FloatKind { Damage, Heal, Block }

public static class FloatingText
{
    private static readonly Color Cream = new("fff6e2");   // STS2 色板 cream
    private static readonly Color BlockBlue = new("21c0ff");

    public static Label Spawn(Node parent, string text, Vector2 at, FloatKind kind)
    {
        var label = new Label { Text = text };
        label.AddThemeFontSizeOverride("font_size", 26);
        label.AddThemeColorOverride("font_color", kind switch
        {
            FloatKind.Damage => ThemeTokens.ResAtk,
            FloatKind.Heal => ThemeTokens.Ok,
            _ => Colors.White,
        });
        label.AddThemeColorOverride("font_outline_color", new Color(0, 0, 0, 0.85f));
        label.AddThemeConstantOverride("outline_size", 6);
        label.CustomMinimumSize = new Vector2(90, 34);
        label.HorizontalAlignment = HorizontalAlignment.Center;
        label.MouseFilter = Control.MouseFilterEnum.Ignore;
        parent.AddChild(label);
        label.ResetSize();
        label.PivotOffset = label.Size * 0.5f;
        label.Position = SpawnPoint(at, kind);
        label.Rotation = Mathf.DegToRad(kind == FloatKind.Damage ? (float)GD.RandRange(-5.0, 5.0) : 0f);

        var tween = label.CreateTween();
        switch (kind)
        {
            case FloatKind.Damage:
            {
                var p0 = label.Position;
                var v0 = new Vector2((float)GD.RandRange(-100.0, 100.0), (float)GD.RandRange(-800.0, -700.0));
                const float gravity = 2000f;
                tween.Parallel().TweenMethod(Callable.From<double>(t =>
                {
                    var s = (float)t;
                    label.Position = p0 + v0 * s + new Vector2(0, 0.5f * gravity * s * s);
                }), 0.0, 2.0, 2.0);
                tween.Parallel().TweenProperty(label, "scale", Vector2.One, 1.2).SetTrans(Tween.TransitionType.Quad).SetEase(Tween.EaseType.Out);
                label.Scale = Vector2.One * 2.5f;
                tween.Parallel().TweenProperty(label, "modulate", new Color(1, 1, 1, 0), 2.0).SetTrans(Tween.TransitionType.Quad).SetEase(Tween.EaseType.In);
                tween.Parallel().TweenProperty(label, "theme_override_colors/font_color", Cream, 0.5).SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
                break;
            }
            case FloatKind.Heal:
            {
                label.Scale = Vector2.One * 2.0f; // 放大态起步
                tween.TweenProperty(label, "scale", Vector2.One, 0.5).SetTrans(Tween.TransitionType.Quad).SetEase(Tween.EaseType.Out);
                tween.TweenProperty(label, "modulate:a", 0f, 0.3).SetDelay(0.5); // 0.5s 缩放结束 + 0.5s 延迟 = 1.0s 起淡出
                break;
            }
            default: // Block
            {
                tween.Parallel().TweenProperty(label, "position:y", label.Position.Y - 250f, 2.0).SetTrans(Tween.TransitionType.Quad).SetEase(Tween.EaseType.Out);
                tween.Parallel().TweenProperty(label, "scale", Vector2.One * 0.6f, 2.0);
                tween.Parallel().TweenProperty(label, "theme_override_colors/font_color", BlockBlue, 2.0);
                break;
            }
        }
        tween.Finished += label.QueueFree;
        return label;
    }

    private static Vector2 SpawnPoint(Vector2 at, FloatKind kind) => kind switch
    {
        FloatKind.Damage => at + new Vector2(0, -100) + new Vector2((float)GD.RandRange(-10.0, 10.0), (float)GD.RandRange(-5.0, 5.0)),
        _ => at,
    };
}
