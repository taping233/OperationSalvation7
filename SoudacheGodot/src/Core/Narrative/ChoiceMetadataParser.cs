namespace Soudache;

// ported from 搜打撤/game/src/narrative.js parseChoice（Godot 批次 4a）。
// 选项文本形如「收下 3 币@@effect=goldmine_safe@@detail=稳定收益@@tone=ok」，
// @@ 后每段是 key=value 元数据（无 '=' 的段为空值键，重复键后者覆盖——与 JS
// Object.fromEntries 语义一致），解析后不得泄漏进 label。
public static class ChoiceMetadataParser
{
    public static NarrativeChoice Parse(string? text)
    {
        // JS: String(text || '').split('@@') —— 普通子串切分，与 C# Split(string) 同语义。
        var segments = (text ?? string.Empty).Split("@@");
        var effect = string.Empty;
        var detail = string.Empty;
        var tone = string.Empty;
        for (var i = 1; i < segments.Length; i++)
        {
            var part = segments[i];
            var at = part.IndexOf('=');
            var key = at < 0 ? part.Trim() : part[..at].Trim();
            var value = at < 0 ? string.Empty : part[(at + 1)..].Trim();
            if (key == "effect") effect = value;
            else if (key == "detail") detail = value;
            else if (key == "tone") tone = value;
        }
        return new NarrativeChoice(segments[0].Trim(), effect, detail, tone);
    }
}
