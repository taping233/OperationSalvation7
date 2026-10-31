using System;using System.IO;using System.Linq;using System.Collections.Generic;using System.Text;using System.Security.Cryptography;using Newtonsoft.Json;using Newtonsoft.Json.Linq;using Sdt.Run;
class ArchiveCheck
{
 static List<string> tests=new List<string>();static string root;static SaveSystem saves;
 static void Check(bool ok,string test){if(!ok)throw new Exception(test);tests.Add(test);}
 static string Hash(JObject o){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(o.ToString(Formatting.None)))).Replace("-","").ToLowerInvariant();}
 static string Tamper(string text,Action<JObject> edit){var o=JObject.Parse(text);o.Remove("checksum");edit(o);o["checksum"]=Hash(o);return o.ToString();}
 static string Raw()=>File.ReadAllText(SaveSystem.ProfilePath);
 static void Reject(string text,int target,string name){string before=Raw();bool rejected=false;try{saves.PreviewSlotArchive(text,target);}catch{rejected=true;}Check(rejected&&Raw()==before,name);}
 static void Main(string[] args)
 {
  root=Path.GetFullPath(args[1]);Directory.CreateDirectory(root);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",root);saves=new SaveSystem();var template=JObject.Parse(File.ReadAllText(args[0]));
  for(int slot=1;slot<=5;slot++){var run=(JObject)template.DeepClone();run["slot"]=slot;run["coins"]=slot*10;saves.WriteSlot(slot,SaveJson.Read<RunSaveData>(run));var baseData=JObject.Parse(File.ReadAllText(Path.Combine(Path.GetDirectoryName(args[0]),"native-base-fixture.json")));baseData["coins"]=slot*100;saves.Global.SetJson(BaseData.SlotKeyPrefix+slot,baseData);}
  var historic=saves.ReadSlot(3);historic.seed=123;saves.PutSettlement(3,new SettlementRecord{identity="3:123",reason="dead",status="complete",run=historic,death=new DeathResult()});
  saves.Global.SetString("archive-check-global","settings unchanged");string initial=Raw(),archive=saves.ExportSlotArchive(1);var plan=saves.PreviewSlotArchive(archive,4);
  Check(plan.SourceSlot==1&&plan.Slot==4&&plan.Overwrites&&plan.HasRun,"preview source/target without writes");Check(Raw()==initial,"preview preserves bytes");
  Check(!saves.ImportSlotArchive(plan,false,out _)&&Raw()==initial,"explicit confirmation required");Check(saves.ImportSlotArchive(plan,true,out var error),"cross-slot import: "+error);
  Check(saves.ReadSlot(4).slot==4&&saves.ReadSlot(4).coins==10,"run identity rebound");
  var before=JObject.Parse(initial);var after=JObject.Parse(Raw());foreach(int slot in new[]{1,2,3,5})Check(JToken.DeepEquals(before["runs"][slot.ToString()],after["runs"][slot.ToString()])&&JToken.DeepEquals(before["global"][BaseData.SlotKeyPrefix+slot],after["global"][BaseData.SlotKeyPrefix+slot])&&JToken.DeepEquals(before["settlements"][slot.ToString()],after["settlements"][slot.ToString()]),"slot "+slot+" untouched");
  Check(saves.Global.GetString("archive-check-global")=="settings unchanged","global settings preserved");Check(!saves.ImportSlotArchive(plan,true,out _),"preview consumed once");
  Reject(archive.Replace("\"checksum\": \"","\"checksum\": \"x"),2,"checksum failure unchanged");Reject(Tamper(archive,o=>o["values"]["run"]["hp"]=-2),2,"invalid run uses shared validation");Reject(Tamper(archive,o=>o["values"]["base"]["stash"]=new JArray(new JObject{{"count",1}})),2,"invalid base rejected");Reject(Tamper(archive,o=>o["format"]="sdt-slot-archive"),2,"web archive rejected");
  var stale=saves.PreviewSlotArchive(archive,2);var update=saves.ReadSlot(2);update.coins++;saves.WriteSlot(2,update);string stable=Raw();Check(!saves.ImportSlotArchive(stale,true,out _)&&Raw()==stable,"stale preview cannot replace newer save");
  var retry=saves.PreviewSlotArchive(archive,2);string lockedBefore=Raw();using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Check(!saves.ImportSlotArchive(retry,true,out _)&&!saves.InTransaction&&Raw()==lockedBefore,"locked file failure preserves disk and live transaction state");Check(saves.ImportSlotArchive(retry,true,out _)&&saves.ReadSlot(2).coins==10,"retry applies once");
  var outer=saves.PreviewSlotArchive(archive,5);saves.BeginTransaction();Check(!saves.ImportSlotArchive(outer,true,out _)&&saves.InTransaction,"archive rejection does not cancel caller transaction");saves.CancelTransaction();
  var run3=saves.ReadSlot(3);saves.PutSettlement(3,new SettlementRecord{identity="3:"+run3.seed,reason="extract",status="sorting",run=run3,left=new List<StashStack>{new StashStack{card=run3.ownedCards[0].card,count=1}},extraction=new ExtractResult()});saves.RemoveRun(3);
  string pending=saves.ExportSlotArchive(3);
  Reject(Tamper(pending,o=>o["values"]["settlement"]["keptPocket"]=new JArray(JValue.CreateNull())),4,"null kept pocket stack rejected");
  Reject(Tamper(pending,o=>o["values"]["settlement"]["receipt"]=JObject.FromObject(new SettlementReceipt{losses=null})),4,"null receipt losses rejected");
  Reject(Tamper(pending,o=>o["values"]["settlement"]["lostPocketCount"]=1),4,"inconsistent pocket probability counts rejected");
  Reject(Tamper(pending,o=>o["values"]["settlement"]["left"]=new JArray(JValue.CreateNull())),4,"null extraction left stack rejected");
  var pendingPlan=saves.PreviewSlotArchive(pending,5);Check(pendingPlan.PendingExtraction&&!pendingPlan.HasRun,"pending extraction preview");Check(saves.ImportSlotArchive(pendingPlan,true,out error),"pending extraction cross-slot import: "+error);Check(saves.ReadSlot(5).slot==5&&saves.GetSettlement(5).identity=="5:"+run3.seed&&saves.GetSettlement(5).run.slot==5,"pending extraction identity and read path restored");
  var r=saves.ReadSlot(1);r.coins=111;saves.WriteSlot(1,r);r.coins=222;saves.WriteSlot(1,r);var previous=saves.PreviewPreviousSlotArchive(1);Check(saves.ImportSlotArchive(previous,true,out error)&&saves.ReadSlot(1).coins==111,"previous profile restores target partition only");
  var corrupt=JObject.Parse(Raw());corrupt["runs"]["2"]["hp"]=-8;File.WriteAllText(SaveSystem.ProfilePath,corrupt.ToString());saves=new SaveSystem();Check(saves.ReadSlot(2)==null&&saves.HasSlotReadError(2),"invalid target read diagnosed");var heal=saves.PreviewSlotArchive(archive,2);Check(saves.ImportSlotArchive(heal,true,out error)&&!saves.HasSlotReadError(2)&&saves.ReadSlot(2).coins==10,"valid import repairs only invalid target");
  var cached=new SaveSystem();cached.ReadSlot(1);var external=new SaveSystem();external.Global.SetString("external-write","must survive");var externalRun=external.ReadSlot(3);if(externalRun!=null){externalRun.coins+=17;external.WriteSlot(3,externalRun);}string externalBytes=Raw();bool staleBlocked=false;try{cached.PreviewSlotArchive(archive,4);}catch{staleBlocked=true;}Check(staleBlocked&&Raw()==externalBytes,"stale instance refuses preview without overwriting other slots or global settings");saves=external;
  string valid=Raw();File.WriteAllText(SaveSystem.ProfilePath,"broken original profile");var bad=new SaveSystem();bool blocked=false;try{bad.PreviewSlotArchive(archive,2);}catch{blocked=true;}Check(blocked&&File.ReadAllText(SaveSystem.ProfilePath)=="broken original profile","whole-profile error refuses partial replacement");File.WriteAllText(SaveSystem.ProfilePath,valid);
  File.WriteAllText(Path.Combine(root,"result.json"),JsonConvert.SerializeObject(new{passed=true,tests,scope="Real production SaveSystem/validation/archive DLL under .NET; isolated native run snapshot, real file writes/locks; not Unity UI or LoadRun."},Formatting.Indented));Console.WriteLine("passed "+tests.Count);
 }
}
