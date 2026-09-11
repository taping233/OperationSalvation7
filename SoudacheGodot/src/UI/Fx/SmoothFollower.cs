using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 指数平滑三通道跟随器（sts2-reference §1 NHandCardHolder）：
/// 位置 delta*7（吸附 1px）/ 缩放 delta*8（吸附 0.002）/ 旋转 delta*10（吸附 0.1°）。
/// 用法：SmoothFollower.Attach(control) → 每帧改 Target*，布局收敛交给 _Process。
/// 最小 API：Attach / TargetPosition / TargetScale / TargetRotation / SnapAll / ScaleInstant。
/// </summary>
public partial class SmoothFollower : Node
{
    private Control _owner = null!;
    private bool _scaleTweenActive;

    public Vector2 TargetPosition { get; set; }
    public Vector2 TargetScale { get; set; } = Vector2.One;
    public float TargetRotationDeg { get; set; }

    /// <summary>挂起三通道（批次 6c 拖拽：宿主直接定位卡片，_Process 让位）。</summary>
    public bool Suspended { get; set; }

    public static SmoothFollower Attach(Control owner)
    {
        var follower = new SmoothFollower { Name = "SmoothFollower" };
        owner.AddChild(follower);
        follower._owner = owner;
        return follower;
    }

    /// <summary>跳过平滑直接吸附到当前目标（首布局/瞬时放大用）。</summary>
    public void SnapAll()
    {
        _owner.Position = TargetPosition;
        _owner.Scale = TargetScale;
        _owner.Rotation = Mathf.DegToRad(TargetRotationDeg);
    }

    /// <summary>缩放通道瞬时设置（STS2 hover 进入无 tween）；进行中的回落 tween 作废。</summary>
    public void ScaleInstant(Vector2 scale)
    {
        _scaleTweenActive = false;
        TargetScale = scale;
        _owner.Scale = scale;
    }

    /// <summary>退出 hover 的 0.5s ExpoOut 回落（sts2-reference §1：退出 0.5s ExpoOut 回 0.8）。
    /// 期间缩放通道由 tween 驱动，平滑通道让位。</summary>
    public void ScaleSettle(Vector2 target, double duration = Sts2Fx.ButtonSettleS)
    {
        _scaleTweenActive = true;
        TargetScale = target;
        var tween = CreateTween();
        tween.TweenProperty(_owner, "scale", target, duration);
        tween.SetExpoOut();
        tween.Finished += () => _scaleTweenActive = false;
    }

    public override void _Process(double delta)
    {
        if (_owner == null || Suspended) return;
        _owner.Position = Sts2Fx.Smooth(_owner.Position, TargetPosition, delta, Sts2Fx.RatePosition, Sts2Fx.SnapPositionPx);
        if (!_scaleTweenActive)
            _owner.Scale = Sts2Fx.Smooth(_owner.Scale, TargetScale, delta, Sts2Fx.RateScale, Sts2Fx.SnapScale);
        var currentDeg = Mathf.RadToDeg(_owner.Rotation);
        _owner.Rotation = Mathf.DegToRad(Sts2Fx.Smooth(currentDeg, TargetRotationDeg, delta, Sts2Fx.RateRotation, Sts2Fx.SnapRotationDeg));
    }
}
