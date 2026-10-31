using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.Core.Battle;

class Program {
 static void Assert(bool condition,string message) { if(!condition) throw new Exception(message); Console.WriteLine("PASS " + message); }
 static void Main() {
  var folder=Path.Combine(Environment.CurrentDirectory,"_planning/migration-1029/independent-flow/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff"));
  Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",folder);
  CardLibrary.Init(()=>CardDatabase.All);
  var g=GameRuntime.I;
  g.Bus.On<ToastRequested>(e=>Console.WriteLine("NOTICE " + e.Text));
  g.ResetSlot(1); Assert(g.Saves.LastWriteSucceeded,"fresh slot persisted");
  var example=CardDatabase.All.First(c=>c.rarity=="古朴"&&c.type=="武术");
  g.Base.pocket.Add(new StashStack{card=example.Clone(),count=2}); g.Base.Save();
  g.NewRun(1,null);
  Assert(g.State.runActive,"fresh new run persisted");
  Console.WriteLine("OBSERVE departure_base_pocket_count="+g.Base.pocket.Sum(s=>s.count)+" expected_current_web=0");
  var crossSnapshot=g.State.mapSnapshot;
  g.EnterLayer(1,crossSnapshot.layers[1].entry,false);
  var previous=crossSnapshot.layers[0].exit;
  Assert(crossSnapshot.layers[1].nodes[g.State.trackPos].next.Any(edge=>edge.li==0&&edge.idx==previous),"generated cross-layer return edge exists");
  var allowed=g.CanMoveToNode("0,"+previous,out var blocked);
  Console.WriteLine("OBSERVE cross_layer_return_allowed="+allowed+" reason="+blocked);
  g.EnterLayer(0,crossSnapshot.layers[0].entry,false);
  string before=SaveJson.Stringify(g.State),baseBefore=SaveJson.Stringify(g.Base),rngBefore=g.Rng.SaveState();
  byte[] disk=File.ReadAllBytes(SaveSystem.ProfilePath);
  using(var locked=new FileStream(SaveSystem.ProfilePath+".writing",FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None)) {
   bool applied=g.TryPersistMutation(()=>{g.State.coins+=7;g.Base.wood+=3;g.Rng.Random("test");},out var reason);
   Assert(!applied,"locked save rejects mutation");
  }
  Assert(before==SaveJson.Stringify(g.State)&&baseBefore==SaveJson.Stringify(g.Base)&&rngBefore==g.Rng.SaveState(),"failed mutation restores run base and RNG");
  Assert(disk.SequenceEqual(File.ReadAllBytes(SaveSystem.ProfilePath)),"failed mutation preserves profile bytes");
  g.TryPersistMutation(()=>{g.State.inventory.Add(new InvSlot{name="木材",count=3,value=1});g.State.ownedCards.Add(new OwnedCard{uid=g.NewUid(),card=example.Clone()});},out _);
  int priorWood=g.Base.wood;
  var first=g.DoExtract(); Assert(first!=null,"extraction starts");
  var repeat=g.DoExtract(); Assert(repeat!=null&&g.Base.wood==priorWood+3&&g.Base.stats.extracts==1,"repeated extraction does not duplicate resources or stats");
  Assert(g.Saves.HasRun(1)&&g.LoadRun(1)&&!g.State.runActive&&g.State.Phase=="settlement","sorting extraction reloads as sorting");
  var sorting=g.ExtractStashAll(); Assert(sorting!=null,"sorting claim persists");
  int stashed=g.Base.StashUsed;
  g.ExtractStashAll(); Assert(g.Base.StashUsed==stashed,"repeated claim does not duplicate cards");
  Assert(g.FinishExtract()?.Done==true&&g.FinishExtract()?.Done==true,"finish extraction is repeatable without duplicate rewards");
  g.ShowTitle();g.ResetSlot(2);g.NewRun(2,null);g.TryPersistMutation(()=>g.Base.wood=71,out _);g.ExitToTitle();
  g.EnterSlot(1);Assert(g.Base.wood==priorWood+3,"slot 2 base writes do not contaminate slot 1");
  g.ResetSlot(3);g.NewRun(3,null);
  int events=0;g.Bus.On<NodeEntered>(e=>{if(e.Node?.Kind==NodeKind.Event)events++;});
  int eventIndex=g.State.mapSnapshot.layers[0].nodes.First(n=>n.type=="event").idx;
  g.EnterLayer(0,eventIndex,false);g.TryPersistMutation(()=>g.ResolveCell(),out _);
  Console.WriteLine("OBSERVE fresh_event_node_entered_count="+events+" expected_single_presentation=1");
  foreach(bool boss in new[]{false,true}) {
   var host=new ProbeHost();var battle=new BattleSession();
   battle.Start(new BattleStartContext{host=host,isBoss=boss,layer=boss?3:0,rng=new Rng(991),enemies=new[]{new EnemyInput{id="bandit",name="Probe",hp=80,atk=1,behavior="strike"}}});
   var fled=battle.Retract();
   Console.WriteLine("OBSERVE retract boss="+boss+" allowed="+fled.Ok+" result="+(host.Result?.Win?.ToString()??"null")+" ended="+(host.Result!=null));
  }
  Console.WriteLine("PROFILE "+SaveSystem.ProfilePath);
 }
 sealed class ProbeHost:BattleHost {
  public int Hp{get;set;}=30; public int MaxHp=>30; public int Atk=>2; public int SpellPower=>0; public string MyClass=>null; public string CharacterId=>null;
  public IReadOnlyList<OwnedCard> OwnedCards{get;}=Enumerable.Range(0,5).Select(i=>new OwnedCard{uid="probe"+i,card=CardLibrary.SHA.Clone()}).ToList();
  public BattleResult Result; public void Log(string message,string kind=null){} public void Heal(int amount){Hp=Math.Min(MaxHp,Hp+amount);}public void OnBattleEnd(BattleResult result){Result=result;}
 }
}
