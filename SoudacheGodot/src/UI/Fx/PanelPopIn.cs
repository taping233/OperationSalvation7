using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 面板弹入通用（sts2-reference §5）：面板 0.15-0.25s alpha 渐入 + CubicOut 位移回位，
/// 直接子元素 0.1s/0.2s 延迟阶梯渐入。背板黑 80% 由调用方自备（ThemeTokens.OverlayScrim）。
/// 最小 API：PanelPopIn.PopIn(panel)，可在每次面板重建后重复调用。
/// </summary>
public static class PanelPopIn
{
    public const double PanelDurationS = 0.2;  // 0.15-0.25s 区间取中
    public const double ChildStaggerS = 0.1;   // 子元素 0.1/0.2s 延迟阶梯
    public const float EnterOffsetY = 16f;     // 入场位移（网页 cardIn: translateY(10px) 量级）

    public static void PopIn(Control panel, double durationS = PanelDurationS, double staggerS = ChildStaggerS)
    {
        KillMetaTween(panel);
        panel.Modulate = new Color(1, 1, 1, 0);
        var basePos = (Vector2)(panel.HasMeta("popin_base_pos") ? panel.GetMeta("popin_base_pos") : panel.Position);
        panel.SetMeta("popin_base_pos", basePos);
        panel.Position = basePos + new Vector2(0, EnterOffsetY);

        var tween = panel.CreateTween();
        SetMetaTween(panel, tween);
        tween.TweenProperty(panel, "modulate:a", 1f, durationS);
        tween.Parallel().TweenProperty(panel, "position", basePos, durationS)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);

        var index = 0;
        foreach (var child in panel.GetChildren())
        {
            if (child is not Control element) continue;
            element.Modulate = new Color(1, 1, 1, 0);
            var step = tween.TweenProperty(element, "modulate:a", 1f, durationS)
                .SetDelay(durationS + index * staggerS);
            _ = step;
            index++;
        }
    }

    private static void KillMetaTween(Control node)
    {
        if (node.HasMeta("popin_tween") && node.GetMeta("popin_tween").As<Tween>() is { } previous && previous.IsValid())
            previous.Kill();
    }

    private static void SetMetaTween(Control node, Tween tween) => node.SetMeta("popin_tween", tween);
}
