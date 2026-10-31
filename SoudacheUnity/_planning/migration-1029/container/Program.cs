using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
namespace UnityEngine {
 public static class Application { public static string persistentDataPath=>Path.GetTempPath(); }
 public static class Debug { public static void LogException(Exception e){Console.WriteLine(e.Message);} }
 public sealed class TextAsset {public string text;}
 public static class Resources {public static T Load<T>(string name)where T:class=>new TextAsset{text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json"))} as T;}
}
namespace Sdt.Run {public sealed class AudioService {public static AudioService I{get;}=new AudioService();public void PlaySfx(string key){}public void PlayBgm(string key){}}}
class Program {
 static int checks;static void Assert(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
 static void Main(){
  string directory=Path.GetFullPath("_planning/migration-1029/container/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(directory);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",directory);
  var g=GameRuntime.I;g.NewRun(1,CharacterTable.All[0].id);g.State.entrySupply=null;
  var fixture=JObject.Parse(File.ReadAllText("_planning/migration-1029/container/source-fixtures.json"));
  foreach(var test in fixture["cases"]){
   string name=(string)test["name"];g.Base.bagUp=(int)test["baseCap"]-GameRules.BagSize;g.State.ownedCards=SaveJson.Read<List<OwnedCard>>(test["before"]["ownedCards"]);g.State.inventory.Clear();g.State.battleActive=false;g.State.Phase="idle";
   var request=test["request"];if(request.Type!=JTokenType.Null){bool ok=CardContainerCommands.TryTransferStack(g,(string)request["kind"],(bool)request["take"],(string)request["name"],out string reason);Assert(ok==(bool)test["result"]["ok"],name+" outcome "+reason);}
   var after=JToken.FromObject(g.State.ownedCards.Select(o=>new{uid=o.uid,stored=o.stored,pouchOf=o.pouchOf}));Assert(JToken.DeepEquals(after,test["after"]),name+" exact zone transitions");
   var q=CardContainerCommands.Query(g);var usage=JToken.FromObject(new{used=q.used,ordinarySlots=q.ordinarySlots,resourceBonus=q.resourceBonus,cap=q.totalCap,safeUsed=q.safeUsed});Assert(JToken.DeepEquals(usage,test["usage"]),name+" exact source usage");
  }
  var box=new CardDef{id="tt2-pearlbox",name="珍珠盒",type="装备",rules=RuleValue.Obj("equip",RuleValue.Obj("container",RuleValue.Obj("slots",9,"accepts","资源")))};
  var pouch=new CardDef{id="tt7-stratagem",name="法师锦囊",type="法术",rules=RuleValue.Obj("equip",RuleValue.Obj("container",RuleValue.Obj("slots",3,"accepts","法术")))};
  var resource=new CardDef{id="r",name="资源",type="资源"};var spell=new CardDef{id="s",name="法术",type="法术"};var sword=new CardDef{id="e",name="装备",type="装备"};
  g.Base.bagUp=1-GameRules.BagSize;g.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="box",card=box,safe=true},new OwnedCard{uid="sword",card=sword}};g.State.ownedCards.AddRange(Enumerable.Range(0,27).Select(i=>new OwnedCard{uid="r"+i,card=resource}));
  Assert(g.UsedSlots()==10&&g.BagCap==10&&!g.CanReceiveCard(spell)&&!g.CanReceiveCard(resource),"resource extension never admits ordinary card");g.State.ownedCards.RemoveAt(g.State.ownedCards.Count-1);Assert(g.CanReceiveCard(resource),"partial resource stack can merge");
  g.Base.bagUp=10-GameRules.BagSize;g.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="box",card=box,safe=true},new OwnedCard{uid="safe-card",card=spell,safe=true},new OwnedCard{uid="stored-resource",card=resource,stored=true},new OwnedCard{uid="pouch-spell",card=spell,stored=true,pouchOf="tt7-stratagem"},new OwnedCard{uid="ordinary",card=sword}};
  Assert(JToken.DeepEquals(JToken.FromObject(CardContainerCommands.RescueCards(g).SelectMany(s=>Enumerable.Repeat(s.card.id,s.count))),fixture["rescue"]),"safe pearl rescue exact source");Assert(!CardContainerCommands.TryDiscard(g,"box",out _),"last occupied box cannot discard");
  g.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="pouch",card=pouch},new OwnedCard{uid="spell",card=spell}};g.SaveCurrent();string before=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");Assert(!CardContainerCommands.TryTransferStack(g,"pouch",false,"法术",out var error,new[]{"spell"})&&!string.IsNullOrEmpty(error),"transfer write failure reports");Assert(!g.State.ownedCards.First(o=>o.uid=="spell").stored&&File.ReadAllText(SaveSystem.ProfilePath)==before,"transfer write failure restores same inventory");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-evidence");
  Assert(CardContainerCommands.TryTransferStack(g,"pouch",false,"法术",out _,new[]{"spell"}),"transfer retry succeeds");var read=new SaveSystem().ReadSlot(1);var stored=read.ownedCards.First(o=>o.uid=="spell");Assert(stored.stored&&stored.pouchOf=="tt7-stratagem"&&read.ownedCards.First(o=>o.uid=="pouch").card.rules.Get("equip").Get("container").Number("slots")==3,"stored flags and nested declaration survive save");
  var result=new{passed=true,assertions=checks,sourceCases=6,directory};File.WriteAllText(Path.Combine(directory,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}
