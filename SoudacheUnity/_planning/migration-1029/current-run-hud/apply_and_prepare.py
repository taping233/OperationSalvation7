from pathlib import Path
import hashlib,json,uuid
from PIL import Image
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SOURCE=ROOT.parent/'搜打撤/game'
app=ROOT/'Assets/Scripts/Sdt.UI/Kit/App.cs'
s=app.read_text(encoding='utf-8-sig')
if 'CurrentUiPreferences.ApplyNativePerformance();' not in s:
    s=s.replace('            GameRuntime.I.BuildDerived();','''            GameRuntime.I.BuildDerived();
            CurrentUiPreferences.ApplyNativePerformance();
            Fx.ReducedMotion = () => CurrentUiPreferences.ReducedMotion;
            Fx.ReduceShake = () => CurrentUiPreferences.ReduceShake;
            BoardView.ReducedMotion = () => CurrentUiPreferences.ReducedMotion;''')
start=s.index('            static readonly KeyCode[] _polled =')
end=s.index('            static void PollRightClick()',start)
s=s[:start]+'''            static readonly KeyCode[] _polled = (KeyCode[])Enum.GetValues(typeof(KeyCode));
            static bool Ctrl => Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
            static bool Alt => Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt);
            static bool Meta => Input.GetKey(KeyCode.LeftCommand) || Input.GetKey(KeyCode.RightCommand);

            public static void PollKeys()
            {
                if (!Input.anyKeyDown || !string.IsNullOrEmpty(Input.compositionString)) return;
                // Key capture owns Escape as well; this precedes all overlay and gameplay handlers.
                foreach (var key in _polled)
                    if (Input.GetKeyDown(key) && CurrentInputBindings.KeyFor(key) != null && CurrentInputBindings.CaptureKey(key, Ctrl, Alt, Meta)) return;
                if (CurrentInputBindings.SuppressGameplayInput) return;
                var selected = EventSystem.current != null ? EventSystem.current.currentSelectedGameObject : null;
                if (selected != null && selected.GetComponentInParent<InputField>() != null) return;
                foreach (var key in _polled)
                {
                    if (!Input.GetKeyDown(key)) continue;
                    // Native Button submission (including hold-to-end-turn) keeps Space/Enter.
                    if ((key == KeyCode.Space || key == KeyCode.Return || key == KeyCode.KeypadEnter) && selected != null && selected.GetComponentInParent<Button>() != null) continue;
                    string action = CurrentInputBindings.ActionFor(CurrentInputBindings.KeyFor(key), Ctrl, Alt, Meta);
                    if (key == KeyCode.Escape)
                    {
                        if (SuggestionBox.IsOpen) { SuggestionBox.CloseIfOpen(); return; }
                        if (DesktopRunHud.Current?.CloseDetail() == true) return;
                        if (_keys.TryGetValue(key, out var close) && OwnsKey(key)) { close(); return; }
                        if (UiStack.Blocked) { if (UiStack.Top.CanCloseWithEscape) UiStack.Top.CloseFromEscape(); return; }
                    }
                    // A bag's historical B registration cannot bypass saved rebinding or the letter gate.
                    bool bagKey = _keyOwners.TryGetValue(key, out var owner) && owner is Screens.Bag.BagScreen;
                    if (!bagKey && _keys.TryGetValue(key, out var handler) && OwnsKey(key)) { handler(); continue; }
                    if (action == "backpack" && UiStack.Top is Screens.Bag.BagScreen) { Screens.Bag.BagScreen.Open(); continue; }
                    var runtime = GameRuntime.I;
                    if (action == null || !runtime.State.runActive || UiStack.Blocked) continue;
                    switch (action)
                    {
                        case "roll": DesktopRunHud.Current?.ChooseRoute(1); break;
                        case "movePrev": DesktopRunHud.Current?.ChooseRoute(-1); break;
                        case "moveConfirm": DesktopRunHud.Current?.ConfirmSelection(); break;
                        case "moveCancel": DesktopRunHud.Current?.ClearSelection(); break;
                        case "camRotateL": BoardViewHost.View?.Rotate(-.2f); break;
                        case "camRotateR": BoardViewHost.View?.Rotate(.2f); break;
                        case "camOverview": BoardViewHost.View?.FrameExploration(true); break;
                        case "camFocus": BoardViewHost.View?.FrameExploration(false); break;
                        case "backpack": Screens.Bag.BagScreen.Open(); break;
                        case "nodeNumbers": runtime.State.togglesIndex = !runtime.State.togglesIndex; BoardViewHost.SetNodeLabelsVisible(runtime.State.togglesIndex); break;
                    }
                }
            }

'''+s[end:]
with app.open('w',encoding='utf-8',newline='') as output:output.write(s)
dest=ROOT/'Assets/Resources/Art/Current/RunHud';dest.mkdir(parents=True,exist_ok=True)
assets=[]
for name in ['bag','safe','pocket','focus','overview']:
    source=SOURCE/f'assets/ui/map-tools-1021/{name}-v2.webp'
    image=Image.open(source).convert('RGBA');target=dest/f'{name}-v2.png';image.save(target)
    assets.append({'source':str(source.relative_to(SOURCE)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'target':str(target.relative_to(ROOT)),'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':image.size,'pixelsSha256':hashlib.sha256(image.tobytes()).hexdigest(),'pixelExact':Image.open(target).convert('RGBA').tobytes()==image.tobytes()})
for name in ['gold','attack']:
    source=SOURCE/f'assets/ui/map-hud-1015/{name}-is7-v2.webp';target=dest/f'{name}-v2.png';image=Image.open(source).convert('RGBA');image.save(target)
    assets.append({'source':str(source.relative_to(SOURCE)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'target':str(target.relative_to(ROOT)),'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':image.size,'pixelsSha256':hashlib.sha256(image.tobytes()).hexdigest(),'pixelExact':Image.open(target).convert('RGBA').tobytes()==image.tobytes()})
files=['src/ui/run-top-bar.js','src/ui/run-top-bar.css','src/core/game-boot-input.js','src/core/input.js','src/core/camera.js','src/ui/end-turn-hold.js','src/run/expedition.view.js','src/run/expedition-tool-art.js','src/core/map-node-state.js','css/page-expedition-hud.css','css/map-floating-tools.css','css/run-experience.css','css/expedition-map.css','css/archive-back.css','src/core/performance-settings.js','index.html','src/ui/battle-menu-icons.js']
(HERE/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in files},ensure_ascii=False,indent=2),encoding='utf-8')
(HERE/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
for path in list((ROOT/'Assets/Scripts/Sdt.UI/Kit').glob('Current*Hud*.cs'))+[ROOT/'Assets/Scripts/Sdt.UI/Kit/CurrentMapTools.cs',ROOT/'Assets/Scripts/Sdt.UI/Kit/CurrentRunTopBar.cs',ROOT/'Assets/Scripts/Sdt.UI/Kit/CurrentEndTurnHold.cs',ROOT/'Assets/Scripts/Sdt.Res/Res.CurrentRunHudAssets.cs']+list(dest.glob('*.png')):
    meta=Path(str(path)+'.meta')
    if not meta.exists():
        if path.suffix=='.cs':meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\n',encoding='utf-8')
        else:meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\nTextureImporter:\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 0\n  isReadable: 0\n  textureType: 0\n  alphaIsTransparency: 1\n  maxTextureSize: 2048\n  textureSettings:\n    filterMode: 1\n    aniso: 1\n    wrapU: 1\n    wrapV: 1\n    wrapW: 1\n  textureCompression: 0\n',encoding='utf-8')
folder_meta=Path(str(dest)+'.meta')
if not folder_meta.exists():folder_meta.write_text(f'fileFormatVersion: 2\nguid: {uuid.uuid4().hex}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {{}}\n',encoding='utf-8')
print('Input wired; original tools decoded pixel-exact:',all(a['pixelExact'] for a in assets))
