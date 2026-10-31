using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
namespace UnityEngine {
 public static class Application {public static string persistentDataPath=>Path.GetTempPath();}
 public static class Debug {public static void LogException(Exception e){Console.WriteLine(e.Message);}}
 public sealed class TextAsset{public string text;}
 public static class Resources{public static T Load<T>(string name)where T:class=>new TextAsset{text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json"))} as T;}
}
namespace Sdt.Run{public sealed class AudioService{public static AudioService I{get;}=new AudioService();public void PlaySfx(string key){}public void PlayBgm(string key){}}}
class Program {
 static int checks,faults,pathCount;
 static void Check(bool ok,string label){checks++;if(!ok)throw new Exception(label);}
 static void Main(){
  string evidence="_planning/migration-1029/travel-departure",dir=Path.GetFullPath(evidence+"/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(dir);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",dir);
  CardLibrary.Init(()=>CardDatabase.All);var g=GameRuntime.I;var vectors=JObject.Parse(File.ReadAllText(evidence+"/source-vectors.json"));
  var pathMethod=typeof(GameRuntime).GetMethod("TravelPath",BindingFlags.Instance|BindingFlags.NonPublic);
  List<string> Travel(string id)=>(List<string>)pathMethod.Invoke(g,new object[]{id});
  bool EqualPath(List<string> actual,JToken expected)=>expected.Type==JTokenType.Null?actual==null:actual!=null&&actual.SequenceEqual(expected.Values<string>());
  void Start(){g.NewRun(1,CharacterTable.All[0].id);Check(g.Saves.LastWriteSucceeded,"fresh run saves");g.State.entrySupply=null;g.State.Phase="idle";g.State.battleActive=false;g.State.altarActivated=true;g.State.bossDefeated=true;}
  void Position(int li,int idx){g.State.layerIdx=li;g.State.trackPos=idx;g.State.Phase="idle";g.State.nodeRewards.Clear();g.State.closed.Clear();g.State.settled.Clear();g.State.revealed.Clear();g.State.entrySupply=null;}
  void Fault(Func<bool> action,string label){g.SaveCurrent();string disk=File.ReadAllText(SaveSystem.ProfilePath),state=SaveJson.Stringify(g.State),data=SaveJson.Stringify(g.Base),rng=g.Rng.SaveState();Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");Check(!action(),label+" rejects failed write");Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&SaveJson.Stringify(g.State)==state&&SaveJson.Stringify(g.Base)==data&&g.Rng.SaveState()==rng,label+" rolls back state, base, RNG and disk");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+faults++);}
  Start();
  foreach(var map in vectors["mapCases"]){
   g.State.mapSnapshot=SaveJson.Read<MapSnapshot>(map["snapshot"]);g.BuildDerived();
   foreach(var c in map["cases"]){
    Position((int)c["layerIdx"],(int)c["trackPos"]);g.State.revealed=new HashSet<string>(c["revealed"].Values<string>());g.State.settled=new HashSet<string>(c["settled"].Values<string>());g.State.closed=new HashSet<string>(c["closed"].Values<string>());
    var expectedReachable=new List<string>();
    foreach(var v in c["expected"]){string id=(string)v["id"];Check(EqualPath(Travel(id),v["path"]),"current JS path "+c["name"]+" -> "+id);Check(g.CanMoveToNode(id,out _)==(v["path"].Type!=JTokenType.Null),"command uses same reachability "+id);pathCount++;if(v["path"].Type!=JTokenType.Null)expectedReachable.Add(id);}
    Check(g.GetReachableNodeIds().SequenceEqual(expectedReachable),"all reachable IDs include direct cross-layer roads "+c["name"]);
   }
  }
  void Synthetic(string transit){
   Position(0,0);g.State.revealed.UnionWith(new[]{"0,0","0,1","0,2"});g.Layers[0].doors.Clear();
   for(int i=0;i<3;i++){var node=g.Map.CellDefs["0,"+i];node.type=i==0?"entrance":i==1?transit:"resource";node.next=i==0?new List<MapLink>{new MapLink(0,1)}:i==1?new List<MapLink>{new MapLink(0,0),new MapLink(0,2)}:new List<MapLink>{new MapLink(0,1)};}
  }
  foreach(var v in vectors["boundaries"]){
   string transit=(string)v["transit"],status=(string)v["status"];Synthetic(transit);if(status!="fresh")g.State.settled.Add("0,1");if(status=="closed")g.State.closed.Add("0,1");
   if(status=="pending"){
    if(transit=="fire")g.State.nodeRewards["0,1"]=new NodeVisitReceipt{type="fire",healUsed=false,restoreUsed=true};
    if(transit=="chest")g.State.nodeRewards["0,1"]=new NodeVisitReceipt{type="chest",chestQueue=new List<ChestVisitReceipt>()};
    if(transit=="event")g.State.nodeRewards["0,1"]=new NodeVisitReceipt{type="event",eventProgress=new EventProgress{stage="rewards"}};
   }
   Check(EqualPath(Travel("0,2"),v["path"]),"current JS transit boundary "+transit+":"+status);
  }
  foreach(var v in vectors["fogCases"]){Synthetic("blank");string mode=(string)v["mode"];g.State.revealed.Remove("0,2");string target="0,2";if(mode=="direct-unseen"){g.State.revealed.Remove("0,1");target="0,1";}if(mode=="visited-target")g.State.settled.Add("0,2");if(mode=="pending-entry")g.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{"one"}};Check(EqualPath(Travel(target),v["path"]),"current JS fog/supply boundary "+mode);}
  Start();g.State.mapSnapshot=LayeredMapGenerator.Generate("0");g.BuildDerived();
  int reverseEvents=0;g.Bus.On<NodeMovementCompleted>(_=>reverseEvents++);Position(1,g.State.mapSnapshot.layers[1].entry);string reverse="0,"+g.State.mapSnapshot.layers[0].exit;
  g.State.revealed.Add(g.CurrentNodeId);Check(g.GetReachableNodeIds().Contains(reverse)&&g.CanMoveToNode(reverse,out _),"second entry exposes return to first gate even without revealed target");
  Fault(()=>g.TryMoveToNode(reverse,out _),"reverse cross-layer movement");int turn=g.State.turn;Check(g.TryMoveToNode(reverse,out _)&&g.State.layerIdx==0&&g.CurrentNodeId==reverse&&g.State.turn==turn+1&&reverseEvents==1,"reverse edge commits correct layer once");
  g.State.Phase="idle";g.SaveCurrent();g.ShowTitle();Check(g.LoadRun(1)&&g.State.layerIdx==0&&g.CurrentNodeId==reverse,"cross-layer position survives reload");
  Start();g.State.mapSnapshot=LayeredMapGenerator.Generate("42");g.BuildDerived();Position(2,g.State.mapSnapshot.layers[2].entry);
  g.State.revealed.UnionWith(g.Map.Nodes.Select(n=>n.id));g.State.closed.UnionWith(g.Map.Nodes.Select(n=>n.id));g.State.settled.UnionWith(g.State.closed);
  var route=g.Map.Nodes.Where(n=>n.layerIdx==2).Select(n=>Travel(n.id)).First(p=>p!=null&&p.Count>=2);string destination=route.Last();var origin=g.CurrentNodeId;turn=g.State.turn;var explored=g.State.explored.ToHashSet();int actions=g.Base.stats.actions;
  Fault(()=>g.TryMoveToNode(destination,out _),"multi-step route");Check(g.TryMoveToNode(destination,out _)&&g.State.turn==turn+route.Count&&g.Base.stats.actions==actions+route.Count,"each traversed cell increments turn and action once");
  Check(route.All(id=>g.State.explored.Contains(id))&&route.Take(route.Count-1).All(id=>g.State.closed.Contains(id))&&g.State.closed.Contains(origin),"all traversed cells record first exploration and departed content");
  g.SaveCurrent();g.ShowTitle();Check(g.LoadRun(1)&&route.All(id=>g.State.explored.Contains(id))&&g.State.turn==turn+route.Count,"multi-step bookkeeping survives reload");
  foreach(var v in vectors["departures"]){
   g.ResetSlot(1);g.Base.stash=SaveJson.Read<List<StashStack>>(v["before"]["stash"]);g.Base.pocket=SaveJson.Read<List<StashStack>>(v["before"]["pocket"]);g.Base.Save();var picks=v["picks"].ToObject<Dictionary<string,int>>();
   if((bool?)v["fail"]==true)Fault(()=>{g.NewRun(1,CharacterTable.All[0].id,picks:picks);return g.Saves.LastWriteSucceeded;},"departure with pocket and picks");else g.NewRun(1,CharacterTable.All[0].id,picks:picks);
   Check(g.Base.pocket.Sum(s=>s.count)==v["after"]["pocket"].Sum(s=>(int)s["count"]),"current JS base pocket outcome "+v["name"]);
   Check(g.Base.stash.Sum(s=>s.count)==v["after"]["stash"].Sum(s=>(int)s["count"]),"current JS departure stash outcome "+v["name"]);
   if((bool?)v["fail"]!=true){Check(g.State.usedPocket.Count==0,"new local used pocket remains empty");g.ShowTitle();Check(g.LoadRun(1)&&g.Base.pocket.Count==0,"successful departure pocket remains empty after reload");}
  }
  g.ResetSlot(1);var resource=CardDatabase.All.First(c=>c.type=="资源");g.Base.pocket.Add(new StashStack{card=resource,count=4});g.Base.stash.Add(new StashStack{card=resource,count=100});g.Base.Save();string baseBefore=SaveJson.Stringify(g.Base);g.NewRun(1,CharacterTable.All[0].id,picks:new Dictionary<string,int>{{resource.name,100}});Check(SaveJson.Stringify(g.Base)==baseBefore&&g.Base.pocket.Sum(s=>s.count)==4,"capacity rejection never clears base pocket");
  Start();var eventNode=g.Map.Nodes.First(n=>n.type=="event");Position(eventNode.layerIdx,eventNode.idx);int pages=0;g.Bus.On<NodeEntered>(e=>{if(e.Node?.Kind==NodeKind.Event)pages++;});int history=g.State.eventLog.Count;
  var opened=g.ResolveCell();Check(opened?.Kind==NodeKind.Event&&pages==1&&g.State.eventLog.Count==history+1,"first event arrival publishes exactly one page and one history record");
  g.TriggerEventCard(CardLibrary.FindById("tt6-bandits"));Check(pages==2,"direct TriggerEventCard still publishes a standalone page");
  g.CurrentNodeReceipt.eventProgress=new EventProgress{eventId="tt6-bandits",stage="battle",enemies=new List<MonsterDef>{new MonsterDef{id="bandit",name="截道拾荒者",hp=3,atk=3}}};int admissions=0;g.Bus.On<BattleRequested>(_=>admissions++);
  g.CurrentNodeReceipt.completed=true;string beforeCompleted=SaveJson.Stringify(g.State);Check(!g.StartEventBattle(null)&&admissions==0&&SaveJson.Stringify(g.State)==beforeCompleted,"completed receipt rejects stale event battle callback without mutation");
  g.CurrentNodeReceipt.completed=false;g.CompleteBattleNode(true);Check(g.CurrentNodeReceipt.eventProgress.settled==(bool)vectors["eventSettlement"]["settled"]&&g.CurrentNodeReceipt.eventProgress.stage=="complete","event victory synchronizes source settled guard and receipt");
  Check(!g.StartEventBattle(null)&&admissions==0,"completed event cannot admit a second battle");g.ShowTitle();Check(g.LoadRun(1)&&g.CurrentNodeReceipt.eventProgress.settled&&g.CurrentNodeReceipt.eventProgress.stage=="complete"&&!g.StartEventBattle(null),"settled event stays complete and closed to battle after reload");
  Check((bool)vectors["eventSettlement"]["first"]&&!(bool)vectors["eventSettlement"]["repeated"]&&(int)vectors["eventSettlement"]["runs"]==1,"current JS settlement accepts once");
  var result=new{passed=true,assertions=checks,pathVectors=pathCount,transitVectors=vectors["boundaries"].Count(),fogSupplyVectors=vectors["fogCases"].Count(),departureVectors=vectors["departures"].Count(),realWriteFailures=faults,directory=dir};File.WriteAllText(Path.Combine(dir,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}
