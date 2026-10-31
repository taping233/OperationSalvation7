using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Collections.Generic;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;
class Tests
{
    sealed class Host:BattleHost
    {
        public int Hp{get;set;}=30; public int MaxHp=>60; public int Atk=>4; public int SpellPower=>2;
        public string MyClass=>null; public string CharacterId=>"wu";
        public IReadOnlyList<OwnedCard> OwnedCards{get;set;}
        public void Log(string text,string kind=null){} public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);} public void OnBattleEnd(BattleResult r){}
    }
    static RuleValue Rule(JsonObject d){var r=new RuleValue();foreach(var p in d)r.Values[p.Key]=Value(p.Value);return r;}
    static object Value(JsonNode v){if(v==null)return null;if(v is JsonObject o)return Rule(o);if(v is JsonArray a)return a.Select(Value).ToArray();var j=(JsonValue)v;if(j.TryGetValue<int>(out var n))return n;if(j.TryGetValue<bool>(out var b))return b;if(j.TryGetValue<string>(out var s))return s;return j.GetValue<double>();}
    static object Field(BattleSession b,string n)=>typeof(BattleSession).GetField(n,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(b);
    static void Set(BattleSession b,string n,object v)=>typeof(BattleSession).GetField(n,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(b,v);
    static object Status(IReadOnlyDictionary<string,int> d)=>d.Where(p=>p.Value!=0).OrderBy(p=>p.Key,StringComparer.Ordinal).ToDictionary(p=>p.Key,p=>p.Value);
    static object Unit(Combatant u)=>new{hp=u.hp,atk=u.atk,dead=u.dead,status=Status(u.status.Export()),armor=u.defense.Armor,shield=u.defense.Shield,guard=u.defense.Guard};
    static object Unit(FoeSnapshot u)=>new{hp=u.hp,atk=u.atk,dead=u.dead,status=Status(u.status),armor=u.defense.Armor,shield=u.defense.Shield,guard=u.defense.Guard};
    static object Snap(BattleSession b,Host h)
    {
        var p=(Combatant)Field(b,"pstat"); var d=(DefenseState)Field(b,"pdef");var s=b.Snapshot;
        return new{player=new{hp=h.Hp,atk=p.atk,dead=p.dead,status=Status(p.status.Export()),armor=d.Armor,shield=d.Shield,guard=d.Guard},allies=s.Allies.Select(Unit).ToArray(),foes=s.Foes.Select(Unit).ToArray(),energy=s.Energy,turn=s.Turn};
    }
    static void Check(CommandResult r){if(!r.Ok)throw new Exception(r.Reason);}
    static void Main()
    {
        CardLibrary.Init(()=>CardDatabase.All);var rows=JsonNode.Parse(File.ReadAllText("source-complex.json")).AsArray();var output=new List<object>();
        foreach(var row in rows)
        {
            var name=(string)row["name"];var seed=(int)row["seed"];
            var owned=row["input"].AsArray().Select(n=>{var c=n["card"].Deserialize<CardDef>(new JsonSerializerOptions{IncludeFields=true});c.rules=n["card"]["rules"] is JsonObject r?Rule(r):null;return new OwnedCard{uid=(string)n["uid"],card=c};}).ToArray();
            var h=new Host{OwnedCards=owned};var b=new BattleSession();var rng=new Rng(seed);
            b.Start(new BattleStartContext{host=h,rng=rng,enemies=name.StartsWith("recruit-")?new[]{new EnemyInput{id="foe",name="target",hp=1000,atk=2},new EnemyInput{id="other",name="other",hp=1000,atk=2}}:new[]{new EnemyInput{id="foe",name="target",hp=1000,atk=2}}});
            Set(b,"maxEnergy",10);Set(b,"energy",10);var foes=(List<BattleFoe>)Field(b,"foes");
            if(name.StartsWith("gate-"))
            {
                foes[0].atk=0;Check(b.PlayCard("o0",-1,false));
                if(name=="gate-prefer"||name=="gate-purify")
                {
                    var targets=new List<Combatant>{(Combatant)Field(b,"pstat")};targets.AddRange(((System.Collections.IEnumerable)Field(b,"ruleAllies")).Cast<Combatant>());
                    foreach(var u in targets){u.status.stealth=2;u.status.atkUp=1;u.status.spellUp=1;u.status.reduce=1;if(name=="gate-purify"){u.defense.Armor=3;u.status.poison=1;}}
                    var p=(Combatant)Field(b,"pstat");var d=(DefenseState)Field(b,"pdef");d.Armor=p.defense.Armor;d.Shield=p.defense.Shield;d.Guard=p.defense.Guard;
                }
                Check(b.PlayCard("o1",-1,false));Check(b.ChooseRuleOption(1));Check(b.EndTurn());var after=Snap(b,h);object second=null,third=null;if(name=="gate-other-door"){Check(b.EndTurn());second=Snap(b,h);Check(b.EndTurn());third=Snap(b,h);}output.Add(new{name,seed,after,second,third,rng=rng.SaveState()});
            }
            else if(name.StartsWith("recruit-"))
            {
                var f=foes[0];f.hp=name=="recruit-poison-death"?3:40;f.maxHp=100;f.atk=4;f.defense=new DefenseState{Armor=5,Shield=2};f.status.poison=2;f.status.reduce=1;f.status.spellUp=3;f.status.freeze=name=="recruit-stealth-expiry"?0:1;foes[1].atk=3;
                Check(b.PlayCard("o0",0,false));if(name=="recruit-stealth-expiry")((System.Collections.IEnumerable)Field(b,"ruleAllies")).Cast<Combatant>().First().status.stealth=1;
                var immediate=Snap(b,h);Check(b.EndTurn());var after=Snap(b,h);Check(b.EndTurn());output.Add(new{name,seed,immediate,after,second=Snap(b,h)});
            }
            else
            {
                Check(b.PlayCard("o0",-1,false));int index=(int)row["index"];var candidates=b.Snapshot.Discovering.options.Select(c=>c.id).ToArray();var chosen=b.Snapshot.Discovering.options[index];
                if(chosen.id!=(string)row["chosen"])throw new Exception("different discover pool: "+chosen.id);Check(b.PickDiscover(index));
                var uid=b.Snapshot.Hand.First(u=>b.FindCard(u).card.id==chosen.id);var c=b.FindCard(uid).card;int before=foes[0].hp;Set(b,"energy",10);Check(b.PlayCard(uid,0,false));
                output.Add(new{name,seed,index,candidates,rng=rng.SaveState(),chosen=chosen.id,waiver=c.noInfuse,damage=before-foes[0].hp,infusing=b.Snapshot.Infusing!=null,after=Snap(b,h)});
            }
            b.Retract();
        }
        File.WriteAllText("core-complex.json",JsonSerializer.Serialize(output,new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine("Core vectors "+output.Count);
    }
}


