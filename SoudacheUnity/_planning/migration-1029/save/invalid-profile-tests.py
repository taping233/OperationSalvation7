from pathlib import Path
p=Path('_planning/migration-1029/save/Program.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('  string valid=File.ReadAllText(SaveSystem.ProfilePath);')
b=s.index('File.WriteAllText(SaveSystem.ProfilePath,"{broken");',a)
s=s[:b]+'''void RejectProfile(Action<JObject> mutate){var document=JObject.Parse(valid);mutate(document);string invalid=document.ToString();File.WriteAllText(SaveSystem.ProfilePath,invalid);var check=new SaveSystem();Assert(check.ReadSlot(5)==null&&check.HasReadError,"损坏库存结构拒绝读取");Assert(!check.WriteSlot(5,new RunSaveData{slot=5})&&File.ReadAllText(SaveSystem.ProfilePath)==invalid,"损坏库存原文保留");File.WriteAllText(SaveSystem.ProfilePath,valid);}
  RejectProfile(d=>d["runs"]["5"]["ownedCards"][0]=JValue.CreateNull());RejectProfile(d=>d["runs"]["5"]["ownedCards"][0]["pouchOf"]="bad-container");RejectProfile(d=>d["runs"]["5"]["inventory"][0]["count"]=-1);
  '''+s[b:]
# NewRun cleared inventory so inject an invalid record instead of mutating absent index.
s=s.replace('d["runs"]["5"]["inventory"][0]["count"]=-1','d["runs"]["5"]["inventory"]=new JArray(new JObject{{"name","木材"},{"count",-1}})')
p.write_text(s,encoding='utf-8')
