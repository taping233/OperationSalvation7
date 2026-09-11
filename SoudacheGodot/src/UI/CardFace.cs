using Godot;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// 卡面控件（网页 cards.view.js cardHTML + css/cards.css .hs-card 移植）。
/// em 布局：卡 10em × 14em，fontPx 即 em 基准（lib 网格 14px / 预览 lg 22px）。
/// Mode.Lib = 图鉴网格简卡（winter.css .hs-card.lib：隐藏 desc/type/kw、art 高 5.8em）；
/// Mode.Full = 预览/特写全卡（cost + art 4.15em + name + type + kw 药丸 + gem 菱形 + desc 条 + dmg/val 角标）。
/// 边框渐变取 tp0-7 类型色（cards.css:16-23），宝石色取 rv0-7 稀有度色（cards.css:32-35，棱彩 #cbb2f0 兜底锚色）。
/// </summary>
public partial class CardFace : Control
{
    public enum FaceMode { Lib, Full }

    private CodexCatalog.CodexCard _card = null!;
    private CodexCatalog _catalog = null!;
    private FaceMode _mode;

    // cards.css .tp0-.tp7：--fc1/--fc2 卡面渐变、--art1 插画窗径向中调
    private static readonly (Color Fc1, Color Fc2, Color Art1)[] TypeColors =
    {
        (new("5b5b5b"), new("232323"), new("404040")), // 武术
        (new("5f5f5f"), new("292929"), new("474747")), // 法术
        (new("6b6b6b"), new("292929"), new("4b4b4b")), // 生物
        (new("6b6b6b"), new("292929"), new("4b4b4b")), // 道具
        (new("6f6f6f"), new("292929"), new("4d4d4d")), // 装备
        (new("5a5a5a"), new("222222"), new("3e3e3e")), // 事件
        (new("8b8b8b"), new("363636"), new("676767")), // 能力卡
        (new("747474"), new("2c2c2c"), new("535353")), // 资源
    };

    // cards.css .rv0-.rv7：--gem 宝石色（衍生=青绿松石、棱彩=幻彩锚色薰衣草）
    private static readonly Color[] GemColors =
    {
        new("9aa0a6"), new("6f9e6a"), new("5a8ec2"), new("9b7fb8"),
        new("d0883e"), new("3fae94"), new("0b0b0d"), new("cbb2f0"),
    };

    public static CardFace Create(CodexCatalog catalog, CodexCatalog.CodexCard card, FaceMode mode, float fontPx)
    {
        var face = new CardFace
        {
            _catalog = catalog,
            _card = card,
            _mode = mode,
            CustomMinimumSize = new Vector2(10 * fontPx, 14 * fontPx),
            MouseFilter = MouseFilterEnum.Pass
        };
        face.Build(fontPx);
        return face;
    }

