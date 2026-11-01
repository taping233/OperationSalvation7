using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;

class Program
{
    static int checks;
    static void Check(bool condition,string label){checks++;if(!condition)throw new InvalidOperationException(label);}
    static CardDef Card(string id,string name=null)=>new CardDef{id=id,name=name??id,type="法术",rarity="古朴",cost=1,desc="wood"};
    static string Sign(JObject body)
    {
        body.Remove("checksum");using(var hash=SHA256.Create())body["checksum"]=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(body.ToString(Formatting.None)))).Replace("-","").ToLowerInvariant();
        return body.ToString(Formatting.Indented);
    }
    static void CacheCases()
    {
        var source=new List<CardDef>{Card("base-a"),Card("base-b")};
        var custom=Card("base-a","override-a");
        CardLibrary.Init(()=>source);CardLibrary.CustomsLoader=()=>new[]{custom};CardLibrary.CustomsSaver=null;CardLibrary.ResetCustomsCache();
        var first=CardLibrary.All();
        Check(first.Count==2&&ReferenceEquals(first[0],custom),"override stays at original source index");
        Check(ReferenceEquals(first,CardLibrary.All()),"unchanged catalog reuses merged read-only projection");
        long before=GC.GetAllocatedBytesForCurrentThread();for(int i=0;i<1000;i++)CardLibrary.All();
        Check(GC.GetAllocatedBytesForCurrentThread()-before==0,"warmed repeated merge lookup allocates zero managed bytes");
        source[1]=Card("base-b","replacement-b");var replaced=CardLibrary.All();
        Check(!ReferenceEquals(first,replaced)&&replaced[1].name=="replacement-b"&&first[1].name=="base-b","same-length source replacement invalidates without rewriting old snapshots");
        source[0].id="base-other";
        Check(CardLibrary.All().Count==3&&CardLibrary.All()[2].id=="base-a","source ID mutation invalidates override positions");
        custom.id="custom-renamed";
        Check(CardLibrary.All().Last().id=="custom-renamed","custom ID mutation invalidates cached merge");
        var stable=CardLibrary.All();CardLibrary.CustomsSaver=_=>throw new IOException("injected catalog write failure");
        foreach(var action in new Action[]{()=>CardLibrary.Upsert(Card("new-failed")),()=>CardLibrary.Remove(custom.id),CardLibrary.ClearCustoms})
        {
            bool failed=false;try{action();}catch(IOException){failed=true;}
            Check(failed&&ReferenceEquals(stable,CardLibrary.All()),"failed custom mutation keeps current list and projection");
        }
        CardLibrary.CustomsSaver=null;CardLibrary.Upsert(Card("added"));
        Check(CardLibrary.FindById("added")!=null&&!ReferenceEquals(stable,CardLibrary.All()),"successful upsert invalidates and appends");
        CardLibrary.Remove("added");Check(CardLibrary.FindById("added")==null,"successful remove invalidates");
        CardLibrary.ClearCustoms();Check(ReferenceEquals(CardLibrary.All(),source),"empty customs return original live source");
        CardLibrary.CustomsLoader=null;CardLibrary.ResetCustomsCache();CardLibrary.Init(()=>CardDatabase.All);
    }
    static List<CardDef> Definitions()
    {
        var cards=Enumerable.Range(0,7).Select(i=>Card("archive-"+(char)('a'+i),"Archive "+(char)('A'+i))).ToList();
        cards[0].rules=RuleValue.Obj("version",1,"play",RuleValue.Arr(
            RuleValue.Obj("op","transform","into",cards[1].name),
            RuleValue.Obj("op","release","source","generated","key",cards[2].name),
            RuleValue.Obj("op","acquire","pool",RuleValue.Obj("kind",cards[3].name)),
            RuleValue.Obj("op","insertCards","ids",RuleValue.Arr(cards[4].id)),
            RuleValue.Obj("op","rewards","ids",RuleValue.Arr(cards[5].id))));
        cards[1].tokenOf=cards[6].id;cards[6].tokenOf=cards[0].id;
        cards.Add(Card("wood","Unreferenced schema and free-text collision"));return cards;
    }
    static void Export(string root)
    {
        CacheCases();var game=GameRuntime.I;game.NewRun(5,"wu");
        var definitions=Definitions();SaveSystem.SaveCustomCards(game.Saves,definitions);CardLibrary.ResetCustomsCache();
        game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{definitions[0].id}};
        game.SaveCurrent();Check(game.Saves.LastWriteSucceeded,"source fixture saved");
        string rng=game.Rng.SaveState(),disk=File.ReadAllText(SaveSystem.ProfilePath);
        var text=game.Saves.ExportSlotArchive(5);var body=JObject.Parse(text);var ids=body["values"]["cards"].Select(card=>(string)card["id"]).ToArray();
        Check(ids.SequenceEqual(definitions.Take(7).Select(card=>card.id)),"export closes IDs, three named forms, insert/rewards IDs and cyclic dependencies in source order");
        Check(!ids.Contains("wood"),"schema names and free text do not import unrelated custom cards");
        Check(game.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"export does not mutate RNG or persisted profile");
        File.WriteAllText(Path.Combine(root,"slot.json"),text);
        string initial=SaveJson.Stringify(game.State);
        var history=Card("removed-history");game.State.ownedCards.Add(new OwnedCard{uid="history",card=history});
        game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{history.id,"tt3-fireball"},taken=new List<int>{0}};
        game.SaveCurrent();
        Check(game.Saves.ExportSlotArchive(5).Length>0,"already received custom snapshot does not require deleted global definition");
        game.State.entrySupply=null;var receipt=game.CurrentNodeReceipt;
        receipt.eventCardId="cmtn7qttxqo4";receipt.eventProgress=new EventProgress{eventId=receipt.eventCardId,stage="restore",cardIds=new List<string>{history.id},drawn=new List<string>{history.id}};
        game.State.usedPocket.Add(new PocketStack{card=history.Clone(),count=1});game.SaveCurrent();
        Check(game.Saves.ExportSlotArchive(5).Length>0,"restore uses consumed snapshots rather than legacy ID arrays");
        receipt.eventProgress=new EventProgress{eventId=receipt.eventCardId,stage="recodeConfirm",cardIds=new List<string>{history.id},drawn=new List<string>{"tt3-fireball"},sources=new List<EventSource>{EventSource.Of(game.State.ownedCards.Last())}};
        game.SaveCurrent();Check(game.Saves.ExportSlotArchive(5).Length>0,"recode validates frozen targets rather than source IDs already held as snapshots");
        game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{"missing-pending"}};game.SaveCurrent();
        bool rejected=false;try{game.Saves.ExportSlotArchive(5);}catch(InvalidDataException){rejected=true;}
        Check(rejected,"missing unreceived definition refuses a misleading export");
        SaveJson.Populate(initial,game.State);game.SaveCurrent();
    }
    static void Import(string root,string mode)
    {
        var game=GameRuntime.I;game.NewRun(4,"wu");
        var existing=mode=="id-conflict"?Card("archive-a","Conflicting target A"):mode=="name-conflict"?Card("target-name","Archive B"):Card("target-only");
        SaveSystem.SaveCustomCards(game.Saves,new[]{existing});CardLibrary.ResetCustomsCache();
        game.Saves.Global.SetString("round3-sentinel","keep this global value");
        string text=File.ReadAllText(Path.Combine(root,"slot.json"));
        string disk=File.ReadAllText(SaveSystem.ProfilePath),other=SaveJson.Stringify(game.Saves.ReadSlot(4));
        if(mode!="import")
        {
            bool rejected=false;try{game.Saves.PreviewSlotArchive(text,2);}catch(InvalidDataException){rejected=true;}
            Check(rejected,"conflicting target definition or named binding rejected at preview");
            Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&SaveSystem.LoadCustomCards(game.Saves).Single().id==existing.id,"conflict keeps target profile and custom catalog intact");return;
        }
        var legacy=JObject.Parse(text);legacy["version"]=1;((JObject)legacy["values"]).Remove("cards");
        bool missingRejected=false;try{game.Saves.PreviewSlotArchive(Sign(legacy),3);}catch(InvalidDataException){missingRejected=true;}
        Check(missingRejected&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"old archive missing pending definitions refuses misleading recovery without writes");
        legacy["values"]["run"]["entrySupply"]["cardIds"][0]="tt3-fireball";
        Check(game.Saves.PreviewSlotArchive(Sign(legacy),3).AddedCustomCards==0,"existing native version1 archive with available definitions still previews");
        var incomplete=JObject.Parse(text);((JObject)incomplete["values"]).Remove("cards");
        bool incompleteRejected=false;try{game.Saves.PreviewSlotArchive(Sign(incomplete),3);}catch(InvalidDataException){incompleteRejected=true;}
        Check(incompleteRejected,"version2 requires its definition partition");
        var preview=game.Saves.PreviewSlotArchive(text,2);
        Check(preview.AddedCustomCards==7&&!preview.Overwrites,"new-profile preview reports referenced definitions and target slot");
        Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&CardLibrary.FindById("archive-a")==null,"preview never publishes archive definitions");
        var block=SaveSystem.ProfilePath+".writing";Directory.CreateDirectory(block);
        Check(!game.Saves.ImportSlotArchive(preview,true,out _)&&!game.Saves.InTransaction,"real import I/O failure rolls back transaction");
        Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&SaveSystem.LoadCustomCards(game.Saves).Single().id==existing.id&&CardLibrary.FindById("archive-a")==null,"failed import rolls back both slot and definitions, retaining cache");
        string marker=Path.Combine(Path.GetDirectoryName(block),"completed-fault-marker");
        Check(Path.GetFullPath(block).StartsWith(Path.GetFullPath(root),StringComparison.OrdinalIgnoreCase)&&Path.GetFullPath(marker).StartsWith(Path.GetFullPath(root),StringComparison.OrdinalIgnoreCase),"fault marker move remains in isolated test output");
        Directory.Move(block,marker);
        Check(game.Saves.ImportSlotArchive(preview,true,out var reason),"same preview retries successfully after I/O repair: "+reason);
        Check(game.Saves.Global.GetString("round3-sentinel")=="keep this global value"&&SaveJson.Stringify(game.Saves.ReadSlot(4))==other,"import preserves unrelated global settings and other slot");
        Check(SaveSystem.LoadCustomCards(game.Saves).Count==8&&CardLibrary.FindById("archive-g")!=null&&CardLibrary.FindById("wood")==null,"successful import reloads exact custom closure without unrelated source cards");
        Check(!game.Saves.ImportSlotArchive(preview,true,out _),"consumed preview cannot replay");
        Check(game.LoadRun(2),"imported slot loads in fresh target process");
        Check(game.GetEntrySupplyCards().Single().id=="archive-a","pending custom candidate survives target-profile load");
        Check(game.ClaimEntrySupply(0,out reason)&&game.State.ownedCards.Any(card=>card.card.id=="archive-a"),"imported custom candidate claims through formal transaction: "+reason);
    }
    static int Main(string[] args)
    {
        try
        {
            string mode=args[0],root=Path.GetFullPath(args[1]);Directory.CreateDirectory(root);
            string profile=Path.Combine(root,mode+"-profile");Directory.CreateDirectory(profile);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",profile);CardLibrary.Init(()=>CardDatabase.All);
            if(mode=="export")Export(root);else Import(root,mode);
            var result=new{passed=true,mode,assertions=checks,profile};
            File.WriteAllText(Path.Combine(root,mode+"-result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));return 0;
        }
        catch(Exception error){Console.WriteLine(error.ToString());return 2;}
    }
}
