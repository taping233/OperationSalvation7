using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattleHoverInfo : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, ISelectHandler, IDeselectHandler
    {
        Action _show;
        public void Setup(Action show) { _show = show; }
        public void OnPointerEnter(PointerEventData e) { _show?.Invoke(); }
        public void OnPointerExit(PointerEventData e) { BattleReadout.Hide(); }
        public void OnSelect(BaseEventData e) { _show?.Invoke(); }
        public void OnDeselect(BaseEventData e) { BattleReadout.Hide(); }
        void OnDisable() { BattleReadout.Hide(); }
    }
    public static class BattleReadout
    {
        static GameObject _root;
        public static void Hide() { if (_root != null) { _root.SetActive(false); UnityEngine.Object.Destroy(_root); _root = null; } }
        public static void Show(Transform parent, string title, string detail)
        {
            Hide(); var rt = BattleScreen.BattleRect("battle-tooltip", parent); _root = rt.gameObject;
            BattleScreen.Fixed(rt, new Vector2(0, 1), new Vector2(0, 1), new Vector2(56, -230), new Vector2(400, 180));
            _root.AddComponent<Image>().color = BtColors.HexA("#10232B", .97f);
            var layout = _root.AddComponent<VerticalLayoutGroup>(); layout.padding = new RectOffset(16,16,12,12); layout.spacing = 8;
            layout.childForceExpandHeight = false; layout.childControlWidth = layout.childControlHeight = true;
            UIKit.Label(rt, title ?? "", 22, BtColors.Hex("#F0E0B8")).raycastTarget = false;
            UIKit.Label(rt, detail ?? "", 20, BtColors.Hex("#D5E1E3")).raycastTarget = false;
            _root.GetComponent<Image>().raycastTarget = false;
        }
    }
    public sealed class BattlePileScreen : Panel
    {
        string _title; IReadOnlyList<string> _uids;
        IReadOnlyList<CurrentBattlePileData.Stack> _stacks;
        readonly List<Button> _inspect = new List<Button>();
        readonly List<(CanvasGroup Group,float Alpha)> _hidden = new List<(CanvasGroup,float)>();
        readonly Dictionary<string,Sdt.Res.CurrentCardPresentation.Context> _descriptions=new Dictionary<string,Sdt.Res.CurrentCardPresentation.Context>();
        Sdt.Core.CardDef[] _readerCards;BattleScreen _owner;Button _opener;string _token;
        public string Kind { get; private set; }
        public IReadOnlyList<CurrentBattlePileData.Stack> Stacks => _stacks;
        public ScrollRect Scroll { get; private set; }
        public static void Open(string title, IReadOnlyList<string> uids,BattleScreen owner,Button opener)
        {
            if(owner==null||UiStack.Top!=owner)return;
            var page = ScreenMount.Show<BattlePileScreen>("BattlePile");
            page.Kind = title == "消耗牌堆" ? "grave" : "deck";
            page._title = page.Kind == "grave" ? "[[icon:consumed-pile]] 消耗牌堆" : "[[icon:draw-pile]] 剩余牌库";
            page._owner=owner;page._opener=opener;page._token=GameSnapshotRef.Current.BattleToken;
            page._uids = uids.ToArray(); page.Build();
        }
        public override void Build()
        {try{BuildPile();}catch{RestoreForeground();throw;}}
        void BuildPile()
        {
            var snapshot = GameSnapshotRef.Current;
            var entries=new List<CurrentBattlePileData.Entry>();
            foreach(string uid in _uids)
            {
                var state=BattleView.Api.CardPresentation(uid);if(state==null)continue;
                var description=CardFace.BattleDescription(snapshot,uid);_descriptions.Add(uid,description);
                entries.Add(new CurrentBattlePileData.Entry { Uid=uid,Card=state.Card,EffectiveCost=state.EffectiveCost,State=state,
                    Presentation=Kind=="deck"||description==null?null:JToken.FromObject(description) });
            }
            _stacks = CurrentBattlePileData.Build(entries, Kind != "deck");
            _readerCards=_stacks.Select(stack=>stack.Card).ToArray();
            UiStack.SetMaskColor(this,Color.clear);
            HideForeground();
            var backdrop=BattleScreen.BattleRect("battle-pile-stage-filter",transform);UiStack.Stretch(backdrop);
            var backdropImage=UIKit.GetOrAdd<Image>(backdrop);backdropImage.color=Color.white;backdropImage.raycastTarget=false;
            var material=Sdt.UI.Screens.Menu.CurrentHomeMaterials.Composite(backdropImage,2,7);
            if(material!=null){material.SetFloat("_Panel",2);material.SetColor("_Tint",BtColors.HexA("#10161b",.28f));}
            var shade = BattleScreen.BattleRect("battle-pile-backdrop", transform); UiStack.Stretch(shade);
            UIKit.GetOrAdd<Image>(shade).color = BtColors.Hex("#050d1766");
            var root = BattleScreen.BattleRect("battle-decision pile", transform);
            var available = ((RectTransform)transform).rect.size;
            float width = Mathf.Min(1700, available.x), height = Mathf.Min(900, available.y);
            BattleScreen.Fixed(root,Vector2.one*.5f,Vector2.one*.5f,Vector2.zero,new Vector2(width,height));
            var title = UIKit.Label(root, _title, 36, BtColors.Hex("#eee3c6"));
            title.name="battle-pile-title";
            title.font = Sdt.Res.Res.SansBold; title.lineSpacing = SourceTextLayout.LineSpacing(title,1.3f);title.alignment=TextAnchor.MiddleCenter;
            BattleScreen.Fixed(title.rectTransform,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-18),new Vector2(700,47));
            var total=UIKit.Label(root,entries.Count+" 张",24,BtColors.Hex("#cadbe2"));total.alignment=TextAnchor.MiddleRight;
            total.name="battle-pile-total";
            BattleScreen.Fixed(total.rectTransform,new Vector2(1,1),new Vector2(1,1),new Vector2(-36,-18),new Vector2(320,47));
            var body = BattleScreen.BattleRect("battle-decision-content", root);
            body.anchorMin = Vector2.zero; body.anchorMax = Vector2.one; body.offsetMin = new Vector2(24,96); body.offsetMax = new Vector2(-24,-85);
            var scroll = UIKit.Scroll(body);
            Scroll=scroll.GetComponentInParent<ScrollRect>();Scroll.name="battle-pile-scroll";Scroll.movementType=ScrollRect.MovementType.Clamped;Scroll.scrollSensitivity=36;
            DestroyImmediate(scroll.GetComponent<VerticalLayoutGroup>());
            var grid = UIKit.GetOrAdd<GridLayoutGroup>(scroll); grid.cellSize = new Vector2(280,420); grid.spacing = new Vector2(40,36);grid.padding=new RectOffset(16,16,14,24);grid.childAlignment=TextAnchor.UpperCenter;
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = Mathf.Max(1, Mathf.FloorToInt((width-48-32+40)/320));
            AttachScrollbar(Scroll);
            for(int index=0;index<_stacks.Count;index++)
            {
                int selected=index;var stack=_stacks[index];
                var host=BattleScreen.BattleRect("btDecisionInspect-"+index,scroll.transform);
                var hit=UIKit.GetOrAdd<Image>(host);hit.color=Color.clear;
                var button=UIKit.GetOrAdd<Button>(host);button.targetGraphic=hit;button.transition=Selectable.Transition.None;
                button.onClick.AddListener(()=>Inspect(selected));_inspect.Add(button);
                var face=DepartureElements.Card(host,stack.Card,280,"battle-pile-card-face",Options(index,false));
                face.anchorMin=face.anchorMax=face.pivot=Vector2.one*.5f;face.anchoredPosition=Vector2.zero;
                // Source pile faces have pointer-events:none; their outer button owns inspection.
                foreach(var graphic in face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;
                foreach(var innerScroll in face.GetComponentsInChildren<ScrollRect>())innerScroll.enabled=false;
                if(stack.Count>1)
                {
                    var badge=BattleScreen.BattleRect("battle-pile-count",host);UIKit.GetOrAdd<Image>(badge).color=BtColors.Hex("#102631ed");
                    var count=UIKit.Label(badge,"×"+stack.Count,25,BtColors.Hex("#f3e5bd"));count.font=Sdt.Res.Res.SansBold;
                    BattleScreen.Fixed(badge,new Vector2(1,1),new Vector2(1,1),new Vector2(-12,-10),new Vector2(Mathf.Max(42,count.preferredWidth+20),39));
                    UiStack.Stretch(count.rectTransform);count.alignment=TextAnchor.MiddleCenter;count.raycastTarget=false;
                }
            }
            if (_stacks.Count == 0){var empty=UIKit.Label(body,Kind=="grave"?"消耗牌堆为空":"牌库已空",26,BtColors.Hex("#c4d5dc"));UiStack.Stretch(empty.rectTransform);empty.alignment=TextAnchor.MiddleCenter;}
            var back = BtBtn.Create(root, "返回战斗", Close, "ok");
            back.name=Kind=="grave"?"btGraveBack":"btDeckBack";
            foreach(var text in back.GetComponentsInChildren<Text>())text.fontSize=24;
            BattleScreen.Fixed((RectTransform)back.transform,new Vector2(1,0),new Vector2(1,0),new Vector2(-36,16),new Vector2(180,60));
        }
        CardFaceOptions Options(int index,bool reading=true)
        {
            var stack=_stacks[index];
            return new CardFaceOptions{HideCost=false,ScrollDescription=reading,CostOverride=stack.EffectiveCost,
                DescriptionContext=_descriptions[stack.Uids[0]],Presentation=stack.State};
        }
        static void AttachScrollbar(ScrollRect scroll)
        {
            // Same native Scrollbar binding as the existing card/studio readers;
            // this viewport keeps its own source thin transparent rail and blue thumb.
            var rail=BattleScreen.BattleRect("battle-pile-scrollbar",scroll.viewport);
            rail.anchorMin=new Vector2(1,0);rail.anchorMax=Vector2.one;rail.offsetMin=new Vector2(-6,0);rail.offsetMax=Vector2.zero;
            UIKit.GetOrAdd<Image>(rail).color=Color.clear;
            var handle=BattleScreen.BattleRect("handle",rail);UiStack.Stretch(handle);
            var ink=UIKit.GetOrAdd<Image>(handle);ink.color=BtColors.Hex("#afc5cf6b");
            var bar=UIKit.GetOrAdd<Scrollbar>(rail);bar.handleRect=handle;bar.targetGraphic=ink;bar.direction=Scrollbar.Direction.BottomToTop;bar.transition=Selectable.Transition.None;
            scroll.verticalScrollbar=bar;scroll.verticalScrollbarVisibility=ScrollRect.ScrollbarVisibility.AutoHide;
        }
        void Inspect(int index)
        {
            if(UiStack.Top!=this||!SourceCurrent)return;
            DepartureCardZoom.Open(_readerCards,index,
                current=>Options(current),current=>_inspect[current].gameObject,sourceCurrent:()=>SourceCurrent);
        }
        void HideForeground()
        {
            var battle=UiStack.CapturePanels().OfType<BattleScreen>().LastOrDefault();if(battle==null)return;
            foreach(var actor in battle.GetComponentsInChildren<BattleUnitFrames>())Hide(actor.transform);
            var foreground=Sdt.Res.Res.BattleLayer("foreground");
            foreach(var image in battle.GetComponentsInChildren<Image>().Where(image=>image.sprite==foreground&&foreground!=null))Hide(image.transform);
        }
        void Hide(Transform target)
        {var group=UIKit.GetOrAdd<CanvasGroup>(target);if(_hidden.Any(item=>item.Group==group))return;_hidden.Add((group,group.alpha));group.alpha=0;}
        void RestoreForeground()
        {foreach(var item in _hidden)if(item.Group!=null)item.Group.alpha=item.Alpha;_hidden.Clear();}
        bool SourceCurrent
        {
            get
            {
                if(_owner==null||GameSnapshotRef.Current?.BattleToken!=_token||GameSnapshotRef.Current.over)return false;
                for(int i=0;i<UiStack.Count;i++)if(UiStack.PanelAt(i)==_owner)return true;
                return false;
            }
        }
        internal override void OnClose()
        {
            RestoreForeground();
            if(SourceCurrent&&UiStack.Top==_owner&&_opener!=null&&_opener.isActiveAndEnabled&&_opener.IsInteractable()
                &&EventSystem.current!=null)EventSystem.current.SetSelectedGameObject(_opener.gameObject);
        }
        protected override void OnDestroy()=>RestoreForeground();
    }
    public sealed class BattleLogScreen : Panel
    {
        IReadOnlyList<string> _entries;
        public static void Open(IReadOnlyList<string> entries)
        { var page = ScreenMount.Show<BattleLogScreen>("BattleLog"); page._entries = new List<string>(entries); page.Build(); }
        public override void Build()
        {
            var root = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, "战斗日志", wide:true);
            var scroll = UIKit.Scroll(root.transform);
            foreach (string entry in _entries) { var copy = UIKit.IconText(scroll.transform, entry); copy.fontSize = 20; CurrentReadingPreference.Bind(copy); }
            if (_entries.Count == 0) UIKit.Label(scroll.transform, "还没有战斗记录", 24, Theme.Sub);
            BtBtn.Create(root.transform, "返回战斗", Close, "ok");
        }
    }
}
