using System;using System.IO;using System.Linq;using System.Collections.Generic;using Newtonsoft.Json;using Sdt.Core;using Sdt.Run;
namespace UnityEngine {
 public static class Application { public static string persistentDataPath=>Path.GetTempPath(); }
 public static class Debug { public static void LogException(Exception error){Console.WriteLine(error.Message);} }
 public sealed class TextAsset { public string text; }
 public static class Resources { public static T Load<T>(string name)where T:class=>new TextAsset{text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json"))} as T; }
}
namespace Sdt.Run {public sealed class AudioService {public static AudioService I{get;}=new AudioService();public void PlaySfx(string key){}public void PlayBgm(string key){}}}
class DataChecks {
 static readonly List<string> Checks=new List<string>();
 static void Check(bool pass,string label){if(!pass)throw new Exception(label);Checks.Add(label);}
 static void Main(){
  string output="_planning/migration-1030-fidelity/transitions/data-check";
  string directory=Path.GetFullPath(output+"/profile-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"));Directory.CreateDirectory(directory);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",directory);
  CardLibrary.Init(()=>CardDatabase.All);var g=GameRuntime.I;g.NewRun(5,CharacterTable.All[0].id);
  var node=g.Map.Snapshot.layers[3].nodes.First(n=>n.type=="boss");g.State.layerIdx=3;g.State.trackPos=node.idx;g.State.altarActivated=true;g.State.Phase="idle";g.SaveCurrent();
  string key=g.CurrentNodeId, random=g.Rng.SaveState();int starts=0;g.Bus.On<BattleRequested>(_=>starts++);
  var gate=g.ResolveCell();Check(gate?.Kind==NodeKind.Boss&&starts==0,"arriving presents boss gate without entering combat");
  Check(g.Rng.SaveState()==random&&g.CurrentNodeReceipt.bossId==null,"merely arriving does not consume boss RNG or reserve a boss");
  Check(g.TryLeaveBossGate(out var error)&&g.State.Phase=="idle"&&!g.State.settled.Contains(key)&&!g.CurrentNodeReceipt.completed,"return keeps boss node available");
  gate=g.ResolveCell();Check(gate?.Kind==NodeKind.Boss&&starts==0&&g.Rng.SaveState()==random,"re-entering shows confirmation without rerolling");
  string before=File.ReadAllText(SaveSystem.ProfilePath);
  using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read)){
   Check(!g.TryBeginBossGate(out error),"failed atomic boss-plan save reports failure");
   Check(starts==0&&g.Rng.SaveState()==random&&g.CurrentNodeReceipt.bossId==null,"failed boss entry rolls back RNG/plan and emits no battle request");
   Check(File.ReadAllText(SaveSystem.ProfilePath)==before,"failed boss-plan save preserves original file");
  }
  Check(g.TryBeginBossGate(out error),"boss confirmation retry saves and dispatches");
  string chosen=g.CurrentNodeReceipt.bossId, selectedRandom=g.Rng.SaveState();
  Check(starts==1&&MapData.AltarBosses.Any(b=>b.id==chosen),"one accepted request selects a real source boss");
  Check(new SaveSystem().ReadSlot(5).nodeRewards[key].bossId==chosen,"boss identity survives actual fresh-file read");
  Check(g.TryBeginBossGate(out error)&&g.CurrentNodeReceipt.bossId==chosen&&g.Rng.SaveState()==selectedRandom,"retrying an accepted plan keeps the same boss and RNG");
  g.State.battleActive=true;Check(!g.TryLeaveBossGate(out error)&&!g.TryBeginBossGate(out error),"active combat refuses gate return and a second gate request");g.State.battleActive=false;
  g.State.altarActivated=false;Check(!g.TryBeginBossGate(out error),"unactivated altar refuses gate entry");
  foreach(string id in new[]{"tt6-mystery","tt6-chestdraw","ev19-recode"}){
   g.NewRun(5,CharacterTable.All[0].id);var target=g.Map.Snapshot.layers[0].nodes.First(n=>n.type=="event");g.State.trackPos=target.idx;g.CurrentNodeReceipt.eventCardId=id;g.State.Phase="idle";
   Check(g.ResolveCell()?.Instant?.EventCard?.id==id,"current generated-map event receipt reaches actual presentation: "+id);
   g.GetEventChoices(id);var initial=g.GetCurrentEventOutcome();Check(initial!=null&&(initial.CardIds==null||initial.CardIds.Count==0),"initial encounter starts on source event banner page: "+id);
  }
  File.WriteAllText(output+"/results.json",JsonConvert.SerializeObject(new{passed=true,count=Checks.Count,checks=Checks,chosen,profileDirectory=directory},Formatting.Indented));
  Console.WriteLine("Boss-gate actual file/command checks: "+Checks.Count+" passed");
 }
}
