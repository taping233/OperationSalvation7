// Direct view of preparation.view.js/preparation.css: tracked goals followed by two parallel preset sections.
using System;
using System.Collections;
using System.Linq;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Hub
{
    public sealed class PreparationScreen : Panel
    {
        BaseData _base;
        int? _slot;
        string _error, _goal = "";
        int _revision;bool _closed,_building,_busy;Text _notice;ScrollRect _scroll;
        readonly Dictionary<string,PreparationPreset> _drafts=new Dictionary<string,PreparationPreset>();
        readonly HashSet<string> _editors = new HashSet<string>();
        readonly Dictionary<string, string> _addKeys = new Dictionary<string, string>();
        readonly Dictionary<string, int> _addCounts = new Dictionary<string, int>();
        bool SourceCurrent=>ReferenceEquals(_base,GameRuntime.I.Base)&&_slot==GameRuntime.I.ActiveSlot;
        bool Current=>!_closed&&!_building&&!_busy&&isActiveAndEnabled&&UiStack.Top==this&&SourceCurrent;
        bool CurrentAt(int revision)=>revision==_revision&&Current;
        public static void Open()
        {
            var page = ScreenMount.Show<PreparationScreen>("Preparation"); page._base = GameRuntime.I.Base; page._slot = GameRuntime.I.ActiveSlot; page.Build();
        }
        public override void CloseFromEscape() => Leave();
        void Leave() { if(!Current)return;Close();if(SourceCurrent)HubScreen.Open("deploy"); }
        internal override void OnClose(){_closed=true;_revision++;}
        public override void Build()
        {
            if(!SourceCurrent){Close();return;}if(!Current)return;
            var selected=EventSystem.current?.currentSelectedGameObject;string focus=selected!=null&&selected.transform.IsChildOf(transform)?selected.name:null;
            float position=_scroll!=null?_scroll.verticalNormalizedPosition:1;
            _revision++;_building=true;UIKit.ClearChildren(transform);
            try{
            var shell = UIKit.Panel("preparation-shell", transform).transform;
            var art = D.Area(shell, "prep-desk", Vector2.zero, Vector2.one); art.gameObject.AddComponent<RectMask2D>();
            var image = D.Area(art, "cover", Vector2.zero, Vector2.one).gameObject.AddComponent<Image>(); D.Cover(image, Sdt.Res.Res.Scene("ui-loop-0925/prep-desk"));
            var tint = D.Area(shell, "desk-overlay", Vector2.zero, Vector2.one); D.Surface(tint, Theme.HexA("#14212C", .94f));
            var header = D.Area(shell, "collection-header", new Vector2(0, 1), Vector2.one, new Vector2(0, -94), Vector2.zero); D.Surface(header, Theme.Hex("#15222B"));
            Bind(D.CommandAt(header, "preparationBack", "‹ 返回", null, Vector2.zero, new Vector2(0, 1), new Vector2(32, 22), new Vector2(160, -22), Color.clear),Leave);
            D.TextAt(header, "目标与预设", 30, Vector2.zero, Vector2.one, new Vector2(196, 22), new Vector2(-32, -22));
            var scroll = D.Scroll(shell, "preparationRoot", Vector2.zero, Vector2.one, new Vector2(32, 32), new Vector2(-32, -126));
            _scroll=scroll.GetComponentInParent<ScrollRect>();
            var scrollLayout = scroll.GetComponent<VerticalLayoutGroup>(); scrollLayout.childForceExpandWidth = false; scrollLayout.childAlignment = TextAnchor.UpperCenter;
            var module = D.Flow(scroll, "preparation-module", false, 24); var bounds = module.gameObject.AddComponent<LayoutElement>(); bounds.minWidth = 0; bounds.preferredWidth = 1500; bounds.flexibleWidth = 0;
            BuildGoals(module);
            var row = D.Flow(module, "prep-presets", true, 24); var layout = row.GetComponent<HorizontalLayoutGroup>(); layout.childForceExpandWidth = true; layout.childForceExpandHeight = false;
            foreach(var preset in _base.PreparationPresets())BuildPreset(row,_drafts.TryGetValue(preset.id,out var draft)?draft:preset);
            _notice=D.Copy(module,_error??"",20,Theme.Hex("#E8B9AE"));_notice.name="preparation-notice";_notice.gameObject.SetActive(!string.IsNullOrEmpty(_error));
            }finally{_building=false;}
            StartCoroutine(RestoreView(_revision,focus,selected,position));
        }
        IEnumerator RestoreView(int revision,string focus,GameObject previous,float position)
        {
            yield return null;if(!CurrentAt(revision))yield break;_scroll.verticalNormalizedPosition=position;
            var selected=EventSystem.current?.currentSelectedGameObject;
            if(selected!=null&&selected!=previous&&selected.activeInHierarchy)yield break;
            var target=GetComponentsInChildren<Selectable>().FirstOrDefault(control=>control.name==focus&&control.IsInteractable());
            if(target!=null)EventSystem.current?.SetSelectedGameObject(target.gameObject);
        }
        void ShowError(string error){_error=error;if(_notice!=null){_notice.text=error??"";_notice.gameObject.SetActive(!string.IsNullOrEmpty(error));}}
        void Save(PreparationPreset preset,bool defer=false)
        {
            if(!Current)return;int revision=_revision;bool saved;string error;
            _busy=true;try{saved=_base.TrySavePreparationPreset(preset,out error);}finally{_busy=false;}
            if(!CurrentAt(revision))return;
            if(!saved){_drafts[preset.id]=preset;ShowError(error);return;}
            _drafts.Remove(preset.id);ShowError(_drafts.Count>0?_error:null);if(defer)StartCoroutine(RefreshAfterEdit(revision));else Build();
        }
        IEnumerator RefreshAfterEdit(int revision){yield return null;if(CurrentAt(revision))Build();}
        void Track(IEnumerable<string> targets)
        {
            if(!Current)return;int revision=_revision;bool saved;string error;
            _busy=true;try{saved=_base.TrySetTrackedGoals(targets,out error);}finally{_busy=false;}
            if(!CurrentAt(revision))return;ShowError(error??(_drafts.Count>0?_error:null));if(saved)Build();
        }
        Button Bind(Button button,Action action)
        {
            int revision=_revision;button.onClick=new Button.ButtonClickedEvent();
            button.onClick.AddListener(()=>{if(!CurrentAt(revision)||!button.IsActive()||!button.IsInteractable())return;AudioService.I.PlaySfx("click");action();});return button;
        }
        Button Command(Transform parent,string name,string caption,Action action,Color? background=null,Color? ink=null,int size=19)
            =>Bind(D.Command(parent,name,caption,null,background,ink,size),action);
        void BuildGoals(Transform parent)
        {
            var tracked = _base.PreparationTracked();
            var header=D.Flow(parent,"prep-goals-head",true,24);header.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleCenter;
            D.Copy(header,"收藏目标",26);
            var count=D.Copy(header,"追踪 "+tracked.Count+"/3",18,D.Muted);count.alignment=TextAnchor.MiddleRight;ContentWidth(count.gameObject,count.preferredWidth);
            if (tracked.Count == 0)
            {
                var empty=D.Area(parent,"prep-goals",Vector2.zero,Vector2.one);var le=UIKit.GetOrAdd<LayoutElement>(empty);le.minHeight=le.preferredHeight=79;le.flexibleWidth=1;
                var copy=D.TextAt(empty,"未追踪目标",18,Vector2.zero,Vector2.one,new Vector2(24,24),new Vector2(-24,-24),D.Muted);copy.alignment=TextAnchor.MiddleCenter;
                Border(empty,true);
            }
            else
            {
                var cards = D.Flow(parent, "prep-goals", true, 16);cards.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.UpperLeft;
                foreach (string id in tracked)
                {
                    var card = CardLibrary.FindById(id); var section = D.Flow(cards, "goal-" + id, true, 16, new RectOffset(20, 20, 18, 18)); D.Surface(section, Theme.HexA("#FFFFFF", .02f));EqualWidth(section);Border(section);section.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;
                    var info=D.Flow(section,"goal-copy",false,8);EqualWidth(info);D.Copy(info,card?.name??id,22).fontStyle=FontStyle.Bold;D.Copy(info,BaseData.PreparationSourceHint(card),18,D.Muted);
                    var remove=Command(section,"goal-remove-"+id,"取消追踪",()=>Track(tracked.Where(target=>target!=id)),Theme.Hex("#1D303B"));FitControl(remove);
                }
                // CSS repeat(3,minmax(0,1fr)): an incomplete row retains three equal tracks.
                for(int i=tracked.Count;i<3;i++){var slot=D.Area(cards,"empty-grid-track",Vector2.zero,Vector2.one);EqualWidth(slot);}
            }
            var add = D.Flow(parent, "prep-goal-add", true, 16); var options = CardLibrary.All().GroupBy(card => card.id).Select(group => group.First()).ToArray();
            Select(add,"prep-goal-select","选择收藏目标",_goal,options.Select(card=>(card.id,card.name)),id=>_goal=id);
            var button=Command(add,"goal-add","加入追踪",()=>{if(!string.IsNullOrEmpty(_goal))Track(tracked.Concat(new[]{_goal}));},Theme.Hex("#1D303B"));button.interactable=tracked.Count<3;
            add.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;FitControl(button);
        }
        void BuildPreset(Transform parent, PreparationPreset preset)
        {
            var section = D.Flow(parent, "prep-preset " + preset.id, false, 20, new RectOffset(24, 24, 24, 24)); D.Surface(section, Theme.HexA("#182932", .86f));EqualWidth(section);Border(section);
            var preview = _base.PreviewPreparation(preset); var pet = BaseData.PetsCatalog.FirstOrDefault(p => p.id == (preset.petId ?? _base.petSel));
            D.Copy(section, preset.name, 26).fontStyle = FontStyle.Bold;
            D.Copy(section, (CharacterTable.For(preset.characterId)?.name ?? "未选择人物") + " · " + (string.IsNullOrEmpty(preset.petId) ? "沿用当前伙伴（" + pet?.name + "）" : pet?.name) + " · " + preset.picks.Count + " 种卡牌", 18, D.Muted);
            var edit=Command(section,"prep-preset-editor "+preset.id,(_editors.Contains(preset.id)?"▾ ":"▸ ")+"编辑人物与卡牌",()=>{if(!_editors.Add(preset.id))_editors.Remove(preset.id);Build();},Color.clear,Theme.Hex("#C6D5DC"),20);
            edit.GetComponentInChildren<Text>().alignment=TextAnchor.MiddleLeft;var editBounds=UIKit.GetOrAdd<LayoutElement>(edit);editBounds.preferredHeight=62;
            if (_editors.Contains(preset.id))
            {
                D.Copy(section,"方案名",18,D.Muted);Input(section,"prep-name-"+preset.id,preset.name,24,value=>{preset.name=value;Save(preset,true);});
                var fields = D.Flow(section, "prep-fields", true, 16);
                Select(fields,"prep-character-"+preset.id,"未选择人物",preset.characterId,CharacterTable.All.Select(c=>(c.id,c.name)),id=>{preset.characterId=id==""?null:id;Save(preset,true);});
                Select(fields,"prep-pet-"+preset.id,"沿用当前伙伴",preset.petId,BaseData.PetsCatalog.Select(p=>(p.id,p.name)),id=>{preset.petId=id==""?null:id;Save(preset,true);});
                foreach (var pick in preset.picks.ToArray())
                {
                    var result = preview.resolvedPicks.FirstOrDefault(item => item.card.cardId == pick.card.cardId && item.card.variantKey == pick.card.variantKey);
                    var row = D.Flow(section, "prep-pick", true, 12); D.Surface(row, Theme.HexA("#0B1722", .29f));
                    D.Copy(row, (result?.name ?? pick.card.cardId) + " ×" + pick.count + "\n" + (result?.status == "ready" ? "已有 " + result.availableCount : result?.status == "forbidden" ? "职业卡禁带" : "缺 " + Math.Max(0, pick.count - (result?.availableCount ?? 0))) + (string.IsNullOrEmpty(pick.card.variantKey) ? " · 基础优先" : " · 指定版本"), 18, D.Muted);
                    Command(row,"preset-pick-remove-"+preset.id+"-"+pick.card.cardId+"-"+pick.card.variantKey,"移除",()=>{preset.picks.Remove(pick);Save(preset);},Theme.Hex("#1D303B"));
                }
                if (preset.picks.Count == 0) D.Copy(section, "还没有选择带入卡牌。", 18, D.Muted);
                var add = D.Flow(section, "prep-add", true, 12);
                var stocks = _base.stash.Where(stack => stack.card?.id != null && stack.count > 0 && GameRuntime.I.FindDepartureStack(GameRuntime.DepartureStackKey(stack)) == stack).ToArray();
                _addKeys.TryGetValue(preset.id, out var selectedKey);
                Select(add,"prep-stock-"+preset.id,"选择仓库卡牌",selectedKey,stocks.Select(stack=>(GameRuntime.DepartureStackKey(stack),stack.card.name+" · "+stack.card.rarity+" · "+stack.card.cost+"费 · 库存 "+stack.count)),key=>_addKeys[preset.id]=key);
                int count = _addCounts.TryGetValue(preset.id, out var n) ? n : 1;
                Input(add,"prep-count-"+preset.id,count.ToString(),2,value=>{_addCounts[preset.id]=int.TryParse(value,out var quantity)?Math.Max(1,Math.Min(99,quantity)):1;},true);
                var addPick=Command(add,"preset-pick-add-"+preset.id,"加入愿望清单",()=>
                {
                    if (!Current || !_addKeys.TryGetValue(preset.id, out var key)) return; var stack = GameRuntime.I.FindDepartureStack(key); if (stack == null) return;
                    string variant = stack.variantKey ?? stack.card.variantKey; var existing = preset.picks.FirstOrDefault(item => item.card.cardId == stack.card.id && item.card.variantKey == variant);
                    if (existing != null) preset.picks.Remove(existing);
                    preset.picks.Add(new PreparationPick { card = new PreparationCardRef { cardId = stack.card.id, variantKey = variant }, count = _addCounts.TryGetValue(preset.id, out var requested) ? requested : 1 }); Save(preset);
                }, Theme.Hex("#1D303B"));
                FitControl(addPick);add.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;
            }
            D.Copy(section, preview.canStart ? "可以应用" : "需要处理", 22, preview.canStart ? D.Accent : Theme.Hex("#D6A79D"));
            D.Copy(section, "带入 " + preview.stashCards + " 张 · 占 " + (preview.capacity?.used ?? 0) + "/" + (preview.capacity?.totalCap ?? _base.BagCap) + " 格 · " + preview.resolvedPicks.Count(item => item.status == "missing") + " 缺失 · " + preview.resolvedPicks.Count(item => item.status == "forbidden") + " 禁带", 18, D.Muted);
            var actions = D.Flow(section, "prep-summary-actions", true, 12);
            Command(actions,"preset-preview-"+preset.id,"重新预览",Build,Theme.Hex("#1D303B"));
            var apply=Command(actions,"preset-apply-"+preset.id,"应用到整备",()=>
            {
                if(_drafts.ContainsKey(preset.id)){ShowError("此预设的编辑尚未保存，请重新提交编辑以重试，再应用到整备。");return;}
                var fresh=_base.PreparationPresets().First(item=>item.id==preset.id);
                if(!_base.PreviewPreparation(fresh).canStart){ShowError("库存或资格已变化，请重新预览。");return;}
                Close();if(SourceCurrent)DepartPrepScreen.OpenPreset(fresh);
            },D.Accent,Theme.Hex("#173B42"));apply.interactable=preview.canStart;
            foreach (string error in preview.errors) D.Copy(section, error, 18, Theme.Hex("#D6A79D"));
            D.Copy(section, "应用后，在整备页确认人物、伙伴与卡牌。", 16, D.Muted);
        }
        static void EqualWidth(Transform node)
        {var le=UIKit.GetOrAdd<LayoutElement>(node);le.minWidth=le.preferredWidth=0;le.flexibleWidth=1;}
        static void ContentWidth(GameObject node,float width)
        {var le=UIKit.GetOrAdd<LayoutElement>(node);le.minWidth=le.preferredWidth=width;le.flexibleWidth=0;}
        static void FitControl(Button button)
        {var text=button.GetComponentInChildren<Text>();text.fontSize=18;text.horizontalOverflow=HorizontalWrapMode.Overflow;ContentWidth(button.gameObject,text.preferredWidth+30);var le=UIKit.GetOrAdd<LayoutElement>(button);le.minHeight=le.preferredHeight=49;}
        static void Border(Transform parent,bool dashed=false)
        {var rect=D.Area(parent,"prep-line",Vector2.zero,Vector2.one);UIKit.GetOrAdd<LayoutElement>(rect).ignoreLayout=true;var line=UIKit.GetOrAdd<PreparationBorder>(rect);line.Dashed=dashed;line.color=Theme.HexA("#A8BBC9",.18f);line.raycastTarget=false;}
        void Input(Transform parent,string name,string value,int limit,Action<string> changed,bool numeric=false)
        {
            int revision=_revision;var root=new GameObject(name,typeof(RectTransform),typeof(Image),typeof(InputField));root.transform.SetParent(parent,false);root.GetComponent<Image>().color=Theme.Hex("#1D303B");root.AddComponent<LayoutElement>().preferredHeight=44;
            if (numeric) { var le = root.GetComponent<LayoutElement>(); le.preferredWidth = 84; le.flexibleWidth = 0; }
            var text = D.TextAt(root.transform, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 6), new Vector2(-14, -6));
            var input = root.GetComponent<InputField>(); input.textComponent = text; input.characterLimit = limit; input.text = value ?? ""; if (numeric) input.contentType = InputField.ContentType.IntegerNumber;
            input.onEndEdit=new InputField.EndEditEvent();input.onEndEdit.AddListener(v=>{if(CurrentAt(revision)&&input.IsActive()&&input.IsInteractable())changed(v);});
        }
        void Select(Transform parent,string name,string empty,string value,IEnumerable<(string id,string name)> choices,Action<string> changed)
        {
            int revision=_revision;
            var options = new[] { (id: "", name: empty) }.Concat(choices).ToArray();
            var root=D.Area(parent,name,Vector2.zero,Vector2.one);D.Surface(root,Theme.Hex("#1D303B"));var le=UIKit.GetOrAdd<LayoutElement>(root);le.minWidth=0;le.flexibleWidth=1;le.minHeight=le.preferredHeight=49;
            var dropdown = root.gameObject.AddComponent<Dropdown>(); dropdown.targetGraphic = root.GetComponent<Image>(); dropdown.captionText = D.TextAt(root, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 6), new Vector2(-24, -6));
            var template = D.Area(root, "Template", Vector2.zero, new Vector2(1, 0), new Vector2(0, -250), Vector2.zero); D.Surface(template, Theme.Hex("#1D303B"));
            var scroll = template.gameObject.AddComponent<ScrollRect>(); scroll.horizontal = false;
            var viewport = D.Area(template, "Viewport", Vector2.zero, Vector2.one); viewport.gameObject.AddComponent<RectMask2D>(); D.Surface(viewport, Color.clear);
            var content = D.Area(viewport, "Content", new Vector2(0, 1), Vector2.one, new Vector2(0, -44), Vector2.zero); content.pivot = new Vector2(.5f, 1);
            var item = D.Area(content, "Item", new Vector2(0, .5f), new Vector2(1, .5f), new Vector2(0, -22), new Vector2(0, 22)); var image = D.Surface(item, Theme.Hex("#315D69")); item.gameObject.AddComponent<Toggle>().targetGraphic = image;
            dropdown.itemText = D.TextAt(item, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 4), new Vector2(-14, -4)); dropdown.template = template; scroll.viewport = viewport; scroll.content = content; template.gameObject.SetActive(false);
            dropdown.AddOptions(options.Select(option=>option.name).ToList());dropdown.value=Math.Max(0,Array.FindIndex(options,option=>option.id==value));dropdown.onValueChanged=new Dropdown.DropdownEvent();dropdown.onValueChanged.AddListener(i=>{if(CurrentAt(revision)&&dropdown.IsActive()&&dropdown.IsInteractable()&&i>=0&&i<options.Length)changed(options[i].id);});
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PreparationBorder : MaskableGraphic
    {
        public bool Dashed;
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();var r=rectTransform.rect;float step=Dashed?8:Mathf.Max(r.width,r.height)+1;
            for(float x=0;x<r.width;x+=step){float end=Mathf.Min(r.width,x+(Dashed?4:step));Quad(vh,r.x+x,r.y,r.x+end,r.y+1);Quad(vh,r.x+x,r.yMax-1,r.x+end,r.yMax);}
            for(float y=0;y<r.height;y+=step){float end=Mathf.Min(r.height,y+(Dashed?4:step));Quad(vh,r.x,r.y+y,r.x+1,r.y+end);Quad(vh,r.xMax-1,r.y+y,r.xMax,r.y+end);}
        }
        void Quad(VertexHelper vh,float left,float bottom,float right,float top)
        {int n=vh.currentVertCount;vh.AddVert(new Vector3(left,bottom,0),color,Vector2.zero);vh.AddVert(new Vector3(left,top,0),color,Vector2.zero);vh.AddVert(new Vector3(right,top,0),color,Vector2.zero);vh.AddVert(new Vector3(right,bottom,0),color,Vector2.zero);vh.AddTriangle(n,n+1,n+2);vh.AddTriangle(n,n+2,n+3);}
    }
}
