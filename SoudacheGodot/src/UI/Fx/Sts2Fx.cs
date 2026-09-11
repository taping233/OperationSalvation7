using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// STS2 presentation-parameter helpers. All numeric constants come from
/// _planning/sts2-reference.md (parameter facts only; re-implemented with Godot
/// Tween/_Process, no MegaCrit code or assets).
/// Static core: exponential smoothing, easings, quadratic bezier, hover push.
/// </summary>
public static class Sts2Fx
{
    // 指数平滑三通道（sts2-reference §1 NHandCardHolder：pos delta*7 / scale delta*8 / rot delta*10）
    public const float RatePosition = 7f;
    public const float RateScale = 8f;
    public const float RateRotation = 10f;
    public const float SnapPositionPx = 1f;   // 吸附阈 1px
    public const float SnapScale = 0.002f;    // 吸附阈 0.002
    public const float SnapRotationDeg = 0.1f; // 吸附阈 0.1°

    // hover 推挤（sts2-reference §1 NPlayerHand）
    public const float PushMaxPx = 100f;
    public const float PushFalloffCards = 4f;

    // 贝塞尔飞卡（sts2-reference §1 NCardFlyVfx）
    public const float FlySpeedMin = 1.1f, FlySpeedMax = 1.25f;
    public const float FlyAccelMin = 2.0f, FlyAccelMax = 2.5f;
    public const float FlyArcUpPx = -500f;         // 目标在上半屏
    public const float FlyArcDownPx = 500f;        // 目标在下半屏 +rand(100,400)
    public const float FlyTangentRate = 12f;       // 旋转沿切线 LerpAngle delta*12
    public const float FlyShrinkEndScale = -0.15f; // 后 1/3 → 0.1 → -0.15（负 scale 翻转缩没）

    // 受击抖动（sts2-reference §2 NCreature.AnimShake）
    public const float ShakeAmplitudePx = 10f;
    public const float ShakeDurationS = 1.0f;

    // 通用双段按钮（sts2-reference §5 NCombatCardPile bump 模式）
    public const double ButtonPopS = 0.05;
    public const double ButtonSettleS = 0.5;

    // 能量球差速旋转（sts2-reference §3 NEnergyCounter：每层 delta*30*(层号+1)，能量 0 降速 5）
    public const float RingRatePerLayer = 30f;
    public const float EmptyRingRatePerLayer = 5f;

    // 手牌回合进出（sts2-reference §1 NPlayerHand：敌方回合 0.2s CubicOut 下沉 100px+变灰；恢复 0.38s）
    public const double HandSinkSeconds = 0.2;
    public const float HandSinkPx = 100f;
    public const double HandRestoreSeconds = 0.38;

    // 结束回合按钮隐藏/出现（sts2-reference §5 NEndTurnButton：+250px 0.5s ExpoOut / BackOut）
    public const double EndTurnHideSeconds = 0.5;
    public const float EndTurnHidePx = 250f;

    /// <summary>STS2 式逐帧指数平滑：lerp(current, target, delta*rate)，带吸附阈。与参照一致为帧率相关实现。</summary>
    public static float Smooth(float current, float target, double delta, float rate, float snap)
    {
        var next = Mathf.Lerp(current, target, (float)Mathf.Clamp(delta * rate, 0.0, 1.0));
        return Mathf.Abs(target - next) <= snap ? target : next;
    }

    public static Vector2 Smooth(Vector2 current, Vector2 target, double delta, float rate, float snap)
    {
        var next = current.Lerp(target, (float)Mathf.Clamp(delta * rate, 0.0, 1.0));
        return next.DistanceTo(target) <= snap ? target : next;
    }

    /// <summary>hover 推挤：push = Lerp(100, 0, min(1, |hoverIdx-i|/4)) px，方向 = sign(hoverIdx-i)。</summary>
    public static float HoverPush(int selfIndex, int hoverIndex)
    {
        if (hoverIndex < 0 || selfIndex == hoverIndex) return 0f;
        var falloff = Mathf.Min(1f, Mathf.Abs(hoverIndex - selfIndex) / PushFalloffCards);
        var push = Mathf.Lerp(PushMaxPx, 0f, falloff);
        return Mathf.Sign(hoverIndex - selfIndex) * push;
    }

    /// <summary>二次贝塞尔 MathHelper.BezierCurve：v(t) = (1-t)²v0 + 2(1-t)t·c0 + t²v1（§1 飞卡/目标箭头共用）。</summary>
    public static Vector2 Bezier(Vector2 v0, Vector2 v1, Vector2 c0, float t)
    {
        var u = 1f - t;
        return u * u * v0 + 2f * u * t * c0 + t * t * v1;
    }

    /// <summary>飞卡控制点：中点 Y 偏移 arcDir（上半屏 -500，下半屏 +500+rand(100,400)）。</summary>
    public static Vector2 FlyControlPoint(Vector2 from, Vector2 to, float? arcOffsetY = null)
    {
        var offset = arcOffsetY ?? (to.Y < 540f
            ? FlyArcUpPx
            : FlyArcDownPx + (float)GD.RandRange(100f, 400f));
        return new Vector2((from.X + to.X) * 0.5f, (from.Y + to.Y) * 0.5f + offset);
    }

    // ---- 缓动（Ease.cs 数值 → Godot 等价闭式；供 _Process 手写动画使用） ----
    public static float ExpoOut(float t) => t >= 1f ? 1f : 1f - Mathf.Pow(2f, -10f * t);
    public static float CubicOut(float t) => 1f - Mathf.Pow(1f - t, 3f);
    public static float QuadOut(float t) => 1f - (1f - t) * (1f - t);
    public static float QuadIn(float t) => t * t;
    public static float SineOut(float t) => Mathf.Sin(t * Mathf.Pi / 2f);
    public static float BackOut(float t)
    {
        const float c1 = 1.70158f; // Ease.cs Back 过冲系数
        var c3 = c1 + 1f;
        return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
    }

    /// <summary>把 ExpoOut 等映射到 Godot Tween 的过渡枚举（0.5s 回落等固定时长动画用 Tween）。</summary>
    public static Tween SetExpoOut(this Tween tween)
    {
        tween.SetTrans(Tween.TransitionType.Expo).SetEase(Tween.EaseType.Out);
        return tween;
    }
}