    private void Build(float em)
    {
        var typeIndex = System.Math.Max(0, System.Array.IndexOf(CodexCatalog.Types, _card.Type));
        var (fc1, fc2, art1) = TypeColors[typeIndex];
        var effectiveRarity = _catalog.RarityOf(_card);
        var gem = GemColors[System.Math.Max(0, System.Array.IndexOf(CodexCatalog.Rarities, effectiveRarity))];

        // 卡底 .hs-card：linear-gradient(165deg, fc1, fc2 72%) + 2px 宝石色边 + .9em 圆角 + 落影
        var panel = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
        panel.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        panel.OffsetLeft = -2; panel.OffsetTop = -2; panel.OffsetRight = 2; panel.OffsetBottom = 2;
        var box = new StyleBoxFlat { BgColor = fc1 };
        box.SetCornerRadiusAll(System.Math.Max(2, (int)(0.9f * em)));
        box.BorderColor = gem;
        box.SetBorderWidthAll(2);
        box.ShadowColor = new Color("07151e70");
        box.ShadowSize = 12;
        box.ShadowOffset = new Vector2(0, 4);
        panel.AddThemeStyleboxOverride("panel", box);
        AddChild(panel);
        WinterUi.Linear(panel, fc1, fc2, true, fc1, 0.28f);

        var column = new VBoxContainer { MouseFilter = MouseFilterEnum.Ignore };
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.OffsetLeft = 0.42f * em; column.OffsetTop = 0.42f * em;
        column.OffsetRight = -0.42f * em; column.OffsetBottom = -0.42f * em;
        AddChild(column);

        // 插画窗 .hsc-art：高 5.8em（lib）/ 4.15em（full），径向渐变底 + 家族位图 cover
        var art = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
        art.SizeFlagsVertical = SizeFlags.ShrinkBegin;
        art.CustomMinimumSize = new Vector2(0, (_mode == FaceMode.Lib ? 5.8f : 4.15f) * em);
        var artBox = new StyleBoxFlat { BgColor = art1 };
        artBox.SetCornerRadiusAll((int)(0.55f * em));
        artBox.BorderColor = new Color(0.93f, 0.93f, 0.93f, 0.16f);
        artBox.SetBorderWidthAll(1);
        art.AddThemeStyleboxOverride("panel", artBox);
        column.AddChild(art);
        var artTexture = new TextureRect
        {
            Texture = GD.Load<Texture2D>(_catalog.FamilyArt(_card)),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered,
            MouseFilter = MouseFilterEnum.Ignore
        };
        art.AddChild(artTexture);

        // 卡名 .hsc-name：深底横条 + 居中粗体（单行省略）
        var nameBar = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
        nameBar.SizeFlagsVertical = SizeFlags.ShrinkBegin;
        var nameBox = new StyleBoxFlat { BgColor = new Color("191919") };
        nameBox.SetCornerRadiusAll((int)(0.3f * em));
        nameBox.BorderWidthTop = 1;
        nameBox.BorderWidthBottom = 1;
        nameBox.BorderColor = new Color(0.63f, 0.63f, 0.63f, 0.45f);
        nameBox.ContentMarginTop = 0.2f * em;
        nameBox.ContentMarginBottom = 0.2f * em;
        nameBar.AddThemeStyleboxOverride("panel", nameBox);
        column.AddChild(nameBar);
        var nameLabel = new Label
        {
            Text = _card.Name,
            HorizontalAlignment = HorizontalAlignment.Center,
            TextOverrunBehavior = TextServer.OverrunBehavior.TrimEllipsis,
            MouseFilter = MouseFilterEnum.Ignore
        };
        nameLabel.AddThemeFontSizeOverride("font_size", (int)System.Math.Max(9, 0.92f * em));
        nameLabel.AddThemeColorOverride("font_color", new Color("dadada"));
        nameLabel.AddThemeFontOverride("font", ThemeTokens.NotoBold);
        nameBar.AddChild(nameLabel);

        if (_mode == FaceMode.Full)
        {
            // 类型行 .hsc-type：「类型 · 稀有度」（职业稀有度显示「XX专属」，cards.view.js:83；cls=中文职业名直接显示）
            var rarityText = effectiveRarity == "职业"
                ? (_card.Cls.Length > 0 ? _card.Cls : "人物") + "专属"
                : effectiveRarity;
            var typeLabel = WinterUi.Label($"{_card.Type} · {rarityText}", System.Math.Max(8, 0.66f * em), new Color("b9b9b9"));
            typeLabel.HorizontalAlignment = HorizontalAlignment.Center;
            typeLabel.SizeFlagsVertical = SizeFlags.ShrinkBegin;
            column.AddChild(typeLabel);

            // 效果词条药丸 .hsc-kw：抽卡/注能/回复/护甲（>0 才渲染，cards.view.js:62-71）
            var keywords = new[] {
                (_card.Draw > 0, $"抽 {_card.Draw}"),
                (_card.Infuse > 0, $"注能 {_card.Infuse}"),
                (_card.Heal > 0, $"回 {_card.Heal}"),
                (_card.Armor > 0, $"甲 {_card.Armor}"),
            }.Where(pair => pair.Item1).ToList();
            if (keywords.Count > 0)
            {
                var kwRow = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
                kwRow.SizeFlagsVertical = SizeFlags.ShrinkBegin;
                kwRow.AddThemeConstantOverride("separation", (int)(0.25f * em));
                column.AddChild(kwRow);
                foreach (var (_, text) in keywords)
                {
                    var pill = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
                    var pillBox = new StyleBoxFlat { BgColor = new Color(0.047f, 0.047f, 0.047f, 0.6f) };
                    pillBox.SetCornerRadiusAll((int)(0.9f * em));
                    pillBox.BorderColor = new Color(0.63f, 0.63f, 0.63f, 0.4f);
                    pillBox.SetBorderWidthAll(1);
                    pillBox.ContentMarginLeft = 0.42f * em;
                    pillBox.ContentMarginRight = 0.42f * em;
                    pillBox.ContentMarginTop = 0.05f * em;
                    pillBox.ContentMarginBottom = 0.05f * em;
                    pill.AddThemeStyleboxOverride("panel", pillBox);
                    pill.AddChild(WinterUi.Label(text, System.Math.Max(8, 0.58f * em), new Color("ebebeb")));
                    kwRow.AddChild(pill);
                }
            }

            // 宝石菱形 .hsc-gem（0.8em 旋转 45° → 等宽正方形近似，带发光边）
            var gemRow = new CenterContainer();
            gemRow.SizeFlagsVertical = SizeFlags.ShrinkBegin;
            column.AddChild(gemRow);
            var gemRect = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
            var gemBox = new StyleBoxFlat { BgColor = gem };
            gemBox.SetCornerRadiusAll((int)(0.12f * em));
            gemBox.BorderColor = new Color(1, 1, 1, 0.55f);
            gemBox.SetBorderWidthAll(1);
            gemBox.ShadowColor = new Color(gem, 0.5f);
            gemBox.ShadowSize = 6;
            gemRect.AddThemeStyleboxOverride("panel", gemBox);
            gemRect.CustomMinimumSize = new Vector2(0.6f * em, 0.6f * em);
            gemRow.AddChild(gemRect);

            // 效果描述 .hsc-desc：浅灰信息条（撑满剩余；空描述显示提示字）
            var descPanel = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore, SizeFlagsVertical = SizeFlags.ExpandFill };
            var descBox = new StyleBoxFlat { BgColor = new Color("d3d3d3") };
            descBox.SetCornerRadiusAll((int)(0.45f * em));
            descBox.BorderColor = new Color("9c9c9c");
            descBox.SetBorderWidthAll(1);
            descBox.ContentMarginLeft = 0.38f * em; descBox.ContentMarginRight = 0.38f * em;
            descBox.ContentMarginTop = 0.3f * em; descBox.ContentMarginBottom = 0.3f * em;
            descPanel.AddThemeStyleboxOverride("panel", descBox);
            column.AddChild(descPanel);
            var descLabel = WinterUi.Label(_card.Desc.Length > 0 ? _card.Desc : "效果描述（可选）",
                System.Math.Max(9, 0.78f * em), _card.Desc.Length > 0 ? new Color("2e2e2e") : new Color("848484"), wrap: true);
            descLabel.HorizontalAlignment = HorizontalAlignment.Center;
            descPanel.AddChild(descLabel);
        }

