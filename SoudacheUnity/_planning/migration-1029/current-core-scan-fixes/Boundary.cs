using System;using System.IO;using System.Linq;using System.Text.Json;using System.Text.Json.Nodes;using System.Collections.Generic;using System.Reflection;using Sdt.Core;using Sdt.Core.Battle;
class Boundary {
 sealed class Host:BattleHost {public int Hp{get;set;}=30;public int MaxHp{get;set;}=60;public int Atk=>4;public int SpellPower=>2;public string MyClass=>null;public string CharacterId=>"wu";public IReadOnlyList<OwnedCard> OwnedCards{get;set;}=Array.Empty<OwnedCard>();public void Log(string s,string k=null){}public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);}public void OnBattleEnd(BattleResult r){} }
 static RuleValue Rule(JsonObject data){var r=new RuleValue();foreach(var p in data)r.Values[p.Key]=Value(p.Value);return r;}
 static object Value(JsonNode v){if(v==null)return null;if(v is JsonObject o)return Rule(o);if(v is JsonArray a)return a.Select(Value).ToArray();var r=(JsonValue)v;if(r.TryGetValue<int>(out var n))return n;if(r.TryGetValue<bool>(out var b))return b;if(r.TryGetValue<string>(out var s))return s;return r.GetValue<double>();}
 static object F(BattleSession b,string n)=>typeof(BattleSession).GetField(n,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(b);static void Set(BattleSession b,string n,object v)=>typeof(BattleSession).GetField(n,BindingFlags.NonPublic|BindingFlags.Instance).SetValue(b,v);
 static void Main(){CardLibrary.Init(()=>CardDatabase.All);var output=new List<object>();int failed=0;foreach(var row in JsonNode.Parse(File.ReadAllText("boundary-source.json")).AsArray()){
 var q=row["q"];int N(string k,int d)=>q[k]?.GetValue<int>()??d;
 var owned=row["input"].AsArray().Select(n=>{var c=n["card"].Deserialize<CardDef>(new JsonSerializerOptions{IncludeFields=true});c.rules=Rule(n["card"]["rules"].AsObject());return new OwnedCard{uid=(string)n["uid"],card=c};}).ToArray();
 var h=new Host{OwnedCards=owned,Hp=N("hp",30),MaxHp=N("maxHp",60)};var rng=new Rng(N("seed",123));var b=new BattleSession();b.Start(new BattleStartContext{host=h,rng=rng,enemies=new[]{new EnemyInput{id="foe",name="目标",hp=1000,atk=2}}});
 Set(b,"hand",new List<string>{"o0"});if(q["other"]!=null)((List<string>)F(b,"hand")).Add("o1");Set(b,"drawPile",Enumerable.Range(q["other"]!=null?2:1,N("draw",0)).Select(i=>"o"+i).ToList());((List<string>)F(b,"discard")).Clear();Set(b,"energy",N("energy",10));Set(b,"maxEnergy",10);((List<BattleFoe>)F(b,"foes"))[0].status.freeze=N("freeze",0);((Combatant)F(b,"pstat")).status.healban=N("healban",0);
 var cmd=b.PlayCard("o0",BattleRules.TargetSideFor(owned[0].card)=="self"?-1:0,false);if(!cmd.Ok)throw new Exception(cmd.Reason);
 if(q["asyncChoice"]?.GetValue<bool>()==true){int guard=0;while(b.RuleInputPending&&guard++<5)b.SelectRuleHand("o1");}
 var s=b.Snapshot;var after=new{hp=h.Hp,energy=s.Energy,maxEnergy=(int)F(b,"maxEnergy"),armor=s.Pdef.Armor,hand=s.Hand.Count,draw=s.DrawPile.Count,status=s.Foes[0].status.Where(p=>p.Value!=0).OrderBy(p=>p.Key).ToDictionary(p=>p.Key,p=>p.Value)};
 var actual=JsonSerializer.SerializeToNode(after);bool equal=JsonNode.DeepEquals(actual,row["after"]);if(!equal){failed++;Console.WriteLine(q["name"]+" source="+row["after"].ToJsonString()+" core="+actual.ToJsonString());}
 output.Add(new{name=(string)q["name"],equal,after,rng=rng.SaveState()});b.Retract();}
 File.WriteAllText("boundary-core.json",JsonSerializer.Serialize(output,new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine($"{output.Count-failed}/{output.Count}");Environment.ExitCode=failed==0?0:1;
 }
}

