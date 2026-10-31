import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
FILES=[
 "Assets/Scripts/Sdt.Res/UnitFrameCatalog.cs","Assets/Scripts/Sdt.Res/CurrentUnitFrames.cs",
 "Assets/Scripts/Sdt.Core/Battle/BattleActorPresentation.cs","Assets/Scripts/Sdt.Core/Battle/BattleSession.cs",
 "Assets/Scripts/Sdt.Core/Battle/StructuredRules.cs","Assets/Scripts/Sdt.Core/Battle/EffectExecutor.cs",
 "Assets/Scripts/Sdt.Boot/BattleBridge.cs","Assets/Scripts/Sdt.Boot/BattleViewApi.cs",
 "Assets/Scripts/Sdt.UI/Screens/Battle/BattleActorClock.cs","Assets/Scripts/Sdt.UI/Screens/Battle/BattleUnitFrames.cs",
 "Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentationQueue.cs","Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentationBeats.cs",
 "Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentationTiming.cs","Assets/Scripts/Sdt.UI/Screens/Battle/BattleEnemyFrameMotion.cs",
 "Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentation.cs","Assets/Scripts/Sdt.UI/Screens/Battle/BattleScreen.cs",
 "Assets/Scripts/Sdt.UI/Screens/Battle/BattleEvents.cs","Assets/Scripts/Sdt.UI/Screens/Battle/BattleRuleInputs.cs",
 "Assets/Resources/Data/CurrentUnitFrames.json"]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
receipt={"files":[{"path":p,"sha256":sha(ROOT/p),"bytes":(ROOT/p).stat().st_size} for p in FILES],
 "assetsReceiptSha256":sha(HERE/"assets-receipt.json"),
 "clockChecks":1813,"beatChecks":25,"forecastChecks":289,"cardChecks":167,
 "latestIntegrationCompile":{"status":"blocked-by-other-slice-in-progress","errors":["Kit/CurrentMapTools.cs: CurrentRunHudAssets missing","Kit/CurrentMapTools.cs: BoardView.FrameExploration missing"],"priorIsolatedBuild":"passed; current-forecast 289/289 and card-semantics-fix 167/167"},
 "rngFinding":{"status":"unmodified; parent owns follow-up","seed":123,
   "source":{"path":"../搜打撤/game/src/battle/core/battle.engine.factory.domain.js:845","method":"frenzyCurse","call":"Random.random('status', 'generation')","firstValue":0.35579043603502214,"curse":"bleed"},
   "unity":{"path":"Assets/Scripts/Sdt.Core/Battle/BattleSession.cs:1031","method":"FrenzyCurse","call":"rng.Random(\"status\")","firstValue":0.8453671627212316,"curse":"poison"},
   "minimalRepro":["node _planning/migration-1029/current-unit-frames/rng-vector.mjs","dotnet run --project _planning/migration-1029/current-unit-frames/Audit.csproj -p:UseSharedCompilation=false"],
   "evidence":["rng-source-vector.json","rng-unity-vector.json","frenzy-random-baseline.json"],
   "domainVector":"one enemy hp50 atk3 affix=frenzy; player hp30 maxHp60, atk4 spellPower2, no defenses/status/owned cards; seed123; EndTurn -> source hit 30->27->23, current Unity 30->27->24"},
 "nativeValidation":"not-run; parent owns native render/input checks",
 "uncommitted":True}
(HERE/"receipt.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"files":len(FILES),"nativeValidation":receipt["nativeValidation"]}))
