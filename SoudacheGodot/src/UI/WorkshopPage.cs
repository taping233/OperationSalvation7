using Godot;
using SoudacheGodot.App;
using System.Linq;
using System.Text.RegularExpressions;

namespace SoudacheGodot.UI;

/// <summary>
/// 卡牌制作坊（本批口径=碎片合成制作界面；真源 game.bag.js craftColorToken 家族 + css/cards.css .pg.cdes 布局）：
/// 左 cdes-stage 合成产物大卡预览 + 右 cdes-form 合成面板（材料清单 → 合成配方 → 合成日志）。
/// 动作消费 = ICoreUiPort.RequestRunAction("craft:tokenA" / "craft:colortoken")（批次 4b adapter 已落地：
/// 3 张员工通行证B → 1 张员工通行证A；通行证A + 2 枚彩色令牌碎片 → 彩色令牌，TokenCraft 语义）。
/// 材料计数：通行证A/B 数量从 RunUiSnapshot.InventoryLabels 栈名解析（对局中=随身背包，局外=基地仓库）；
/// 碎片计数快照无字段（[6b'→A] Fragments），到达前显示「—/2」，可用性由 adapter 拒绝语义兜底。
/// </summary>
public partial class WorkshopPage : Control
{
    private readonly CodexCatalog _catalog = CodexCatalog.Default;
    private GameAudio? _audio;
    private ICoreUiPort? _core;
    private RunUiSnapshot? _snapshot;

    private Label _fragmentCount = null!;
    private Label _goldCount = null!;
    private Label _colorCount = null!;
    private Label _statusLine = null!;

    private static readonly Regex StackRegex = new(@"^(?<name>.+?)\s*×(?<n>\d+)$", RegexOptions.Compiled);

