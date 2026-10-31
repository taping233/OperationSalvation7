# -*- coding: utf-8 -*-
from pathlib import Path
import hashlib,json
directory=Path(__file__).resolve().parent
root=directory.parents[2]
files=['Assets/Scripts/Sdt.UI/Screens/Battle/BattleSecondaryViews.cs','Assets/Scripts/Sdt.UI/Screens/Battle/CurrentBattlePileData.cs','Assets/Scripts/Sdt.UI/Screens/Run/DepartureElements.cs','Assets/Scripts/Sdt.UI/Kit/UiStack.cs','Assets/Editor/CurrentBattlePileValidation.cs','Assets/Scripts/Sdt.UI/Screens/Run/RunUi.cs','Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentation.cs']
source=['game/src/battle/view/battle.pile-view.js','game/src/battle/view/battle.decision-shell.js','game/src/battle/view/battle.overlays.js','game/css/battle-pile-view.css','game/src/battle/bag/battle.bag.domain.js','game/src/battle/bag/battle.slam-skill.js','game/css/cards.css','game/css/winter.css','game/css/battle-secondary-overlay.css','game/css/expedition-library.css','game/css/review-ui.css','game/src/ui/card-zoom-controller.js','game/src/ui/hud.js','game/src/ui/run-top-bar.css']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt={'production':{p:sha(root/p) for p in files},'source':{p:sha(root.parent/'搜打撤'/p) for p in source},'compile':'final private compile 0 errors / 10 existing warnings; Editor probe 0 errors / 4 existing OffscreenCapture warnings; root native pending','dataChecks':10,'nativeRun':False,'foreground':False,'pending':['native button/reader browse/scroll/focus and backdrop material/alpha restoration','actual player frame review']}
(directory/'freeze.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'production':len(files),'source':len(source),'dataChecks':10}))
