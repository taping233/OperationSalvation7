using Godot;
using SoudacheGodot.App;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// 对局地图画布（批次 6c-map）：网页版 搜打撤/game/src/renderer.js 的 Godot _draw() 1:1 移植。
/// 消费 RunUiSnapshot.Nodes（MapNodeUiSnapshot X/Row/Neighbors/Type/IsCurrent/IsCurrent），
/// 绘制壁纸层 → 环内连线（确定性弯曲二次贝塞尔）→ 可走道路三描 → 结点盘面/位图图标 →
/// 状态描环（当前金/可走亮金/微光环绕/已走绿环）→ 编号 → 入口脉冲 → 祭坛法阵 →
/// 悬停/选中金色下行箭头（2026-09-09 定版）→ 当前棋子标记（移动 220ms 三次缓出+金色四角括号）→ 暗角。
/// 所有线宽/字号在屏幕空间恒定像素（网页 ctx.lineWidth = n / cam.zoom 同口径）。
/// 缺快照信号已登记 [6c-map→A]：seen（战争迷雾）与 visited 批量填充（IsResolved 已接线、待适配器填充）——
/// 迷雾关闭时网页本就全可见（seen 为空兼容态），本实现恒 fog off，与网页 seen 空行为一致。
/// </summary>
public partial class MapBoardCanvas : Control
{
    /// <summary>点击可走节点（MapScreen 转 RequestRunAction("move:idx")）。</summary>
    public event Action<int>? NodeClicked;
    /// <summary>悬停节点变化（网页 game.boot.js updateHover：节点变化时 sfx('hover')）。</summary>
    public event Action? HoverChanged;

    // —— renderer.js 常量 ——
    private const float NodeR = 26f;          // NODE_R 普通结点半径（世界像素）
    private const float BossR = 30f;          // BOSS_R
    private const float AltarR = 32f;         // ALTAR_R
    private const float WorldSpacing = 120f;  // game.session.js MAP_NODE_SPACING
    private const float WorldPadding = 180f;  // game.session.js MAP_NODE_PADDING
    private const float Tile = 48f;           // SDT.MAP.tile（map.json），棋子/法阵尺寸基准 T0
    private const float FitPadding = 128f;    // enterLayer → cam.fitLayer(game, 128)
    private const float HitMinWorld = 34f;    // camera.js nodeHitRadius minWorldPx
    private const float HitMinScreen = 28f;   // camera.js nodeHitRadius minScreenPx

    private static readonly Color BgTop = new("17252b");     // COLORS.bgTop
    private static readonly Color BgBottom = new("080c10");  // COLORS.bgBottom
    private static readonly Color RingLink = new(226 / 255f, 202 / 255f, 150 / 255f, 0.66f); // COLORS.ringLink
    private static readonly Color DiscBase = new("141210");  // mixHex 压暗目标色

    // GLISTEN 重要结点微光环绕色（renderer.js）
    private static readonly Dictionary<string, Color> Glisten = new()
    {
        ["altar"] = new(154 / 255f, 124 / 255f, 200 / 255f, 0.9f),
        ["boss"] = new(255 / 255f, 110 / 255f, 90 / 255f, 0.85f),
        ["door"] = new(225 / 255f, 192 / 255f, 120 / 255f, 0.85f),
        ["emergencyExit"] = new(82 / 255f, 210 / 255f, 115 / 255f, 0.85f),
        ["entrance"] = new(82 / 255f, 210 / 255f, 115 / 255f, 0.85f),
    };

    // layeredMap.js LAYER_COLORS（层色：结点盘面 tint）
    private static readonly Color[] LayerColors =
    {
        new("78b9d6"), new("9fcf8d"), new("d8ae68"), new("b77ad8"),
    };

    // —— 快照态 ——
    private RunUiSnapshot? _snapshot;
    private readonly Dictionary<int, Vector2> _pos = new();    // idx → 世界坐标
    private readonly Dictionary<int, string> _types = new();   // idx → 结点类型
    private readonly List<(int a, int b, float seed)> _edges = new();
    private readonly HashSet<int> _legal = new();              // 当前节点相邻（可走集合）
    private Vector2 _boundsMin, _boundsMax;
    private bool _hasLayer;

    // —— 镜头（camera.js fitBounds：zoom 钳 0.4..2.5，焦点=包围盒中心） ——
    private float _zoom = 1f;
    private Vector2 _center;
    private Vector2 _lastDrawSize;

    // —— 交互 ——
    private int _hoverIdx = -1;
    private int _pinnedHoverIdx = -1;   // 验收演示：钉住的「选中态」金箭头目标
    private int _lastHoverSfx = -1;

    // —— 棋子移动动画（game.run.flow.js MOVE_DURATION=220ms，eased=1-(1-t)^3） ——
    private const double MoveDuration = 0.22;
    private Vector2 _markerWorld;
    private Vector2 _moveFrom;
    private Vector2 _moveTo;
    private double _moveT = 1.0;
    private int _moveTargetIdx = -1;
    private int _markerTrackPos = -1;

    private double _time;
    private readonly Dictionary<string, Texture2D?> _baked = new();
    private Func<string, string> _iconResolver = type => AssetLibrary.MapIcon(type);
    private Texture2D? _backdrop;
    private readonly Dictionary<int, Texture2D> _discTex = new();
    private Texture2D? _veilTex;
    private float _veilCached = -1f;
    private Texture2D? _darkTex;
    private Texture2D? _haloTex;
    private Texture2D? _vignetteTex;

    /// <summary>结点图标路径解析器注入（MapScreen 组合点传入 AssetLibrary.MapIcon）。</summary>
    public void SetIconResolver(Func<string, string> resolver)
    {
        _iconResolver = resolver;
        _baked.Clear();
    }

