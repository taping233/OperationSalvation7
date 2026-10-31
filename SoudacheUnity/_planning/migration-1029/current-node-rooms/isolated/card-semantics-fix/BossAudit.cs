using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Sdt.Core;
using Sdt.Core.Battle;
static class BossAudit {
 static readonly BindingFlags BF=BindingFlags.NonPublic|BindingFlags.Instance;
 static void Set(BattleSession b,string n,object value)=>typeof(BattleSession).GetField(n,BF).SetValue(b,value);
 static T Field<T>(BattleSession b,string n)=>(T)typeof(BattleSession).GetField(n,BF).GetValue(b);
 static void Call(BattleSession b,string n,params object[] args)=>typeof(BattleSession).GetMethod(n,BF).Invoke(b,args);
 static int N(JsonElement x,string n)=>x.TryGetProperty(n,out var v)&&v.ValueKind==JsonValueKind.Number?v.GetInt32():0;
 static (BattleSession b,Host h) Start(string behavior,string affix=null,string mode="standard"){
  var h=new Host();var b=new BattleSession();b.Start(new BattleStartContext{host=h,rng=new Rng(333),runMode=mode,enemies=new[]{new EnemyInput{id="fixture",name="boss",hp=100,atk=1,behavior=behavior,affix=affix}}});return(b,h);
 }
 internal static IEnumerable<object> Run(){
  var rows=new List<object>();void Add(string name,object actual,object expected)=>rows.Add(new{name,actual,expected,equal=JsonSerializer.Serialize(actual)==JsonSerializer.Serialize(expected)});
  using var doc=JsonDocument.Parse(System.IO.File.ReadAllText("_planning/migration-1029/current-node-rooms/isolated/card-semantics-fix/boss-source-vectors.json"));
  int i=0;foreach(var v in doc.RootElement.GetProperty("witness").EnumerateArray()){
   var input=v.GetProperty("input");var status=input.GetProperty("status");var f=new Combatant{hp=N(input,"hp"),maxHp=N(input,"maxHp"),atk=N(input,"atk"),behavior="witness_pope",status=new UnitStatus{silence=N(status,"silence"),healban=N(status,"healban")},defense=new DefenseState{Armor=2}};
   var dealt=CombatResolver.DealDamage(new Combatant{atk=4,spellPower=2},f,N(v,"amount"),v.GetProperty("type").GetString()).dealt;var after=v.GetProperty("after");Add("witnessVector"+i++,new[]{dealt,f.hp,f.atk},new[]{N(v,"dealt"),N(after,"hp"),N(after,"atk")});
  }
  i=0;foreach(var v in doc.RootElement.GetProperty("capped").EnumerateArray()){
   var input=v.GetProperty("input");var status=input.GetProperty("status");var f=new Combatant{hp=N(input,"hp"),maxHp=N(input,"maxHp"),atk=N(input,"atk"),damageCap=N(input,"damageCap"),status=new UnitStatus{abreak=N(status,"abreak"),necroticExposure=N(status,"necroticExposure")},defense=new DefenseState{Armor=2}};
   var dealt=CombatResolver.DealDamage(new Combatant{atk=4,spellPower=2},f,9,v.GetProperty("type").GetString()).dealt;Add("damageCapExposureVector"+i++,new[]{dealt,f.hp},new[]{N(v,"dealt"),N(v,"hp")});
  }
  foreach(var mode in new[]{"standard","elite"}){
   var s=Start("mutation_mother",null,mode);Set(s.b,"rng",new Rng(333));
   foreach(var v in doc.RootElement.GetProperty("summons").EnumerateArray().Where(x=>x.GetProperty("mode").GetString()==mode)){
    Set(s.b,"turn",N(v,"turn"));Call(s.b,"ApplyCurrentBossTurnStart");var f=Field<List<BattleFoe>>(s.b,"foes").Last();var wanted=v.GetProperty("foe");
    Add("motherSummon"+mode+N(v,"turn"),new object[]{f.id,f.hp,f.atk,f.eliteSkill,f.status.stealth},new object[]{wanted.GetProperty("id").GetString(),N(wanted,"hp"),N(wanted,"atk"),wanted.GetProperty("eliteSkill").ValueKind==JsonValueKind.String?wanted.GetProperty("eliteSkill").GetString():null,N(wanted,"stealth")});
   }
  }
  {var s=Start("necromancer");Set(s.b,"drawPile",Enumerable.Range(0,7).Select(n=>"d"+n).ToList());foreach(var v in doc.RootElement.GetProperty("necro").EnumerateArray()){
   Set(s.b,"turn",N(v,"turn"));Call(s.b,"ApplyCurrentBossTurnStart");var f=Field<List<BattleFoe>>(s.b,"foes")[0];Add("necroPiles"+N(v,"turn"),new object[]{Field<List<string>>(s.b,"drawPile").ToArray(),Field<List<string>>(s.b,"grave").ToArray(),f.status.necroticExposure},new object[]{v.GetProperty("drawPile").EnumerateArray().Select(x=>x.GetString()).ToArray(),v.GetProperty("grave").EnumerateArray().Select(x=>x.GetString()).ToArray(),N(v,"exposure")});
  }}
  {var s=Start("general","grow");var f=Field<List<BattleFoe>>(s.b,"foes")[0];f.atk=5;s.b.EndTurn();Add("generalGrowsByTwo",f.atk,7);}
  {var s=Start("mysterious_blocker");var f=Field<List<BattleFoe>>(s.b,"foes")[0];var keys=new[]{"bleed","poison","abreak","healban"};Add("blockerOpeningCurseEveryone",keys.All(k=>f.status.Get(k)==1&&s.b.Snapshot.pstat.status[k]==1),true);int before=CombatResolver.Curses.Sum(k=>f.status.Get(k));Call(s.b,"CleanseCurrentBlocker",f);Add("blockerAttackRemovesOneLayer",CombatResolver.Curses.Sum(k=>f.status.Get(k)),before-1);}
  {var s=Start("element_boss","aegis");Set(s.b,"turn",2);var f=Field<List<BattleFoe>>(s.b,"foes")[0];Call(s.b,"HitFoe",f,CardLibrary.SHA,4,"fixed","");Add("aegisEvenTurnBlocks",f.hp,100);f.status.abreak=1;Call(s.b,"HitFoe",f,CardLibrary.SHA,4,"fixed","");Add("aegisBrokenCanDamage",f.hp,96);}
  return rows;
 }
}
