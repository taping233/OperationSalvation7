from pathlib import Path
import sys,uuid
ROOT=Path.cwd();HERE=ROOT/'_planning/current-battle-statuses'
mode=sys.argv[1]
if mode=='mount':
    path=ROOT/'Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentation.cs';text=path.read_text(encoding='utf-8-sig');start=text.index('        sealed class UnitMount');end=text.rfind('    }\n}')
    old=text[start:end];new=(HERE/'UnitMount.cs.txt').read_text(encoding='utf-8');print('*** Begin Patch\n*** Update File: '+str(path)+'\n@@\n'+'\n'.join('-'+line for line in old.splitlines())+'\n'+'\n'.join('+'+line for line in new.splitlines())+'\n*** End Patch')
elif mode=='chips':
    path=ROOT/'Assets/Scripts/Sdt.UI/Screens/Battle/BattleWidgets.cs';text=path.read_text(encoding='utf-8-sig');start=text.index('    public static class BtChips');end=text.index('    /// <summary>sts-nameplate',start)
    new='''    public static class BtChips
    {
        public static GameObject Create(Transform parent,IReadOnlyList<StatusChip> chips)
        {
            var rect=BattleScreen.BattleRect("sts-chips",parent);rect.anchorMin=new Vector2(0,1);rect.anchorMax=Vector2.one;rect.pivot=new Vector2(0,1);
            var status=UIKit.GetOrAdd<CurrentBattleStatuses>(rect);status.Initialize(parent.name!="sts-me",parent.GetComponentInParent<BattleScreen>());status.Sync(CurrentBattleStatusModel.Legacy(chips));rect.sizeDelta=new Vector2(0,status.RegionHeight);return rect.gameObject;
        }
    }

'''
    old=text[start:end];print('*** Begin Patch\n*** Update File: '+str(path)+'\n@@\n'+'\n'.join('-'+line for line in old.splitlines())+'\n'+'\n'.join('+'+line for line in new.splitlines())+'\n*** End Patch')
elif mode=='metas':
    for name in ['CurrentBattleNameplate','CurrentBattleStatuses','CurrentBattleStatusModel']:
        path=ROOT/'Assets/Scripts/Sdt.UI/Screens/Battle'/(name+'.cs.meta')
        if not path.exists():path.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\n',encoding='utf-8')
