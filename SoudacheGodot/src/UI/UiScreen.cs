using Godot;

namespace SoudacheGodot.UI;

/// Shared screen contract. Screens only publish navigation intents; AppMain owns scene lifetime.
public abstract partial class UiScreen : Control
{
    [Signal]
    public delegate void NavigateRequestedEventHandler(string screenKey);

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        Build();
        MaybeScheduledShot();
    }

    /// <summary>
    /// 验收帧导出：--shot=&lt;path.png&gt; 在 0.6s（动画完成后）抓取视口存 PNG 并退出。
    /// 与 --write-movie 等价的帧导出手段（movie 模式与部分屏组合卡耗时改用此路）。
    /// </summary>
    private void MaybeScheduledShot()
    {
        var target = "";
        foreach (var arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--shot=", System.StringComparison.Ordinal))
                target = arg.Substring("--shot=".Length);
        }
        if (target.Length == 0) return;
        var path = target;
        GetTree().CreateTimer(0.6).Timeout += () =>
        {
            var image = GetViewport().GetTexture().GetImage();
            image.SavePng(path);
            GD.Print($"UI_SHOT_SAVED {path}");
            GetTree().Quit();
        };
    }

    protected abstract void Build();

    protected void Navigate(string screenKey)
    {
        EmitSignal(SignalName.NavigateRequested, screenKey);
    }

    public void RequestNavigation(string screenKey)
    {
        Navigate(screenKey);
    }
}
