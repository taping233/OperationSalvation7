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
 public static class Debug { public static void LogException(Exception e){Console.WriteLine("listener-error:"+e.Message);} }
 public sealed class TextAsset {public string text;}
 public static class Resources {public static T Load<T>(string name)where T:class=>new TextAsset{text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json"))} as T;}
}
namespace Sdt.Run { public sealed class AudioService {public static AudioService I {get;}=new AudioService();public void PlaySfx(string key){}public void PlayBgm(string key){} } }
class HubFeatureChecks {
 static int assertions, faults;
 static void Check(bool condition,string message){assertions++;if(!condition)throw new Exception(message);}
 static void Main(){
  string output=Path.GetFullPath("_planning/migration-1029/ui/features-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",output);
  CardLibrary.Init(()=>CardDatabase.All);
  var fixture=JObject.Parse(File.ReadAllText("_planning/migration-1029/ui/source-hub-vectors.json"));var game=GameRuntime.I;game.ResetSlot(1);
  foreach(var item in fixture["previews"]){
   var data=SaveJson.Read<BaseData>(item["base"]);SaveJson.Populate(SaveJson.Stringify(data),game.Base);
   var preset=SaveJson.Read<PreparationPreset>(item["preset"]);var actual=game.Base.PreviewPreparation(preset);var expected=item["result"];
   Check(actual.canStart==expected.Value<bool>("canStart"),"source preview eligibility "+preset.petId);
   Check(actual.capacity.used==expected["costs"].Value<int>("slotsUsed"),"source slots "+preset.petId);
   Check(actual.capacity.ordinarySlots==expected["costs"].Value<int>("ordinarySlots"),"source ordinary slots");
   Check(actual.capacity.resourceSlots==expected["costs"].Value<int>("resourceSlots"),"source resource slots");
   Check(actual.stashCards==expected["costs"].Value<int>("stashCards"),"source stash count");
   for(int i=0;i<actual.resolvedPicks.Count;i++){var got=actual.resolvedPicks[i];var wanted=expected["resolvedPicks"][i];Check(got.status==wanted.Value<string>("status")&&got.availableCount==wanted.Value<int>("availableCount")&&got.appliedCount==wanted.Value<int>("appliedCount"),"source resolved pick");}
  }
  foreach(var item in fixture["normalizers"]){var data=SaveJson.Read<BaseData>(item["input"]);Check(JToken.DeepEquals(JArray.FromObject(data.PreparationTracked()),item["result"]["tracked"]),"source tracked normalization");Check(JToken.DeepEquals(JArray.FromObject(data.PreparationPresets()),item["result"]["presets"]),"source preset normalization");}
  foreach(var item in fixture["pickVectors"]){var picks=SaveJson.Read<List<PreparationPick>>(item["input"]);Check(JToken.DeepEquals(JToken.FromObject((object)BaseData.NormalizePreparationPicks(picks)??JValue.CreateNull()),item["result"]),"source pick normalization");}
  foreach(var item in fixture["corruptStories"]){var data=new BaseData{story=(JObject)item["input"]};Check(data.TryReadLastLamp(out _,out _)==item.Value<bool>("ok"),"source corrupt story rejection");}
  game.ResetSlot(1);
  void Fault(Action action){string before=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");action();Check(File.ReadAllText(SaveSystem.ProfilePath)==before,"failure preserves profile");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+(faults++));}
  Check(game.Base.TrySetTrackedGoals(new[]{" a ","a","b"},out _)&&game.Base.goals.tracked.SequenceEqual(new[]{"a","b"}),"goals trim dedupe");
  Check(!game.Base.TrySetTrackedGoals(new[]{"a","b","c","d"},out _)&&game.Base.goals.tracked.Count==2,"goal limit rollback");
  var valid=new PreparationPreset{id="preset-1",name="实装预设",petId="dog",characterId=CharacterTable.All[0].id};
  Check(game.Base.TrySavePreparationPreset(valid,out _),"preset save");
  Fault(()=>Check(!game.Base.TrySavePreparationPreset(new PreparationPreset{id="preset-1",name="失败改名"},out _),"preset file failure"));
  Check(game.Base.PreparationPresets()[0].name==valid.name,"preset draft rollback");
  foreach(var vector in fixture["storyVectors"]){
   game.Base.story=(JObject)vector["before"]["story"].DeepClone();var input=vector["input"];string run=input.Value<string>("runId"),evt=input.Value<string>("eventInstanceId"),choice=input.Value<string>("choiceId");int segment=input.Value<int>("segmentId");
   var inspected=game.Base.InspectLastLamp(run,evt);Check(inspected.kind==vector["inspected"]["value"].Value<string>("kind")&&inspected.segmentId==segment,"source story inspection");
   Check(game.Base.TryRecordLastLamp(run,evt,segment,choice,out _),"story commit");Check(JToken.DeepEquals(game.Base.story,vector["prepared"]["value"]["afterState"]["story"]),"source story afterState");
   Check(game.Base.InspectLastLamp(run,evt).kind=="recover","story same event recovers");Check(game.Base.InspectLastLamp(run,evt+"0").kind=="already-read-this-run","story once per run");
   Check(game.Base.TryRecordLastLamp(run,evt,segment,choice,out _),"story retry idempotent");
  }
  game.Base.story=JObject.Parse("{\"flags\":{},\"outcomes\":{}}");game.Base.Save();
  Fault(()=>Check(!game.Base.TryRecordLastLamp("failed-run",BaseData.LastLampEventId("failed-run",0,1),1,"continue",out _),"story save failure"));Check(game.Base.TryReadLastLamp(out var empty,out _)&&empty.stage==0,"story failure no progress");
  var pack=CardLibrary.FindById("tt-econpack");var filler=CardDatabase.All.First(card=>card.rarity=="古朴"&&card.type=="资源");
  foreach(var vector in fixture["packVectors"]){int room=vector.Value<int>("room");game.Base.stash=new List<StashStack>{new StashStack{card=pack,count=2},new StashStack{card=filler,count=game.Base.StashCap-room-2}};game.Base.supplyPackOpening=null;game.Base.Save();int count=game.Base.StashUsed;
   bool opened=game.Base.TryOpenSupplyPack(out var cards,out _);Check(opened==vector["result"].Value<bool>("ok"),"source pack capacity boundary");Check(game.Base.StashUsed==count+(opened?4:0),"pack slot accounting");if(opened)Check(cards.Count==5&&cards.All(CardLibrary.IsRandomObtainable),"pack random eligible five");
  }
  var frozenCard=CardDatabase.All.First(CardLibrary.IsRandomObtainable);
  game.Base.stash=new List<StashStack>{new StashStack{card=pack,count=1}};game.Base.supplyPackOpening=new SupplyPackOpening{cardIds=Enumerable.Repeat(frozenCard.id,5).ToList()};game.Base.Save();
  Fault(()=>Check(!game.Base.TryOpenSupplyPack(out _,out _),"pack save failure"));Check(game.Base.stash[0].count==1&&game.Base.supplyPackOpening.cardIds.All(id=>id==frozenCard.id),"pack candidates and item retained");Check(game.Base.TryOpenSupplyPack(out var frozen,out _)&&frozen.All(card=>card.id==frozenCard.id),"pack retries same candidates");
  var saved=new SaveSystem();var restored=BaseData.Use(saved,1);Check(restored.goals.presets["preset-1"].name==valid.name&&restored.goals.tracked.SequenceEqual(new[]{"a","b"}),"restart restores preparation");
  game.ResetSlot(2);var deployCard=CardDatabase.All.First(card=>card.type=="武术"&&card.rarity=="古朴");game.Base.stash=new List<StashStack>{new StashStack{card=deployCard,count=3}};game.Base.pets["robot"]=new PetProgress();game.Base.Save();
  var deployment=new PreparationPreset{id="preset-1",name="出征",characterId=CharacterTable.All[0].id,petId="robot",picks=new List<PreparationPick>{new PreparationPick{card=new PreparationCardRef{cardId=deployCard.id},count=2}}};Check(game.Base.TrySavePreparationPreset(deployment,out _),"save deployment fixture");
  Fault(()=>Check(!game.Base.TryStartPreparation("preset-1",out _),"deployment save failure"));Check(!game.State.runActive&&game.Base.petSel=="dog"&&game.Base.stash[0].count==3,"deployment failure preserves pet/stash/run");
  Check(game.Base.TryStartPreparation("preset-1",out var deployReason),"deployment atomic commit: "+deployReason);Check(game.State.runActive&&game.State.characterId==deployment.characterId&&game.Base.petSel=="robot"&&game.Base.stash[0].count==1,"deployment applies saved identity and picks");Check(game.State.ownedCards.Count(card=>card.card.id==CardLibrary.SHA.id)==7,"preset robot starter seven");
  var result=new{passed=true,assertions,realFileFailures=faults,sourcePreviews=fixture["previews"].Count(),sourceStory=fixture["storyVectors"].Count(),sourcePack=fixture["packVectors"].Count()};File.WriteAllText(Path.Combine(output,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}
