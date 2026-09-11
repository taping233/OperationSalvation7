using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 按钮 0.05s/0.5s 双段反馈（sts2-reference §5：通用 bump = 0.05s 弹起/0.5s ExpoOut 回落）。
/// Pile 样式（牌堆按钮）：hover 1.25x 0.05s、移出 0.5s ExpoOut、按下 0.25s CubicOut+变暗；
/// Sink 样式（结束回合按钮）：hover 下沉 8px 0.5s CubicOut+变暗；
/// Standard：hover 1.04x 0.05s、回落 0.5s ExpoOut。
/// 最小 API：ButtonFeedback.Attach(button, ButtonFeedbackStyle.Pile)。
/// </summary>
public enum ButtonFeedbackStyle { Standard, Pile, Sink }

public static class ButtonFeedback
{
    public const float PileHoverScale = 1.25f;      // 牌堆按钮 hover 1.25x
    public const float StandardHoverScale = 1.04f;
    public const float SinkHoverPx = 8f;            // hover 下沉 8px
    public const float PressScale = 0.95f;          // 按压缩小
    public const float PressDim = 0.85f;            // 按下变暗 modulate
    public const double PressS = 0.25;              // 按压 0.25s CubicOut

    public static void Attach(Button button, ButtonFeedbackStyle style = ButtonFeedbackStyle.Standard)
    {
        button.MouseEntered += () => AnimateHover(button, style);
        button.MouseExited += () => AnimateSettle(button, style);
        button.ButtonDown += () => AnimatePress(button);
        button.ButtonUp += () => AnimateRelease(button, style);
    }

    private static void AnimateHover(Button button, ButtonFeedbackStyle style)
    {
        Kill(button);
        button.PivotOffset = button.Size * 0.5f;
        if (style == ButtonFeedbackStyle.Sink)
        {
            var tween = button.CreateTween();
            Keep(button, tween);
            tween.TweenProperty(button, "position:y", BaseY(button) + SinkHoverPx, Sts2Fx.ButtonSettleS)
                .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
            tween.Parallel().TweenProperty(button, "modulate", new Color(PressDim, PressDim, PressDim), 0.3);
            return;
        }
        var targetScale = style == ButtonFeedbackStyle.Pile ? PileHoverScale : StandardHoverScale;
        var pop = button.CreateTween();
        Keep(button, pop);
        pop.TweenProperty(button, "scale", Vector2.One * targetScale, Sts2Fx.ButtonPopS);
    }

    private static void AnimateSettle(Button button, ButtonFeedbackStyle style)
    {
        Kill(button);
        if (style == ButtonFeedbackStyle.Sink)
        {
            var tween = button.CreateTween();
            Keep(button, tween);
            tween.TweenProperty(button, "position:y", BaseY(button), Sts2Fx.ButtonSettleS);
            tween.SetExpoOut();
            tween.Parallel().TweenProperty(button, "modulate", Colors.White, 0.3);
            return;
        }
        var settle = button.CreateTween();
        settle.SetExpoOut();
        Keep(button, settle);
        settle.TweenProperty(button, "scale", Vector2.One, Sts2Fx.ButtonSettleS);
    }

    private static void AnimatePress(Button button)
    {
        Kill(button);
        button.PivotOffset = button.Size * 0.5f;
        var tween = button.CreateTween();
        Keep(button, tween);
        tween.TweenProperty(button, "scale", Vector2.One * PressScale, PressS)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.Parallel().TweenProperty(button, "modulate", new Color(PressDim, PressDim, PressDim), PressS);
    }

    private static void AnimateRelease(Button button, ButtonFeedbackStyle style)
    {
        AnimateSettle(button, style);
        var restore = button.CreateTween();
        Keep(button, restore);
        restore.TweenProperty(button, "modulate", Colors.White, 0.15);
    }

    private static float BaseY(Button button)
    {
        if (!button.HasMeta("fb_base_y"))
            button.SetMeta("fb_base_y", button.Position.Y);
        return (float)button.GetMeta("fb_base_y");
    }

    private static void Kill(Button button)
    {
        if (button.HasMeta("fb_tween") && button.GetMeta("fb_tween").As<Tween>() is { } previous && previous.IsValid())
            previous.Kill();
    }

    private static void Keep(Button button, Tween tween) => button.SetMeta("fb_tween", tween);
}
