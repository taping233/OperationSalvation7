using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Sdt.Res;
using Sdt.UI.Kit;
class IconChecks {
 static int assertions;
 static void Check(bool value,string message){assertions++;if(!value)throw new Exception(message);}
 static void Main(){
  using var fixtures=JsonDocument.Parse(File.ReadAllText("_planning/migration-1029/ui/icon-source-vectors.json"));
  using var receipt=JsonDocument.Parse(File.ReadAllText("_planning/migration-1029/ui/icons-receipt.json"));
  foreach(var source in fixtures.RootElement.GetProperty("sources").EnumerateObject()){
   Check(CurrentUiIcons.Paths.ContainsKey(source.Name),"source registered "+source.Name);
   var record=receipt.RootElement.GetProperty("files").EnumerateArray().Single(item=>item.GetProperty("key").GetString()==source.Name);
   Check(record.GetProperty("source").GetString()==source.Value.GetString(),"source path precedence "+source.Name);
  }
  int vectors=0;
  foreach(var vector in fixtures.RootElement.GetProperty("vectors").EnumerateArray()){
   var document=InlineIconParser.Parse(vector.GetProperty("input").GetString(),20,true,_=>4);
   Check(document.icons.Select(icon=>icon.key).SequenceEqual(vector.GetProperty("keys").EnumerateArray().Select(key=>key.GetString())),"source icon expansion "+vector.GetProperty("input").GetString());
   foreach(var icon in document.icons){Check(document.text[icon.characterIndex]=='\u00a0',"raw generator index");Check(icon.characterCount==4&&document.text.Substring(icon.characterIndex,4).All(c=>c=='\u00a0'),"complete reserved advance");Check(icon.size>=22,"image extent independent from individual advance");}
   vectors++;
  }
  var rich=InlineIconParser.Parse("A<color=red>[[icon:archive]]</color>B",26,true,_=>5);
  Check(rich.icons[0].characterIndex==12&&rich.icons[0].size==29&&rich.icons[0].color=="red","native rich-tag index and dynamic font size");
  var nested=InlineIconParser.Parse("<size=32><color=#ff0000>[[icon:cards]]</color></size> [[icon:coin]]",20,true,_=>3);
  Check(nested.icons[0].size==36&&nested.icons[1].size==22&&nested.icons[1].color==null,"nested styles restore");
  var legacy=InlineIconParser.Parse("➜ ↻ ☑ ☐ ☐\uFE0F",20,true,_=>3);
  Check(legacy.icons.Select(icon=>icon.key).SequenceEqual(new[]{"arrow","recycle","check"}),"legacy aliases reuse source icon shapes");
  Check(legacy.text.EndsWith("□ □",StringComparison.Ordinal)&&!legacy.text.Contains("☐"),"unchecked square preserves empty meaning and removes variation selector");
  var result=new{passed=true,assertions,vectors,registered=CurrentUiIcons.Paths.Count};
  File.WriteAllText("_planning/migration-1029/ui/icon-checks/result.json",JsonSerializer.Serialize(result));Console.WriteLine(JsonSerializer.Serialize(result));
 }
}
