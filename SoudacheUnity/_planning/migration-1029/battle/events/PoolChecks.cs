using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;

static class PoolChecks
{
    static int checks;static void Check(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
    static object Field(BattleSession b,string name)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(b);
    static object Call(BattleSession b,string name,params object[] args)=>typeof(BattleSession).GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(b,args);
    static BattleSession Start(params string[] ids)
    {
        var h=new CheckpointHost{Hp=1000,MaxHp=1000,cards=ids.Select((id,i)=>{var card=CardLibrary.FindById(id).Clone();card.runtimeCost=0;return new OwnedCard{uid="owned:"+i,card=card};}).ToList()};
        var b=new BattleSession();b.Start(new BattleStartContext{host=h,rng=new Rng(333),enemies=new[]{new EnemyInput{name="long",hp=1000,atk=1}}});return b;
    }
    public static int Run()
    {
        var packet=JObject.Parse(File.ReadAllText("_planning/migration-1029/battle/current-catalog.json"));
        foreach(var group in ((JObject)packet["config"]).Properties()){
            string name=char.ToUpperInvariant(group.Name[0])+group.Name.Substring(1);var type=typeof(GameRules).GetNestedType(name);
            foreach(var field in ((JObject)group.Value).Properties()){
                string member=char.ToUpperInvariant(field.Name[0])+field.Name.Substring(1);var actual=type.GetField(member).GetRawConstantValue();Check(Convert.ToDouble(actual)==(double)field.Value,"source rule config "+name+"."+member);
            }
        }
        Check(JToken.DeepEquals(SaveJson.Token(CardLibrary.ShopWeights),packet["policies"]["shopWeights"]),"source shop weights 60/28/9/3");
        Check(JToken.DeepEquals(SaveJson.Token(CardLibrary.Price),packet["policies"]["price"]),"source rarity price table");
        foreach(var vector in JArray.Parse(File.ReadAllText("_planning/migration-1029/battle/pool-source-vectors.json"))){
            var pool=SaveJson.Read<RuleValue>(vector["pool"]);var filter=SaveJson.Read<RuleValue>(vector["filter"]);
            var actual=CurrentBattlePools.Resolve(CardLibrary.All(),pool,(string)vector["myClass"],filter,(bool)vector["named"]);
            Check(actual.Select(c=>c.id).SequenceEqual(vector["ids"].Values<string>()),"actual source pool membership "+pool.Text("kind")+"/"+(string)vector["myClass"]+" expected="+string.Join(",",vector["ids"].Values<string>())+" actual="+string.Join(",",actual.Select(c=>c.id)));
        }
        var b=Start("tt3-dig-treasure");var before=b.Snapshot.drawPile.Take(3).ToList();int granted=b.GrantedCards.Count;
        Check(b.PlayCard("owned:0",-1,false).Ok&&b.Snapshot.discovering.options.Count==3,"deck bottom reveals three source cards");
        Check(before.All(uid=>!b.Snapshot.drawPile.Contains(uid)),"deck candidates reserved out of live deck");
        b.PickDiscover(1);Check(b.Snapshot.hand.Contains(before[1])&&b.Snapshot.drawPile.Take(2).SequenceEqual(new[]{before[0],before[2]}),"deck discovery moves original uid and restores others at bottom");
        Check(b.GrantedCards.Count==granted&&b.Snapshot.pdef.Armor==CardLibrary.Price["初始"],"deck discovery does not duplicate and armor counted once");
        b=Start("cmtn1epgt20j");b.PlayCard("owned:0",-1,false);var noInfuseChoice=b.Snapshot.discovering.options.First();b.PickDiscover(0);var gained=b.GrantedCards.Last(c=>c.card.id==noInfuseChoice.id);Check(gained.card.noInfuse&&CardLibrary.FindById(gained.card.id).noInfuse==false,"chosen no-infuse instance retains immutable catalog");
        b=Start("tt7-bladebloom");b.PlayCard("owned:0",-1,false);int options=b.Snapshot.discovering.options.Count;var selected=b.Snapshot.discovering.options[0];b.PickDiscover(0);Check(b.GrantedCards.Count>=GameRules.Battle.NormalStarterDeckSize+options-1,"playKeep preserves unchosen discovery cards");
        b=Start("tt13-flame-staff");b.PlayCard("owned:0",-1,false);Check(b.Snapshot.Equipment.Count==1,"equipment with trigger-only rules still occupies equipment slot");int hp=b.Snapshot.foes[0].hp;b.EndTurn();Check(b.Snapshot.foes[0].hp<hp,"flame staff turn start registered");
        b=Start("tt7-arcanescroll","tt3-fireball","starter-attack");b.PlayCard("owned:0",-1,false);int deck=b.Snapshot.drawPile.Count;b.PlayCard("owned:1",0,true);Check(b.Snapshot.drawPile.Count==deck,"equipped card onConsume does not respond to other card consumption");
        Console.WriteLine("PASS "+checks+" pool/acquisition assertions with 52 actual source candidate lists");return checks;
    }
}
