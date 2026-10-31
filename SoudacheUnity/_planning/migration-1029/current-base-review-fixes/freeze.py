"""Freeze this review correction only. No native render/interaction acceptance is asserted."""
from pathlib import Path
import hashlib,json,uuid,datetime,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];GAME=ROOT.parent/'搜打撤/game'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[ROOT/'Assets/Scripts/Sdt.UI/Screens/Hub'/p for p in ['HubScreen.cs','HubCurrentLayout.cs','HubCurrentSourceLayout.cs','HubModernPages.cs','HubCurrentRooms.cs','CourtyardScreen.cs']]
files+=[ROOT/'Assets/Resources/HubPortraitMultiply.shader']
for path in files:
    assert not re.search(r'GetComponent<[^>]+>\([^)]*\)\s*\?\?',path.read_text(encoding='utf-8')),path
    meta=Path(str(path)+'.meta')
    if not meta.exists():
        importer='ShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n' if path.suffix=='.shader' else 'MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n'
        meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\n'+importer+'  userData: \n  assetBundleName: \n  assetBundleVariant: \n',encoding='utf-8')
sources=['css/archive-back.css','css/navigation-feedback.css','css/base-framework-v7.css','css/base-archive-facilities-v12.css','css/base-courtyard-v3.css','css/base-logistics-trade-v12.css','css/base-personnel-v12.css','css/collection-workspace.css','src/hub/hub.personnel.js','src/hub/hub.trade-shop-v5.js','src/hub/hub.warehouse.js','src/ui/home-linked-interactions.js']
report=dict(status='production-frozen-for-independent-native-review',time=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    reviewedEvidence='../current-effect-review/review6-base-photoagent.json',
    production=[dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p))for p in files],
    currentSource=[dict(path='game/'+p,sha256=sha(GAME/p))for p in sources],
    reusedAssets=[dict(path='Assets/Resources/Art/CurrentHome/linked-back.png',sha256=sha(ROOT/'Assets/Resources/Art/CurrentHome/linked-back.png'),mode='existing source SVG raster; no reimport')],
    corrections=[
      dict(finding='R6-PHOTOAGENT-01',result='166px trade mode track, remaining shelf, 480px desk; 220px auto-fill/16px gap/max260px item; source 210px shelf and 220px desk art; scroll constrained to shelf/reading'),
      dict(finding='R6-PHOTOAGENT-02',result='184px archive directory; 230px/.8fr/min490px1.2fr facilities tracks; numbered left aligned directory title/arrow and facility second line'),
      dict(finding='R6-PHOTOAGENT-03',result='default portrait only: full original, isolated #c4ccc9 stage, CSS-equivalent RGB multiply shader; scene skins retain normal image material'),
      dict(finding='R6-PHOTOAGENT-04',result='courtyard 12px gaps, 18px horizontal padding, 10px vertical button padding, content width buttons, remaining-width information, intact current-window counters'),
      dict(finding='R6-PHOTOAGENT-05',result='64x58 transparent square back region at18/16, reused24px linked-back SVG; graphite hover/focus and source focus outline'),
      dict(related='warehouse fixed track boundary',result='348px divisor/24px gap, full original columns through last row, 300px art contained, independent scrolling, right stack count')],
    checks=['private Hub partial family and Courtyard compile against imported assemblies: 0 warnings/0 errors','owned Unity pseudo-null add-component pattern guard'],
    controls=['hub-back archive-back','archive-back-focus-visible','trade-v12-layout','trade-v5-list','trade-v5-item <key>','av12-workspace','av12-directory','facility-layout','facility-map','pv12-agent-image-stage','warehouse-card-browser','warehouse-card-cell <id>','stack-count','courtyard-controls-row','courtyard-v3-info','courtyard-v3-progress'],
    nativeRequired=['new current-window screenshots reviewed by a different reviewer','trade shelf no overlap; rail166/desk480; card art width210/220; shelf and desk scroll independently','archive directory184 and facilities230/.8fr/1.2fr proportions, selection targets','default versus scene skin and shader import/color in native renderer','courtyard counters intact, buttons content width, hover/focus/back destination','warehouse last row width preserved and scrolling detail/back state'],
    shaderImportVerified=False,appearanceAccepted=False,realInputAccepted=False)
(HERE/'freeze.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(files=len(files),sourceFiles=len(sources),freezeSha256=sha(HERE/'freeze.json')),ensure_ascii=False))
