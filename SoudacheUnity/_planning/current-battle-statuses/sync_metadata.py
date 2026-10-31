from pathlib import Path
import json
root=Path.cwd();source=json.loads((root/'_planning/current-battle-statuses/source-vectors.json').read_text(encoding='utf-8'));path=root/'Assets/Scripts/Sdt.Core/CombatResolver.cs';text=path.read_text(encoding='utf-8-sig')
print('*** Begin Patch\n*** Update File: '+str(path))
for kind in ['Curse','Buff']:
    marker=f'        public static readonly IReadOnlyDictionary<string, {kind}Meta> {kind}MetaDict = new Dictionary<string, {kind}Meta>'
    start=text.index(marker);end=text.index('        };',start)+len('        };');old=text[start:end]
    keys=source['curses' if kind=='Curse' else 'buffs'];metadata=source['curseMetadata' if kind=='Curse' else 'buffMetadata'];lines=[marker,'        {']
    for key in keys:
        fields=[]
        for field in ['name','icon','stack','value','timed','flag','desc']:
            if field in metadata[key]:fields.append(field+' = '+json.dumps(metadata[key][field],ensure_ascii=False))
        lines.append('            { '+json.dumps(key)+', new '+kind+'Meta { '+', '.join(fields)+' } },')
    lines.append('        };');new='\n'.join(lines)
    print('@@\n'+'\n'.join('-'+line for line in old.splitlines())+'\n'+'\n'.join('+'+line for line in new.splitlines()))
print('*** End Patch')
