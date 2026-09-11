using Godot;

namespace SoudacheGodot.UI;

/// <summary>
/// Design tokens extracted 1:1 from the web version's seven wired stylesheets
/// (搜打撤/game/css/{base,cards,overlays,hub,battle,scenes,winter}.css).
/// winter.css is loaded last and therefore wins; it is the primary source.
/// Use these constants instead of hand-picked colors so every screen stays
/// pixel-consistent with the web build (HANDOFF 口径 4).
/// </summary>
public static class ThemeTokens
{
    // ------------------------------------------------------------------
    // Palette — winter.css :root (active art direction)
    // ------------------------------------------------------------------
    public static readonly Color Ink = new("101e27");        // --ink / --bg 页面底色
    public static readonly Color Desk1 = new("1c303c");      // --desk1 侧栏石墨层 1
    public static readonly Color Desk2 = new("132630");      // --desk2 侧栏石墨层 2
    public static readonly Color Panel = new("192e39");      // --panel 面板层级
    public static readonly Color Panel2 = new("233d49");     // --panel2 面板亮层
    public static readonly Color Inset = new("112530");      // --inset 凹槽
    public static readonly Color Line = new("3b5663");       // --line 分隔线
    public static readonly Color Line2 = new("6b828a");      // --line2 亮分隔线
    public static readonly Color Txt = new("e8eeea");        // --txt 主文字
    public static readonly Color Sub = new("b2c4c9");        // --sub 次文字
    public static readonly Color Dim = new("849da7");        // --dim 弱文字
    public static readonly Color Amber = new("ddb876");      // --amber / --gold 琥珀
    public static readonly Color AmberSoft = new("ecd2a3");  // --amber-soft
    public static readonly Color Ok = new("9bc5c0");         // --ok 冷青绿
    public static readonly Color Arcane = new("b1a1c4");     // --arcane 奥术紫

    // winter.css 组件覆盖色（选择器见注释）
    public static readonly Color OverlayScrim = new("071720a8");           // #overlay
    public static readonly Color OverlayCardTop = new("203a48");           // #overlay .card 渐变起
    public static readonly Color OverlayCardBottom = new("132a36");        // #overlay .card 渐变止
    public static readonly Color OverlayCardBorder = new("697f87");        // #overlay .card 边线
    public static readonly Color BtnBg = new("24424f");                    // .ov-btn/.mini-btn/.hub-tab
    public static readonly Color BtnBgHover = new("365b69");               // 同上 :hover
    public static readonly Color BtnBorder = new("607c86");
    public static readonly Color BtnBorderHover = new("cadcd9");
    public static readonly Color BtnOkBg = new("d8bc86");                  // .ov-btn.ok
    public static readonly Color BtnOkText = new("152e3b");
    public static readonly Color BtnDangerBg = new("7a443e");              // .ov-btn.danger
    public static readonly Color BtnDangerBorder = new("be8c7e");
    public static readonly Color BtnDangerText = new("f3dcd5");
    public static readonly Color HubCardBg = new("193441");                // .hub-card/.cls-card/.ach-row
    public static readonly Color HubCardBorder = new("486674");
    public static readonly Color HubTabIdle = new("9db4bd");
    public static readonly Color HubTabOn = new("d7c193");                 // .hub-tab.on
    public static readonly Color HubTabOnText = new("16323e");
    public static readonly Color ResChipBg = new("102833");                // .res-chip/.fc-chip
    public static readonly Color ResChipBorder = new("4c6a76");
    public static readonly Color ResChipText = new("b3c9ce");
    public static readonly Color ResGold = new("e2c28b");                  // #resHud .res-gold b
    public static readonly Color ResAtk = new("ff6b5e");                   // #resHud .res-atk b（base.css）
    public static readonly Color ModeCardBg = new("1b3947");               // .mode-card
    public static readonly Color ModeCardOnBg = new("2d4a55");             // .mode-card.on
    public static readonly Color ModeCardOnBorder = new("d4b582");
    public static readonly Color DeployBg = new("dfc691");                 // #btnDeploy
    public static readonly Color DeployText = new("17323f");
    public static readonly Color SlotCardTop = new("0e2430");              // .slot-card 渐变
    public static readonly Color SlotCardBottom = new("0a1a24");
    public static readonly Color SlotCardBorder = new("63808b");
    public static readonly Color InputBg = new("102b39");                  // input/textarea/select
    public static readonly Color InputBorder = new("657f89");
    public static readonly Color SidebarTop = new("122a36");               // #sidebar 渐变起
    public static readonly Color SidebarBottom = new("1b3541");            // #sidebar 渐变止
    public static readonly Color SidebarEdge = new("6f8994");              // #sidebar border-top
    public static readonly Color HpHudBg = new("132b36");                  // #hpHud
    public static readonly Color HpHudBorder = new("637c89");
    public static readonly Color LayerBannerEdge = new("d5b47d");          // #layerBanner 底边
    public static readonly Color MapLabelBg = new("152e3bd9");             // .map-label
    public static readonly Color MapLabelCurrentBg = new("152a34f0");      // .map-label.current
    public static readonly Color MapLabelCurrentText = new("f3e3c3");
    public static readonly Color MapLabelCurrentEdge = new("d9bd89");
    public static readonly Color RollBtnBg = new("dec28e");                // #rollBtn
    public static readonly Color RollBtnHover = new("f0d5a1");
    public static readonly Color FocusRing = new("e2c48d");                // :focus-visible outline
    public static readonly Color HomeBtnTop = new("a02020");               // #btnHome 渐变
    public static readonly Color HomeBtnBottom = new("701616");
    public static readonly Color EmberGlow = new("ff9a3c5c");              // .ak-start 起动余烬光
    public static readonly Color EmberCore = new("c23c2a30");

