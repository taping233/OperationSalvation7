"""Read-only source-fidelity checks. This does not build Unity or verify rendered effects."""
import hashlib, json, math, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCE = ROOT.parent / '搜打撤' / 'game'
UI = ROOT / 'Assets/Scripts/Sdt.UI/Screens/Battle'
OUT = pathlib.Path(__file__).resolve().parent
def read(path): return path.read_text(encoding='utf-8-sig')
def fingerprint(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT.parent)).replace('\\','/'), 'sha256':hashlib.sha256(data).hexdigest(), 'bytes':len(data)}

source_names = [
    'src/battle/view/battle.view.js', 'src/battle/view/battle.stage-view.js',
    'src/battle/view/battle.layers.js', 'src/battle/view/battle.hand-layout.js',
    'src/battle/core/battle.hand.js', 'src/battle/view/battle.aim.js',
    'src/battle/view/battle.infusion-view.js', 'src/battle/view/battle.hand-selection-view.js',
    'src/battle/view/battle.potion-use.js', 'src/battle/view/battle.skill-view.js',
    'src/battle/view/battle.scenery.js', 'src/core/enemy-portrait-presentation.js',
    'src/battle/view/battle.turn-forecast.js', 'src/ui/battle-hud-info.js',
    'src/ui/run-top-bar.js', 'src/ui/run-top-bar.css', 'src/ui/settings-battle-restart.js',
    'css/battle-stage.css', 'css/battle-hand-overhaul.css', 'css/battle-equipment.css',
    'css/battle-infusion.css', 'css/battle-hand-selection.css', 'css/battle-discover.css',
    'css/battle-scene-polish.css', 'css/battle-status-chips.css', 'css/card-layout-selected.css',
]
sources = [fingerprint(SOURCE / name) for name in source_names]
hand = read(UI / 'HandPanel.cs')
stage = read(UI / 'BattlePresentation.cs')
screen = read(UI / 'BattleScreen.cs')
profile = read(UI / 'BattlePortraitProfile.cs')
checks = []
def check(name, condition):
    checks.append({'name':name,'passed':bool(condition)})
    if not condition: raise AssertionError(name)
check('source hand constants 260/190/64 and rotation 0, scale 1',
      all(token in hand for token in ['CardW = 260, CardH = 390, PreferredStep = 190, RestDrop = 64',
          'PageSize = 9', 'Quaternion.identity', 'Mathf.Min(PreferredStep, (width - CardW) / (n - 1))']))
check('retained stage and keyed unit and hand mounts', '_stageRoot.childCount' not in screen and
      'Dictionary<string, UnitMount>' in stage and '_retained.Find' in hand and 'FaceSignature' in hand)
check('source HUD source geometry', all(token in stage for token in [
    'HudEdge = 56, HudBottom = 40, ResourceWidth = 176, TacticsWidth = 248, HandGap = 64',
    'new Vector2(ResourceWidth, 104)', 'new Vector2(-HudEdge - TacticsWidth - HandGap,392)',
    'new Vector2(0, 110)', '_stageRoot.rect.height * .28f + 110']))
check('source self/enemy/ally horizontal mounts', all(token in stage+read(UI/'BattleRuleInputs.cs')
    for token in ['new Vector2(.27f, 0)', '_stageRoot.rect.width * .54f', '_stageRoot.rect.width * .36f', 'new Vector2(.35f, 0)']))
src_profiles = read(SOURCE / 'src/core/enemy-portrait-presentation.js')
for match in re.finditer(r'^\s*(\w+):\s*\{([^\r\n]+)', src_profiles, re.M):
    values = dict(re.findall(r'"?(height|aspect|imageScale|bottom|x)"?\s*:\s*(-?\d+(?:\.\d+)?)', match[2]))
    emitted = re.search(r'case "'+re.escape(match[1])+r'": return new BattlePortraitProfile\(([^)]+)\)',profile)
    check('portrait '+match[1], emitted and [float(x.strip().rstrip('f')) for x in emitted[1].split(',')]
          == [float(values[k]) for k in ['height','aspect','imageScale','bottom','x']])
arrow = read(UI / 'AimArrow.cs')
check('CSS to Unity Y-axis conversion points bow upwards', 'if (py < 0)' in arrow)
check('target click executes actual PlayCard command', 'cmd.PlayCard(cur.PendingTarget.Uid, idx, false)' in screen)
check('authoritative consumed pile and forecast; phase owns enemy hand motion',
      's.ConsumedPile ?? Array.Empty<string>()' in stage and 'var value = s.Forecast' in stage and 'bool enemy = s.Phase == "enemy"' in stage)
check('settings entry owns surrender and logs; tactics has no old extra buttons',
      'public static void OpenBattleSettings()' in stage and '_flee' not in stage and '_log =' not in stage)
check('shared seven controls resolved through Res', 'Res.BattleControl(key)' in stage and 'Res.BattleControl(skill.kind' in read(UI/'BattleRuleInputs.cs'))
check('source infusion workspace dimensions', all(t in stage for t in ['new Vector2(300,450)','new Vector2(190,285)','new Vector2(430,-676)']))
check('surrender confirmation implementation preserved', 'Time.unscaledTime + 2.6f' in read(UI/'BattleSurrenderButton.cs'))
module = (SOURCE / 'src/battle/view/battle.hand-layout.js').as_uri()
program = "const {handDisplayLayout:f}=await import("+json.dumps(module)+"); console.log(JSON.stringify(Array.from({length:9},(_,n)=>Array.from({length:n+1},(_,i)=>f(i,n+1,1256)))));"
result = subprocess.run(['node','--input-type=module','-e',program],capture_output=True,text=True,check=True)
reference = json.loads(result.stdout)
for rows in reference:
    n = len(rows); step = min(190,(1256-260)/(n-1)) if n>1 else 0
    for i, row in enumerate(rows):
        check('source formula n%d i%d'%(n,i), row['x']==math.floor((i-(n-1)/2)*step+.5) and row['rot']==0 and row['scale']==1 and row['rest']==64)
receipt = {'scope':'background-source-contract-only','sources':sources,
           'unitySources':[fingerprint(p) for p in sorted(UI.glob('*.cs'))],
           'checks':checks,'passed':len(checks),'renderedEffectsVerified':False,
           'notRun':['shared project compilation','Unity editor/player','native input','screenshots/pixel matching']}
(OUT/'source-contract-check.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'sources':len(sources),'visual':False},ensure_ascii=False))
