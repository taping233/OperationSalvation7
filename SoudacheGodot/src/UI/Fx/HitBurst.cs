using Godot;

namespace SoudacheGodot.UI.Fx;

/// <summary>
/// 打击粒子（sts2-reference §2 NHitSparkVfx + 网页 pixi-effects.js burstAtElement 数值）：
/// 一次打击叠三层 one-shot 粒子（explosiveness=1 短促爆发）——
/// 主火花 initial_velocity 1500-2500 / spread 180° / 无重力 / lifetime 0.3-0.5 / amount 24；
/// 碎屑层 400-600 与 200-800（后一层带反重力 (0,-100) 漂浮，网页 gravity y=300 沉坠）；
/// lifetime_randomness 0.25-1.0。着色沿用网页 tint 口径：
/// 治疗 warm #61d69b（amount 10）、我方受击 #ff6659、命中敌人 #ffb34d。
/// 最小 API：HitBurst.Burst(parent, globalPos, HitBurstKind.Hit)。
/// </summary>
public static class HitBurst
{
    public enum Kind { Hit, Hurt, Heal }

    public const float MainSpeedMin = 1500f, MainSpeedMax = 2500f;   // sts2-reference §2 主火花
    public const float DebrisSpeedMin = 400f, DebrisSpeedMax = 600f;  // 碎屑层 1
    public const float Debris2SpeedMin = 200f, Debris2SpeedMax = 800f; // 碎屑层 2
    public const int MainAmount = 24;
    public const int DebrisAmount = 12;
    public const int HealAmount = 10;                                 // 网页 warm count=10（其余 14）
    public const float DebrisRiseGravity = -100f;                     // 漂浮碎屑反重力

    /// <summary>网页 burstAtElement 起喷位 = 元素矩形中心偏上（height*0.42）。</summary>
    public static void Burst(Control host, Vector2 globalPos, Kind kind = Kind.Hit)
    {
        var (mainColor, amount) = kind switch
        {
            Kind.Heal => (new Color("61d69b"), HealAmount),
            Kind.Hurt => (new Color("ff6659"), MainAmount),
            _ => (new Color("ffb34d"), MainAmount),
        };
        var burst = new BurstNode(globalPos, mainColor, amount) { Name = "HitBurst" };
        host.AddChild(burst);
    }
}

/// <summary>HitBurst 的三层 one-shot 粒子宿主；0.9s 后自清。</summary>
public partial class BurstNode : Node2D
{
    private readonly Vector2 _pos;
    private readonly Color _color;
    private readonly int _amount;
    private double _elapsed;

    public BurstNode(Vector2 pos, Color color, int amount)
    {
        _pos = pos;
        _color = color;
        _amount = amount;
        Position = pos;
        ZIndex = 90;
    }

    private static Texture2D DotTexture()
    {
        // 网页共用白圆贴图（pixi-effects.js 8px dot），Godot 用 8×8 白 PlaceholderTexture2D 等价
        var image = Image.CreateEmpty(8, 8, false, Image.Format.Rgba8);
        image.Fill(Colors.White);
        return ImageTexture.CreateFromImage(image);
    }

    public override void _Ready()
    {
        var dot = DotTexture();
        AddChild(SparkLayer(dot, new Vector3(0, 300, 0), speedMin: HitBurst.MainSpeedMin,
            speedMax: HitBurst.MainSpeedMax, amount: _amount, lifeMin: 0.3f, lifeMax: 0.5f, scale: 0.42f));
        AddChild(SparkLayer(dot, new Vector3(0, 300, 0), speedMin: HitBurst.DebrisSpeedMin,
            speedMax: HitBurst.DebrisSpeedMax, amount: HitBurst.DebrisAmount, lifeMin: 0.35f, lifeMax: 0.6f, scale: 0.3f));
        AddChild(SparkLayer(dot, new Vector3(0, HitBurst.DebrisRiseGravity, 0), speedMin: HitBurst.Debris2SpeedMin,
            speedMax: HitBurst.Debris2SpeedMax, amount: HitBurst.DebrisAmount, lifeMin: 0.45f, lifeMax: 0.8f, scale: 0.22f));
    }

    private GpuParticles2D SparkLayer(Texture2D dot, Vector3 oneShotGravity, float speedMin, float speedMax,
        int amount, float lifeMin, float lifeMax, float scale)
    {
        var material = new ParticleProcessMaterial
        {
            // sts2-reference §2：spread 180°、无定向；网页 startRotation 0-360 全向喷洒
            Spread = 180f,
            InitialVelocityMin = speedMin,
            InitialVelocityMax = speedMax,
            Gravity = oneShotGravity,
            LifetimeRandomness = 0.75f,
            ScaleMin = scale * 0.7f,
            ScaleMax = scale,
            Color = _color,
            EmissionShape = ParticleProcessMaterial.EmissionShapeEnum.Sphere,
            EmissionSphereRadius = 6f,
        };
        var particles = new GpuParticles2D
        {
            ProcessMaterial = material,
            Texture = dot,
            Amount = amount,
            Lifetime = lifeMax,
            OneShot = true,
            Explosiveness = 1f,                 // 短促爆发（sts2-reference §2 one-shot）
            SpeedScale = 1f,
            Emitting = true,
            LocalCoords = false,
        };
        // 帧渐隐：alpha 0.95→0（网页 alpha start 0.95 end 0）
        var gradient = new GradientTexture1D();
        var ramp = new Gradient();
        ramp.SetColor(0, new Color(_color.R, _color.G, _color.B, 0.95f));
        ramp.SetColor(1, new Color(_color.R, _color.G, _color.B, 0f));
        gradient.Gradient = ramp;
        material.ColorRamp = gradient;
        return particles;
    }

    public override void _Process(double delta)
    {
        _elapsed += delta;
        if (_elapsed >= 0.9) QueueFree(); // 最长 lifetime 0.8s 后清理
    }
}