    public override void _Ready()
    {
        MouseFilter = Control.MouseFilterEnum.Stop;
        ClipContents = true;
        Resized += () =>
        {
            if (_hasLayer) RefitCamera();
            QueueRedraw();
        };
    }

    /// <summary>快照接入（MapScreen.ApplySnapshot 调用）；TrackPosition 变化时启动棋子位移动画。</summary>
    public void SetData(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        RebuildGeometry();
        if (_pos.TryGetValue(snapshot.TrackPosition, out var cur))
        {
            if (_markerTrackPos != snapshot.TrackPosition)
            {
                if (_markerTrackPos >= 0 && _pos.ContainsKey(_markerTrackPos))
                {
                    // 走格子动画（game.run.flow.js moveTo：220ms 三次缓出 + 目标金色四角括号）
                    _moveFrom = _pos[_markerTrackPos];
                    _moveTo = cur;
                    _moveT = 0.0;
                    _moveTargetIdx = snapshot.TrackPosition;
                }
                else
                {
                    _markerWorld = cur;
                    _moveT = 1.0;
                    _moveTargetIdx = -1;
                }
                _markerTrackPos = snapshot.TrackPosition;
            }
            if (_moveT >= 1.0) _markerWorld = cur;
        }
        else
        {
            _markerTrackPos = -1;
            _moveT = 1.0;
        }
        EnsureBackdrop();
        QueueRedraw();
    }

    /// <summary>验收演示/锁定选中：钉住一个可走节点显示金箭头（网页 game.hover 定格）。</summary>
    public void SetPinnedHover(int idx)
    {
        _pinnedHoverIdx = idx;
        QueueRedraw();
    }

    public int? FirstLegalIndex() => _legal.Count == 0 ? null : _legal.Min();

    private string NodeType(int idx) => _types.TryGetValue(idx, out var t) ? t : "unknown";

    // ------------------------------------------------------------------
    // 几何：nodePos / 边去重 / 可走集合（renderer.js nodeGeo 的快照版）
    // ------------------------------------------------------------------

    private void RebuildGeometry()
    {
        _pos.Clear();
        _types.Clear();
        _edges.Clear();
        _legal.Clear();
        _hasLayer = false;
        var snap = _snapshot;
        if (snap == null || snap.Nodes.Length == 0) return;

        int minX = int.MaxValue, minRow = int.MaxValue;
        foreach (var n in snap.Nodes)
        {
            minX = Math.Min(minX, n.X);
            minRow = Math.Min(minRow, n.Row);
        }
        // game.session.js buildDerived：x = PADDING + (cell.x - minX) * SPACING
        foreach (var n in snap.Nodes)
        {
            _pos[n.Index] = new Vector2(
                WorldPadding + (n.X - minX) * WorldSpacing,
                WorldPadding + (n.Row - minRow) * WorldSpacing);
            _types[n.Index] = n.Type;
        }

        // 当前层道路按真实 next 去重（edgeKey 排序拼接同口径）
        var seenEdge = new HashSet<long>();
        foreach (var n in snap.Nodes)
        {
            foreach (var to in n.Neighbors)
            {
                if (!_types.ContainsKey(to)) continue;
                var lo = Math.Min(n.Index, to);
                var hi = Math.Max(n.Index, to);
                if (!seenEdge.Add((long)lo * 100000 + hi)) continue;
                // hand() 种子：li*57 + i*13 + toLi*3 + toIdx（同层 li=toLi=LayerIndex）
                _edges.Add((n.Index, to, snap.LayerIndex * 57f + n.Index * 13f + snap.LayerIndex * 3f + to));
            }
        }

        var current = snap.Nodes.FirstOrDefault(n => n.IsCurrent);
        if (current != null)
            foreach (var to in current.Neighbors)
                if (_types.ContainsKey(to))
                    _legal.Add(to);

        _boundsMin = new Vector2(_pos.Values.Min(p => p.X), _pos.Values.Min(p => p.Y));
        _boundsMax = new Vector2(_pos.Values.Max(p => p.X), _pos.Values.Max(p => p.Y));
        _hasLayer = true;
        RefitCamera();
    }

    private void RefitCamera()
    {
        // camera.js fitBounds(bounds, 128)：zoom = clamp(min(vw/w, vh/h), 0.4, 2.5)，焦点=包围盒中心
        var w = Math.Max(1f, _boundsMax.X - _boundsMin.X + FitPadding * 2f);
        var h = Math.Max(1f, _boundsMax.Y - _boundsMin.Y + FitPadding * 2f);
        _zoom = Math.Clamp(Math.Min(Size.X / w, Size.Y / h), 0.4f, 2.5f);
        _center = (_boundsMin + _boundsMax) / 2f;
    }

    private Vector2 WorldToScreen(Vector2 world) => (world - _center) * _zoom + Size / 2f;
    private Vector2 ScreenToWorld(Vector2 screen) => (screen - Size / 2f) / _zoom + _center;

    private float NodeRadius(string type) =>
        type is "altar" ? AltarR : type is "boss" ? BossR : NodeR;   // renderer.js nodeRadius

    // ------------------------------------------------------------------
    // 逐帧
    // ------------------------------------------------------------------

    public override void _Process(double delta)
    {
        if (!_hasLayer || !IsVisibleInTree()) return;
        _time += delta;
        if (_moveT < 1.0)
        {
            _moveT = Math.Min(1.0, _moveT + delta / MoveDuration);
            var t = (float)_moveT;
            var eased = 1f - MathF.Pow(1f - t, 3f);   // game.run.flow.js eased
            _markerWorld = _moveFrom.Lerp(_moveTo, eased);
        }
        QueueRedraw();   // 可走道路脉冲 / 金箭头浮动 / 法阵虚线均为时间驱动（网页逐帧重绘同口径）
    }

