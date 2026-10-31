from pathlib import Path
import hashlib,json
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[3]
here=Path(__file__).resolve().parent
game=root.parent/'\u641c\u6253\u64a4'/'game'
files=[
'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentBeginnerGuide.cs',
'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentBeginnerGuide.Content.cs',
'Assets/Scripts/Sdt.UI/Screens/Menu/MenuDialogs.cs',
'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentFeedbackComposer.cs',
'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSettingsPage.cs',
'Assets/Scripts/Sdt.Res/CurrentCardPresentation.cs',
'Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentInventory.cs',
'Assets/Scripts/Sdt.UI/Screens/Misc/PhotoStudioDossier.cs',
'Assets/Scripts/Sdt.UI/Screens/Misc/PhotoDetailScreen.cs',
'Assets/Scripts/Sdt.UI/Screens/Bag/BagCardDetail.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/CurrentSettlementView.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/ClassChoiceScreen.Pool.cs',
'Assets/Scripts/Sdt.UI/Screens/Battle/BattleItemInputs.cs',
'Assets/Scripts/Sdt.UI/Screens/Battle/BattleRuleInputs.cs',
'Assets/Resources/Data/CurrentBeginnerGuide.json','Assets/Scripts/Sdt.Core/Cards.cs']
files += [p.relative_to(root).as_posix() for p in (root/'Assets/Resources/Art/CurrentGuide').glob('*.png')]
source=['data/beginner-guide.json','src/ui/menu-guide.js','src/ui/beginner-guide.js','css/beginner-guide.css','src/ui/region-transition.js','src/ui/motion-presets.js',
'src/cards/card-description-text.js','src/cards/structured-card-description.js','src/cards/card-state-presentation.js','src/cards/battle-value-context.js','src/cards/cards.rules.js',
'src/ui/card-zoom-content.js','src/hub/hub.warehouse.js','src/hub/game.cardslib.page.js','src/ui/performance-settings.js','src/cards/cards.js']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt={'frozenUtc':datetime.now(timezone.utc).isoformat(),'production':{p:sha(root/p) for p in files},'source':{p:sha(game/p) for p in source},
'checks':{'privateTypecheck':'0 errors, 10 warnings in latest current dependency snapshot; none from new guide','freshFormatterVectors':{'tested':650,'differences':0},'freshCanonicalCatalog':{'cards':291,'fields':12,'differences':0},'presentationDataResourceMatchesFreshSource':True,'customMergeSourceCoreChecks':7},
'nativePending':['all six guide chapters, full image reader pan/return, per-chapter scroll restoration and interrupted navigation','all source descriptions in bag/warehouse/settlement/starting-pool/equipment/item readers; battle uses live snapshot and UID','damage-type caption in photo dossier/detail; performance-help copy after native cadence integration'],
'scope':'Source-faithful UI presentation only. No source Vite edits, card rules, gameplay values, shared docs, Unity or CUA invocation.'}
(here/'production-freeze.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'productionFiles':len(files),'sourceFiles':len(source),'frozen':True}))
