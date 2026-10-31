using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.UI.Screens.Battle;
using Pile = Sdt.UI.Screens.Battle.CurrentBattlePileData;

static class Program
{
    static readonly List<string> Checks=new List<string>();
    static void Check(bool value,string label){if(!value)throw new Exception(label);Checks.Add(label);}
    static Pile.Entry Entry(string uid,CardDef card,string projection=null,int? cost=null)=>new Pile.Entry{Uid=uid,Card=card,EffectiveCost=cost??card?.cost??0,PresentationKey=projection};
    public static void Main()
    {
        var a=new CardDef{id="same",name="法术",type="法术",cost=1,dmg=2,rules=RuleValue.Obj("z",1,"a",RuleValue.Obj("m",3,"b",2))};
        var b=a.Clone();b.rules=RuleValue.Obj("a",RuleValue.Obj("b",2,"m",3),"z",1);
        var source=new[]{Entry("u2",a),Entry("u1",b)};
        var before=JsonConvert.SerializeObject(source);
        var grouped=Pile.Build(source);
        Check(grouped.Count==1&&grouped[0].Count==2,"same effective card ignores ownership UID and rule property insertion order");
        var deck=Pile.Build(source,false);
        Check(deck.Count==2&&deck.All(stack=>stack.Count==1),"deck keeps separate instances");
        Check(deck.Select(stack=>stack.Uids[0]).SequenceEqual(new[]{"u1","u2"}),"deck display tie-break is independent of draw order");
        Check(JsonConvert.SerializeObject(source)==before&&source.Select(entry=>entry.Uid).SequenceEqual(new[]{"u2","u1"}),"display sorting and grouping never mutate source card data or UID order");
        var cost=a.Clone();cost.runtimeCost=0;
        var rule=a.Clone();rule.rules=RuleValue.Obj("z",2,"a",RuleValue.Obj("m",3,"b",2));
        var upgrade=a.Clone();upgrade.dmg=3;
        var variant=a.Clone();variant.variantKey="upgraded";
        Check(Pile.Build(new[]{Entry("u0",a),Entry("u1",cost),Entry("u2",rule),Entry("u3",upgrade),Entry("u4",variant)}).Count==5,"different runtime cost, rules, upgrade or variant stays separate");
        Check(Pile.Build(new[]{Entry("u0",a,cost:0),Entry("u1",b,cost:1)}).Count==2,"different live effective cost stays separate");
        Check(Pile.Build(new[]{Entry("u0",a,"{\"AstrolabePhase\":0}"),Entry("u1",b,"{\"AstrolabePhase\":1}")}).Count==2,"different per-instance presentation stays separate");
        Check(Pile.Build(new[]{Entry("u0",a,"{\"_presentation\":{\"uid\":\"u0\",\"phase\":0}}"),Entry("u1",b,"{\"_presentation\":{\"phase\":0,\"uid\":\"u1\"}}")}).Count==1,"presentation UID is excluded while effective presentation fields remain");
        var names=new[]{"中","阿","波"}.Select((name,index)=>Entry("n"+index,new CardDef{id=name,name=name,type="法术",cost=1})).ToArray();
        Check(Pile.Build(names).Select(stack=>stack.Card.name).SequenceEqual(new[]{"阿","波","中"}),"display uses Chinese name ordering");
        Check(Pile.Build(new Pile.Entry[]{null,Entry("missing",null)}).Count==0,"missing entries do not fabricate cards");
        Console.WriteLine(JsonConvert.SerializeObject(new{passed=true,checks=Checks},Formatting.Indented));
    }
}
