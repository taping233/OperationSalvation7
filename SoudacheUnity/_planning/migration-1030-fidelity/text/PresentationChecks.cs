using System;
using System.IO;
using System.Text.Json;
using System.Linq;
using Sdt.Core;
using Sdt.Res;
class CheckCopy
{
    static JsonSerializerOptions Options = new JsonSerializerOptions { IncludeFields = true };
    static object Tree(JsonElement e)
    {
        switch(e.ValueKind) {
        case JsonValueKind.Object: var result = new RuleValue();foreach(var p in e.EnumerateObject())result.Values[p.Name]=Tree(p.Value);return result;
        case JsonValueKind.Array:return e.EnumerateArray().Select(Tree).ToArray();
        case JsonValueKind.Number:return e.TryGetInt32(out var n)?(object)n:e.GetDouble();
        case JsonValueKind.True:return true;case JsonValueKind.False:return false;case JsonValueKind.String:return e.GetString();default:return null;
        }
    }
    static int Main(string[] args)
    {
        var data=JsonSerializer.Deserialize<CurrentCardPresentation.Data>(File.ReadAllText(args[0]),Options);CurrentCardPresentation.Configure(data);
        var json=JsonDocument.Parse(File.ReadAllText(args[1]));int n=0,failed=0;
        foreach(var c in json.RootElement.GetProperty("cases").EnumerateArray()) {
            var item=c.GetProperty("card");var card=JsonSerializer.Deserialize<CardDef>(item.GetRawText(),Options);
            if(item.TryGetProperty("rules",out var rules))card.rules=Tree(rules)as RuleValue;
            CurrentCardPresentation.Context context=null;if(c.GetProperty("context").ValueKind!=JsonValueKind.Null)context=JsonSerializer.Deserialize<CurrentCardPresentation.Context>(c.GetProperty("context").GetRawText(),Options);
            var actual=CurrentCardPresentation.Description(card,context);var expected=c.GetProperty("expected").GetString();n++;
            if(actual!=expected){failed++;Console.WriteLine(card.id+" expected="+expected+" actual="+actual);}
        }
        Console.WriteLine("presentation cases="+n+" failed="+failed);return failed==0?0:1;
    }
}
