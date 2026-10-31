from pathlib import Path
import hashlib,json,datetime
here=Path(__file__).resolve().parent
root=here.parents[2]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
paths=json.loads((here/'production-manifest.json').read_text(encoding='utf-8'))
frozen={}
for name in paths:
    path=root/name
    snapshot=here/'isolated/snapshot'/(name[len('Assets/Scripts/'):] if name.startswith('Assets/Scripts/') else name)
    if path.suffix=='.cs':assert sha(path)==sha(snapshot),f'Production differs from checked source: {name}'
    frozen[name]=sha(path)
source=json.loads((here/'source-manifest.json').read_text(encoding='utf-8-sig'))
for item in source:assert sha(root.parent/'搜打撤'/item['source'])==item['sha256'],f"Source changed: {item['source']}"
checks=json.loads((here/'domain-checks.json').read_text(encoding='utf-8'))
assert checks['passed'] and checks['assertions']==26
log=(here/'isolated-build.log').read_text(encoding='utf-8')
assert '0 个错误' in log
(here/'production-manifest.json').write_text(json.dumps(frozen,ensure_ascii=False,indent=2),encoding='utf-8')
report={'status':'frozen-for-native-review','frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionFiles':frozen,'sourceManifestCount':len(source),'checks':{'isolatedCompile':{'passed':True,'errors':0,'existingWarnings':2,'log':'isolated-build.log'},'domainAssertions':{'passed':True,'assertions':26,'report':'domain-checks.json'},'productionMatchesCheckedSnapshot':True,'sourceBytesUnchanged':True},'pending':['Unity native import and shader compilation','Current-window visual review against current Vite source','Real system input for rail drag, zoom and containers'],'probeContract':'probe-contract.md'}
(here/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Frozen: '+str(len(frozen))+' production files; 26 domain assertions; native review remains pending.')
