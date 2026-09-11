using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 标题页雪花层（winter.css #20「.title-snow + akSnow」1:1）：
/// 24 片 5px 白点、双层视差下落（translateY -4vh→106vh，50% 处 +3vw、终点 -2vw 漂移），
/// 每片 left/duration/delay/scale 取自 CSS nth-child 表；透明度 8% 前淡入至 .85、落点收至 .15。
/// 只动 transform/透明度（性能铁律），整层可在页面覆盖时 SetRunning(false) 暂停（body.page-covered 对应）。
/// </summary>
public partial class SnowLayer : Control
{
    private struct Flake
    {
        public float LeftRatio;    // left %
        public float DurationS;    // animation-duration
        public float DelayS;       // animation-delay（负值=已进行中）
        public float Scale;        // transform scale
    }

    // winter.css .title-snow i:nth-child(1..24) 参数表
    private static readonly Flake[] Flakes =
    {
        new() { LeftRatio = 3, DurationS = 11, DelayS = 0, Scale = .7f },
        new() { LeftRatio = 9, DurationS = 14, DelayS = -4, Scale = 1 },
        new() { LeftRatio = 16, DurationS = 9, DelayS = -8, Scale = .55f },
        new() { LeftRatio = 23, DurationS = 16, DelayS = -2, Scale = .8f },
        new() { LeftRatio = 31, DurationS = 12, DelayS = -9, Scale = 1 },
        new() { LeftRatio = 38, DurationS = 10, DelayS = -5, Scale = .6f },
        new() { LeftRatio = 45, DurationS = 15, DelayS = -1, Scale = .75f },
        new() { LeftRatio = 52, DurationS = 13, DelayS = -11, Scale = 1 },
        new() { LeftRatio = 59, DurationS = 9.5f, DelayS = -6, Scale = .5f },
        new() { LeftRatio = 66, DurationS = 17, DelayS = -3, Scale = 1 },
        new() { LeftRatio = 73, DurationS = 11.5f, DelayS = -10, Scale = .7f },
        new() { LeftRatio = 80, DurationS = 14.5f, DelayS = -7, Scale = .85f },
        new() { LeftRatio = 87, DurationS = 10.5f, DelayS = -12, Scale = .6f },
        new() { LeftRatio = 94, DurationS = 16, DelayS = -8, Scale = 1 },
        new() { LeftRatio = 6, DurationS = 13.5f, DelayS = -13, Scale = .65f },
        new() { LeftRatio = 20, DurationS = 12.5f, DelayS = -6.5f, Scale = .9f },
        new() { LeftRatio = 35, DurationS = 15.5f, DelayS = -3.5f, Scale = .55f },
        new() { LeftRatio = 50, DurationS = 10, DelayS = -14, Scale = 1 },
        new() { LeftRatio = 65, DurationS = 14, DelayS = -9.5f, Scale = .75f },
        new() { LeftRatio = 79, DurationS = 12, DelayS = -4.5f, Scale = .6f },
        new() { LeftRatio = 91, DurationS = 17.5f, DelayS = -15, Scale = .8f },
        new() { LeftRatio = 12, DurationS = 9, DelayS = -10.5f, Scale = .5f },
        new() { LeftRatio = 44, DurationS = 16.5f, DelayS = -1.5f, Scale = .85f },
        new() { LeftRatio = 70, DurationS = 13, DelayS = -7.5f, Scale = .6f },
    };

    private double _clockS;
    private bool _running = true;

    public void SetRunning(bool running)
    {
        _running = running;
        if (running)
            QueueRedraw();
    }

    public override void _Process(double delta)
    {
        if (!_running || !IsVisibleInTree()) return;
        _clockS += delta;
        QueueRedraw();
    }

    public override void _Draw()
    {
        var size = Size;
        if (size.X <= 1 || size.Y <= 1) return;
        var vh = size.Y / 100f;
        var vw = size.X / 100f;
        foreach (var flake in Flakes)
        {
            var cycle = (float)((_clockS + flake.DelayS) % flake.DurationS / flake.DurationS);
            if (cycle < 0) cycle += 1f;
            // akSnow：Y -4vh→106vh；X 0→50% 时漂 +3vw，50%→100% 回落至 -2vw
            var y = (-4f + 110f * cycle) * vh;
            var drift = cycle < 0.5f ? 3f * (cycle / 0.5f) : 3f - 5f * ((cycle - 0.5f) / 0.5f);
            var x = flake.LeftRatio / 100f * size.X + drift * vw;
            // 透明度：0%→8% 淡入至 .85，100% 收至 .15
            var alpha = cycle < 0.08f ? Mathf.Lerp(0f, 0.85f, cycle / 0.08f)
                : Mathf.Lerp(0.85f, 0.15f, (cycle - 0.08f) / 0.92f);
            var radius = 2.5f * flake.Scale;
            DrawCircle(new Vector2(x, y), radius, new Color(0.933f, 0.957f, 0.973f, alpha));
        }
    }
}
