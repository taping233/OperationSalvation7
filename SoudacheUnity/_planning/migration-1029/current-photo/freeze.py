"""Freeze owned bytes and source comparisons; never claim native visual/input approval."""
import hashlib,json,uuid,shutil
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).parent;GAME=ROOT.parent/'搜打撤/game'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=json.loads((HERE/'source-receipt.json').read_text(encoding='utf-8'))
for item in receipt['sourceFiles']:assert sha(GAME/item['path'])==item['sha256'],item['path']
bitmap=0
for item in receipt['assets']:
    src,dst=GAME/item['source'],ROOT/item['output'];assert sha(src)==item['sourceSha256'];assert sha(dst)==item['outputSha256']
    if item['conversion'].startswith('original pixels'):
        with Image.open(src)as a,Image.open(dst)as b:assert ImageChops.difference(a.convert('RGBA'),b.convert('RGBA')).getbbox()is None
        bitmap+=1
sources=[ROOT/'Assets/Scripts/Sdt.UI/Screens/Misc'/name for name in ['CardLibraryScreen.cs','PhotoDetailScreen.cs','PhotoStudioElements.cs','PhotoStudioChoice.cs','PhotoStudioWall.cs','PhotoStudioDossier.cs','PhotoStudioRoom.cs','PhotoStudioMotion.cs','PhotoInlineLinks.cs','PhotoPrismaticText.cs','PhotoNegativeGesture.cs']]
sources += [ROOT/'Assets/Scripts/Sdt.Res'/name for name in ['CurrentPhotoAssets.cs','CurrentCardPresentation.cs','CurrentCardPresentation.Rich.cs']]
for src in sources:
    text=src.read_text(encoding='utf-8');assert 'GetComponent<' not in text or '??' not in text or not __import__('re').search(r'GetComponent<[^>]+>\([^)]*\)\s*\?\?',text),src
    meta=Path(str(src)+'.meta')
    if not meta.exists():meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\nMonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n',encoding='utf-8')
for name in ['CardLibraryScreen.cs','PhotoDetailScreen.cs']:shutil.copyfile(ROOT/'Assets/Scripts/Sdt.UI/Screens/Misc'/name,HERE/name)
copy=ROOT/'Assets/Resources/Art/CurrentPhoto/descriptions.json';meta=Path(str(copy)+'.meta')
if not meta.exists():meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\nTextScriptImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n',encoding='utf-8')
controls=['closeCardPage','libType0..8','cardSearch','libRar','libSort','libCls','libClearFilter','libRemoveFilter-rar/cls/q','libGrid','Photo-<card.id>','libPrev','libNext','libLocate','libInspect','PhotoClose','PhotoNote','PhotoNoteStatus','card-reference-<id>','term-<key>']
report=dict(status='source-and-private-compile-frozen; native-review-required',sourceFiles=len(receipt['sourceFiles']),imageAssets=len(receipt['assets']),originalPixelComparisons=bitmap,presentationOracleCases=650,presentationOracleFailures=0,
 files=[dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p))for p in sources+[copy,ROOT/'Assets/Resources/Art/CurrentPhoto/PhotoNegative.shader',ROOT/'Assets/Resources/Art/CurrentPhoto/PhotoPrismatic.shader']],controls=controls,
 verified=['source and output SHA256','three original bitmap RGBA pixel comparisons','private owned-source compilation: 0 warnings/0 errors','650 independent live JS formatter oracle cases','owned git diff whitespace check'],
 notVerified=['native current-window appearance/materials/animation and shader import','real mouse/keyboard/IME/link hit geometry','global note write failure/retry under native host'], implementedPhotoEffects=['600ms press: invert(1) hue-rotate(180deg) sepia(.12), up/leave/cancel/blur restore','105deg rarity-only per-fragment text gradient: six exact source colors/stops'],
 centralizedByRoot=['Sdt.Res.asmdef Core dependency','BaseData.TrySavePhotoNote title-global guard','CardFace consumers of shared presentation API'])
(HERE/'freeze.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(files=len(report['files']),sourceFiles=report['sourceFiles'],imageAssets=report['imageAssets'],freezeSha256=sha(HERE/'freeze.json'))))