    // ------------------------------------------------------------------
    // Radius — border-radius histogram across the seven sheets
    // ------------------------------------------------------------------
    public const int RadiusCard = 8;     // 卡面/按钮（出现最多）
    public const int RadiusPanel = 10;   // 面板
    public const int RadiusChip = 12;    // 大容器/弹窗（overlay .card 结构层 14 → winter 1）
    public const int RadiusSoft = 6;     // 小件
    public const int RadiusCrisp = 1;    // winter 皮肤铬件（winter.css 大量 1px 锐角）
    public const int RadiusPill = 999;   // 胶囊

    // ------------------------------------------------------------------
    // Shadows — box-shadow tokens (px: x y spread → Godot StyleBox shadow_*)
    // ------------------------------------------------------------------
    public readonly record struct Shadow(Color Color, Vector2 Offset, int Blur)
    {
        public void Apply(StyleBoxFlat box)
        {
            box.ShadowColor = Color;
            box.ShadowSize = (int)Blur;
            box.ShadowOffset = Offset;
        }
    }

    public static readonly Shadow CardDrop = new(new("07151e70"), new(0, 4), 12);      // .hs-card
    public static readonly Shadow CardDropHover = new(new("03111f99"), new(0, 8), 20); // .hs-card:hover
    public static readonly Shadow OverlayDrop = new(new("05131a99"), new(0, 25), 100); // #overlay .card
    public static readonly Shadow SidebarUp = new(new("0b233555"), new(0, -5), 25);    // #sidebar
    public static readonly Shadow SlotDrop = new(new("05131a66"), new(0, 12), 30);     // .slot-card
    public static readonly Shadow HomeBtnDrop = new(new("00000073"), new(0, 2), 6);    // #btnHome
    public static readonly Shadow WhiteGlow = new(new("a1a1a147"), Vector2.Zero, 9);   // 通用白辉光

    /// <summary>inset 0 1px 0 rgba(240,240,240,.06) 的近似：用 1px 亮描边模拟顶缘高光。</summary>
    public static readonly Color InsetTopHighlight = new(240f / 255f, 240f / 255f, 240f / 255f, 0.06f);

    // ------------------------------------------------------------------
    // Spacing — gap/padding histogram (px)
    // ------------------------------------------------------------------
    public const int SpaceXs = 4;      // gap 4-5px（紧凑行内）
    public const int SpaceSm = 8;      // gap 8px（最常见）
    public const int SpaceMd = 10;     // gap 10px（次常见）
    public const int SpaceLg = 12;     // gap 12px
    public const int SpaceXl = 16;     // gap 14-16px
    public const int PadChipX = 12;    // padding: 5px 12px（chip/小按钮）
    public const int PadPanelX = 24;   // #overlay .card padding: 26px 24px 22px
    public const int PadPanelY = 22;
    public const int PadBarX = 14;     // #sidebar padding: 10px 14px
    public const int PadBarY = 10;

    // ------------------------------------------------------------------
    // Typography
    // ------------------------------------------------------------------
    public const int FontBody = 14;        // .hs-card font-size 14px 基准
    public const int FontUi = 16;          // .bt-slot font-size 16px
    public const int FontHeading = 21;     // #overlay h2 21px
    public const int FontBanner = 20;      // #layerBanner .lb-zh 20px
    public const int FontMono = 9;         // .title-kicker / .lb-en 8-11px Cascadia
    public const float LetterSpacingHeading = 4f; // #layerBanner letter-spacing 4px
    public const float LetterSpacingTitle = 8f;   // .cn-title letter-spacing 8px

    private static FontFile? _noto;
    private static FontVariation? _notoBold;
    private static FontFile? _mono400;
    private static FontFile? _mono700;

    /// <summary>全量 Noto Sans SC 可变字体（wght 100-900）。也是 project.godot 默认主题字体。</summary>
    public static FontFile Noto => _noto ??= GD.Load<FontFile>("res://assets/fonts/NotoSansSC-VF.ttf");

    /// <summary>Noto wght=700 实例，对应网页 font-weight:700。</summary>
    public static FontVariation NotoBold
    {
        get
        {
            if (_notoBold != null) return _notoBold;
            _notoBold = new FontVariation { BaseFont = Noto };
            _notoBold.VariationOpentype = new Godot.Collections.Dictionary { ["wght"] = 700 };
            return _notoBold;
        }
    }

    /// <summary>Cascadia Code 等宽（数字/英文角标），对应网页 'Cascadia Code'。</summary>
    public static FontFile Mono => _mono400 ??= GD.Load<FontFile>("res://assets/fonts/cascadia-code-400.woff2");
    public static FontFile MonoBold => _mono700 ??= GD.Load<FontFile>("res://assets/fonts/cascadia-code-700.woff2");

    // ------------------------------------------------------------------
    // Motion — 网页版 CSS transition/animation 时序（布局 1:1 用）
    // STS2 手感参数另见 src/UI/Fx/Sts2Fx.cs（数值库）
    // ------------------------------------------------------------------
    public static class Motion
    {
        public const double ButtonTransition = 0.16;     // button transition .16s
        public const double OverlayCardIn = 0.22;        // cardIn .22s cubic-bezier(.22,1,.36,1)
        public const double HudStagger = 0.07;           // .ak-hud 子元素 70ms 阶梯
        public const double HudIn = 0.5;                 // akIn .5s
        public const double CardHoverLift = 0.16;        // .bt-card transition .16s cubic-bezier(.3,1.3,.5,1)
        public const double HitShakeWeb = 0.42;          // stsShake .42s（网页版自有抖动）
    }
}
