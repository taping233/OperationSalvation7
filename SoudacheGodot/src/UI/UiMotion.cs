using Godot;

namespace SoudacheGodot.UI;

/// Godot translation of the original web presentation timings in
/// game/src/motion.js and game/css/winter.css.
public static class UiMotion
{
    public static void Enter(Control control, double delay = 0.0)
    {
        var target = control.Position;
        control.Position = target + new Vector2(0, 10);
        control.Modulate = control.Modulate with { A = 0 };
        var tween = control.CreateTween().SetParallel().SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.TweenProperty(control, "position", target, 0.5).SetDelay(delay);
        tween.TweenProperty(control, "modulate:a", 1.0f, 0.5).SetDelay(delay);
    }

    public static void OverlayIn(Control control)
    {
        var targetPosition = control.Position;
        control.PivotOffset = control.Size * 0.5f;
        control.Position = targetPosition + new Vector2(0, 18);
        control.Scale = new Vector2(0.985f, 0.985f);
        control.Modulate = control.Modulate with { A = 0 };
        var tween = control.CreateTween().SetParallel().SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.TweenProperty(control, "position", targetPosition, 0.28);
        tween.TweenProperty(control, "scale", Vector2.One, 0.28);
        tween.TweenProperty(control, "modulate:a", 1.0f, 0.28);
    }

    public static void Pop(Control control)
    {
        control.PivotOffset = control.Size * 0.5f;
        var tween = control.CreateTween().SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.TweenProperty(control, "scale", new Vector2(1.16f, 1.16f), 0.09);
        tween.TweenProperty(control, "scale", new Vector2(0.98f, 0.98f), 0.08);
        tween.TweenProperty(control, "scale", Vector2.One, 0.15);
    }

    public static void Hit(Control control, bool self = false)
    {
        var origin = control.Position;
        var direction = self ? -1.0f : 1.0f;
        var tween = control.CreateTween().SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tween.TweenProperty(control, "position:x", origin.X + 9 * direction, 0.08);
        tween.TweenProperty(control, "position:x", origin.X - 7 * direction, 0.08);
        tween.TweenProperty(control, "position:x", origin.X + 5 * direction, 0.08);
        tween.TweenProperty(control, "position:x", origin.X - 2 * direction, 0.08);
        tween.TweenProperty(control, "position:x", origin.X, 0.08);
    }

    public static void Breathe(CanvasItem item, float lowAlpha = 0.7f, float highAlpha = 1.0f, double seconds = 3.2)
    {
        item.Modulate = item.Modulate with { A = lowAlpha };
        var tween = item.CreateTween().SetLoops().SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.InOut);
        tween.TweenProperty(item, "modulate:a", highAlpha, seconds * 0.5);
        tween.TweenProperty(item, "modulate:a", lowAlpha, seconds * 0.5);
    }
}
