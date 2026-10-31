from pathlib import Path
import hashlib
import json
import shutil
from datetime import datetime, timezone

here = Path(__file__).resolve().parent
project = here.parents[2]
source = project.parent / '\u641c\u6253\u64a4' / 'game'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
production = [
    'Assets/Scripts/Sdt.Boot/GameBoot.cs',
    'Assets/Scripts/Sdt.Boot/NativeDisplayReview.cs',
    'Assets/Scripts/Sdt.UI/Kit/App.cs',
    'Assets/Scripts/Sdt.UI/Kit/InlineIconText.cs',
    'Assets/Scripts/Sdt.UI/Screens/Misc/PhotoInlineLinks.cs',
]
source_inputs = [
    source/'src/ui/ui-scale.js',source/'src/core/renderer.js',
    source/'src/core/performance-settings.js',source/'src/core/performance-budgets.js',
    project/'Library/PackageCache/com.unity.ugui@eb824e41fbc7/Runtime/UGUI/UI/Core/Text.cs',
    project/'Library/PackageCache/com.unity.ugui@eb824e41fbc7/Runtime/UGUI/UI/Core/Layout/CanvasScaler.cs',
    project/'ProjectSettings/ProjectSettings.asset',project/'ProjectSettings/QualitySettings.asset',
]
original_log = Path.home()/'AppData/LocalLow/Codename7'/'\u4ee3\u53f7\u67d2-\u641c\u6253\u64a4'/'Player.log'
if original_log.is_file():
    shutil.copyfile(original_log,here/'original-player.log')
result = {
    'recordedUtc':datetime.now(timezone.utc).isoformat(),
    'productionFreeze':{name:sha(project/name) for name in production},
    'sourceInputs':{str(path):sha(path) for path in source_inputs},
    'originalPlayerObservedRunning':False,
    'currentPhysicalDisplay':{'width':2560,'height':1440,'evidence':'read-only Win32_VideoController'},
    'originalExeDeclaredDpi':{'method':'read-only PE RT_MANIFEST resource 1','dpiAware':'True/PM','dpiAwareness':'PerMonitorV2'},
    'originalPlayerLogSha256':sha(here/'original-player.log') if (here/'original-player.log').is_file() else None,
    'helpers':{name:sha(here/name) for name in ['run_hidden_player.ps1','analyse_player_review.py']},
    'nativeValidation':'pending Root actual standalone build/run; no Unity or user window operated by this agent',
}
(here/'receipt.json').write_text(json.dumps(result,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'frozen':len(production),'native':'pending Root'}))
