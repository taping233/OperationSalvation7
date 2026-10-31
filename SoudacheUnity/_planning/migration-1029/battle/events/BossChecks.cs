using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

static class BossChecks
{
    static int checks;static void Check(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
    static object Field(BattleSession b,string name)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(b);
    static void Set(BattleSession b,string name,object value)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(b,value);
    static void Call(BattleSession b,string name)=>typeof(BattleSession).GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(b,null);
    static BattleSession Start(string behavior,string mode="standard")
    {
        var b=new BattleSession();b.Start(new BattleStartContext{host=new CheckpointHost{Hp=1000,MaxHp=1000},runMode=mode,rng=new Rng(333),enemies=new[]{new EnemyInput{name=behavior,hp=100,atk=1,behavior=behavior}}});return b;
    }
    public static int Run()
    {
        var data=JObject.Parse(File.ReadAllText("_planning/migration-1029/battle/boss-source-vectors.json"));
        foreach(var v in data["witness"]){var input=v["input"];var unit=new Combatant{hp=20,maxHp=30,atk=1,behavior="witness_pope",defense=new DefenseState{Armor=2}};unit.status.silence=(int)input["status"]["silence"];unit.status.healban=(int)input["status"]["healban"];
            var result=CombatResolver.DealDamage(new Combatant{atk=4,spellPower=2},unit,(int)v["amount"],(string)v["type"]);Check(result.dealt==(int)v["dealt"]&&unit.hp==(int)v["after"]["hp"]&&unit.atk==(int)v["after"]["atk"],"source witness " +(string)v["type"]);}
        foreach(var v in data["capped"]){var input=v["input"];var unit=new Combatant{hp=100,maxHp=100,atk=1,damageCap=4,defense=new DefenseState{Armor=2}};unit.status.abreak=(int)input["status"]["abreak"];unit.status.necroticExposure=(int)input["status"]["necroticExposure"];
            var result=CombatResolver.DealDamage(new Combatant{atk=4,spellPower=2},unit,9,(string)v["type"]);Check(result.dealt==(int)v["dealt"]&&unit.hp==(int)v["hp"],"source final cap/exposure/armor-break "+(string)v["type"]);}
        foreach(string mode in new[]{"standard","elite"}){var battle=Start("mutation_mother",mode);foreach(var v in data["summons"].Where(v=>(string)v["mode"]==mode)){
            Set(battle,"turn",(int)v["turn"]);Call(battle,"ApplyCurrentBossTurnStart");var s=battle.Snapshot.foes.Last();var e=v["foe"];
            Check(s.id==(string)e["id"]&&s.hp==(int)e["hp"]&&s.atk==(int)e["atk"]&&s.eliteSkill==(string)e["eliteSkill"]&&s.status["stealth"]==(int)e["stealth"],"source mother summon "+mode+v["turn"]);
            int count=battle.Snapshot.foes.Count;Call(battle,"ApplyCurrentBossTurnStart");Check(battle.Snapshot.foes.Count==count,"mother trigger only once per turn");}}
        var necro=Start("necromancer");var deck=(List<string>)Field(necro,"drawPile");deck.Clear();deck.AddRange(Enumerable.Range(0,7).Select(i=>"d"+i));
        foreach(var v in data["necro"]){Set(necro,"turn",(int)v["turn"]);Call(necro,"ApplyCurrentBossTurnStart");Check(necro.Snapshot.drawPile.SequenceEqual(v["drawPile"].Values<string>())&&necro.Snapshot.grave.SequenceEqual(v["grave"].Values<string>())&&necro.Snapshot.foes[0].status["necroticExposure"]==(int)v["exposure"],"source necromancer tear/exposure");}
        var blocker=Start("mysterious_blocker");Check(new[]{"bleed","poison","abreak","healban"}.All(k=>blocker.Snapshot.pstat.status[k]==1&&blocker.Snapshot.foes[0].status[k]==1),"source blocker opening applies four curses to all participants");
        int before=new[]{"bleed","poison","abreak","healban"}.Sum(k=>blocker.Snapshot.foes[0].status[k]);blocker.EndTurn();Check(blocker.Snapshot.foes[0].status["bleed"]+blocker.Snapshot.foes[0].status["poison"]<=2,"blocker self-cleanses after attack before durations");
        // No coin increment is permitted for armor/energy-only onKill payloads.
        var host=new CheckpointHost{cards=new List<OwnedCard>{new OwnedCard{uid="sniper",card=CardLibrary.FindById("tt13-snipe").Clone()}}};host.cards[0].card.runtimeCost=0;
        var shot=new BattleSession();shot.Start(new BattleStartContext{host=host,rng=new Rng(333),enemies=new[]{new EnemyInput{name="low",hp=1,atk=1},new EnemyInput{name="other",hp=40,atk=1}}});shot.PlayCard("sniper",0,false);Check(host.coins==0,"energy onKill never awards phantom coin");
        BattleResult ended=null;Action<BattleResult> capture=result=>ended=result;BattleSession.BattleEnded+=capture;
        try{var moves=new CheckpointHost{cards=Enumerable.Range(0,10).Select(i=>{var card=CardLibrary.FindById("starter-attack").Clone();card.runtimeCost=0;return new OwnedCard{uid="move:"+i,card=card};}).ToList()};var b=new BattleSession();b.Start(new BattleStartContext{host=moves,rng=new Rng(1),enemies=new[]{new EnemyInput{name="long",hp=1000,atk=1}}});foreach(var owned in moves.cards)b.PlayCard(owned.uid,0,false);b.EndTurn();b.Retract();Check(ended?.TurnMovesMax==10,"ten move achievement counter survives turn reset");}
        finally{BattleSession.BattleEnded-=capture;}
        Console.WriteLine("PASS "+checks+" current boss assertions with 59 actual source vectors");return checks;
    }
}
