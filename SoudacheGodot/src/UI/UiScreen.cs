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
