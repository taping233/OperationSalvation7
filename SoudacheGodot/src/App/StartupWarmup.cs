using Godot;
using System;
using System.Collections.Generic;

namespace SoudacheGodot.App;

/// <summary>
/// 批次 7b 性能铁律③：启动后 idle 分帧预热高频资产。
/// 对照网页 game.boot.js:519-551 预热清单（卡面/敌人立绘/职业立绘 + 图标 + 场景大图 +
/// hub 壁纸；网页用 requestIdleCallback + warmBatched 分批让出主线程）：
/// - 卡面立绘   assets/cards + assets/portraits（= SDT.Art.collectCardAssets）
/// - 场景大图   assets/scenes + assets/backgrounds（= PRELOAD_SCENES）
/// - 图标       assets/icons（= SDT.Icons.urls）
/// - 地图贴图   assets/map（6c-map 位图图标/层底图）
/// - hub 壁纸   assets/images（= warmHubWallpaper，含 slots/svg）
/// - 字体       assets/fonts（Godot 特有：主题 FontFile/FontVariation 首次整形预热）
/// 音频不在本清单（GameAudio 池加载自理，sdt 音频归 C 线）。
/// 每帧 WarmStep 只加载一小批，完成/失败计数打 WARMUP 日志（--perf-smoke 计时不受失焦影响的
/// 平移逻辑在 AppMain，本类不感知）。加载结果持强引用，防止弱缓存释放后二次解码。
/// </summary>
public sealed class StartupWarmup
{
    private static readonly string[] WarmDirs =
    {
        "res://assets/cards",
        "res://assets/portraits",
        "res://assets/scenes",
        "res://assets/backgrounds",
        "res://assets/icons",
        "res://assets/map",
        "res://assets/images",
        "res://assets/fonts",
    };

    private const int BatchPerFrame = 4;

    private readonly List<string> _paths = new();
    private readonly List<string> _rawImages = new();
    private readonly List<Resource> _keepAlive = new();
    private int _cursor;
    private int _failed;
    private ulong _startMs;
    private bool _started;

    public int Total => _paths.Count;
    public int RawImages => _rawImages.Count;
    public int Loaded => _cursor - _failed;
    public bool Done { get; private set; }

    /// <summary>遍历 res:// 资产目录收集待预热清单（嵌入 pck 支持列目录；缺目录静默跳过）。</summary>
    public void Collect()
    {
        _startMs = Time.GetTicksMsec();
        foreach (var dir in WarmDirs) CollectDir(dir);
        _started = true;
        GD.Print($"WARMUP_START assets={_paths.Count} raw_images={_rawImages.Count} dirs={WarmDirs.Length}");
    }

    private void CollectDir(string dirPath)
    {
        using var dir = DirAccess.Open(dirPath);
        if (dir == null) return;
        dir.ListDirBegin();
        var name = dir.GetNext();
        while (!string.IsNullOrEmpty(name))
        {
            if (name[0] != '.' && !name.EndsWith(".import") && !name.EndsWith(".uid"))
            {
                var full = dirPath + "/" + name;
                if (dir.CurrentIsDir()) CollectDir(full);
                else if (IsWarmable(full))
                {
                    // 导出模板的 ResourceLoader 只认 .import remap 的导入产物；无 .import 的
                    // raw 位图（6c-map 自搜打撤复制的 png/jpg/webp）走 Image 解码分支预热，
                    // 无导入途径的 svg 只能跳过（Godot svg 加载同样依赖编辑器导入）。
                    if (FileAccess.FileExists(full + ".import")) _paths.Add(full);
                    else if (IsRawBitmap(full)) _rawImages.Add(full);
                }
            }
            name = dir.GetNext();
        }
        dir.ListDirEnd();
    }

    private static bool IsWarmable(string path)
    {
        foreach (var ext in new[] { ".png", ".webp", ".jpg", ".svg", ".ttf", ".otf" })
            if (path.EndsWith(ext, StringComparison.Ordinal)) return true;
        return false;
    }

    private static bool IsRawBitmap(string path)
    {
        foreach (var ext in new[] { ".png", ".webp", ".jpg" })
            if (path.EndsWith(ext, StringComparison.Ordinal)) return true;
        return false;
    }

    private static Resource? LoadRawBitmap(string path)
    {
        // 与 B 线 AssetLibrary 的位图加载同路径：Image 解码 + 建纹理，预热解码与 GPU 上传
        var image = Image.LoadFromFile(ProjectSettings.GlobalizePath(path));
        return image == null ? null : ImageTexture.CreateFromImage(image);
    }

    /// <summary>每帧驱动一次：加载 BatchPerFrame 个资源；全部完成后打 WARMUP_OK（幂等，Done 后即返回）。</summary>
    public void WarmStep()
    {
        if (!_started || Done) return;
        var end = Math.Min(_paths.Count, _cursor + BatchPerFrame);
        while (_cursor < end)
        {
            var path = _paths[_cursor++];
            // CacheMode.Reuse：进资源缓存；再持强引用避免缓存释放后重付解码
            var res = ResourceLoader.Load<Resource>(path, cacheMode: ResourceLoader.CacheMode.Reuse);
            if (res != null) _keepAlive.Add(res);
            else { _failed++; GD.PushWarning($"WARMUP failed: {path}"); }
        }
        if (_cursor >= _paths.Count)
        {
            foreach (var raw in _rawImages)
            {
                var res = LoadRawBitmap(raw);
                if (res != null) _keepAlive.Add(res);
                else { _failed++; GD.PushWarning($"WARMUP failed(raw): {raw}"); }
            }
            Done = true;
            GD.Print($"WARMUP_OK imported={_paths.Count} raw={_rawImages.Count} failed={_failed} " +
                     $"keep_alive={_keepAlive.Count} ms={Time.GetTicksMsec() - _startMs}");
        }
    }
}
