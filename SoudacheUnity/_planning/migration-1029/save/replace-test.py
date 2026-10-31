from pathlib import Path
p=Path('_planning/migration-1029/save/Program.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('  string valid=File.ReadAllText(SaveSystem.ProfilePath);')
s=s[:a]+'''  string beforeReplace=File.ReadAllText(SaveSystem.ProfilePath);int beforeCoin=g.State.coins;
  using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.None))Assert(!g.TryPersistMutation(()=>g.State.coins+=99,out _),"原子替换受锁失败");
  Assert(File.ReadAllText(SaveSystem.ProfilePath)==beforeReplace&&g.State.coins==beforeCoin,"临时文件完成后替换失败仍保留原档与内存");
  Assert(File.Exists(SaveSystem.ProfilePath+".previous"),"保留上一份成功快照");
'''+s[a:]
s=s.replace('realWriteFailures=fault,scope=','realWriteFailures=fault+1,scope=')
p.write_text(s,encoding='utf-8')
