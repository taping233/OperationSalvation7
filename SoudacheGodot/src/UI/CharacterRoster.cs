using System;
using System.Collections.Generic;
using Godot;

namespace SoudacheGodot.UI;

/// <summary>
/// 角色花名册：直接读 data/characters.json（只读，接口需求 [1→B] 的过渡口径）。
/// 数据字段与网页版 characters.json 相同：id / name / rulesetId / role / color。
/// </summary>
public static class CharacterRoster
{
    public sealed record Entry(string Id, string Name, string RulesetId, string Role, string Color);

    private static List<Entry>? _cache;

    public static IReadOnlyList<Entry> Entries => _cache ??= Load();

    public static string DisplayName(string id)
    {
        foreach (var entry in Entries)
            if (entry.Id == id)
                return entry.Name;
        return "未选择角色";
    }

    private static List<Entry> Load()
    {
        var result = new List<Entry>();
        var file = FileAccess.Open("res://data/characters.json", FileAccess.ModeFlags.Read);
        if (file == null)
        {
            GD.PushWarning("CharacterRoster: data/characters.json 不可读");
            return result;
        }
        var json = file.GetAsText();
        file.Close();
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(json);
            foreach (var node in document.RootElement.GetProperty("characters").EnumerateArray())
            {
                var id = node.TryGetProperty("id", out var idNode) ? idNode.GetString() ?? "" : "";
                if (id.Length == 0) continue;
                result.Add(new Entry(
                    id,
                    node.TryGetProperty("name", out var nameNode) ? nameNode.GetString() ?? id : id,
                    node.TryGetProperty("rulesetId", out var rulesetNode) ? rulesetNode.GetString() ?? "" : "",
                    node.TryGetProperty("role", out var roleNode) ? roleNode.GetString() ?? "" : "",
                    node.TryGetProperty("color", out var colorNode) ? colorNode.GetString() ?? "#e8eeea" : "#e8eeea"));
            }
        }
        catch (Exception error)
        {
            GD.PushWarning($"CharacterRoster: 解析失败 {error.Message}");
        }
        return result;
    }
}
