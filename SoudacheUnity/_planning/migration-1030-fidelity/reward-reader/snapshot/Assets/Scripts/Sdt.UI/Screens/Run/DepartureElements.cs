// Local projection primitives for roster-departure-v2.css and departure-selected.css.
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.Core;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    internal static class DepartureElements
    {
        internal static readonly Color Ink = Theme.Hex("#EDF5F4"), Muted = Theme.Hex("#BFD0D0"), Accent = Theme.Hex("#ACD6CE");
        static Sprite _round;
        static Sprite Rounded
        {
            get
            {
                if (_round != null) return _round;
                const int side = 64; const float radius = 16;
                var tex = new Texture2D(side, side, TextureFormat.RGBA32, false) { name = "departure-css-radius", wrapMode = TextureWrapMode.Clamp };
                for (int y = 0; y < side; y++) for (int x = 0; x < side; x++)
                {
                    float dx = Mathf.Max(0, Mathf.Abs(x - 31.5f) - 16), dy = Mathf.Max(0, Mathf.Abs(y - 31.5f) - 16);
                    tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(radius - Mathf.Sqrt(dx * dx + dy * dy))));
                }
                tex.Apply(); return _round = Sprite.Create(tex, new Rect(0, 0, side, side), Vector2.one * .5f, 100, 0, SpriteMeshType.FullRect, new Vector4(18, 18, 18, 18));
            }
        }
        internal static RectTransform Area(Transform parent, string name, Vector2 min, Vector2 max, Vector2? low = null, Vector2? high = null)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>(); rect.SetParent(parent, false);
            Place(rect, min, max, low ?? Vector2.zero, high ?? Vector2.zero); return rect;
        }
        internal static void Place(RectTransform rect, Vector2 min, Vector2 max, Vector2 low, Vector2 high)
        { rect.anchorMin = min; rect.anchorMax = max; rect.offsetMin = low; rect.offsetMax = high; }
        internal static Image Surface(Transform parent, Color color, bool rounded = false, bool glass = false, float radius = 16)
        {
            var image = Sdt.UI.Kit.UIKit.GetOrAdd<Image>(parent); image.color = color;
            if (rounded) { image.sprite = Rounded; image.type = Image.Type.Sliced; image.pixelsPerUnitMultiplier = 16f / Mathf.Max(1, radius); }
            if (glass) Sdt.UI.Screens.Hub.HubCurrentGlass.Apply(image);
            return image;
        }
        internal static void Line(Transform parent, Color color)
        { var line = Area(parent, "css-border", new Vector2(0, 0), new Vector2(1, 0), Vector2.zero, new Vector2(0, 1)); Surface(line, color).raycastTarget = false; }
        internal static Text Copy(Transform parent, string text, int size, Color? color = null, float height = 0)
        {
            var label = UIKit.Label(parent, text, size, color ?? Ink); label.alignment = TextAnchor.UpperLeft;
            var le = label.gameObject.AddComponent<LayoutElement>(); le.minHeight = height > 0 ? height : size * 1.5f; le.preferredHeight = height > 0 ? height : -1; le.flexibleWidth = 1; return label;
        }
        internal static Text TextAt(Transform parent, string text, int size, Vector2 min, Vector2 max, Vector2 low, Vector2 high, Color? color = null)
        { var label = UIKit.Label(parent, text, size, color ?? Ink); Place(label.rectTransform, min, max, low, high); label.alignment = TextAnchor.MiddleLeft; return label; }
        internal static Button Command(Transform parent, string name, string caption, Action clicked, Color? background = null, Color? ink = null, int size = 19)
        {
            var button = UIKit.Btn(parent, caption, clicked); button.name = name;
            Surface(button.transform, background ?? Theme.HexA("#102D3A", .5f), true, false, 8);
            foreach (var text in button.GetComponentsInChildren<Text>()) { text.fontSize = size; text.color = ink ?? Ink; }
            var border = button.GetComponent<Outline>(); if (border != null) border.effectColor = Theme.HexA("#BDD8DC", .36f);
            return button;
        }
        internal static Button CommandAt(Transform parent, string name, string caption, Action clicked, Vector2 min, Vector2 max, Vector2 low, Vector2 high, Color? background = null, Color? ink = null, int size = 19)
        { var b = Command(parent, name, caption, clicked, background, ink, size); Place((RectTransform)b.transform, min, max, low, high); return b; }
        internal static Transform Flow(Transform parent, string name, bool horizontal, float gap = 12, RectOffset padding = null)
        {
            var rect = Area(parent, name, Vector2.zero, Vector2.one);
            var group = horizontal ? (HorizontalOrVerticalLayoutGroup)rect.gameObject.AddComponent<HorizontalLayoutGroup>() : rect.gameObject.AddComponent<VerticalLayoutGroup>();
            group.spacing = gap; group.padding = padding ?? new RectOffset(); group.childControlWidth = group.childControlHeight = true;
            group.childForceExpandWidth = true; group.childForceExpandHeight = false; return rect;
        }
        internal static Transform Scroll(Transform parent, string name, Vector2 min, Vector2 max, Vector2 low, Vector2 high)
        {
            var content = UIKit.Scroll(parent); content.transform.parent.name = name;
            Place((RectTransform)content.transform.parent, min, max, low, high); return content.transform;
        }
        internal static GridLayoutGroup Grid(Transform content, float width = 240, float height = 400, int fixedColumns = 0)
        {
            UnityEngine.Object.DestroyImmediate(content.GetComponent<VerticalLayoutGroup>());
            var grid = content.gameObject.AddComponent<GridLayoutGroup>(); grid.padding = new RectOffset(12, 12, 14, 26); grid.spacing = new Vector2(16, 22); grid.childAlignment = TextAnchor.UpperLeft;
            grid.cellSize = new Vector2(width, height); grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = Math.Max(1, fixedColumns);
            var responsive = content.gameObject.AddComponent<DepartureGrid>(); responsive.MinimumWidth = width; responsive.FixedColumns = fixedColumns; return grid;
        }
        internal static RectTransform Card(Transform parent, CardDef card, float width, string name = "dep-card-face", CardFaceOptions options = null)
        {
            var host = Area(parent, name, new Vector2(.5f, 1), new Vector2(.5f, 1)); host.pivot = new Vector2(.5f, 1); host.sizeDelta = new Vector2(width, width * 1.5f);
            var face = CardFace.Create(card, CardSize.Xl, host, options:options); var rect = (RectTransform)face.transform;
            face.GetComponent<LayoutElement>().ignoreLayout = true; rect.anchorMin = rect.anchorMax = Vector2.one * .5f; rect.anchoredPosition = Vector2.zero;
            rect.localScale = Vector3.one * width / (392f * 2f / 3f); return host;
        }
        internal static void Cover(Image image, Sprite sprite, Vector2? focus = null)
        {
            image.sprite = sprite; image.color = sprite != null ? Color.white : Color.clear; image.raycastTarget = false;
            if (sprite == null) return;
            var fit = image.gameObject.AddComponent<AspectRatioFitter>(); fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent; fit.aspectRatio = sprite.rect.width / sprite.rect.height;
            image.rectTransform.pivot = focus ?? Vector2.one * .5f;
        }
    }
    internal sealed class DepartureGrid : MonoBehaviour
    {
        public float MinimumWidth = 240;
        public int FixedColumns;
        void LateUpdate()
        {
            var grid = GetComponent<GridLayoutGroup>(); float width = ((RectTransform)transform).rect.width - grid.padding.horizontal;
            int columns = FixedColumns > 0 ? FixedColumns : Mathf.Max(1, Mathf.FloorToInt((width + grid.spacing.x) / (MinimumWidth + grid.spacing.x)));
            grid.constraintCount = columns;
            // auto-fill source distributes remaining space, while each face stays <=240.
            var size = grid.cellSize; size.x = Mathf.Max(1, (width - grid.spacing.x * (columns - 1)) / columns); grid.cellSize = size;
        }
    }
    // Optional render-only action data. Its owner keeps admission and all mutations.
    internal sealed class DepartureReaderFooter
    {
        public Func<string> Label,Warning;
        public Func<bool> Visible,CanAct;
        public Action Activate;
        public string ButtonName="zoom-claim";
        public bool ChestStyle;
    }
    internal sealed class DepartureCardZoom : Panel
    {
        CardDef[] _cards; int _index;
        Func<int,CardFaceOptions> _options;
        Func<int,GameObject> _returnFocus;
        Panel _readerOwner;
        bool _sourceReader,_hideNote,_requiresOwner;string _readerFocus,_footerSignature;
        DepartureReaderFooter _footer;Func<bool> _sourceCurrent;
        public static void Open(CardDef[] cards, int index = 0, Func<int,CardFaceOptions> options = null, Func<int,GameObject> returnFocus = null,
            bool hideNote=false,DepartureReaderFooter footer=null,Func<bool> sourceCurrent=null)
        {
            if(cards==null||cards.Length==0)return;
            var owner=UiStack.Top;var focus=EventSystem.current?.currentSelectedGameObject;
            var page=ScreenMount.Show<DepartureCardZoom>("DepartureCardZoom");page._cards=cards;page._index=Mathf.Clamp(index,0,cards.Length-1);
            page._sourceReader=options==null;page._options=options??(_=>new CardFaceOptions());page._returnFocus=returnFocus??(_=>focus);page._readerOwner=owner;page._requiresOwner=owner!=null;
            page._hideNote=hideNote;page._footer=footer;page._sourceCurrent=sourceCurrent;page.Build();
        }
        bool SourceCurrent=> (!_requiresOwner||_readerOwner!=null&&UiStack.CapturePanels().Contains(_readerOwner))&&(_sourceCurrent?.Invoke()??true);
        public override void Build()
            =>BuildBattleReader();
        void BuildBattleReader()
        {
            // Battle readers retain their existing stage filter. Ordinary source readers
            // share winter/cover-details' 18% curtain, 18px blur and read-only card note.
            UiStack.SetMaskColor(this,Color.clear);
            if(_sourceReader)
            {
                var backdrop=DepartureElements.Area(transform,"card-zoom-source-backdrop",Vector2.zero,Vector2.one);UiStack.Stretch(backdrop);
                var image=UIKit.GetOrAdd<Image>(backdrop);image.color=Color.white;image.raycastTarget=false;
                var material=Sdt.UI.Screens.Menu.CurrentHomeMaterials.Composite(image,2,18);
                if(material!=null){material.SetFloat("_Panel",2);material.SetColor("_Tint",Theme.Hex("#1213142e"));}
            }
            var root=UIKit.Panel("cardZoom",transform).transform;
            var hit=DepartureElements.Surface(root,Color.clear);var outside=UIKit.GetOrAdd<Button>(root);outside.targetGraphic=hit;outside.transition=Selectable.Transition.None;outside.onClick.AddListener(Close);
            float width=13.08f*34,height=width*1.5f;
            bool browsing=_cards.Length>1;
            float groupHeight=height+72+(browsing?70:0);
            var card=DepartureElements.Card(root,_cards[_index],width,"card-zoom-current",_options(_index));
            card.anchorMin=card.anchorMax=card.pivot=Vector2.one*.5f;card.anchoredPosition=new Vector2(0,browsing?35:0);
            float noteHeight=0,footerHeight=0;
            if(_sourceReader&&!_hideNote)
            {
                noteHeight=BuildSourceNote(root,height,browsing);
                float lift=(noteHeight+16)*.5f-14;
                card.anchoredPosition+=Vector2.up*lift;
                var note=(RectTransform)root.Find("card-zoom-source-note");note.anchoredPosition=new Vector2(0,card.anchoredPosition.y-height*.5f-16-noteHeight*.5f);
                groupHeight+=noteHeight+16;
            }
            if(_footer!=null)
            {
                _footerSignature=FooterSignature();footerHeight=BuildFooter(root);
                if(footerHeight>0)
                {
                    card.anchoredPosition+=Vector2.up*((footerHeight+16)*.5f-(_hideNote?14:0));
                    var footer=(RectTransform)root.Find("card-zoom-expedition-footer");
                    footer.anchoredPosition=new Vector2(0,card.anchoredPosition.y-height*.5f-16-footerHeight*.5f-(noteHeight>0?noteHeight+16:0));
                    if(noteHeight>0){var note=(RectTransform)root.Find("card-zoom-source-note");note.anchoredPosition=new Vector2(0,card.anchoredPosition.y-height*.5f-16-noteHeight*.5f);}
                    groupHeight+=footerHeight+16;
                }
            }
            var close=DepartureElements.CommandAt(root,"zoom-close","[[icon:cross]]",Close,new Vector2(1,1),new Vector2(1,1),new Vector2(-62,-62),new Vector2(-18,-18),Theme.Hex("#15212cef"),Theme.Hex("#eef1ed"),22);
            if(!browsing){FocusReader(close);return;}
            var nav=AreaAt(root,"cz-list-nav",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(-132,(((RectTransform)transform).rect.height-groupHeight)*.5f),new Vector2(132,(((RectTransform)transform).rect.height-groupHeight)*.5f+54));
            var previous=DepartureElements.CommandAt(nav,"zoom-prev","‹",()=>Browse(-1),Vector2.zero,Vector2.zero,Vector2.zero,new Vector2(64,54),Theme.Hex("#192b33b8"),Theme.Hex("#d5c89d"),36);
            var next=DepartureElements.CommandAt(nav,"zoom-next","›",()=>Browse(1),Vector2.zero,Vector2.zero,new Vector2(200,0),new Vector2(264,54),Theme.Hex("#192b33b8"),Theme.Hex("#d5c89d"),36);
            previous.gameObject.SetActive(_index>0);next.gameObject.SetActive(_index<_cards.Length-1);
            var status=DepartureElements.TextAt(nav,(_index+1)+" / "+_cards.Length,22,Vector2.zero,Vector2.zero,new Vector2(96,0),new Vector2(168,54),Theme.Hex("#e8e9de"));status.name="zoom-index";status.raycastTarget=false;
            // A clear child target keeps clicks in the navigation gap from dismissing the reader.
            var navHit=UIKit.GetOrAdd<Image>(nav);navHit.color=Color.clear;UIKit.GetOrAdd<Button>(nav).transition=Selectable.Transition.None;
            FocusReader(close);
        }
        void FocusReader(Button fallback)
        {
            if(UiStack.Top!=this||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen)return;
            foreach(var button in GetComponentsInChildren<Button>())
                if(button.name==_readerFocus&&button.isActiveAndEnabled&&button.IsInteractable()){EventSystem.current?.SetSelectedGameObject(button.gameObject);return;}
            EventSystem.current?.SetSelectedGameObject(fallback.gameObject);
        }
        string FooterSignature()=>_footer==null?"":(_footer.Visible?.Invoke()??true)+"|"+(_footer.Label?.Invoke()??"")+"|"+(_footer.Warning?.Invoke()??"")+"|"+(_footer.CanAct?.Invoke()??true);
        float BuildFooter(Transform parent)
        {
            if(!(_footer.Visible?.Invoke()??true))return 0;
            var bounds=((RectTransform)transform).rect;
            float width=_footer.ChestStyle?Mathf.Min(400,bounds.width*.8f):Mathf.Min(1020,bounds.width*.94f);
            var footer=DepartureElements.Area(parent,"card-zoom-expedition-footer",Vector2.one*.5f,Vector2.one*.5f);footer.pivot=Vector2.one*.5f;
            var image=DepartureElements.Surface(footer,_footer.ChestStyle?Color.clear:Theme.Hex("#ebecedf5"));
            image.raycastTarget=false;
            if(!_footer.ChestStyle){var border=UIKit.GetOrAdd<Outline>(footer);border.effectColor=Theme.Hex("#a1a4a7");border.effectDistance=new Vector2(1,-1);}
            float padding=_footer.ChestStyle?0:16,innerWidth=width-(_footer.ChestStyle?0:40),warningHeight=0;
            string warning=_footer.Warning?.Invoke();
            if(!string.IsNullOrEmpty(warning))
            {
                var text=UIKit.Label(footer,warning,16,Theme.Hex(_footer.ChestStyle?"#dadada":"#26292c"));text.name="zoom-choice-warning";text.alignment=TextAnchor.MiddleLeft;
                text.lineSpacing=SourceTextLayout.LineSpacing(text,1.2f);SourceTextLayout.Cjk(text);text.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,innerWidth);
                warningHeight=Mathf.Max(19,text.preferredHeight);
                CurrentNodeElements.Fixed(text.rectTransform,(width-innerWidth)*.5f,padding,innerWidth,warningHeight);
            }
            float buttonHeight=_footer.ChestStyle?58:42;
            var button=UIKit.Btn(footer,_footer.Label?.Invoke()??"",()=>
            {
                if(UiStack.Top!=this||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen||!SourceCurrent||!(_footer.Visible?.Invoke()??true)||!(_footer.CanAct?.Invoke()??true))return;
                Close();
                if((_readerOwner==null&&!_requiresOwner||UiStack.Top==_readerOwner)&&SourceCurrent)_footer.Activate?.Invoke();
            });button.name=_footer.ButtonName;button.interactable=_footer.CanAct?.Invoke()??true;
            button.image.color=Theme.Hex(_footer.ChestStyle?"#197b76":"#a98738");
            var outline=button.GetComponent<Outline>();if(outline!=null)outline.effectColor=Theme.Hex(_footer.ChestStyle?"#65bcb25c":"#a98738");
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=_footer.ChestStyle?25:15;text.font=Sdt.Res.Res.SansBold;text.color=Theme.Hex(_footer.ChestStyle?"#f1f6f0":"#f2f0ec");}
            float buttonWidth=_footer.ChestStyle?innerWidth:Mathf.Min(innerWidth,button.GetComponentInChildren<Text>().preferredWidth+36);
            CurrentNodeElements.Fixed((RectTransform)button.transform,(width-innerWidth)*.5f,padding+warningHeight,buttonWidth,buttonHeight);
            float height=padding*2+warningHeight+buttonHeight;footer.sizeDelta=new Vector2(width,height);return height;
        }
        float BuildSourceNote(Transform parent,float cardHeight,bool browsing)
        {
            var bounds=((RectTransform)transform).rect;float width=Mathf.Min(620,bounds.width*.9f);
            var note=DepartureElements.Area(parent,"card-zoom-source-note",Vector2.one*.5f,Vector2.one*.5f);note.pivot=Vector2.one*.5f;
            var noteImage=DepartureElements.Surface(note,Theme.Hex("#ebeced"));var noteHit=UIKit.GetOrAdd<Button>(note);noteHit.targetGraphic=noteImage;noteHit.transition=Selectable.Transition.None;
            var outline=UIKit.GetOrAdd<Outline>(note);outline.effectColor=Theme.Hex(string.IsNullOrEmpty(_cards[_index].note)?"#a1a4a7":"#ceb66b");outline.effectDistance=new Vector2(1,-1);
            var tag=DepartureElements.TextAt(note,"备注",13,new Vector2(0,1),new Vector2(0,1),new Vector2(18,-36),new Vector2(58,-15),Theme.Hex("#6e603e"));tag.font=Sdt.Res.Res.SansBold;
            var content=DepartureElements.Scroll(note,"card-zoom-note-scroll",Vector2.zero,Vector2.one,new Vector2(70,15),new Vector2(-18,-15));
            string value=string.IsNullOrEmpty(_cards[_index].note)?"暂无备注":_cards[_index].note;
            var text=UIKit.Label(content,value,14,Theme.Hex(string.IsNullOrEmpty(_cards[_index].note)?"#555b61":"#26292c"));text.supportRichText=false;text.lineSpacing=SourceTextLayout.LineSpacing(text,1.7f);SourceTextLayout.Cjk(text);text.raycastTarget=false;
            text.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,width-88);float desired=Mathf.Max(54,text.preferredHeight+30);
            float available=Mathf.Max(54,bounds.height-cardHeight-(browsing?70:0)-100);
            float height=Mathf.Min(desired,Mathf.Min(bounds.height*.28f,available));note.sizeDelta=new Vector2(width,height);return height;
        }
        static RectTransform AreaAt(Transform parent,string name,Vector2 min,Vector2 max,Vector2 low,Vector2 high)=>DepartureElements.Area(parent,name,min,max,low,high);
        void Browse(int direction)
        {
            if(UiStack.Top!=this)return;
            int next=_index+direction;
            if(next<0||next>=_cards.Length)return;
            var focus=EventSystem.current?.currentSelectedGameObject;if(focus!=null&&focus.transform.IsChildOf(transform))_readerFocus=focus.name;
            _index=next;
            foreach(Transform child in transform)child.gameObject.SetActive(false);
            Rebuild();
        }
        void Update()
        {
            if(_options==null)return;
            if(!SourceCurrent){Close();return;}
            if(UiStack.Top!=this||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen)return;
            if(_footer!=null&&_footerSignature!=FooterSignature())
            {
                var focus=EventSystem.current?.currentSelectedGameObject;if(focus!=null&&focus.transform.IsChildOf(transform))_readerFocus=focus.name;
                foreach(Transform child in transform)child.gameObject.SetActive(false);Rebuild();return;
            }
            if(Input.GetKeyDown(KeyCode.LeftArrow))Browse(-1);
            else if(Input.GetKeyDown(KeyCode.RightArrow))Browse(1);
        }
        internal override void OnClose()
        {if(_returnFocus==null||_readerOwner==null||UiStack.Top!=_readerOwner||!SourceCurrent||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen)return;var focus=_returnFocus(_index);if(focus!=null&&focus.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(focus);}
    }
}
