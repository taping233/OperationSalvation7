using Godot;
using SoudacheGodot.App;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// 底栏迷你地图（批次 6c-map）：网页版 game.session.js renderMiniMap 的 1:1 移植。
/// #miniMap（sidebar statsPanel 内 76px 高、max-width 560px）：本层包围盒留边适配（pad=短边 16%），
/// 连线（两端可见）→ 当前节点可走亮边（2.65px/nodeR）→ 类型色圆点（当前金圈/可走亮环/其余半透明）。
/// 事件驱动重绘（仅在快照变化时 QueueRedraw，不逐帧——网页 2026-09-09 定向同口径）。
/// 战争迷雾 seen 集快照未携带（已登记 [6c-map→A]），网页 seen 为空时简图本就全显，行为一致。
/// </summary>
public partial class MiniMapCanvas : Control
{
    // game.session.js MINI_TYPE_COLOR
    private static readonly Dictionary<string, Color> TypeColor = new()
    {
        ["battle"] = new("ff6b5e"), ["fire"] = new("f2854a"), ["chest"] = new("f5c542"),
        ["event"] = new("41d0a8"), ["shop"] = new("52d273"), ["key"] = new("f5c542"),
        ["coin"] = new("f5c542"), ["wood"] = new("c8956a"), ["rations"] = new("7fdd9c"),
        ["door"] = new("c9b28a"), ["entrance"] = new("52d273"),
        ["extraction"] = new("52d273"), ["emergencyExit"] = new("52d273"),
        ["altar"] = new("b77ad8"), ["boss"] = new("ff5a50"),
    };

    private RunUiSnapshot? _snapshot;
    private readonly Dictionary<int, Vector2> _pt = new();

    public override void _Ready()
    {
        MouseFilter = Control.MouseFilterEnum.Ignore;
    }

    public void SetData(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        _pt.Clear();
        if (snapshot.Nodes.Length == 0)
        {
            QueueRedraw();
            return;
        }
        int minX = int.MaxValue, minRow = int.MaxValue;
        foreach (var n in snapshot.Nodes)
        {
            minX = Math.Min(minX, n.X);
            minRow = Math.Min(minRow, n.Row);
        }
        foreach (var n in snapshot.Nodes)
            _pt[n.Index] = new Vector2(
                180f + (n.X - minX) * 120f,   // game.session.js MAP_NODE_PADDING/SPACING（世界坐标等比）
                180f + (n.Row - minRow) * 120f);
        QueueRedraw();
    }

    public override void _Draw()
    {
        var snap = _snapshot;
        if (snap == null || _pt.Count == 0) return;
        var w = Size.X;
        var h = Size.Y;
        // 本层包围盒 → 画布内留边适配（保持纵横比）；pad 按短边比例留白
        var minX = _pt.Values.Min(p => p.X);
        var maxX = _pt.Values.Max(p => p.X);
        var minY = _pt.Values.Min(p => p.Y);
        var maxY = _pt.Values.Max(p => p.Y);
        var spanX = MathF.Max(1f, maxX - minX);
        var spanY = MathF.Max(1f, maxY - minY);
        var pad = MathF.Min(w, h) * 0.16f;
        var s = MathF.Min((w - pad * 2f) / spanX, (h - pad * 2f) / spanY);
        var ox = (w - spanX * s) / 2f;
        var oy = (h - spanY * s) / 2f;
        Vector2 Px(int idx) => new(ox + (_pt[idx].X - minX) * s, oy + (_pt[idx].Y - minY) * s);
        var nodeR = MathF.Max(5f, MathF.Min(w, h) * 0.055f);   // 圆点尺寸随画布自适应

        // 当前节点的相邻（可走）集合
        var current = snap.Nodes.FirstOrDefault(n => n.IsCurrent);
        var legal = new HashSet<int>(current?.Neighbors ?? Array.Empty<int>());

        // 连线（网页 fog 双端可见过滤；seen 为空时全显）
        foreach (var n in snap.Nodes)
        {
            foreach (var to in n.Neighbors)
            {
                if (to <= n.Index || !_pt.ContainsKey(to)) continue;   // 网页 ni <= i 去重
                DrawLine(Px(n.Index), Px(to), new Color(214 / 255f, 181 / 255f, 110 / 255f, 0.4f), 2f);
            }
        }
        // 当前节点 → 可走相邻的亮边
        if (current != null && _pt.ContainsKey(current.Index))
            foreach (var ni in legal)
            {
                if (!_pt.ContainsKey(ni)) continue;
                DrawLine(Px(current.Index), Px(ni), new Color(1f, 202 / 255f, 91 / 255f, 0.95f), nodeR * 0.42f);
            }
        // 节点圆点：当前金圈最大、可走次之（亮环）、走过的半透明
        foreach (var n in snap.Nodes)
        {
            if (!_pt.ContainsKey(n.Index)) continue;
            var p = Px(n.Index);
            var isCur = current != null && n.Index == current.Index;
            var isLegal = legal.Contains(n.Index);
            var col = TypeColor.TryGetValue(n.Type, out var c) ? c : new Color("d8b46a");
            DrawCircle(p, isCur ? nodeR : nodeR * 0.72f, new Color(col, isCur || isLegal ? 1f : 0.62f));
            if (isLegal && !isCur)
                DrawArc(p, nodeR * 0.72f, 0f, Mathf.Tau, 32, new Color(1f, 214 / 255f, 110 / 255f, 0.95f), nodeR * 0.3f);
            if (isCur)
                DrawArc(p, nodeR, 0f, Mathf.Tau, 32, new Color("ffd166"), nodeR * 0.36f);
        }
    }
}
