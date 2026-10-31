# -*- coding: utf-8 -*-
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[3]
d=Path(__file__).resolve().parent
files=['Assets/Scripts/Sdt.UI/Kit/SourceTextLayout.cs','Assets/Scripts/Sdt.UI/Kit/InlineIconText.cs','Assets/Scripts/Sdt.UI/Kit/CjkNativeLayout.cs','Assets/Scripts/Sdt.UI/Screens/Run/CardFace.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentBeginnerGuide.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentNodeScene.cs','Assets/Editor/CurrentCjkLayoutValidation.cs']
(d/'freeze.json').write_text(json.dumps({'state':'frozen','owner':'cjk_native_source_wrap','files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in files},'privateProductionCompile':'0 errors / 10 pre-existing warnings','privateEditorCompile':'0 errors / 0 warnings','syntheticAdvanceInvariants':21,'native':'Not run by subagent. Root must run Sdt.Editor.CurrentCjkLayoutValidation.Run, actual player and independent review.'},indent=2)+'\n',encoding='utf-8')
