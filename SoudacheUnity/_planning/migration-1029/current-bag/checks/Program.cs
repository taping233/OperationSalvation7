using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
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
 static int checks;static readonly List<string> passed=new List<string>();
 static void Assert(bool condition,string label){checks++;if(!condition)throw new Exception(label);passed.Add(label);}
 static OwnedCard Owned(string uid,CardDef card,bool stored=false)=>new OwnedCard{uid=uid,card=card,stored=stored};
 static void Main(){
  string directory=Path.GetFullPath("_planning/migration-1029/current-bag/checks/profile-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(directory);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",directory);
  var g=GameRuntime.I;g.NewRun(1,CharacterTable.All[0].id);g.State.entrySupply=null;g.State.battleActive=false;g.State.Phase="idle";g.State.inventory.Clear();
  Assert(BaseData.IsSha(CardLibrary.SHA)&&!BaseData.IsSha(new CardDef{id="different-id",name="初始攻击"}),"starter protection uses current identity and excludes unrelated same-name card");
  g.State.ownedCards=new List<OwnedCard>{Owned("starter",CardLibrary.SHA)};
  Assert(!CardContainerCommands.TryMoveSafe(g,new[]{"starter"},true,out _)&&!CardContainerCommands.TryDiscard(g,"starter",out _),"current starter cannot enter safety or be discarded");
  Assert(g.State.ownedCards.Count==1&&g.State.ownedCards[0].uid=="starter"&&g.State.ownedCards[0].safe!=true,"starter rejection retains original owned card");
  var box=new CardDef{id="tt2-pearlbox",name="珍珠盒",type="装备",rules=RuleValue.Obj("equip",RuleValue.Obj("container",RuleValue.Obj("slots",9,"accepts","资源")))};
  var a=new CardDef{id="r",variantKey="a",name="同名资源",type="资源",cost=1};var b=a.Clone();b.variantKey="b";b.cost=2;
  g.Base.bagUp=10-GameRules.BagSize;g.State.ownedCards=new List<OwnedCard>{Owned("a1",a),Owned("a2",a),Owned("b1",b),Owned("b2",b)};
  var stacks=CardContainerCommands.ZoneStacks(g.State.ownedCards,false);Assert(stacks.Count==2&&stacks.All(s=>s.count==2),"same-name variants retain two bag stacks");
  g.Base.bagUp=1-GameRules.BagSize;g.State.ownedCards=new List<OwnedCard>{Owned("a1",a),Owned("a2",a)};
  Assert(CardContainerCommands.CanReceive(g,a),"same variant merges into its partial stack");Assert(!CardContainerCommands.CanReceive(g,b),"different variant cannot borrow same-name stack capacity");
  g.Base.bagUp=10-GameRules.BagSize;g.State.ownedCards=new List<OwnedCard>{Owned("box",box),Owned("a1",a,true),Owned("b1",b,true),Owned("b2",b,true)};
  Assert(CardContainerCommands.TryTransferStack(g,"pearl",true,a.name,out var reason,new[]{"a1"}),"specific stored UID can be taken: "+reason);
  Assert(!g.State.ownedCards.First(o=>o.uid=="a1").stored&&g.State.ownedCards.Where(o=>o.uid.StartsWith("b")).All(o=>o.uid=="box"||o.stored),"taking first variant leaves same-name other variant stored");
  g.State.ownedCards=new List<OwnedCard>{Owned("box",box),Owned("a1",a),Owned("b1",b)};
  Assert(!CardContainerCommands.TryTransferStack(g,"pearl",false,a.name,out _,new[]{"a1","b1"}),"mixed variant UID request is rejected");Assert(!g.State.ownedCards.First(o=>o.uid=="a1").stored&&!g.State.ownedCards.First(o=>o.uid=="b1").stored,"rejected mixed request preserves both originals");
  g.State.ownedCards=new List<OwnedCard>{Owned("box",box)};g.State.ownedCards.AddRange(Enumerable.Range(0,6).Select(i=>Owned("a"+i,a)));
  Assert(CardContainerCommands.TryTransferStack(g,"pearl",false,a.name,out _,new[]{"a3","a4","a5"}),"precise second split stack can be stored");Assert(g.State.ownedCards.Where(o=>o.stored).Select(o=>o.uid).SequenceEqual(new[]{"a3","a4","a5"}),"second split stack uses its exact three UIDs");
  Assert(!CardContainerCommands.TryTransferStack(g,"pearl",true,a.name,out _,new[]{"a0"}),"stale UID outside container is rejected");
  g.SaveCurrent();string disk=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
  Assert(!CardContainerCommands.TryTransferStack(g,"pearl",true,a.name,out var failure,new[]{"a3","a4","a5"})&&!string.IsNullOrEmpty(failure),"failed take reports failed persistence");
  Assert(g.State.ownedCards.Where(o=>o.stored).Select(o=>o.uid).SequenceEqual(new[]{"a3","a4","a5"})&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"failed take restores exact source inventory and prior saved bytes");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-evidence");
  Assert(CardContainerCommands.TryTransferStack(g,"pearl",true,a.name,out _,new[]{"a3","a4","a5"}),"same observed UID selection succeeds after failure");Assert(g.State.ownedCards.Count(o=>o.card.id=="r")==6&&g.State.ownedCards.All(o=>!o.stored),"retry loses and duplicates no cards");
  g.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="safe-a",card=a,safe=true},new OwnedCard{uid="safe-b",card=b,safe=true}};
  var rescue=CardContainerCommands.RescueCards(g);Assert(rescue.Count==2&&rescue.Select(s=>s.variantKey).SequenceEqual(new[]{"a","b"}),"rescue projection retains variant snapshots");
  g.State.ownedCards=new List<OwnedCard>{Owned("box",box),Owned("last",b,true)};
  Assert(CardContainerCommands.TryTransferStack(g,"pearl",true,b.name,out _,new[]{"last"}),"last stored variant card can be taken");
  var lastRead=new SaveSystem().ReadSlot(1);Assert(lastRead.ownedCards.Count(o=>o.uid=="last")==1&&!lastRead.ownedCards.First(o=>o.uid=="last").stored&&lastRead.ownedCards.First(o=>o.uid=="last").card.variantKey=="b","last card reread retains exact UID, variant and destination");
  g.Base.stash.Clear();g.Base.pocket.Clear();
  g.Base.DepositCards(new[]{new StashStack{card=a,count=1,stackKey="stable-a",variantKey="a"},new StashStack{card=b,count=1,stackKey="stable-b",variantKey="b"}});
  g.Base.DepositCards(new[]{new StashStack{card=a,count=2,variantKey="a"}});
  Assert(g.Base.stash.Count==2&&g.Base.stash.First(s=>s.variantKey=="a").count==3&&g.Base.stash.First(s=>s.variantKey=="b").count==1,"deposit merges matching ID and variant while retaining other variant");
  Assert(g.Base.stash.First(s=>s.variantKey=="a").stackKey=="stable-a"&&!ReferenceEquals(g.Base.stash.First(s=>s.variantKey=="a").card,a),"deposit retains stable key and owns a card snapshot");
  var other=a.Clone();other.id="different-id";g.Base.DepositCards(new[]{new StashStack{card=other,count=1,variantKey="a"}});Assert(g.Base.stash.Count==3,"same display name with different ID remains separate on deposit");
  var baseRead=BaseData.Use(new SaveSystem(),1);Assert(baseRead.stash.Count==3&&baseRead.stash.First(s=>s.stackKey=="stable-b").card.variantKey=="b","deposited variant and explicit stable key survive reread");
  g.Base.DepositCards(new[]{new StashStack{card=CardLibrary.SHA,count=1},new StashStack{card=new CardDef{id="class",name="职业",rarity="职业"},count=1}},true);Assert(g.Base.pocket.Count==0,"source starter and professional exclusions hold for base pocket");
  string depositDisk=File.ReadAllText(SaveSystem.ProfilePath),depositBefore=SaveJson.Stringify(g.Base.stash);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");bool depositFailed=false;
  try{g.Base.DepositCards(new[]{new StashStack{card=b,count=4,variantKey="b"}});}catch(IOException){depositFailed=true;}
  Assert(depositFailed&&SaveJson.Stringify(g.Base.stash)==depositBefore&&File.ReadAllText(SaveSystem.ProfilePath)==depositDisk,"failed standalone deposit restores exact stash and previous saved bytes");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".deposit-fault-evidence");
  var result=new{passed=true,assertions=checks,cases=passed};File.WriteAllText("_planning/migration-1029/current-bag/domain-checks.json",JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}
