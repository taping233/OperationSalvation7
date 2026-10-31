"""Read-only current-source, image/pixel, importer and complete home route checks."""
from pathlib import Path
import hashlib,json,re
from PIL import Image,ImageChops
HERE=Path(__file__).parent
ROOT=HERE.resolve().parents[2]
GAME=ROOT.parent/'搜打撤/game'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=json.loads((HERE/'source-receipt.json').read_text(encoding='utf-8'))
checks=[]
for item in receipt['sourceFingerprints']:
    assert sha(GAME/item['path'])==item['sha256'], 'Source changed: '+item['path']
checks.append('current source fingerprints: '+str(len(receipt['sourceFingerprints'])))
for item in receipt['files']:
    source=GAME/item['source'];dest=ROOT/item['output']
    assert sha(source)==item['sourceSha256'] and sha(dest)==item['outputSha256'],item['output']
    if item['operation'].startswith('original pixels'):
        with Image.open(source) as a,Image.open(dest) as b:
            assert a.size==b.size
            assert ImageChops.difference(a.convert('RGBA'),b.convert('RGBA')).getbbox() is None,item['output']
checks.append('source/output asset fingerprints and original image pixels: '+str(len(receipt['files'])))
for item in receipt['derived']:
    assert sha(ROOT/item['path'])==item['sha256'],item['path']
checks.append('derived CSS primitive assets: '+str(len(receipt['derived'])))
ids=['mStart','mGuide','mAch','btnCardLib','mSettings','mCredits','btnTitleExit','btnTitleMute','mInbox','btnTitleWallpaper','btnTitleWallpaperView']
html=(GAME/'index.html').read_text(encoding='utf-8')
native=(ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu/TitleScreen.cs').read_text(encoding='utf-8-sig')
for ident in ids:
    assert 'id="'+ident+'"' in html and '"'+ident+'"' in native,ident
for retired in ['ak-start','ak-circle','ak-user','akExtracts','WINTER ARCHIVE','开始探索','收藏图鉴']:
    assert retired not in native,retired
checks.append('all 11 current home controls present; retired composition absent')
wallpaper=(GAME/'src/ui/title-wallpaper.js').read_text(encoding='utf-8')
source_ids=re.search(r'const wallpapers = \[(.*?)\]',wallpaper)[1]
assert re.findall(r"'([^']+)'",source_ids)==receipt['wallpapers']
assert receipt['defaultWallpaper']=='wu-bass' and len(receipt['wallpapers'])==7
assert '.home-button-copy::after { display: none; }' in (GAME/'css/title-p0.css').read_text(encoding='utf-8')
checks.append('current seven-wallpaper ordering/default and hidden sublabels preserved')
resources=ROOT/'Assets/Resources/Art/CurrentHome';guids=[]
for asset in resources.glob('*'):
    if asset.suffix not in ('.png','.ttf'):continue
    meta=Path(str(asset)+'.meta').read_text(encoding='utf-8')
    guids+=re.findall(r'^guid: (.+)$',meta,re.M)
    if asset.suffix=='.png':
        assert 'maxTextureSize: 4096' in meta and 'enableMipMap: 0' in meta
        assert 'textureCompression: 0' in meta and 'alphaIsTransparency: 1' in meta
assert len(guids)==len(set(guids))
checks.append('all native resource metadata: lossless 4096px limit, alpha, unique GUID')
output=dict(status='passed',checks=checks,sourceReceiptSha256=sha(HERE/'source-receipt.json'),
            nativeRendering='pending parent-owned capture',interactionExecution='pending parent-owned native probes')
(HERE/'verification.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(output,ensure_ascii=False))