        // 费用宝石 .hsc-cost：左上角圆形（-0.48em 出血）
        var costGem = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
        costGem.Position = new Vector2(0, 0);
        costGem.Size = new Vector2(2.18f * em, 2.18f * em);
        var costBox = new StyleBoxFlat { BgColor = new Color("5c5c5c") };
        costBox.SetCornerRadiusAll((int)(1.09f * em));
        costBox.BorderColor = new Color(1, 1, 1, 0.68f);
        costBox.SetBorderWidthAll(2);
        costGem.AddThemeStyleboxOverride("panel", costBox);
        var costLabel = new Label
        {
            Text = _card.Cost.ToString(),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            MouseFilter = MouseFilterEnum.Ignore
        };
        costLabel.AddThemeFontSizeOverride("font_size", (int)em);
        costLabel.AddThemeColorOverride("font_color", Colors.White);
        costLabel.AddThemeFontOverride("font", ThemeTokens.NotoBold);
        costGem.AddChild(costLabel);
        AddChild(costGem);

        if (_mode == FaceMode.Full)
        {
            // 伤害宝石 .hsc-dmg：左下（伤害类型卡且 dmg>0，或负数攻击词条；clip 六边形以圆角近似）
            var showDmg = CodexCatalog.DmgTypes.Contains(_card.Type)
                && (_card.Dmg > 0 || (_card.Dmg < 0 && _card.DmgType == "attack"));
            if (showDmg)
            {
                var dmgPanel = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
                dmgPanel.Position = new Vector2(-0.55f * em, 14 * em - 2.1f * em);
                dmgPanel.Size = new Vector2(2.3f * em, 2.3f * em);
                var dmgBox = new StyleBoxFlat { BgColor = new Color("5a5a5a") };
                dmgBox.SetCornerRadiusAll((int)(0.7f * em));
                dmgBox.BorderColor = new Color(1, 1, 1, 0.4f);
                dmgBox.SetBorderWidthAll(1);
                dmgPanel.AddThemeStyleboxOverride("panel", dmgBox);
                var dmgLabel = WinterUi.Label(_card.Dmg.ToString(), 0.95f * em, Colors.White);
                dmgLabel.AddThemeFontOverride("font", ThemeTokens.NotoBold);
                dmgLabel.HorizontalAlignment = HorizontalAlignment.Center;
                dmgLabel.VerticalAlignment = VerticalAlignment.Center;
                dmgPanel.AddChild(dmgLabel);
                AddChild(dmgPanel);
            }

            // 币值角标 .hsc-val：右下圆形（金边 + 硬币图标 + 数值）
            if (_card.Value > 0)
            {
                var valPanel = new PanelContainer { MouseFilter = MouseFilterEnum.Ignore };
                valPanel.Position = new Vector2(10 * em - 2.18f * em, 14 * em - 2.18f * em);
                valPanel.Size = new Vector2(2.18f * em, 2.18f * em);
                var valBox = new StyleBoxFlat { BgColor = new Color("8f8f8f") };
                valBox.SetCornerRadiusAll((int)(1.09f * em));
                valBox.BorderColor = new Color(1, 0.925f, 0.663f, 0.78f);
                valBox.SetBorderWidthAll(2);
                valPanel.AddThemeStyleboxOverride("panel", valBox);
                var valRow = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
                valRow.AddThemeConstantOverride("separation", 1);
                valRow.AddChild(WinterUi.Icon("res://assets/icons/coin.png", System.Math.Max(6, (int)(0.62f * em))));
                valRow.AddChild(WinterUi.Label(_card.Value.ToString(), 0.95f * em, Colors.White));
                valPanel.AddChild(valRow);
                AddChild(valPanel);
            }
        }
    }
}
