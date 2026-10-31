using System;
using System.Linq;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
using Sdt.Core;
class CustomCatalogCheck
{
    static void Main(string[] args)
    {
        var source=JsonDocument.Parse(File.ReadAllText(args[0])).RootElement;
        var expected=source.GetProperty("baseline").EnumerateArray().Select(x=>x.GetString()).ToArray();
        var options=new JsonSerializerOptions{IncludeFields=true};string file=Path.GetFullPath(args[1]);
        Directory.CreateDirectory(Path.GetDirectoryName(file));
        CardLibrary.Init(()=>CardDatabase.All);
        CardLibrary.CustomsLoader=()=>File.Exists(file)?JsonSerializer.Deserialize<List<CardDef>>(File.ReadAllText(file),options):new List<CardDef>();
        CardLibrary.CustomsSaver=cards=>File.WriteAllText(file,JsonSerializer.Serialize(cards,options));
        CardLibrary.ResetCustomsCache();
        void Check(bool ok,string message){if(!ok)throw new Exception(message);Console.WriteLine("PASS "+message);}
        Check(CardLibrary.All().Select(c=>c.id).SequenceEqual(expected),"default order equals fresh source");
        int index=source.GetProperty("targetIndex").GetInt32();var edited=CardDatabase.All[index].Clone();edited.desc="source override example";
        CardLibrary.Upsert(edited);var all=CardLibrary.All();
        Check(all.Count==expected.Length&&all.Count(c=>c.id==edited.id)==1,"override preserves gallery count and unique stable ID");
        Check(all[index].desc==edited.desc&&CardLibrary.FindById(edited.id).desc==edited.desc,"same stable ID uses edited description at original index");
        Check(all.Select(c=>c.id).SequenceEqual(expected),"override does not reorder extraction pool");
        var added=edited.Clone();added.id="fidelity-only-new";added.name="source new example";added.desc="new example";CardLibrary.Upsert(added);all=CardLibrary.All();
        var expectedAdded=source.GetProperty("append").GetProperty("ids").EnumerateArray().Select(x=>x.GetString()).ToArray();
        Check(all.Count==expected.Length+1&&all.Last().id==added.id&&all.Select(c=>c.id).SequenceEqual(expectedAdded),"new stable ID appends exactly as source");
        CardLibrary.ResetCustomsCache();all=CardLibrary.All();
        Check(all.Select(c=>c.id).SequenceEqual(expectedAdded)&&all[index].desc==edited.desc,"serialized provider file reload retains source order and override");
        Check(all.Select(c=>c.id).Distinct().Count()==all.Count,"reload contains no duplicate stable ID");
    }
}
