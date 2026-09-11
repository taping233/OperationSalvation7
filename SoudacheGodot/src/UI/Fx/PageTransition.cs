using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 页面/弹窗入场过渡，时序 1:1 对齐网页版 CSS 动画（winter.css / overlays.css）：
/// - PageIn  = .card.page pgIn .38s cubic-bezier(.22,1,.36,1)：opacity 0 + translateY(18px) scale(.988)
/// - CardIn  = #overlay .card cardIn .22s cubic-bezier(.22,1,.36,1)：opacity 0 + scale(.94) translateY(10px)
/// - SlotIn  = .slot-deck .slot-card slotIn .5s 同缓动 translateY(22px)，逐张延迟 60ms
/// - HubPageIn = .hub-page.page-in hubPageIn .3s cubic-bezier(.22,.61,.36,1) translateY(12px)
/// </summary>
public static class PageTransition
{
    public static void PageIn(Control page)
    {
        Animate(page, 0.38, 18f, 0.988f, 0f);
    }

    public static void CardIn(Control card)
    {
        Animate(card, 0.22, 10f, 0.94f, 0f);
    }

    public static void HubPageIn(Control page)
    {
        Animate(page, 0.3, 12f, 1f, 0f, Tween.TransitionType.Cubic, Tween.EaseType.Out);
    }

    /// <summary>逐张上浮（选档卡）：delay = index * 0.06s。</summary>
    public static void SlotIn(Control deck)
    {
        var index = 0;
        foreach (var child in deck.GetChildren())
        {
            if (child is not Control card) continue;
            Animate(card, 0.5, 22f, 1f, 0.06 * index);
            index++;
        }
    }

    private static void Animate(Control node, double durationS, float offsetY, float startScale, double delayS,
        Tween.TransitionType trans = Tween.TransitionType.Cubic, Tween.EaseType ease = Tween.EaseType.Out)
    {
        if (node.HasMeta("pt_tween") && node.GetMeta("pt_tween").As<Tween>() is { } previous && previous.IsValid())
            previous.Kill();
        node.SetMeta("pt_base_pos", node.Position);
        node.PivotOffset = node.Size * 0.5f;
        node.Modulate = new Color(1, 1, 1, 0);
        node.Position = node.Position + new Vector2(0, offsetY);
        var tween = node.CreateTween();
        node.SetMeta("pt_tween", tween);
        if (delayS > 0)
            tween.TweenInterval(delayS);
        tween.TweenProperty(node, "modulate:a", 1f, durationS);
        tween.Parallel().TweenProperty(node, "position",
            (Vector2)node.GetMeta("pt_base_pos"), durationS).SetTrans(trans).SetEase(ease);
        if (startScale < 1f)
            tween.Parallel().TweenProperty(node, "scale", Vector2.One, durationS).From(Vector2.One * startScale)
                .SetTrans(trans).SetEase(ease);
    }
}
