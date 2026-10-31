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
class HubParityChecks {
 static int assertions;
 static void Check(bool ok,string message){assertions++;if(!ok)throw new Exception(message);}
 static void Main(){
  string output=Path.GetFullPath("_planning/parity-1031/hub-check-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",output);
  var vectors=JObject.Parse(File.ReadAllText("_planning/parity-1031/hub-source-vectors.json"));var game=GameRuntime.I;
  CardLibrary.Init(()=>CardDatabase.All);game.ResetSlot(1);
  var keyMaterial=CardDatabase.All.First(card=>BaseData.MaterialInfo(card)?.kind=="keys").Clone();var materialInfo=BaseData.MaterialInfo(keyMaterial);
  keyMaterial.name="重命名的结构材料";keyMaterial.desc="钥匙 ×999";game.Base.keys=3;game.Base.stash=new List<StashStack>{new StashStack{card=keyMaterial,count=2}};
  Check(game.Base.KeyCount==3+materialInfo.amount*2,"key HUD uses structured amount and ignores display name/description");game.Base.keys=0;
  foreach(var row in vectors["conversions"]){
   var input=row["input"];var card=input["card"].ToObject<CardDef>();var data=input["baseSnapshot"];game.Base.characters=data["characters"].ToObject<Dictionary<string,ClassProgress>>();game.Base.collection=data["collection"].ToObject<Dictionary<string,CollectionEntry>>();
   game.Base.collectionProtection=new Dictionary<string,bool>();if(game.Base.IsCollected(card))game.Base.collectionProtection[card.id]=(bool)data["collection"][card.id]["protected"];
   var actual=game.Meta.PreviewCollectionConversion(card,(int)input["availableCount"],(int)input["count"]);var expected=row["expected"];
   foreach(string field in new[]{"canConvert","maxCount","actualXp","overflowXp","beforeLevel","afterLevel"})Check(JToken.DeepEquals(JToken.FromObject(actual)[field],expected[field]),"source conversion "+field+" "+input);
  }
  foreach(var row in vectors["prices"])Check(BaseData.StashSalePrice(new CardDef{rarity=(string)row["rarity"],value=37})==(int)row["expected"],"source stash price "+row["rarity"]);
  var cards=vectors["cards"].ToObject<List<CardDef>>();CardLibrary.Init(()=>cards);
  foreach(var row in vectors["starters"]){var data=BaseData.Def();var rng=new Rng((int)row["seed"]);data.SeedStarterStash(rng);Check(data.stash.Select(s=>s.card.id).SequenceEqual(row["ids"].Values<string>()),"source starter IDs seed "+row["seed"]);Check(rng.Random("card","reward")==row.Value<double>("nextReward")&&rng.Random()==row.Value<double>("nextGameplay"),"source starter RNG seed "+row["seed"]);Check(data.stash.All(s=>!cards.Any(c=>ReferenceEquals(c,s.card))),"starter snapshots cloned");}
  CardLibrary.Init(()=>CardDatabase.All);game.ResetSlot(1);
  var protectedClass=CardDatabase.All.First(c=>c.cls=="侠客"&&c.rarity=="职业").Clone();game.Base.stash=new List<StashStack>{new StashStack{card=protectedClass,count=2}};game.Base.collection.Clear();game.Base.collectionProtection.Clear();game.Base.Save();
  string beforeProtection=SaveJson.Stringify(game.Base);Check(!game.Base.TrySetProtection(protectedClass,true,out _),"unregistered class protection cannot bypass conversion");Check(SaveJson.Stringify(game.Base)==beforeProtection,"rejected protection preserves stock, gallery and XP");
  var native=CardDatabase.All.First(c=>c.type=="武术"&&c.rarity=="古朴").Clone();var other=native.Clone();other.variantKey="alternate";
  game.Base.stash=new List<StashStack>{new StashStack{card=native,count=2},new StashStack{card=other,count=3}};game.Base.Save();
  string key=GameRuntime.DepartureStackKey(game.Base.stash[1]);int coins=game.Base.coins;
  Check(game.TryPersistMutation(()=>{var sale=game.Base.SellStashCards(other.name,1,key);if(!sale.ok)throw new Exception(sale.msg);},out var why),"variant sale "+why);
  Check(game.Base.stash[0].count==2&&game.Base.stash[1].count==2&&game.Base.coins==coins+BaseData.StashSalePrice(other),"variant sale preserves neighboring snapshot");
  game.Base.AppendRewardCards(new[]{native});Check(game.Base.stash[0].count==3&&game.Base.stash[1].count==2,"base reward does not merge into other variant");
  var third=native.Clone();third.variantKey="third";game.Base.AppendRewardCards(new[]{third});Check(game.Base.stash.Count==3&&!ReferenceEquals(game.Base.stash[2].card,third),"new reward variant is a detached snapshot");game.Base.Save();
  var profile=File.ReadAllText(SaveSystem.ProfilePath);string state=SaveJson.Stringify(game.Base);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
  Check(!game.TryPersistMutation(()=>{game.Base.SellStashCards(other.name,1,key);},out _),"variant sale fails under file lock");Check(File.ReadAllText(SaveSystem.ProfilePath)==profile&&SaveJson.Stringify(game.Base)==state,"failed variant sale rolls back");Directory.Move(SaveSystem.ProfilePath+".writing",Path.Combine(output,"fault-marker"));
  var global=game.Saves.Global;global.SetString("parity-preference","before");long revision=global.Revision;game.Saves.BeginTransaction();global.SetString("parity-preference","draft");Check(global.Revision>revision&&global.GetString("parity-preference")=="draft","settings revision follows draft");revision=global.Revision;game.Saves.CancelTransaction();Check(global.Revision>revision&&global.GetString("parity-preference")=="before","settings revision follows rollback");
  var token=new JObject{{"nested",new JObject{{"value",1}}}};global.SetJson("parity-object",token);var detached=global.GetJson("parity-object");detached["nested"]["value"]=99;Check((int)global.GetJson("parity-object")["nested"]["value"]==1,"GetJson isolation preserved");
  var result=new{passed=true,assertions,sourceConversions=vectors["conversions"].Count(),sourceStarters=vectors["starters"].Count(),realFileFailure=true,scope="Core/Run production sources with Unity resource/audio stubs; no native UI or physical-input claim"};File.WriteAllText(Path.Combine(output,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}
