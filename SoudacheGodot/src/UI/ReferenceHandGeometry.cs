using Godot;

namespace SoudacheGodot.UI;

/// <summary>Directly adapted from sts2-reverse HandPosHelper's 1-10 card position table.
/// Only presentation geometry is reused; card identity and gameplay remain Soudache-owned.
/// Scale segments per wave1 6a spec (sts2-reference §1 NCardHolder.smallScale=0.8 base):
/// ≤7 张 → ×1.0、8 张 → ×0.95、9 张 → ×0.90、10 张 → ×0.85（每多一张 -0.05，0.85 封底）。</summary>
internal static class ReferenceHandGeometry
{
    /// <summary>手内基准缩放（sts2-reference §1 NCardHolder.smallScale=0.8）。</summary>
    public const float BaseHandScale = 0.8f;

    private static readonly Vector2[][] Positions =
    {
        new[] { new Vector2(0, -50) },
        new[] { new Vector2(-100, -50), new Vector2(100, -50) },
        new[] { new Vector2(-180, -50), new Vector2(0, -59), new Vector2(180, -50) },
        new[] { new Vector2(-240, -25), new Vector2(-80, -50), new Vector2(80, -50), new Vector2(240, -25) },
        new[] { new Vector2(-340, 10), new Vector2(-170, -30), new Vector2(0, -50), new Vector2(170, -30), new Vector2(340, 10) },
        new[] { new Vector2(-460, 13), new Vector2(-273, -25), new Vector2(-90, -50), new Vector2(90, -50), new Vector2(273, -25), new Vector2(460, 13) },
        new[] { new Vector2(-534, 18), new Vector2(-365, -14), new Vector2(-189, -39), new Vector2(0, -50), new Vector2(189, -39), new Vector2(365, -14), new Vector2(534, 18) },
        new[] { new Vector2(-565, 28), new Vector2(-400, -14), new Vector2(-231, -39), new Vector2(-80, -50), new Vector2(80, -50), new Vector2(231, -39), new Vector2(400, -14), new Vector2(565, 28) },
        new[] { new Vector2(-600, 37), new Vector2(-445, -2), new Vector2(-300, -29), new Vector2(-150, -45), new Vector2(0, -50), new Vector2(150, -45), new Vector2(300, -29), new Vector2(445, -2), new Vector2(600, 37) },
        new[] { new Vector2(-610, 38), new Vector2(-472, 5), new Vector2(-340, -21), new Vector2(-200, -41), new Vector2(-64, -50), new Vector2(64, -50), new Vector2(200, -41), new Vector2(340, -21), new Vector2(472, 5), new Vector2(610, 38) }
    };

    public static Vector2 GetPosition(int handSize, int index) => Positions[handSize - 1][index];
    public static bool Supports(int handSize) => handSize is >= 1 and <= 10;

    /// <summary>拥挤手牌缩放分段系数：≤7 张 1.0，之后每张 -0.05，最低 0.85。</summary>
    public static float GetScaleFactor(int handSize)
        => handSize <= 7 ? 1f : Mathf.Max(0.85f, 1f - (handSize - 7) * 0.05f);
}
