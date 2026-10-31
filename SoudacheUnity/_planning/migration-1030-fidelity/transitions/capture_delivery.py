from pathlib import Path
import hashlib,json,datetime
ROOT=Path.cwd();OUT=Path(__file__).resolve().parent
files=[
'Assets/Scripts/Sdt.UI/Screens/Run/CurrentRunFilm.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/CurrentRunFilm.Motion.cs',
'Assets/Resources/CurrentRunFilm.shader','Assets/Resources/Data/CurrentCinematicProfiles.json',
'Assets/Scripts/Sdt.UI/Screens/Run/CurrentEncounterOpening.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/CurrentBossGateScreen.cs',
'Assets/Scripts/Sdt.Run/GameRuntime.BossGate.cs','Assets/Scripts/Sdt.Core/RunState.cs',
'Assets/Scripts/Sdt.Run/GameRuntime.cs','Assets/Scripts/Sdt.Boot/RunLoopBridge.cs',
'Assets/Scripts/Sdt.Boot/BattleBridge.cs','Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentation.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/ExtractScreens.cs','Assets/Scripts/Sdt.UI/Screens/Run/EventDialogScreen.cs',
'Assets/Scripts/Sdt.UI/Screens/Run/AltarRitualScreen.cs','Assets/Scripts/Sdt.UI/Screens/Run/NodeModals.cs',
'Assets/Scripts/Sdt.UI/Screens/Hub/DepartureCinematic.cs','Assets/Scripts/Sdt.UI/Screens/Misc/CardLibraryScreen.cs',
'Assets/Editor/CurrentFilmFlowValidation.cs']
report={
 'status':'implementation-frozen-pending-root-native','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'files':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files},
 'sharedFileNote':'Hash snapshot does not claim unrelated prior changes. App, GameBoot, RunUi, docs and native runs have other owners.',
 'sourceChains':{
 'camp':'HubOpened -> current Hub -> source camp800+680',
 'resume':'RunLoaded -> restored destination under resume0+680',
 'photo':'actual openCardLibrary -> every PageEntry(photo)1100+760; exact owner cancellation',
 'loading':'root UiStack prepared menu/ClassChoice PageEntry integration160+420',
 'nodes':'NodeEntered -> door420/altar820/shop460/event520/emergency360 +680; no narrated fire/blank film',
 'battle':'actual map BattleRequested -> battle300+680; event combats intentionally direct',
 'boss':'actual boss arrival -> confirmation/banner/no RNG -> boss1500 -> atomic dedicated bossId -> BattleBridge checkpoint -> deck; Skip retains680',
 'passage':'actual TryUseDoor -> NodeMovementCompleted -> layer image3600+700; destination presentations wait until film finishes',
 'extraction':'persisted ExtractDoneScreen -> extraction1400+680; dedicated Skip140',
 'encounters':'EventDialog3/AltarRitual/BossGate shared five source specs; once per run/node lamp650+100 stagger',
 'door':'current source title/sub/goDoor; source inventory/back footer; old extraction/left-behind choices removed'},
 'reuse':{'profiles':17,'layers':4,'encounters':5,'images':10,'newImages':8,'reused':['existing city reflection','existing archive leaves'],'notActivated':['legacy SceneTransitionScreen/RunTransitionScreen','catalog-only retreat']},
 'checks':{
 'privateTypecheck':'complete production + independent Editor probe + existing OffscreenCapture: exit0/14warnings/0errors (existing production10+existing OffscreenCapture obsolete4)',
 'actualCoreRunChecks':json.loads((OUT/'data-check/results.json').read_text(encoding='utf-8'))},
 'native':{
 'runByThisAgent':False,'entryPoint':'Sdt.Editor.CurrentFilmFlowValidation.Run','requiredEnvironment':'SDT_UNITY_CHECK_OUTPUT; probe sets isolated SDT_UNITY_TEST_DATA',
 'independentScope':['actual title photo cold/warm/owner cancellation and develop frames','actual boss confirmation/back/reentry/no RNG','locked real profile failure after full source film; state/RNG/file rollback; retry','native raycast intercept and pointer Skip -> actual boss deck selection','actual altar/three event receipts -> five shared banners','door inventory/back/reentry/ordinary Skip -> actual goDoor -> passage time/frames/noSkip'],
 'unverified':['Unity shader compile/support/rendered fidelity','native actual timing/paint review','root complete departure/camp/resume/ordinary battle/victory/defeat/extraction flows','physical OS input'],
 'rootMustRun':True}}
(OUT/'delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('delivery.json: '+str(len(files))+' source files; '+str(report['checks']['actualCoreRunChecks']['count'])+' actual file/command checks; native pending')
