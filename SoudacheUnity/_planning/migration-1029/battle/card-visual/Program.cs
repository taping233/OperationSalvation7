using System;
using System.IO;
using System.Text.Json;
using Sdt.Core;
using Sdt.UI.Screens.Run;

static class Program
{
    static int checks;
    static void Check(bool ok,string why){checks++;if(!ok)throw new Exception(why);}
    static void Main()
    {
        CardLibrary.Init(()=>CardDatabase.All);using var doc=JsonDocument.Parse(File.ReadAllText("_planning/migration-1029/battle/card-visual/source-vectors.json"));
        foreach(var vector in doc.RootElement.GetProperty("vectors").EnumerateArray()){
            var card=CardLibrary.FindById(vector.GetProperty("id").GetString());var options=new CardFaceOptions{HideCost=vector.GetProperty("hideCost").GetBoolean(),CostOverride=vector.GetProperty("override").ValueKind==JsonValueKind.Null?(int?)null:vector.GetProperty("override").GetInt32()};
            Check(CardVisual.FrameKey(card)==vector.GetProperty("frame").GetString(),"source effective frame "+card.id);
            Check(CardVisual.ShowCost(card,options.HideCost)==vector.GetProperty("hasCost").GetBoolean(),"source cost visibility "+card.id);
            if(vector.GetProperty("hasCost").GetBoolean()){Check(CardVisual.Cost(card,options)==vector.GetProperty("cost").GetInt32(),"source actual cost "+card.id);Check(CardVisual.CostTone(card,options)==vector.GetProperty("tone").GetString(),"source cost color "+card.id);}
            Check(CardVisual.ShowDamage(card)==vector.GetProperty("hasDamage").GetBoolean(),"source damage semantic marker "+card.id);
            Check(CardVisual.DamageText(card)==vector.GetProperty("damageText").GetString(),"source damage type notation "+card.id);
            Check(CardVisual.DamageIcon(card)==vector.GetProperty("damageIcon").GetString(),"source damage semantic icon "+card.id);
            Check(CardLibrary.SellPrice(card)==vector.GetProperty("value").GetInt32(),"source coin badge "+card.id);
        }
        foreach(var f in doc.RootElement.GetProperty("frames").EnumerateObject()){
            var actual=CardVisual.Frames[f.Name];var expected=f.Value.GetProperty("opening");
            Check(actual.Left==expected[0].GetSingle()&&actual.Top==expected[1].GetSingle()&&actual.Width==expected[2].GetSingle()&&actual.Height==expected[3].GetSingle(),"source opening rectangle "+f.Name);
            Check(actual.CanvasWidth==f.Value.GetProperty("width").GetSingle()&&actual.CanvasHeight==f.Value.GetProperty("height").GetSingle(),"source natural frame ratio "+f.Name);
        }
        foreach(string kind in new[]{"attack","spell","fixed","true"}){
            var c=new CardDef{type="武术",dmgType=kind,dmg=kind=="attack"?-2:4};string text=CardVisual.DamageText(c);
            Check(text==(kind=="attack"?"-2":kind=="spell"?"4'":kind=="true"?"4''":"4"),"four damage formats "+kind);
        }
        var changed=new CardDef{type="法术",cost=5,runtimeCost=0};Check(CardVisual.Cost(changed,null)==0&&CardVisual.CostTone(changed,null)=="down","runtime zero cost retains base and green state");
        var result=new{passed=true,checks,presentationVectors=doc.RootElement.GetProperty("vectors").GetArrayLength(),frames=CardVisual.Frames.Count,source="actual source HTML and frame JSON",boundary="pure presentation semantics; native render is independently checked by parent"};
        string json=JsonSerializer.Serialize(result,new JsonSerializerOptions{WriteIndented=true});File.WriteAllText("_planning/migration-1029/battle/card-visual/result.json",json);Console.WriteLine(json);
    }
}