    public override void _GuiInput(InputEvent @event)
    {
        if (!_hasLayer) return;
        if (@event is InputEventMouseMotion motion)
        {
            var hit = PickNode(ScreenToWorld(motion.Position));
            var next = hit ?? -1;
            if (next != _hoverIdx)
            {
                _hoverIdx = next;
                if (next >= 0 && next != _lastHoverSfx)
                {
                    _lastHoverSfx = next;
                    HoverChanged?.Invoke();
                }
                QueueRedraw();
            }
            var legalHit = hit.HasValue && _legal.Contains(hit.Value) && _moveT >= 1.0;
            MouseDefaultCursorShape = legalHit ? CursorShape.PointingHand : CursorShape.Arrow;
        }
        else if (@event is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left } click)
        {
            var hit = PickNode(ScreenToWorld(click.Position));
            // 网页 game.boot.js：只有相邻可走节点可点（moveTo 内还有 next 集合二次校验）
            if (hit.HasValue && _legal.Contains(hit.Value) && _moveT >= 1.0)
                NodeClicked?.Invoke(hit.Value);
        }
    }

    private int? PickNode(Vector2 world)
    {
        // camera.js nodeHitRadius：max(34, 28/zoom) 世界命中半径
        var radius = Math.Max(HitMinWorld, HitMinScreen / Math.Max(0.4f, _zoom));
        int? best = null;
        var bestD = float.MaxValue;
        foreach (var (idx, p) in _pos)
        {
            var d = p.DistanceTo(world);
            if (d <= radius && d < bestD)
            {
                bestD = d;
                best = idx;
            }
        }
        return best;
    }

    public override void _Draw()
    {
        if (!_hasLayer || _snapshot == null) return;
        if (_lastDrawSize != Size)
        {
            _lastDrawSize = Size;
            RefitCamera();
        }
        var size = Size;
        DrawBackdrop(size);
        DrawLinks();
        DrawNodePlates();
        DrawIcons();
        DrawIndexes();
        DrawEntrancePulse();
        DrawAltarCircle();
        DrawMoveTargetBrackets();
        DrawHoverRing();
        DrawTargetArrow();
        DrawPlayer();
        DrawVignette(size);
    }

    // ------------------------------------------------------------------
    // 分层绘制（renderer.js draw() 顺序）
    // ------------------------------------------------------------------

    private void DrawBackdrop(Vector2 size)
    {
        DrawRect(new Rect2(Vector2.Zero, size), new Color("0b0e12"));   // 壁纸未就绪回退底色
        if (_backdrop != null)
        {
            // drawCover：scale = max(w/iw, h/ih)，居中裁剪铺满
            var iw = _backdrop.GetWidth();
            var ih = _backdrop.GetHeight();
            if (iw > 0 && ih > 0)
            {
                var scale = MathF.Max(size.X / iw, size.Y / ih);
                var dw = iw * scale;
                var dh = ih * scale;
                DrawTextureRect(_backdrop,
                    new Rect2((size.X - dw) * 0.5f, (size.Y - dh) * 0.5f, dw, dh), false, Colors.White);
            }
        }
        // 层遮罩：veil 强度的 bg 渐变（bgTop→bgBottom，按层 0.5 / 0.62 / 0.8 / 0.5）
        DrawTextureRect(VeilTexture(LayerVeil(_snapshot!.LayerIndex)), new Rect2(Vector2.Zero, size), false, Colors.White);
        // 轻量暗色层（draw() 内三段 bg 渐变，保留对比度不遮壁纸主体）
        DrawTextureRect(DarkLayerTexture(), new Rect2(Vector2.Zero, size), false, Colors.White);
        // 中央冷青 halo（径向 0.08 → 0.03@0.62 → 0）
        DrawTextureRect(HaloTexture(), HaloRect(size), false, Colors.White);
    }

    private static float LayerVeil(int li) => li switch
    {
        2 => 0.62f,   // layer3-knight.webp
        3 => 0.8f,    // layer4-priestess-light.webp（浅底必须压暗）
        4 => 0.5f,    // layer5-priestess-dark.webp
        _ => 0.5f,    // environmentBackdrop（endfield-ruins）
    };

    private void DrawLinks()
    {
        var snap = _snapshot!;
        // 环内相邻结点连线：实描（α0.20 @1.8px）+ 点划叠加（α0.08 @2.8px，dash 1.5/9）
        foreach (var (a, b, seed) in _edges)
        {
            if (!_pos.TryGetValue(a, out var pa) || !_pos.TryGetValue(b, out var pb)) continue;
            var (ta, tb) = Trim(pa, pb, NodeRadius(NodeType(a)) + 8f, NodeRadius(NodeType(b)) + 8f);
            var sa = WorldToScreen(ta);
            var sb = WorldToScreen(tb);
            var samples = QuadSamples(sa, WorldToScreen(BendMid(ta, tb, seed)), sb, 16);
            DrawPolyline(samples, new Color(RingLink, RingLink.A * 0.20f), 1.8f);
            DrawDashedPolyline(samples, 1.5f, 9f, new Color(RingLink, RingLink.A * 0.08f), 2.8f);
        }
        // 当前节点可走道路：柔光底 13px / 亮色中层 5.4px / 白金芯线 1.7px（pulse=0.82+sin(3.2t)*0.12）
        if (_legal.Count > 0 && _pos.TryGetValue(snap.TrackPosition, out var from))
        {
            var pulse = 0.82f + MathF.Sin((float)_time * 3.2f) * 0.12f;
            foreach (var to in _legal)
            {
                if (!_pos.TryGetValue(to, out var pb)) continue;
                var (ta, tb) = Trim(from, pb, NodeRadius(NodeType(snap.TrackPosition)) + 8f,
                    NodeRadius(NodeType(to)) + 8f);
                var sa = WorldToScreen(ta);
                var sb = WorldToScreen(tb);
                var samples = QuadSamples(sa,
                    WorldToScreen(BendMid(ta, tb, snap.LayerIndex * 57f + snap.TrackPosition * 13f + snap.LayerIndex * 3f + to)),
                    sb, 16);
                DrawPolyline(samples, new Color(1f, 190 / 255f, 74 / 255f, 0.78f * 0.42f * pulse), 13f);
                DrawPolyline(samples, new Color(1f, 202 / 255f, 91 / 255f, 0.96f * 0.92f * pulse), 5.4f);
                DrawPolyline(samples, new Color(1f, 247 / 255f, 205 / 255f, 0.98f), 1.7f);
            }
        }
        // 祭坛引导线（紫，altarEntrances → 中央祭坛）：快照无 li=-1 中央节点/altarEntrances 信号，
        // 已登记 [6c-map→A]，数据到位前不绘制（与网页「无 altarNode 不画」一致）。
    }

    private Vector2 BendMid(Vector2 a, Vector2 b, float seed)
    {
        // renderer.js hand()：off = (hash2(seed,7)-0.5)*2*min(18, len*0.08)，中点沿法线偏移
        var len = a.DistanceTo(b);
        if (len < 1f) return (a + b) / 2f;
        var dir = (b - a) / len;
        var off = (Hash2(seed, 7) - 0.5f) * 2f * MathF.Min(18f, len * 0.08f);
        return (a + b) / 2f + new Vector2(-dir.Y, dir.X) * off;
    }

    private static (Vector2, Vector2) Trim(Vector2 from, Vector2 to, float gapA, float gapB)
    {
        var len = from.DistanceTo(to);
        if (len < 1f) return (from, to);
        var dir = (to - from) / len;
        return (from + dir * gapA, to - dir * gapB);
    }

    private void DrawNodePlates()
    {
        var snap = _snapshot!;
        foreach (var n in snap.Nodes)
        {
            if (!_pos.TryGetValue(n.Index, out var world)) continue;
            var r = NodeRadius(n.Type);
            var p = WorldToScreen(world);
            var alpha = NodeAlpha(n.Index);
            // 纸面落影：ellipse(x+2.5, y+4, r*1.02, r*0.62) rgba(0,0,0,0.38)
            DrawSetTransform(p + new Vector2(2.5f, 4f) * _zoom, 0f, new Vector2(1f, 0.608f));
            DrawCircle(Vector2.Zero, r * _zoom * 1.02f, new Color(0f, 0f, 0f, 0.38f * alpha));
            DrawSetTransform(Vector2.Zero, 0f, Vector2.One);
            // 盘面：层色微 tint 深色径向渐变 base = mixHex(layerColor,#141210,0.82)
            var dr = r * _zoom * 1.02f;
            DrawTextureRect(DiscTexture(snap.LayerIndex),
                new Rect2(p - new Vector2(dr, dr), new Vector2(dr, dr) * 2f),
                false, new Color(1f, 1f, 1f, alpha));
        }
    }

    private float NodeAlpha(int idx)
    {
        // drawIcons：current 1 / legal 0.95 / 其余 0.55
        if (_snapshot!.TrackPosition == idx) return 1f;
        if (_legal.Contains(idx)) return 0.95f;
        return 0.55f;
    }

    private void DrawIcons()
    {
        var snap = _snapshot!;
        foreach (var n in snap.Nodes)
        {
            if (!_pos.TryGetValue(n.Index, out var world)) continue;
            var r = NodeRadius(n.Type);
            var p = WorldToScreen(world);
            var alpha = NodeAlpha(n.Index);
            var current = snap.TrackPosition == n.Index;
            var legal = _legal.Contains(n.Index);
            var baked = BakedIcon(n.Type);
            if (baked != null)
            {
                // 圆形位图结点（呼吸缩放由结点盘面统一表达；位图直径 = 2r）
                DrawTextureRect(baked, new Rect2(p - new Vector2(r, r) * _zoom, new Vector2(r, r) * _zoom * 2f),
                    false, new Color(1f, 1f, 1f, alpha));
                // drawBitmapIcon 描环：当前金环 0.5 / 可走亮金 0.85 @2.4 / 其余暗 0.25
                var ringColor = current
                    ? new Color(235 / 255f, 205 / 255f, 140 / 255f, 0.5f)
                    : legal
                        ? new Color(1f, 214 / 255f, 110 / 255f, 0.85f)
                        : new Color(180 / 255f, 160 / 255f, 120 / 255f, 0.25f);
                DrawArc(p, r * _zoom, 0f, Mathf.Tau, 64, ringColor, legal && !current ? 2.4f : 1.6f);
            }
            // GLISTEN 微光环绕（1.26r，1.5px，current 0.9 / 0.18）
            if (Glisten.TryGetValue(n.Type, out var glow))
                DrawArc(p, r * _zoom * 1.26f, 0f, Mathf.Tau, 64,
                    new Color(glow, glow.A * (current ? 0.9f : 0.18f)), 1.5f);
            // 已走绿环（drawIcons walked 分支：1.16r 描绿 + 0.16 填充；IsResolved 待 [6c-map→A] 填充生效）
            if (n.IsResolved)
            {
                DrawArc(p, r * _zoom * 1.16f, 0f, Mathf.Tau, 64,
                    new Color(82 / 255f, 210 / 255f, 115 / 255f, current ? 0.95f : 0.6f), 2.2f);
                DrawCircle(p, r * _zoom * 1.16f, new Color(82 / 255f, 210 / 255f, 115 / 255f, 0.16f));
            }
        }
    }

    private void DrawIndexes()
    {
        // drawIndexes：当前层结点编号（0 起），font 9px，current α0.85 / 0.18，位置 y-r-4
        var snap = _snapshot!;
        var font = ThemeTokens.Noto;
        foreach (var n in snap.Nodes)
        {
            if (!_pos.TryGetValue(n.Index, out var world)) continue;
            var p = WorldToScreen(world);
            var r = NodeRadius(n.Type);
            var alpha = snap.TrackPosition == n.Index ? 0.85f : 0.18f;
            var text = n.Index.ToString();
            var tw = font.GetStringSize(text, HorizontalAlignment.Left, -1, 9).X;
            DrawString(font, new Vector2(p.X - tw / 2f, p.Y - (r * _zoom + 4f)), text,
                HorizontalAlignment.Left, -1, 9, new Color(1f, 1f, 1f, 0.6f * alpha));
        }
    }

    private void DrawEntrancePulse()
    {
        // drawEntrancePulse：入口脉冲圈 NODE_R+4+2.5（pulse 定值 0.5），current α1 / 0.16
        var snap = _snapshot!;
        foreach (var n in snap.Nodes)
        {
            if (n.Type != "entrance") continue;
            if (!_pos.TryGetValue(n.Index, out var world)) continue;
            var p = WorldToScreen(world);
            DrawArc(p, (NodeR + 4f + 2.5f) * _zoom, 0f, Mathf.Tau, 48,
                new Color(90 / 255f, 162 / 255f, 134 / 255f, n.IsCurrent ? 1f : 0.16f), 2f);
        }
    }

    private void DrawAltarCircle()
    {
        // drawAltarCircle：祭坛旋转法阵双层虚线（T0*1.05 / T0*0.72，dash 7/9，offset ∓t·14 / +t·10）
        var snap = _snapshot!;
        var altar = snap.Nodes.FirstOrDefault(n => n.Type == "altar");
        if (altar == null || !_pos.TryGetValue(altar.Index, out var world)) return;
        var deep = snap.LayerIndex >= 3;   // 最深层（四层定版 li=3，网页 layerIdx===layerData.length-1）
        var a = deep ? 0.55f : 0.20f;
        var p = WorldToScreen(world);
        DrawDashedCircle(p, Tile * 1.05f * _zoom, 7f, 9f, new Color(154 / 255f, 124 / 255f, 200 / 255f, a), 1.6f, -(float)_time * 14f);
        DrawDashedCircle(p, Tile * 0.72f * _zoom, 7f, 9f, new Color(186 / 255f, 150 / 255f, 230 / 255f, a * 0.8f), 1.6f, (float)_time * 10f);
    }

    private void DrawMoveTargetBrackets()
    {
        // drawMoveTarget：移动中目标结点金色四角括号（s=T0*0.38, L=T0*0.16, 2px 圆头）
        if (_moveT >= 1.0 || _moveTargetIdx < 0 || !_pos.TryGetValue(_moveTargetIdx, out var world)) return;
        var p = WorldToScreen(world);
        var s = Tile * 0.38f;
        var l = Tile * 0.16f;
        var c = new Color(245 / 255f, 197 / 255f, 66 / 255f, 0.9f);
        foreach (var (sx, sy) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
        {
            var corner = p + new Vector2(sx * s, sy * s);
            DrawLine(corner - new Vector2(sx * l, 0), corner, c, 2f);
            DrawLine(corner, corner - new Vector2(0, sy * l), c, 2f);
        }
    }

    private void DrawHoverRing()
    {
        // drawHover：悬停圈（r+4，填充 0.10 + 描边 0.7 金 + 微光）
        var idx = _pinnedHoverIdx >= 0 ? _pinnedHoverIdx : _hoverIdx;
        if (idx < 0 || !_pos.TryGetValue(idx, out var world)) return;
        if (!_types.TryGetValue(idx, out var type)) return;
        var r = NodeRadius(type);
        var p = WorldToScreen(world);
        DrawCircle(p, (r + 4f) * _zoom, new Color(240 / 255f, 210 / 255f, 140 / 255f, 0.10f));
        DrawArc(p, (r + 4f) * _zoom, 0f, Mathf.Tau, 64, new Color(240 / 255f, 210 / 255f, 140 / 255f, 0.7f), 1.5f);
    }

    /// <summary>选中态金色下行箭头（drawTargetArrow/drawNodeArrow，2026-09-09 定版）：悬停/锁定的可达节点上方上下浮动。</summary>
    private void DrawTargetArrow()
    {
        var idx = _pinnedHoverIdx >= 0 ? _pinnedHoverIdx : _hoverIdx;
        if (idx < 0 || !_legal.Contains(idx) || !_pos.TryGetValue(idx, out var world)) return;
        var p = WorldToScreen(world);
        var bounce = MathF.Sin((float)_time * 4.2f) * 3f;
        var y = p.Y - NodeRadius(NodeType(idx)) * _zoom - 14f - bounce;
        // shadowBlur 6 近似：下移 1.5px 的暗金重影
        DrawArrowShape(new Vector2(p.X, y + 1.5f), new Color(216 / 255f, 180 / 255f, 106 / 255f, 0.35f));
        DrawArrowShape(new Vector2(p.X, y), new Color(245 / 255f, 197 / 255f, 66 / 255f, 0.95f));
    }

    private void DrawArrowShape(Vector2 at, Color color)
    {
        // moveTo(-9,-10)→(9,-10)→(0,2) 三角 + fillRect(-2.5,-20,5,11) 杆（屏幕恒定尺寸）
        DrawColoredPolygon(new[] { at + new Vector2(-9, -10), at + new Vector2(9, -10), at + new Vector2(0, 2) }, color);
        DrawRect(new Rect2(at + new Vector2(-2.5f, -20f), new Vector2(5, 11)), color);
    }

    private void DrawPlayer()
    {
        // drawPlayer：浅红圆圈标记 + 贴地呼吸光圈 + 外扩涟漪 + 名牌「你」（pulse 定值 0.5）
        if (_markerTrackPos < 0 || _snapshot == null) return;
        var p = WorldToScreen(_markerWorld);
        var s = Tile * 0.40f;
        const float pulse = 0.5f;
        // 地影
        DrawSetTransform(p + new Vector2(0, s * 0.14f) * _zoom, 0f, new Vector2(1f, 0.32f));
        DrawCircle(Vector2.Zero, s * 0.5f * _zoom, new Color(0f, 0f, 0f, 0.42f));
        DrawSetTransform(Vector2.Zero, 0f, Vector2.One);
        // 呼吸光圈（贴地椭圆，与标记同色系）
        DrawSetTransform(p + new Vector2(0, s * 0.14f) * _zoom, 0f, new Vector2(1f, 0.342f));
        DrawArc(Vector2.Zero, s * (0.68f + pulse * 0.1f) * _zoom, 0f, Mathf.Tau, 48,
            new Color(1f, 132 / 255f, 115 / 255f, 0.34f - pulse * 0.18f), 2f);
        DrawSetTransform(Vector2.Zero, 0f, Vector2.One);
        // 当前位置标记（T0*0.66*(1+pulse*0.10)）
        var markR = Tile * 0.66f * (1f + pulse * 0.10f) * _zoom;
        DrawCircle(p, markR, new Color(1f, 120 / 255f, 105 / 255f, 0.16f));
        DrawArc(p, markR, 0f, Mathf.Tau, 64, new Color(1f, 132 / 255f, 115 / 255f, 0.95f), 3.2f);
        // 外扩涟漪
        DrawArc(p, markR * (1.15f + pulse * 0.35f), 0f, Mathf.Tau, 64,
            new Color(1f, 132 / 255f, 115 / 255f, 0.55f - pulse * 0.4f), 2f);
        // 名牌胶囊「你」（钉在标记上方）
        var font = ThemeTokens.Noto;
        var text = "你";
        var tw = font.GetStringSize(text, HorizontalAlignment.Left, -1, 10).X;
        var lw = tw + 12f;
        const float lh = 15f;
        var ly = p.Y - markR - 16f;
        var rect = new Rect2(p.X - lw / 2f, ly - lh / 2f, lw, lh);
        DrawStyleBox(new StyleBoxFlat
        {
            BgColor = new Color(22 / 255f, 15 / 255f, 6 / 255f, 0.85f),
            BorderColor = new Color(216 / 255f, 180 / 255f, 106 / 255f, 0.55f),
            BorderWidthBottom = 1, BorderWidthLeft = 1, BorderWidthRight = 1, BorderWidthTop = 1,
            CornerRadiusBottomLeft = (int)(lh / 2), CornerRadiusBottomRight = (int)(lh / 2),
            CornerRadiusTopLeft = (int)(lh / 2), CornerRadiusTopRight = (int)(lh / 2),
        }, rect);
        DrawString(font, new Vector2(p.X - tw / 2f, ly + 3.5f), text, HorizontalAlignment.Left, -1, 10,
            new Color("f2e2b8"));
    }

    private void DrawVignette(Vector2 size)
    {
        // draw() 尾帧暗角：径向 transparent → rgba(0,0,0,0.36)
        DrawTextureRect(VignetteTexture(), new Rect2(Vector2.Zero, size), false, Colors.White);
    }

    // ------------------------------------------------------------------
    // 缓存纹理 / 绘制工具
    // ------------------------------------------------------------------

    private void EnsureBackdrop()
    {
        var li = _snapshot?.LayerIndex ?? -1;
        // renderer.js LAYER_BACKDROPS：2→layer3-knight / 3→layer4-priestess-light / 4→layer5-priestess-dark / 其余 endfield-ruins
        var path = li switch
        {
            2 => "res://assets/map/layer3-knight.webp",
            3 => "res://assets/map/layer4-priestess-light.webp",
            4 => "res://assets/map/layer5-priestess-dark.webp",
            _ => "res://assets/map/endfield-ruins.jpg",
        };
        _backdrop = LoadTextureRobust(path);
    }

    /// <summary>
    /// 壁纸加载：优先 GD.Load（编辑器/已导入环境）；release 模板运行时对无导入产物的
    /// raw jpg/webp 可能无资源加载器，回退 FileAccess + Image.Load*FromBuffer（核心图像模块）。
    /// </summary>
    private static Texture2D? LoadTextureRobust(string path)
    {
        if (ResourceLoader.Exists(path))
        {
            try
            {
                var loaded = GD.Load<Texture2D>(path);
                if (loaded != null) return loaded;
            }
            catch (Exception)
            {
                // 落到缓冲解码
            }
        }
        try
        {
            using var file = FileAccess.Open(path, FileAccess.ModeFlags.Read);
            if (file == null) return null;
            var buffer = file.GetBuffer((long)file.GetLength());
            var image = new Image();
            var ok = path.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase)
                || path.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)
                    ? image.LoadJpgFromBuffer(buffer)
                    : path.EndsWith(".webp", StringComparison.OrdinalIgnoreCase)
                        ? image.LoadWebpFromBuffer(buffer)
                        : path.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                            ? image.LoadPngFromBuffer(buffer)
                            : Error.Failed;
            return ok == Error.Ok ? ImageTexture.CreateFromImage(image) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private Texture2D? BakedIcon(string type)
    {
        if (_baked.TryGetValue(type, out var cached)) return cached;
        Texture2D? result = null;
        var path = _iconResolver(type);
        if (ResourceLoader.Exists(path))
        {
            try
            {
                var image = GD.Load<Texture2D>(path).GetImage();
                if (image != null)
                {
                    if (image.IsCompressed()) image.Decompress();
                    image.Convert(Image.Format.Rgba8);
                    result = BakeCircularIcon(image);
                }
            }
            catch (Exception)
            {
                result = null;   // 位图未就绪 → 回退盘面（网页 drawBitmapIcon 返回 false 同口径）
            }
        }
        else
        {
            // 无导入产物的 raw 资源（新拷贝 svg/png）：FileAccess + Image 缓冲解码回退
            try
            {
                using var file = FileAccess.Open(path, FileAccess.ModeFlags.Read);
                if (file != null)
                {
                    var buffer = file.GetBuffer((long)file.GetLength());
                    Image? raw = null;
                    if (path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
                    {
                        var svg = System.Text.Encoding.UTF8.GetString(buffer);
                        var svgImage = new Image();
                        if (svgImage.LoadSvgFromString(svg) == Error.Ok) raw = svgImage;
                    }
                    else if (path.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                    {
                        var pngImage = new Image();
                        if (pngImage.LoadPngFromBuffer(buffer) == Error.Ok) raw = pngImage;
                    }
                    if (raw != null)
                    {
                        raw.Convert(Image.Format.Rgba8);
                        result = BakeCircularIcon(raw);
                    }
                }
            }
            catch (Exception)
            {
                result = null;
            }
        }
        _baked[type] = result;
        return result;
    }

    /// <summary>renderer.icons.js bakedIconFor：#1d1c1a 圆底 + 0.97R 圆形裁剪位图（0.91R 起 1.82R 宽），256px 烘焙。</summary>
    private static Texture2D BakeCircularIcon(Image src)
    {
        const int size = 256;
        const float r = size / 2f;
        var disk = Image.CreateEmpty(size, size, false, Image.Format.Rgba8);
        var dark = new Color("1d1c1a");
        for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
                if (new Vector2(x + 0.5f - r, y + 0.5f - r).Length() <= r - 0.5f)
                    disk.SetPixel(x, y, dark);
        var inner = (int)(r * 1.82f);
        var scaled = (Image)src.Duplicate();
        scaled.Resize(inner, inner, Image.Interpolation.Lanczos);
        var maskR = r * 0.97f;
        var off = (int)(r - r * 0.91f);
        for (var y = 0; y < inner; y++)
        {
            var py = off + y;
            if (py < 0 || py >= size) continue;
            for (var x = 0; x < inner; x++)
            {
                var px = off + x;
                if (px < 0 || px >= size) continue;
                var c = scaled.GetPixel(x, y);
                if (c.A <= 0.002f) continue;
                if (new Vector2(px + 0.5f - r, py + 0.5f - r).Length() > maskR) continue;
                var dst = disk.GetPixel(px, py);
                var outA = c.A + dst.A * (1f - c.A);
                if (outA <= 0f) continue;
                disk.SetPixel(px, py, new Color(
                    (c.R * c.A + dst.R * dst.A * (1f - c.A)) / outA,
                    (c.G * c.A + dst.G * dst.A * (1f - c.A)) / outA,
                    (c.B * c.A + dst.B * dst.A * (1f - c.A)) / outA, outA));
            }
        }
        return ImageTexture.CreateFromImage(disk);
    }

    private Texture2D DiscTexture(int layerIdx)
    {
        // 盘面径向渐变（mixHex(layerColor,#141210,0.82)，shade +0.05 → -0.08），
        // 渐变中心偏移 (-0.3r,-0.4r)、半径 r，1.02r 圆形裁剪（ensureBoard 结点盘面）。
        // 用逐像素烘焙 Image（GradientTexture2D 无法做「圆外透明」，会画成方斑）。
        if (_discTex.TryGetValue(layerIdx, out var tex)) return tex;
        var layerColor = layerIdx >= 0 && layerIdx < LayerColors.Length ? LayerColors[layerIdx] : new Color("6e5133");
        var baseColor = layerColor.Lerp(DiscBase, 0.82f);
        var light = Shade(baseColor, 0.05f);
        var dark = Shade(baseColor, -0.08f);
        const int size = 128;
        var img = Image.CreateEmpty(size, size, false, Image.Format.Rgba8);
        var c = new Vector2(size / 2f, size / 2f);
        var off = new Vector2(-0.15f, -0.20f) * size;   // (-0.3r, -0.4r)
        var radius = size / 2f;
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var p = new Vector2(x + 0.5f, y + 0.5f);
                if (p.DistanceTo(c) > radius * 1.02f) continue;   // 圆形裁剪
                var d = MathF.Min(1f, p.DistanceTo(c + off) / radius);
                img.SetPixel(x, y, light.Lerp(dark, d));
            }
        }
        tex = ImageTexture.CreateFromImage(img);
        _discTex[layerIdx] = tex;
        return tex;
    }

    private Texture2D VeilTexture(float veil)
    {
        if (_veilTex != null && MathF.Abs(_veilCached - veil) < 0.001f) return _veilTex;
        _veilCached = veil;
        var gradient = new Gradient
        {
            Offsets = new[] { 0f, 1f },
            Colors = new[] { new Color(BgTop, veil), new Color(BgBottom, veil) },
        };
        _veilTex = new GradientTexture2D
        {
            Gradient = gradient, FillFrom = new Vector2(0f, 0f), FillTo = new Vector2(0f, 1f),
            Width = 4, Height = 256,
        };
        return _veilTex;
    }

    private Texture2D DarkLayerTexture()
    {
        if (_darkTex != null) return _darkTex;
        var gradient = new Gradient
        {
            Offsets = new[] { 0f, 0.55f, 1f },
            Colors = new[]
            {
                new Color(5 / 255f, 14 / 255f, 18 / 255f, 0.28f),
                new Color(5 / 255f, 14 / 255f, 18 / 255f, 0.18f),
                new Color(2 / 255f, 8 / 255f, 11 / 255f, 0.40f),
            },
        };
        _darkTex = new GradientTexture2D
        {
            Gradient = gradient, FillFrom = new Vector2(0f, 0f), FillTo = new Vector2(0f, 1f),
            Width = 4, Height = 256,
        };
        return _darkTex;
    }

    private Texture2D HaloTexture()
    {
        if (_haloTex != null) return _haloTex;
        var gradient = new Gradient
        {
            Offsets = new[] { 0f, 0.62f, 1f },
            Colors = new[]
            {
                new Color(83 / 255f, 126 / 255f, 137 / 255f, 0.08f),
                new Color(36 / 255f, 64 / 255f, 74 / 255f, 0.03f),
                new Color(0f, 0f, 0f, 0f),
            },
        };
        _haloTex = new GradientTexture2D
        {
            Gradient = gradient, Fill = GradientTexture2D.FillEnum.Radial,
            FillFrom = new Vector2(0.5f, 0.5f), FillTo = new Vector2(1f, 1f),
            Width = 256, Height = 256,
        };
        return _haloTex;
    }

    private Rect2 HaloRect(Vector2 size)
    {
        // halo 半径 0.72*max(w,h)，中心 (0.5w, 0.46h)：画能容纳该径向的正方形
        var r = MathF.Max(size.X, size.Y) * 0.72f;
        var center = new Vector2(size.X * 0.5f, size.Y * 0.46f);
        return new Rect2(center - new Vector2(r, r), new Vector2(r, r) * 2f);
    }

    private Texture2D VignetteTexture()
    {
        if (_vignetteTex != null) return _vignetteTex;
        var gradient = new Gradient
        {
            Offsets = new[] { 0f, 0.45f, 1f },   // 内半径 0.30*min / 外 0.78*max 的近似比例
            Colors = new[] { new Color(0f, 0f, 0f, 0f), new Color(0f, 0f, 0f, 0f), new Color(0f, 0f, 0f, 0.36f) },
        };
        _vignetteTex = new GradientTexture2D
        {
            Gradient = gradient, Fill = GradientTexture2D.FillEnum.Radial,
            FillFrom = new Vector2(0.5f, 0.5f), FillTo = new Vector2(1f, 1f),
            Width = 256, Height = 256,
        };
        return _vignetteTex;
    }

    private void DrawDashedPolyline(Vector2[] points, float dash, float gap, Color color, float width)
    {
        var inDash = true;
        var remain = dash;
        for (var i = 1; i < points.Length; i++)
        {
            var a = points[i - 1];
            var b = points[i];
            var seg = a.DistanceTo(b);
            if (seg <= 0.001f) continue;
            var t = 0f;
            while (t < seg - 0.001f)
            {
                var step = MathF.Min(remain, seg - t);
                if (inDash && step > 0.001f)
                    DrawLine(a + (b - a) * (t / seg), a + (b - a) * ((t + step) / seg), color, width);
                t += step;
                remain -= step;
                if (remain <= 0.001f)
                {
                    inDash = !inDash;
                    remain = inDash ? dash : gap;
                }
            }
        }
    }

    private void DrawDashedCircle(Vector2 center, float radius, float dash, float gap, Color color, float width, float offset)
    {
        // 圆周点划（offset 像素相位平移 = 法阵旋转，网页 lineDashOffset 同效）
        var circumference = Mathf.Tau * radius;
        var period = dash + gap;
        if (period <= 0f || circumference <= 0f) return;
        var phase = Mathf.PosMod(offset, period);
        var drawn = 0f;
        var guard = 0;
        while (drawn < circumference - 0.001f && guard++ < 1024)
        {
            var pat = Mathf.PosMod(phase + drawn, period);
            if (pat < dash)
            {
                var len = MathF.Min(dash - pat, circumference - drawn);
                DrawArc(center, radius, drawn / radius, (drawn + len) / radius, 8, color, width);
                drawn += len;
            }
            else
            {
                drawn += MathF.Min(period - pat, circumference - drawn);
            }
        }
    }

    private static Vector2[] QuadSamples(Vector2 a, Vector2 mid, Vector2 b, int segments)
    {
        var pts = new Vector2[segments + 1];
        for (var i = 0; i <= segments; i++)
        {
            var t = (float)i / segments;
            var it = 1f - t;
            pts[i] = it * it * a + 2f * it * t * mid + t * t * b;
        }
        return pts;
    }

    /// <summary>renderer.primitives.js hash2（确定性弯曲种子，逐位对齐 JS 的 >>>0 无符号运算）。</summary>
    private static float Hash2(float x, float y)
    {
        uint value = (uint)(x * 374761393f + y * 668265263f);
        value = (value ^ (value >> 13)) * 1274126177u;
        return (value ^ (value >> 16)) / 4294967296f;
    }

    /// <summary>renderer.primitives.js shade(hex, amount)（通道 ±255*amount 钳制；Color 分量 0..1 → amount 缩放 1/255）。</summary>
    private static Color Shade(Color c, float amount)
    {
        var a = amount;   // 网页 amount 作用于 0..255 通道，Color 为 0..1 → 同数值等比
        return new Color(
            Math.Clamp(c.R + a, 0f, 1f),
            Math.Clamp(c.G + a, 0f, 1f),
            Math.Clamp(c.B + a, 0f, 1f), c.A);
    }
}
