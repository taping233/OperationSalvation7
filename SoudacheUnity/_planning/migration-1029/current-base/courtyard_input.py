from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/CourtyardScreen.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('_preferences=CourtyardPreferences.Read(GameRuntime.I.Saves);','try{_preferences=CourtyardPreferences.Read(GameRuntime.I.Saves);}catch{_preferences=new CourtyardPreferences();}\n            _preferences.sound=_preferences.rain&&_preferences.sound;')
s=s.replace('var button=input.gameObject.AddComponent<Button>();button.targetGraphic=input.GetComponent<Image>();button.onClick.AddListener(()=>Interact(_pond.Model.Width*.5,_pond.Model.Height*.5));\n            var pointer=input.gameObject.AddComponent<CourtyardPointer>();pointer.Owner=this;pointer.Pond=_pond;button.navigation=new Navigation{mode=Navigation.Mode.Automatic};','var pointer=input.gameObject.AddComponent<CourtyardPointer>();pointer.Owner=this;pointer.Pond=_pond;pointer.targetGraphic=input.GetComponent<Image>();pointer.navigation=new Navigation{mode=Navigation.Mode.Automatic};')
s=s.replace('var info=H.Column(row,"courtyard-v3-info",6);','var info=H.Row(row,"courtyard-v3-info",24,56);')
s=s.replace('sealed class CourtyardPointer : MonoBehaviour,IPointerClickHandler,IPointerMoveHandler,IPointerExitHandler','sealed class CourtyardPointer : Selectable,IPointerClickHandler,IPointerMoveHandler,IPointerExitHandler,ISubmitHandler,IUpdateSelectedHandler')
s=s.replace('public CourtyardScreen Owner;public KoiPondGraphic Pond;','public CourtyardScreen Owner;public KoiPondGraphic Pond;int _lastFeedFrame=-1;\n        void Feed(double x,double y){if(_lastFeedFrame==Time.frameCount)return;_lastFeedFrame=Time.frameCount;Owner.Interact(x,y);}')
s=s.replace('var p=Point(data);Owner.Interact(p.x,p.y);','EventSystem.current?.SetSelectedGameObject(gameObject);var p=Point(data);Feed(p.x,p.y);')
s=s.replace('public void OnPointerExit(PointerEventData data)=>Pond.Model.Pointer(null,null);','public new void OnPointerExit(PointerEventData data){base.OnPointerExit(data);Pond.Model.Pointer(null,null);}\n        public void OnSubmit(BaseEventData data)=>Feed(Pond.Model.Width*.5,Pond.Model.Height*.5);\n        public void OnUpdateSelected(BaseEventData data){if(Input.GetKeyDown(KeyCode.Space))Feed(Pond.Model.Width*.5,Pond.Model.Height*.5);}')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/_planning/migration-1029/current-base/check-source.ps1');s=p.read_text(encoding='utf-8-sig').replace("\\Hub\\Hub[^\\]*\\.cs$'", "\\Hub\\(Hub[^\\]*|CourtyardScreen)\\.cs$'")
# Literal replacement of the existing PowerShell regex.
s=s.replace("'\\\\Hub\\\\Hub[^\\\\]*\\.cs$'", "'\\\\Hub\\\\(Hub[^\\\\]*|CourtyardScreen)\\.cs$'")
p.write_text(s,encoding='utf-8')
