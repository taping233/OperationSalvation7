using System;using System.IO;using System.Linq;using System.Collections.Generic;using Newtonsoft.Json;using Newtonsoft.Json.Linq;using Sdt.Core;using Sdt.Run;
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
  string directory=Path.GetFullPath("_planning/migration-1029/current-integration/data-check/profile-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"));Directory.CreateDirectory(directory);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",directory);
  CardLibrary.Init(()=>CardDatabase.All);var runtime=GameRuntime.I;
  Check(runtime.ActiveSlot==null,"title has no active slot");
  Check(runtime.Base.TrySavePhotoNote("tt3-fireball","title note",out var error),"global photo note can save at title: "+error);
  Check((string)new SaveSystem().Global.GetJson("sdt-card-photo-notes-v1")["tt3-fireball"]=="title note","title note rereads from actual file");
  string bytes=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
  Check(!runtime.Base.TrySavePhotoNote("tt3-fireball","failed replacement",out error),"photo note reports blocked atomic write");
  Check(runtime.Base.PhotoNote("tt3-fireball")=="title note"&&File.ReadAllText(SaveSystem.ProfilePath)==bytes,"failed note restores memory and leaves actual file unchanged");
  Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-evidence");
  Check(runtime.Base.TrySavePhotoNote("tt3-fireball","retried note",out error),"photo note retry succeeds");
  Check(!runtime.Base.TrySavePhotoNote("missing-card", "invalid",out error),"invalid card cannot create a global note");
  runtime.NewRun(2,CharacterTable.All[0].id);runtime.State.Phase="idle";runtime.SaveCurrent();
  var valid=new SaveSystem().ReadSlot(2);Check(valid!=null,"valid run fixture is readable");
  var profile=JObject.Parse(File.ReadAllText(SaveSystem.ProfilePath));profile["runs"]["1"]=new JObject{{"format","invalid"},{"retained","corrupt slot original"}};profile["global"]["sdt-base-v1-slot3"]="invalid base payload";
  File.WriteAllText(SaveSystem.ProfilePath,profile.ToString());var saves=new SaveSystem();
  Check(saves.ReadSlot(1)==null&&saves.HasSlotReadError(1)&&!saves.HasReadError,"malformed slot reports an isolated read error");
  Check(saves.ReadSlot(2)!=null&&!saves.HasSlotReadError(2),"a malformed slot does not block reading a good slot");
  var goodBase=BaseData.Use(saves,2);goodBase.coins++;goodBase.Save();
  Check(JToken.DeepEquals(JObject.Parse(File.ReadAllText(SaveSystem.ProfilePath))["runs"]["1"],profile["runs"]["1"]),"saving another slot preserves malformed slot bytes as JSON tokens");
  valid.slot=1;Check(!saves.WriteSlot(1,valid),"malformed observed slot cannot be overwritten by a normal write");
  saves.BeginTransaction();saves.RemoveRun(1);saves.CancelTransaction();Check(saves.HasSlotReadError(1),"cancelled removal restores isolated read protection");
  Check(saves.HasRun(1),"cancelled removal retains malformed source record");
  string baseKey=BaseData.SlotKeyPrefix+3;profile=JObject.Parse(File.ReadAllText(SaveSystem.ProfilePath));profile["global"][baseKey]="invalid base payload";File.WriteAllText(SaveSystem.ProfilePath,profile.ToString());saves=new SaveSystem();
  BaseData.Peek(saves,3);Check(saves.HasSlotReadError(3)&&!saves.HasReadError,"malformed base data reports its own slot");
  Check(saves.ReadSlot(2)!=null&&BaseData.Use(saves,2)!=null,"base corruption leaves another slot usable");
  string fatal=Path.Combine(directory,"fatal");Directory.CreateDirectory(fatal);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",fatal);File.WriteAllText(SaveSystem.ProfilePath,"{malformed entire profile");saves=new SaveSystem();
  saves.ReadSlot(2);Check(saves.HasReadError&&saves.HasSlotReadError(2),"malformed profile blocks all affected slots");
  bool refused=false;try{saves.Global.SetString("new","value");}catch(IOException){refused=true;}
  Check(refused&&File.ReadAllText(SaveSystem.ProfilePath)=="{malformed entire profile","fatal profile remains intact and refuses writes");
  File.WriteAllText("_planning/migration-1029/current-integration/data-check/results.json",JsonConvert.SerializeObject(new{passed=true,count=Checks.Count,checks=Checks},Formatting.Indented));
  Console.WriteLine("Actual run/save domain checks: "+Checks.Count+" passed");
 }
}
