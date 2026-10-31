from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[3]
draft=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inputs=['../搜打撤/game/src/core/performance-settings.js','../搜打撤/game/src/core/performance-budgets.js','../搜打撤/game/src/core/art.js','../搜打撤/game/src/core/renderer.js','../搜打撤/game/src/hub/hub.courtyard-runtime.js','../搜打撤/game/css/performance-settings.css','../搜打撤/game/css/card-layout-selected.css','../搜打撤/game/css/review-ui.css']
targets=['Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeAmbient.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeMotion.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSettingsPage.cs','Assets/Scripts/Sdt.UI/Screens/Misc/PhotoInlineLinks.cs','Assets/Scripts/Sdt.UI/Screens/Battle/BattleSecondaryViews.cs','Assets/Scripts/Sdt.UI/Screens/Run/CardFace.cs']
receipt={'source':{p:sha(root/p) for p in inputs},'productionFreeze':{p:sha(root/p) for p in targets}}
(draft/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
def candidate(path,pairs):
 text=(root/path).read_text(encoding='utf-8-sig')
 for old,new in pairs:
  assert text.count(old)==1,(path,old,text.count(old))
  text=text.replace(old,new)
 dest=draft/'candidate'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text,encoding='utf-8')
candidate(targets[0],[('bool reduced = CurrentHomeMotion.Reduced;','bool reduced = CurrentHomeMotion.Reduced;\n            bool low = CurrentNativePerformance.Low, high = CurrentNativePerformance.High;\n            float decorationTime = low ? 0 : time;'),('(-_ghostHalfWidth*Mathf.Repeat(time/180,1),-822.4f)','(-_ghostHalfWidth*Mathf.Repeat(decorationTime/180,1),-822.4f)'),('if (reduced || (_ensemble&&snow.near))','if (reduced || low || (snow.near && (!high || _ensemble)))'),('reduced ? 0 : opacity*.42f','reduced || low ? 0 : opacity*.42f'),('_beams.enabled = !reduced;','_beams.enabled = !reduced && !low;'),('_grain.enabled = !reduced;','_grain.enabled = !reduced && high;\n            _mist.enabled = high;'),('float travel = reduced ? 0 :','float travel = reduced || low ? 0 :')])
candidate(targets[1],[('float drift = Reduced || _wallpaperOnly ? 0 :','float drift = Reduced || CurrentNativePerformance.Low || _wallpaperOnly ? 0 :')])
candidate(targets[2],[('public static bool QualityProjectionAvailable;','public static bool QualityProjectionAvailable => CurrentNativePerformance.Available;')])
