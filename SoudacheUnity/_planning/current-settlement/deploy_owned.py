from pathlib import Path
import hashlib,json,uuid,sys
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent
mode=sys.argv[1]
if mode=='schemas':
    print('*** Begin Patch')
    fields={
      'Assets/Scripts/Sdt.Run/GameRuntime.cs':[("public bool Done;","public List<StashStack> SavedCards = new List<StashStack>(), KeptPocket = new List<StashStack>();\n        public int PocketKept,PocketLost,PocketRuleLost; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;\n        public bool Done;"),("public int SavedN;","public int SavedN; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;"),("public int BroughtN, KeptN, Coins;","public int BroughtN, KeptN, Coins; public SettlementReceipt Receipt;")],
      'Assets/Scripts/Sdt.Run/SaveSystem.cs':[("public AbandonResult abandon;","public AbandonResult abandon;\n        public int sourceIdentityVersion,requestSeq,totalPocketCount,lostPocketCount;\n        public List<StashStack> keptPocket = new List<StashStack>();\n        public RunGrowthReceipt growth; public SettlementReceipt receipt;")]
    }
    for path,replacements in fields.items():
        text=(ROOT/path).read_text(encoding='utf-8-sig');print('*** Update File: '+str(ROOT/path))
        for old,new in replacements:
            assert old in text
            if new in text:continue
            # Keep inline comments and all surrounding subsystems untouched.
            line=next(line for line in text.splitlines() if old in line);replacement=line.replace(old,new)
            print('@@\n-'+line+'\n'+'\n'.join('+'+row for row in replacement.splitlines()))
    print('*** End Patch')
elif mode=='menu':
    path=ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu/MenuDialogs.cs';text=path.read_text(encoding='utf-8-sig');start=text.index('    public sealed class LeaveMenuScreen : Panel');end=text.index('    // ============================================================\n    // 现行试玩反馈',start);old=text[start:end];new=(HERE/'menu-segments.cs.txt').read_text(encoding='utf-8')
    print('*** Begin Patch\n*** Update File: '+str(path)+'\n@@\n'+'\n'.join('-'+line for line in old.splitlines())+'\n'+'\n'.join('+'+line for line in new.splitlines())+'\n*** End Patch')
elif mode=='copies':
    files={'GameRuntime.Settlement.cs':'Sdt.Run','CurrentSettlementReceipt.cs':'Sdt.Run','ExtractScreens.cs':'Sdt.UI/Screens/Run','CurrentSettlementView.cs':'Sdt.UI/Screens/Run','CurrentExtractionPage.cs':'Sdt.UI/Screens/Run','CurrentSettlementReport.cs':'Sdt.UI/Screens/Run','CurrentLeavePage.cs':'Sdt.UI/Screens/Menu'}
    evidence={}
    for name,domain in files.items():
        target=ROOT/'Assets/Scripts'/domain/name;draft=HERE/name
        evidence[str(target.relative_to(ROOT))]={'before':hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None,'after':hashlib.sha256(draft.read_bytes()).hexdigest()};target.write_bytes(draft.read_bytes());meta=Path(str(target)+'.meta')
        if not meta.exists():meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\n',encoding='utf-8')
    asset=ROOT.parent/'搜打撤/game/assets/scenes/ui-loop-0925/rewards-convoy-fail.webp';dest=ROOT/'Assets/Resources/Art/Current/Settlement';dest.mkdir(exist_ok=True);target=dest/'rewards-convoy-fail.png';image=Image.open(asset).convert('RGBA');image.save(target)
    meta=Path(str(target)+'.meta')
    if not meta.exists():meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\nTextureImporter:\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 0\n  textureType: 0\n  alphaIsTransparency: 1\n  maxTextureSize: 2048\n  textureCompression: 0\n',encoding='utf-8')
    meta=Path(str(dest)+'.meta')
    if not meta.exists():meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {{}}\n',encoding='utf-8')
    (HERE/'applied-sha256.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'asset.json').write_text(json.dumps({'source':str(asset),'sourceSha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'target':str(target.relative_to(ROOT)),'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'pixelExact':image.tobytes()==Image.open(target).convert('RGBA').tobytes()},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Copied 7 owned production files; original failure banner decoded pixel-exact.')
