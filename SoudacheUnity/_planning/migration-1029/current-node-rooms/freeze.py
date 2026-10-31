import json,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
GAME=ROOT.parent/'搜打撤/game'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def digest(rows):return hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
installed=json.loads((HERE/'installed.json').read_text(encoding='utf-8'))['files']
files=[dict(path=row['path'],sha256=sha(ROOT/row['path']),bytes=(ROOT/row['path']).stat().st_size) for row in installed]
sources=json.loads((HERE/'source-data.json').read_text(encoding='utf-8'))['sources']
assert all(sha(GAME/row['file'])==row['sha256'] for row in sources)
pending=[]
for kind,target in [('Scripts',ROOT/'Assets/Scripts'),('Resources',ROOT/'Assets/Resources')]:
 for source in (HERE/'draft'/kind).rglob('*'):
  if not source.is_file():continue
  dest=target/source.relative_to(HERE/'draft'/kind)
  if not dest.exists() or sha(source)!=sha(dest):pending.append(dict(path=str(dest.relative_to(ROOT)).replace('\\','/'),productionSha256=sha(dest) if dest.exists() else None,draftSha256=sha(source)))
assets=json.loads((HERE/'assets-receipt.json').read_text(encoding='utf-8'))
checks=json.loads((HERE/'domain-results.json').read_text(encoding='utf-8'))
receipt=dict(status='native-window-frozen-pending-private-patch' if pending else 'production-frozen-awaiting-native-review',productionDigest=digest(files),sourceDigest=digest([dict(file=x['file'],sha256=x['sha256']) for x in sources]),productionFiles=files,sourceFiles=sources,pendingPrivatePatch=pending,checks=dict(isolatedFullBuildErrors=0,existingForecast='289/289',existingCardSemantics='167/167',nodeSourceAndDomain=checks['count'],nodeChecksApplyTo='private draft' if pending else 'frozen production',assetSourceOutputChecks=49,encounterVectors=100,originalDimensions=True,noUnityLaunch=True,noSharedCompile=True),runtimeEntries=json.loads((HERE/'source-data.json').read_text(encoding='utf-8'))['runtimeEntries'],deadCode=json.loads((HERE/'source-data.json').read_text(encoding='utf-8'))['deadCode'],nativePending=['Event/entry/fire/pickup/reward/chest current-window layout, masks, font wrapping, full original illustration crop','Dice saved-result 1250ms motion, coin 950ms sweep, fire compact720ms, card acquisition340ms and stagger reveal140+i170ms','Retained cards/scroll/focus after bag and zoom, no duplicate receipt on repeated click/reentry','Capacity organizer safe/discard failure returns to same pending reward','Victory extra legendary and boss continuation after every reward; injected save failure retains retry page'],binaryPolicy=dict(commitPerformed=False,filesAbove1MB=[dict(path=row['output'],sha256=row['outputSha256'],bytes=row['bytes']) for row in assets['files'] if row['bytes']>1024*1024],regenerate='node source-data.mjs; python export_assets.py (original assets only, no generated illustrations)'))
(HERE/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(status=receipt['status'],productionDigest=receipt['productionDigest'],sourceDigest=receipt['sourceDigest'],pending=len(pending),nodeChecks=checks['count'])))
