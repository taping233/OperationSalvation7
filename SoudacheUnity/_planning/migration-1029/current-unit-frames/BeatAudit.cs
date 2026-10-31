using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Core.Battle;

static class BeatAudit
{
    sealed class Host:BattleHost
    {
        public int Hp{get;set;}=30;public int MaxHp=>60;public int Atk=>4;public int SpellPower=>2;
        public string MyClass=>null;public string CharacterId=>"wu";
        public IReadOnlyList<OwnedCard> OwnedCards=>Array.Empty<OwnedCard>();
        public void Log(string value,string kind=null){} public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);}public void OnBattleEnd(BattleResult result){}
    }
    const BindingFlags Fields=BindingFlags.Instance|BindingFlags.NonPublic;
    static object Field(BattleSession session,string name)=>typeof(BattleSession).GetField(name,Fields).GetValue(session);
    static (BattleSession session,Host host,Rng rng) Start(JsonNode fixture)
    {
        var h=new Host{Hp=(int?)fixture["playerHp"]??30};var rng=new Rng(123);var b=new BattleSession();
        b.Start(new BattleStartContext{host=h,rng=rng,enemies=Enumerable.Range(0,(int)fixture["targets"]).Select(i=>new EnemyInput{id="foe"+i,name="目标",hp=(int)fixture["hp"],atk=(int?)fixture["enemyAtk"]??3,affix=(string)fixture["affix"]}).ToArray()});
        if((bool?)fixture["playerCurseImmune"]==true)((HashSet<string>)Field(b,"persistentRules")).Add("playerCurseImmune");
        if(fixture["enemy"]!=null||fixture["surrender"]!=null||fixture["smoke"]!=null)return(b,h,rng);
        var ops=(string)fixture["name"]=="children"?RuleValue.Arr(
            RuleValue.Obj("op","release","source","generated","key","初始攻击","max",1),
            RuleValue.Obj("op","release","source","generated","key","初始攻击","max",1)):
            RuleValue.Arr(RuleValue.Obj("op","damage","amountField","dmg","hitCount",(int)fixture["count"],"target",(int)fixture["targets"]>1?"allEnemies":"chosenEnemy"));
        string type=(string)fixture["type"];
        var card=new CardDef{id="fixture",name="测试",type=type,cost=0,desc="",dmg=(int)fixture["amount"],dmgType=type=="法术"?"spell":"fixed",
            rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","enemy","area",(int)fixture["targets"]>1)),"triggers",RuleValue.Obj("onPlay",ops))};
        ((List<OwnedCard>)Field(b,"granted")).Add(new OwnedCard{uid="fixture",card=card});
        ((List<string>)Field(b,"hand")).Add("fixture");return(b,h,rng);
    }
    public static void Run()
    {
        CardLibrary.Init(()=>CardDatabase.All);
        string here="_planning/migration-1029/current-unit-frames";
        File.WriteAllText(here+"/rng-unity-vector.json",JsonSerializer.Serialize(new{seed=123,currentCall="Random(status)",currentValue=new Rng(123).Random("status"),sourceSignatureCall="Random(status,generation)",sourceSignatureValue=new Rng(123).Random("status","generation")},new JsonSerializerOptions{WriteIndented=true}));
        var oracle=JsonNode.Parse(File.ReadAllText(here+"/source-beats.json"));var rows=new List<object>();int failures=0;
        foreach(var scenario in oracle["scenarios"].AsArray())
        {
            var fixture=scenario["fixture"];var(b,h,rng)=Start(fixture);var all=new List<BattleActorCue>();
            Action<BattleActorCue> listen=cue=>{if(cue.BattleToken==b.Snapshot.BattleToken)all.Add(cue);};
            BattleSession.ActorPresentation+=listen;var played=Execute(b,fixture);BattleSession.ActorPresentation-=listen;
            var actual=new List<object>();foreach(var cue in all)
            {
                if(cue.Kind=="windup")actual.Add(new{kind="windup",action=cue.Action,replay=cue.ReplayAttacker,windup=cue.WindupMs});
                else if(cue.Kind=="enemy-windup")actual.Add(new{kind="enemy-windup",actor=cue.ActorIndex});
                else if(cue.Kind=="death")actual.Add(new{kind="death"});
                else if(cue.Kind=="hit"&&cue.AllyIndex<0)actual.Add(new{kind="hit",unit=cue.IsSelf?(object)"self":cue.Unit,before=cue.HpBefore,after=cue.HpAfter,max=cue.MaxHp});
            }
            var actualNode=JsonSerializer.SerializeToNode(actual);bool pass=played.Ok&&JsonNode.DeepEquals(actualNode,scenario["records"]);
            rows.Add(new{name=(string)fixture["name"]+":source-beats",pass,actual=actualNode,expected=scenario["records"]});if(!pass)failures++;
            string state=JsonSerializer.Serialize(b.Snapshot,new JsonSerializerOptions{IncludeFields=true}),random=rng.SaveState();
            var(b2,h2,rng2)=Start(fixture);Execute(b2,fixture);
            bool unchanged;
            // Tokens intentionally differ between sessions. Compare all other snapshot fields and RNG streams.
            var first=JsonNode.Parse(state).AsObject();var second=JsonSerializer.SerializeToNode(b2.Snapshot,new JsonSerializerOptions{IncludeFields=true}).AsObject();first.Remove("BattleToken");second.Remove("BattleToken");
            unchanged=JsonNode.DeepEquals(first,second)&&random==rng2.SaveState()&&h.Hp==h2.Hp;
            rows.Add(new{name=(string)fixture["name"]+":listener-does-not-change-rules",pass=unchanged});if(!unchanged)failures++;
            // Frozen copies survive later runtime mutations.
            var hit=all.FirstOrDefault(c=>c.Kind=="hit");if(hit!=null){int hp=hit.HpAfter;var foe=((List<BattleFoe>)Field(b,"foes"))[0];foe.hp=777;foe.defense.Armor=888;bool detached=hit.HpAfter==hp&&hit.DefenseAfter.Armor!=888;rows.Add(new{name=(string)fixture["name"]+":immutable-hit",pass=detached});if(!detached)failures++;}
        }
        File.WriteAllText(here+"/beat-results.json",JsonSerializer.Serialize(new{checks=rows.Count,failures,rows},new JsonSerializerOptions{WriteIndented=true}));
        Console.WriteLine($"actual Core/staged source beats: {rows.Count-failures}/{rows.Count}");
        if(failures>0)throw new Exception("Beat/source comparison failed");
    }
    static CommandResult Execute(BattleSession b,JsonNode fixture)=>fixture["enemy"]!=null?b.EndTurn():fixture["surrender"]!=null?b.Surrender():fixture["smoke"]!=null?b.Retract():b.PlayCard("fixture",0,false);
}
