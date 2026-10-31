from pathlib import Path
import xml.etree.ElementTree as ET
p=Path(__file__).parent
def edit(name,old,new):
 f=p/'ui'/name;s=f.read_text(encoding='utf-8-sig');assert s.count(old)==1,(name,old,s.count(old));f.write_text(s.replace(old,new),encoding='utf-8')
edit('BattleEvents.cs','PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType);','PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType, CardDef card = null);')
edit('BattleViewApi.cs','public PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType)','public PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType, CardDef card = null)')
edit('BattleViewApi.cs','var r = CombatResolver.PreviewDamage(attacker, target, amount, dmgType);','amount = Session?.AdjustCardDamage(card, StatusOf(foe?.status,"bleed"), amount, dmgType) ?? amount;\n            var r = CombatResolver.PreviewDamage(attacker, target, amount, dmgType);')
edit('BattleFx.cs','api.PreviewDamage(snap.Player.Atk, snap.Player.SpellPower, foe, amount, type);','api.PreviewDamage(snap.Player.Atk, snap.Player.SpellPower, foe, amount, type, card);')
q=p/'full-compile';q.mkdir(exist_ok=True)
for f in (p.parent/'compile').glob('*.csproj'):
 tree=ET.parse(f);root=tree.getroot()
 for item in root.iter('Compile'):
  path=Path(item.attrib['Include']);relative=str(path).split('Sdt.Core\\')
  if len(relative)==2:item.set('Include',str((p/'snapshot'/relative[1].replace('\\','/')).resolve()))
  elif (p/'ui'/path.name).exists():item.set('Include',str((p/'ui'/path.name).resolve()))
 if f.stem=='Sdt.Core':
  group=ET.SubElement(root,'ItemGroup')
  for name in ['BattleHandPayment.cs','BattleRuleConsumers.cs']:ET.SubElement(group,'Compile',Include=str((p/'snapshot'/'Battle'/name).resolve()))
 tree.write(q/f.name,encoding='utf-8',xml_declaration=True)
(q/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>')
# Independent prior checks compile against the private source snapshot.
for name,source in [('integration','current-integration'),('forecast','current-forecast'),('semantics','card-semantics-fix')]:
 out=p/name;out.mkdir(exist_ok=True);src=p.parent/source
 for f in src.glob('*.cs'):(out/f.name).write_bytes(f.read_bytes())
 project=next(src.glob('*.csproj'));tree=ET.parse(project)
 for item in tree.getroot().iter('Compile'):
  if 'Sdt.Core' in item.attrib['Include']:item.set('Include','../snapshot/**/*.cs')
 tree.write(out/'Checks.csproj',encoding='utf-8',xml_declaration=True)
