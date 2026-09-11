using System;
using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace SoudacheGodot.UI;

/// <summary>
/// 留言（写给 Friday 的建议）存取。语义对齐网页版 saveSuggestion/loadSuggestions 的
/// localStorage 落点（sdt-suggestions-v1）：Godot 侧存 user://suggestions.json。
/// 条目字段与网页版一致：ts / page / target / at / text / done。
/// </summary>
public static class SuggestionStore
{
    public sealed record Entry(string Ts, string? Page, string? Target, string? At, string Text, bool Done);

    private const string StorePath = "user://suggestions.json";

    public static List<Entry> Load()
    {
        var file = FileAccess.Open(StorePath, FileAccess.ModeFlags.Read);
        if (file == null) return new List<Entry>();
        var text = file.GetAsText();
        file.Close();
        try
        {
            var list = JsonSerializer.Deserialize<List<Entry>>(text);
            return list ?? new List<Entry>();
        }
        catch (Exception)
        {
            return new List<Entry>();
        }
    }

    public static bool Append(Entry entry)
    {
        try
        {
            var list = Load();
            list.Add(entry);
            var options = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
            var file = FileAccess.Open(StorePath, FileAccess.ModeFlags.Write);
            if (file == null) return false;
            file.StoreString(JsonSerializer.Serialize(list, options));
            file.Close();
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public static bool Remove(string ts)
    {
        try
        {
            var list = Load();
            var kept = list.FindAll(e => e.Ts != ts);
            if (kept.Count == list.Count) return false;
            var options = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
            var file = FileAccess.Open(StorePath, FileAccess.ModeFlags.Write);
            if (file == null) return false;
            file.StoreString(JsonSerializer.Serialize(kept, options));
            file.Close();
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>网页版 fmtSugTime：MM-DD HH:MM（本地时）。</summary>
    public static string FormatTime(string iso)
    {
        if (!DateTime.TryParse(iso, out var moment)) return "";
        return $"{moment.Month:00}-{moment.Day:00} {moment.Hour:00}:{moment.Minute:00}";
    }

    public static string NowIso() => DateTime.UtcNow.ToString("o");
}
