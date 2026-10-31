"""Freeze live owned source bytes and source-derived assets. Native review remains independent."""
from pathlib import Path
import datetime,hashlib,json,re,uuid
from PIL import Image,ImageChops
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];GAME=ROOT.parent/'搜打撤/game'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt=json.loads((HERE/'source-receipt.json').read_text(encoding='utf-8'));comparisons=0
for item in receipt['sources']:assert sha(GAME/item['path'])==item['sha256'],item['path']
for item in receipt['assets']:
    source=GAME/item['source'];output=ROOT/item['output'];assert sha(source)==item['sourceSha256'];assert sha(output)==item['outputSha256']
    if item['conversion'].startswith('original WebP'):
        with Image.open(source)as a,Image.open(output)as b:assert ImageChops.difference(a.convert('RGBA'),b.convert('RGBA')).getbbox()is None
        comparisons+=1
files=[p for p in (ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu').glob('Current*.cs') if re.match('Current(Archive|Slot|Achievement)',p.stem)]
files+=[ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu'/p for p in ['SlotPickerScreen.cs','MenuDialogs.cs']]
files+=[ROOT/'Assets/Scripts/Sdt.Res/CurrentArchiveAssets.cs',ROOT/'Assets/Resources/Art/CurrentArchive/SlotWallpaper.shader']
for path in files:
    text=path.read_text(encoding='utf-8');assert not re.search(r'GetComponent<[^>]+>\([^)]*\)\s*\?\?',text),path
    meta=Path(str(path)+'.meta')
    if not meta.exists():
        importer='ShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n' if path.suffix=='.shader' else 'MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n'
        meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\n'+importer+'  userData: \n  assetBundleName: \n  assetBundleVariant: \n',encoding='utf-8')
diagnostics=json.loads((HERE/'source-diagnostics.json').read_text(encoding='utf-8-sig'));assert not diagnostics['archiveErrors']
menu=(ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu/MenuDialogs.cs').read_bytes();settings=menu[menu.index(b'    public sealed class SettingsScreen'):]
report=dict(status='frozen-for-independent-native-review',time=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceReceiptSha256=sha(HERE/'source-receipt.json'),sourceCount=len(receipt['sources']),newAssets=len(receipt['assets']),originalRgbaPixelComparisons=comparisons,
    production=[dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p))for p in files],
    sharedSettingsSegmentSha256=hashlib.sha256(settings).hexdigest(),
    validation=dict(mode=diagnostics['mode'],ownedCSharpFiles=len(diagnostics['auditedPaths']),errors=len(diagnostics['archiveErrors']),warnings=len(diagnostics.get('archiveWarnings',[])),shaderImportVerified=False,nativeEffectAccepted=False,realInputAccepted=False),
    actualData=dict(slots='single live SaveSystem, ReadSlot + BaseData.Peek once per visit, HasSlotReadError/ReadErrorForSlot isolate damaged slots',recent='largest positive run.savedAt; source first-slot tie break; base-only slots are not recent-highlighted',achievements='26 live MetaProgress definitions, latest valid slot base snapshot; source unlocked predicate and achClaimed kept independent; no sums or fake global database',notes='shared existing global photo notes; existing formatter and card library unchanged'),
    implementedSlot=['five264px cards,44px bounded gap, full available height, current wallpaper split into5 strips','five original SVG weather emblems; original SVG horse/deer/birds; original alpha-derived emblem glow; CSS fog/bokeh/snow and metal corners','four data states; source error-card fallback has no destructive or entry action','real progress/layer/class/hp/maxHp/coins/savedAt; expandable play time and real unlocked achievement names','latest run highlight; confirmation dialog for overwrite/delete; persist failure leaves picker/error; double click and stale page guards','ordinary shared transparent back/hover/focus; source archiveDeal delay220+index50 and duration420; reduced motion preference'],
    implementedAchievement=['shared collection titlebar/navigation/tool/body architecture;420px inspector','six original categories and exact26 IDs; query name+condition;all/unlocked/locked/pending/claimed filters','source independent unlocked/claimed states and real progress/rewards; read-only title overview','five original art styles chosen once per open;6x5 original atlas cells; no reconstructed medal art','list and240px grid; source-sized native text; preserved first-visible anchor except category/reset; filtered-out detail closes','source selection marker; previous/next without wrap, continuous scroll-into-view; detail close restores focus; Escape closes inner details/menu before page','ambient progress opacity and1100ms polish glint; region/list entry and detail fades','original archive-leaves cut:850ms image reveal/raking-light, then actual transition-handoff max(680,240) exit; no added cinematic wording'],
    scopedOut=['research/nest branch disabled for this desktop first version by MIGRATION.md:9; uses actual ordinary/elite four-layer records','source saveArchive controls conditional on injection; current native host has no injected archive service, so hidden','old Web save migration excluded; no backup adapter or new save database added'],
    controls=['slotBack','slot-card-1..5','slot-enter-1..5','slot-more-1..5','slot-overwrite-1..5','slot-delete-1..5','slot-confirmation','confirmation-cancel','confirmation-accept','achBack','ag-category-0..5','ag-search-input','ag-filter-all/unlocked/locked/pending/claimed','ag-view-False/True','ag-medal-<achievement.id>','ag-prev','ag-next','ag-dismiss','ag-display-menu','ag-ambient','ag-polish','ag-reset'],
    nativeRequired=['Slot first paint/scroll bounds, original emblems/gradient shader import, empty/base/run/read-error cards','expand and collapse more with full fields; recent positive timestamp and tie behavior','new/enter/run resume; explicit overwrite/delete confirmation and cancel; failed write/retry keep original file and picker visible','bad individual slot isolated from other four and profile-wide failure; click spam/stale callbacks','title achievement open: wait at least1800ms to see uncovered final frame; verify actual film beforehand','all6 categories,5 filters,search/list/grid, selected detail persistent scroll,filter-hidden selection closes; prev/next bounds andscroll-into-view','readonly rewards and counts from actual latest base, five random atlas styles stable across filtering','Escape hierarchy, keyboard navigation/searchIME, back target; ambient/glint and reduced motion'],
    excludedFromGitCommit=[dict(path=a['output'],sha256=a['outputSha256'],bytes=a['bytes'])for a in receipt['assets']if a['bytes']>1024*1024])
(HERE/'freeze.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(dict(productionFiles=len(files),sourceFiles=len(receipt['sources']),assets=len(receipt['assets']),originalPixelComparisons=comparisons,freezeSha256=sha(HERE/'freeze.json'))))
