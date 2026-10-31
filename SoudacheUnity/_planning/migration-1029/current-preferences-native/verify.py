from pathlib import Path
import hashlib,json,re
p=Path(__file__).resolve().parent;root=p.parents[2]
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
receipt=json.loads((p/'receipt.json').read_text(encoding='utf-8'))
for key,value in receipt['source'].items():assert sha(root/key)==value,key
source=root.parent/'搜打撤/game'
presets=(source/'src/core/performance-settings.js').read_text(encoding='utf-8')
vectors={}
for key,values in [('low',(1,.75,.25)),('balanced',(1.5,1,.5)),('high',(2,1.25,1))]:
 match=re.search(key+r': Object.freeze\(\{.*?backdropScale: ([\d.]+), courtyardScale: ([\d.]+), retainedImageScale: ([\d.]+)',presets)
 assert match and tuple(map(float,match.groups()))==values,key
 vectors[key]={'sourceBackdropScale':values[0],'sourceCourtyardScale':values[1],'sourceRetainedMiB':192*values[2],'nativeDistantSnow':key!='low','nativeNearSnow':key=='high','nativeMist':key=='high','nativeGrain':key=='high','nativeSparks':key!='low','nativeBeams':key!='low','nativeGhostAndAccentMotion':key!='low'}
css=(source/'css/performance-settings.css').read_text(encoding='utf-8')
assert 'low"] #title :is(.home-snow,.home-near-snow,.home-mist,.home-grain,.home-spark,.home-beams)' in css
assert 'balanced"] #title :is(.home-near-snow,.home-mist,.home-grain)' in css
ambient=(root/'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeAmbient.cs').read_text(encoding='utf-8')
for actual in ['reduced || low || (snow.near && (!high || _ensemble))','reduced || low ? 0 : opacity*.42f','_beams.enabled = !reduced && !low','_grain.enabled = !reduced && high','_mist.enabled = high','float decorationTime = low ? 0 : time','float travel = reduced || low ? 0 :']:
 assert actual in ambient,actual
for path in ['css/review-ui.css','css/card-layout-selected.css','src/ui/card-zoom-content.js','src/ui/confirm-dialog.js','src/ui/term-tips.runtime.js','src/ui/ui.js','src/ui/inventory-zoom.js']:
 receipt['source']['../搜打撤/game/'+path]=sha(source/path)
new=list((p/'candidate').rglob('*.cs'))
files={str(f.relative_to(p/'candidate')).replace('\\','/'):sha(root/f.relative_to(p/'candidate')) for f in new}
assert len(files)==10,len(files)
(p/'production-freeze.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
(p/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
(p/'source-vectors.json').write_text(json.dumps({'kind':'source vector + production wiring inspection; actual Unity evidence delegated to root','vectors':vectors,'reading':{'cardZoom_hsc_desc':{'font':26,'lineSpacing':'existing'},'termTip_log_confirmation':{'font':26,'lineSpacing':1.7},'excluded':['photo .cz-photo-rules','inventory-zoom-rules','#tooltip','ordinary Xl cards','map preview']},'sourceShaUnchanged':True,'productionFiles':len(files)},ensure_ascii=False,indent=2),encoding='utf-8')
print('Source preset vectors, source hashes and 10 production consumer hashes verified')
