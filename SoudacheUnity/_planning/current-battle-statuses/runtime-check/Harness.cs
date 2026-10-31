
using System;using System.Linq;using System.Collections.Generic;using System.Reflection;using Sdt.Core;using Sdt.Core.Battle;
class Host:BattleHost {public int Hp{get;set;}=20;public int MaxHp=>20;public int Atk=>2;public int SpellPower=>0;public string MyClass=>"侠客";public string CharacterId=>"wu";public IReadOnlyList<OwnedCard> OwnedCards=>Array.Empty<OwnedCard>();public void Log(string m,string k=null){}public void Heal(int n){}public void OnBattleEnd(BattleResult r){}}
class Program {
 static int n;static void Check(bool ok,string label){if(!ok)throw new Exception(label);n++;}
 static readonly BindingFlags flags=BindingFlags.Instance|BindingFlags.NonPublic;
 static void Set(BattleSession session,string name,object value)=>typeof(BattleSession).GetField(name,flags).SetValue(session,value);
 static void Register(BattleSession session,string name,int? duration=null,int count=1){var op=duration.HasValue?RuleValue.Obj("rule",name,"duration",duration.Value,"n",count):RuleValue.Obj("rule",name,"n",count);typeof(BattleSession).GetMethod("RegisterRuleName",flags).Invoke(session,new object[]{new CardDef(),op});}
 static IReadOnlyList<BattlePlayerEffect> Effects(BattleSession session)=>(IReadOnlyList<BattlePlayerEffect>)typeof(BattleSession).GetMethod("ProjectPlayerEffects",flags).Invoke(session,null);
 static void Main(){var session=new BattleSession();Check(Effects(session).Count==0,"new actual runtime has no fabricated effects");
 Register(session,"playerCurseImmune",1);Check(Effects(session).Single().Duration=="本回合","actual removeRule job maps temporary immunity");Register(session,"playerCurseImmune");Check(Effects(session).Single().Duration=="本场","actual persistent registration replaces expiry");
 Register(session,"moveCost1");Register(session,"doubleNextSpell");Register(session,"allSpellsInfused");Register(session,"discoverPlus");Register(session,"discoverPlus");Register(session,"bleedAmp");Register(session,"deathSave",null,3);Set(session,"extraTurn",true);
 var effects=Effects(session);Check(string.Join(",",effects.Select(e=>e.Key))=="curseImmunity,moveCost,nextSpell,infused,discoverPlus,bleedAmp,deathSave,extraTurn","actual private runtime fields map all8 effects in source order");Check(effects[1].Name=="招式1费"&&effects[4].Name=="发现候选+2"&&effects[6].Duration=="3次","native move cost/discover counter/fatal-save count mapped");
 Set(session,"doubleNextSpell",false);Set(session,"deathSaves",0);Set(session,"extraTurn",false);Check(Effects(session).All(e=>e.Key!="nextSpell"&&e.Key!="deathSave"&&e.Key!="extraTurn"),"consumed runtime flags disappear");Check(effects.Count==8&&effects[6].Duration=="3次","previous effect snapshot detached from live fields");
 Set(session,"G",new Host());Set(session,"pdef",new DefenseState());Set(session,"pstat",new Combatant());var snapshot=session.GetSnapshot();Check(snapshot.PlayerEffects.Count==5&&object.ReferenceEquals(snapshot.PlayerEffects,snapshot.playerEffects),"real GetSnapshot publishes projected readonly collection");
 var before=Effects(session).Select(e=>e.Name+e.Duration).ToArray();session.GetSnapshot();Check(before.SequenceEqual(Effects(session).Select(e=>e.Name+e.Duration)),"snapshot reads leave effect runtime state intact");
 Console.WriteLine("PASS "+n+" actual BattleSession player-effect assertions");}
}