    public Control Build(GameAudio? audio)
    {
        _audio = audio;
        MouseFilter = MouseFilterEnum.Stop;
        WinterUi.Linear(this, new Color("1b3645"), new Color("102431"), true);

        // .pg.cdes：padding 20px 34px 26px（winter.css:300）
        var margin = new MarginContainer();
        margin.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        margin.AddThemeConstantOverride("margin_left", 34);
        margin.AddThemeConstantOverride("margin_right", 34);
        margin.AddThemeConstantOverride("margin_top", 20);
        margin.AddThemeConstantOverride("margin_bottom", 26);
        AddChild(margin);
        var root = new VBoxContainer();
        root.SizeFlagsVertical = SizeFlags.ExpandFill;
        margin.AddChild(root);

        // pg-head：icon + 标题（对齐 cardslib.js:348「卡牌制作坊」）
        var head = new HBoxContainer();
        head.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        head.SizeFlagsVertical = SizeFlags.ShrinkBegin;
        head.AddThemeConstantOverride("separation", 10);
        root.AddChild(head);
        head.AddChild(WinterUi.Icon("res://assets/images/ui/icon-pen.svg", 18));
        var title = WinterUi.Heading("卡牌制作坊", 20, new Color("e8eeea"), 2f);
        title.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        head.AddChild(title);
        head.AddChild(WinterUi.Label("彩色令牌碎片合成 · 语义对照 TokenCraft（批次 2/4b）", 12, new Color("9db4bd")));
        var headSpacer = new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        head.AddChild(headSpacer);

        // cdes-main：左舞台 flex 1.15 + 右表单（min-width 400，cards.css:248-254）
        var main = new HBoxContainer();
        main.SizeFlagsVertical = SizeFlags.ExpandFill;
        main.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        main.AddThemeConstantOverride("separation", 16);
        root.AddChild(main);

        BuildStage(main);
        BuildForm(main);

        RefreshMaterials();
        return this;
    }

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
        _core = core;
        _core.RunSnapshotChanged += ApplySnapshot;
        _core.PublishCurrentState();
    }

    public override void _ExitTree()
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        RefreshMaterials();
        if (_statusLine != null) _statusLine.Text = snapshot.StatusText.Length > 0 ? snapshot.StatusText : "选择配方开始合成。";
    }

    // cdes-stage：产物预览（彩色令牌 lg）+ stage-hint（cards.css:248-253 径向底）
    private void BuildStage(HBoxContainer main)
    {
        var stage = new PanelContainer();
        stage.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        stage.SizeFlagsStretchRatio = 1.15f;
        stage.SizeFlagsVertical = SizeFlags.ExpandFill;
        var stageBox = WinterUi.Box(new Color("16303c"), 1, new Color("68808b", 0.2f), 1);
        stage.AddThemeStyleboxOverride("panel", stageBox);
        main.AddChild(stage);
        WinterUi.Radial(stage, new Color("2a4a58"), new Color("122732"), new Vector2(0.5f, 0.42f), new Vector2(0.6f, 0.6f));

        var column = new VBoxContainer();
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.Alignment = BoxContainer.AlignmentMode.Center;
        column.AddThemeConstantOverride("separation", 14);
        stage.AddChild(column);

        var token = _catalog.ById(CodexCatalog.ColorTokenId);
        if (token != null)
        {
            var faceHost = new CenterContainer();
            faceHost.SizeFlagsVertical = SizeFlags.ExpandFill;
            column.AddChild(faceHost);
            faceHost.AddChild(CardFace.Create(_catalog, token, CardFace.FaceMode.Full, 20));
        }
        var hint = WinterUi.Label("合成产物：彩色令牌（使用后获得本职业能力卡）", 12, new Color("b3c9ce"), wrap: true);
        hint.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(hint);
    }

    private void BuildForm(HBoxContainer main)
    {
        var scroll = new ScrollContainer();
        scroll.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        scroll.SizeFlagsVertical = SizeFlags.ExpandFill;
        main.AddChild(scroll);
        var form = new VBoxContainer();
        form.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        form.CustomMinimumSize = new Vector2(420, 0);
        form.AddThemeConstantOverride("separation", 12);
        scroll.AddChild(form);

        // —— cdes-sec「材料清单」——
        form.AddChild(SectionTitle("材料清单", "来自本局随身背包 / 基地仓库"));
        var materials = new VBoxContainer();
        materials.AddThemeConstantOverride("separation", 6);
        form.AddChild(materials);
        materials.AddChild(MaterialRow("res://assets/images/ui/icon-wood.svg", "彩色令牌碎片", out _fragmentCount));
        materials.AddChild(MaterialRow("res://assets/images/ui/icon-key.svg", "员工通行证A（觉醒令牌）", out _colorCount));
        materials.AddChild(MaterialRow("res://assets/images/ui/icon-key.svg", "员工通行证B（黄金令牌）", out _goldCount));

        // —— cdes-sec「合成配方」——
        form.AddChild(SectionTitle("合成配方", "动作走 craft:tokenA / craft:colortoken"));
        form.AddChild(RecipeRow(
            _catalog.ById(CodexCatalog.TokenGoldId),
            "3 张员工通行证B → 1 张员工通行证A",
            "合成员工通行证A（3 张 B → 1 张 A）",   // 网页 game.bag.js:269 按钮文案
            "craft:tokenA"));
        form.AddChild(RecipeRow(
            _catalog.ById(CodexCatalog.ColorTokenId),
            "员工通行证A ×1 + 彩色令牌碎片 ×2 → 1 张彩色令牌",
            "合成彩色令牌（2 碎片 + 1 通行证A）",   // 网页 game.bag.js:271 按钮文案
            "craft:colortoken"));

        // —— cdes-sec「合成日志」——
        form.AddChild(SectionTitle("合成日志", "STATUS"));
        _statusLine = WinterUi.Label("选择配方开始合成。", 12, new Color("ceddde"), wrap: true);
        _statusLine.CustomMinimumSize = new Vector2(0, 44);
        form.AddChild(_statusLine);
    }

    private Control SectionTitle(string cn, string en) => WinterUi.SetHeading(cn, en);

    private Control MaterialRow(string icon, string caption, out Label valueLabel)
    {
        var row = new PanelContainer();
        row.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        row.AddThemeStyleboxOverride("panel", WinterUi.Box(ThemeTokens.ResChipBg, 1, ThemeTokens.ResChipBorder, 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 6);
        margin.AddThemeConstantOverride("margin_bottom", 6);
        row.AddChild(margin);
        var line = new HBoxContainer();
        line.AddThemeConstantOverride("separation", 8);
        margin.AddChild(line);
        line.AddChild(WinterUi.Icon(icon, 16));
        line.AddChild(WinterUi.Label(caption, 13, ThemeTokens.ResChipText));
        var spacer = new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        line.AddChild(spacer);
        valueLabel = WinterUi.Label("—", 14, new Color("e5d4ae"));
        valueLabel.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        line.AddChild(valueLabel);
        return row;
    }

    // 配方行：材料卡 sm 预览 + 说明 + 合成按钮（ov-btn.ok，语义=网页 bag.js 特写按钮）
    private Control RecipeRow(CodexCatalog.CodexCard? material, string formula, string buttonText, string action)
    {
        var row = new PanelContainer();
        row.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        row.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("193441", 0.55f), 8, new Color("486674", 0.4f), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 10);
        margin.AddThemeConstantOverride("margin_bottom", 10);
        row.AddChild(margin);
        var line = new HBoxContainer();
        line.AddThemeConstantOverride("separation", 12);
        margin.AddChild(line);

        if (material != null)
            line.AddChild(CardFace.Create(_catalog, material, CardFace.FaceMode.Lib, 9));
        var info = new VBoxContainer();
        info.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        info.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        info.AddThemeConstantOverride("separation", 6);
        line.AddChild(info);
        info.AddChild(WinterUi.Label(formula, 13, new Color("e4eeea"), wrap: true));
        var button = WinterUi.OvButton(buttonText, "ok", new Vector2(280, 40));
        button.Pressed += () =>
        {
            _audio?.PlaySfx("confirm");
            _core?.RequestRunAction(action);
        };
        info.AddChild(button);
        return row;
    }

    /// <summary>
    /// 材料计数刷新：碎片数快照无字段（[6b'→A] Fragments）恒显「—/2」；
    /// 通行证 A/B 从 InventoryLabels 栈名解析（对局中=随身背包，局外=基地仓库）。
    /// </summary>
    private void RefreshMaterials()
    {
        if (_goldCount == null) return;
        var snapshot = _snapshot;
        _fragmentCount.Text = "—/2"; // [6b'→A] RunUiSnapshot.Fragments 就位后改实值（N/2）
        _goldCount.Text = CountOf(snapshot, CodexCatalog.TokenGoldId).ToString();
        _colorCount.Text = CountOf(snapshot, CodexCatalog.TokenColorId).ToString();
    }

    private static int CountOf(RunUiSnapshot? snapshot, string cardId)
    {
        if (snapshot == null) return 0;
        var name = cardId == CodexCatalog.TokenGoldId ? "员工通行证B" : "员工通行证A";
        foreach (var label in snapshot.InventoryLabels)
        {
            var match = StackRegex.Match(label);
            if (match.Success && match.Groups["name"].Value == name)
                return int.TryParse(match.Groups["n"].Value, out var parsed) ? parsed : 0;
        }
        return 0;
    }
}
