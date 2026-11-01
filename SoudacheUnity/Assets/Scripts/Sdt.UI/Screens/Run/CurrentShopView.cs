// Current game.run.shop.js renderShop/renderSellPage and expedition-shop.css.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class CurrentShopView : MonoBehaviour
    {
        ShopScreen _owner;IReadOnlyList<ShopScreen.ShopSlot> _stock;
        Action<int,ShopScreen.ShopSlot> _buy;Action<OwnedCard,CardDef> _sell;Action _leave;
        RectTransform _content,_header,_body,_footer,_detail;ScrollRect _boardScroll;
        Text _notice;string _noticeValue="",_marketFocus,_sellFocus;int _selected=-1,_merchant,_sellFocusIndex;bool _exchange,_rules,_covered,_renderedExchange;Vector2 _size;
        float _marketScroll=1,_sellScroll=1,_detailScroll=1;ScrollRect _detailScrollRect;
        readonly List<CurrentShopOffer> _offers=new List<CurrentShopOffer>();
        ShopFacts _facts; RectTransform _resources; Button _back,_headerBag; Text _title;
        CurrentShopCoin.Row _resourceRow;Text _coinValue,_resourceLabel,_resourceValue,_resourceUnit;
        ScrollRect _marketScrollRect,_sellScrollRect;
        static readonly string[] Lines={"我很看好你哦","这是上一个人卖给我的，想知道他后来怎么样吗","赊账？下次我考虑一下","消费是世界进步的源泉","想要变得更强吗"};
        public bool DetailOpen=>_selected>=0&&!_exchange;public bool ExchangeOpen=>_exchange;
        bool Current=>_owner!=null&&_owner.ShopActive;
        public static CurrentShopView Create(ShopScreen owner,IReadOnlyList<ShopScreen.ShopSlot> stock,Action<int,ShopScreen.ShopSlot> buy,Action<OwnedCard,CardDef> sell,Action leave)
        {
            var root=Rect(owner.transform,"shop-replica source-current-shop");UiStack.Stretch(root);
            var view=UIKit.GetOrAdd<CurrentShopView>(root);view._owner=owner;view._stock=stock;view._buy=buy;view._sell=sell;view._leave=leave;
            Background(root);view._content=Rect(root,"shop-page-content");UiStack.Stretch(view._content);view.Render();return view;
        }
        public static void Background(Transform parent)
        {
            var backdrop=Rect(parent,"current-shop-background");UiStack.Stretch(backdrop);UIKit.GetOrAdd<RectMask2D>(backdrop);
            var image=UIKit.Image(backdrop,CurrentShopAssets.Get("merchant-approved"));UiStack.Stretch(image.rectTransform);image.raycastTarget=false;
            var fit=UIKit.GetOrAdd<AspectRatioFitter>(image);fit.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;fit.aspectRatio=image.sprite==null?1659f/948:image.sprite.rect.width/image.sprite.rect.height;
            var shade=Rect(parent,"shop-source-gradient");UiStack.Stretch(shade);UIKit.GetOrAdd<CurrentShopShade>(shade).raycastTarget=false;
        }
        public void Refresh(IReadOnlyList<ShopScreen.ShopSlot> stock){if(!Current)return;_stock=stock;Render();}
        public void Notice(string value){_noticeValue=value??"";if(_notice!=null)_notice.text=_noticeValue;}
        public bool BackFromSubpage(){if(!_exchange&&_selected>=0){CloseDetail();return true;}if(_exchange){_exchange=false;Render();return true;}return false;}
        void SaveBrowse()
        {
            if(_boardScroll!=null){if(_renderedExchange)_sellScroll=_boardScroll.verticalNormalizedPosition;else _marketScroll=_boardScroll.verticalNormalizedPosition;}
            if(_detailScrollRect!=null)_detailScroll=_detailScrollRect.verticalNormalizedPosition;
            var focus=EventSystem.current?.currentSelectedGameObject;if(focus==null||!focus.transform.IsChildOf(transform))return;
            if(_renderedExchange){_sellFocus=focus.name;if(_sellFocus.StartsWith("sellCard-")){int index=_facts.Sellables.FindIndex(card=>"sellCard-"+card.uid==_sellFocus);if(index>=0)_sellFocusIndex=index;}}
            else _marketFocus=focus.name;
        }
        void RestoreFocus()
        {
            string key=_exchange?_sellFocus:_marketFocus;var buttons=_content.GetComponentsInChildren<Button>();var target=buttons.FirstOrDefault(button=>button.name==key&&button.IsInteractable());
            if(target==null&&_exchange&&key!=null&&key.StartsWith("sellCard-")){var sale=buttons.Where(button=>button.name.StartsWith("sellCard-")).ToArray();if(sale.Length>0)target=sale[Mathf.Clamp(_sellFocusIndex,0,sale.Length-1)];}
            if(target==null&&!_exchange&&_selected>=0)target=buttons.FirstOrDefault(button=>button.IsInteractable()&&(button.name.StartsWith("buyCard-")||button.name.StartsWith("buySha-")||button.name=="shop-detail-done"||button.name=="shop-detail-bag"));
            if(target==null)target=buttons.FirstOrDefault(button=>button.name==(_exchange?"backShop":_selected>=0?"shopCloseInspect":"closeShop"));
            if(target!=null)EventSystemSelect(target.gameObject);
        }
        void Render()
        {
            if(!Current)return;
            SaveBrowse();_facts=new ShopFacts(GameRuntime.I);
            if(_header==null)
            {
                _header=Rect(_content,"shop-heading");_body=Rect(_content,"shop-layout");_footer=Rect(_content,"shop-market-footer");
                _title=Label(_header,"shop-title","",36,"#eef1ed",true);
                _headerBag=Button(_header,"shopOpenBag","[[icon:bag]] 背包",OpenBag,"#16282b5e","#eef1ed",18);
                _notice=Label(_footer,"shop-live",_noticeValue,18,"#afc0c1");
                _back=Button(_footer,"closeShop","",()=>{if(_exchange){_exchange=false;Render();}else _leave?.Invoke();},"#b6cbd7","#17232b",22);
            }
            _title.text=_exchange?"[[icon:sell-cards]] 收购台":"补给站";
            _headerBag.gameObject.SetActive(_exchange);
            _back.name=_exchange?"backShop":"closeShop";_back.GetComponentInChildren<Text>().text=_exchange?"返回商店":"返回地图";
            bool exchange=_exchange;Bind(_back,()=>{if(exchange){_exchange=false;Render();}else _leave?.Invoke();});Bind(_headerBag,OpenBag);
            var state=GameRuntime.I.State;
            if(_resourceRow==null)
            {
                var resources=new CurrentShopCoin.Row(_header,"shop-resources",66);_resourceRow=resources;_resources=resources.Root;
                resources.Space(12);resources.Coin(48);resources.Space(10);resources.Text("coin-label","可用金币",18,"#b9c9d2");resources.Space(10);_coinValue=resources.Text("coin-value","",42,"#e0c98c",true,1);resources.Space(10);resources.Text("coin-unit","币",18,"#b9c9d2");resources.Space(18+22);
                _resourceLabel=resources.Text("resource-label","",18,"#b9c9d2");resources.Space(7);_resourceValue=resources.Text("resource-value","",27,"#eef1ed",true,1.2f);resources.Space(7);_resourceUnit=resources.Text("resource-unit","",18,"#b9c9d2");
            }
            _coinValue.text=state.coins.ToString();_resourceLabel.text=_exchange?"可出售":"容量";_resourceValue.text=_exchange?_facts.Sellables.Count.ToString():_facts.Capacity.used+"/"+_facts.Capacity.totalCap;_resourceUnit.text=_exchange?"张":"格";_resourceRow.Relayout();
            if(_exchange)BuildExchange();else BuildMarket();
            if(_board!=null)_board.gameObject.SetActive(!_exchange);if(_merchantPanel!=null)_merchantPanel.gameObject.SetActive(!_exchange);
            if(_ledger!=null)_ledger.gameObject.SetActive(_exchange);if(_catalog!=null)_catalog.gameObject.SetActive(_exchange);
            if(_detail!=null)_detail.gameObject.SetActive(!_exchange&&_selected>=0);
            _boardScroll=_exchange?_sellScrollRect:_marketScrollRect;_renderedExchange=_exchange;
            Layout();Canvas.ForceUpdateCanvases();if(_boardScroll!=null)_boardScroll.verticalNormalizedPosition=_exchange?_sellScroll:_marketScroll;
            if(_selected>=0&&!_exchange)BuildDetail();RestoreFocus();
        }
        void LateUpdate(){if(_content==null)return;var size=((RectTransform)transform).rect.size;if(size!=_size){Layout();if(_selected>=0)LayoutDetail();}}
        void Update(){bool covered=UiStack.Top!=_owner;if(_covered&&!covered&&Current)_owner.RefreshStockView();_covered=covered;}
        void Layout()
        {
            _size=((RectTransform)transform).rect.size;float width=_size.x,height=_size.y;
            Place(_header,42,28,width-84,66);Place(_body,42,118,width-84,Mathf.Max(100,height-222));Place(_footer,42,height-80,width-84,56);
            Place(_header.Find("shop-title"),0,0,600,66);CurrentShopCoin.Right(_resources,0,0);
            if(_exchange)Place(_header.Find("shopOpenBag"),Mathf.Max(270,width-1030),11,126,44);
            Place(_footer.Find(_exchange?"backShop":"closeShop"),width-84-208,0,208,56);Place(_notice.transform,0,0,width-84-232,56);
            if(!_exchange)LayoutMarket();else LayoutExchange();
        }
        static RectTransform Rect(Transform parent,string name){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return(RectTransform)go.transform;}
        static void Place(Transform item,float x,float y,float w,float h){if(item==null)return;var r=(RectTransform)item;r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);}
        static Text Label(Transform parent,string name,string value,int size,string ink,bool bold=false)
        {var text=UIKit.Label(parent,value,size,Theme.Hex(ink));text.name=name;if(bold)text.font=Sdt.Res.Res.SansBold;text.lineSpacing=SourceTextLayout.LineSpacing(text,1.4f);text.raycastTarget=false;return text;}
        Button Button(Transform parent,string name,string value,Action action,string fill="#16282b5e",string ink="#eef1ed",int font=18)
        {var b=UIKit.Btn(parent,value,null);b.name=name;b.image.color=Theme.Hex(fill);var outline=b.GetComponent<Outline>();if(outline!=null)Destroy(outline);var text=b.GetComponentInChildren<Text>();text.fontSize=font;text.font=Sdt.Res.Res.Sans;text.color=Theme.Hex(ink);text.lineSpacing=SourceTextLayout.LineSpacing(text,1.4f);if(text is InlineIconText inline)inline.DisabledOpacity=1;Bind(b,action);return b;}
        void Bind(Button button,Action action)=>UIKit.GetOrAdd<CurrentShopAction>(button).Bind(button,()=>Current,action);
        static void Clear(Transform parent){foreach(Transform child in parent){child.gameObject.SetActive(false);Destroy(child.gameObject);}}
        internal static string FaceKey(CardDef card)=>string.Join("|",card?.id,card?.variantKey,card?.name,card?.art,card?.value,card?.type,card?.cls,CardVisual.EffectiveRarity(card),card?.cost,card?.runtimeCost,card?.dmg,card?.dmgType,Sdt.Res.CurrentCardPresentation.Description(card));
        internal sealed class ShopFacts
        {
            readonly GameRuntime _game;readonly Dictionary<CardDef,bool> _fits=new Dictionary<CardDef,bool>();
            readonly Dictionary<string,int> _names=new Dictionary<string,int>();
            public readonly BagCapacityQuery Capacity;public readonly List<OwnedCard> Sellables=new List<OwnedCard>();
            public ShopFacts(GameRuntime game){_game=game;Capacity=CardContainerCommands.Query(game);foreach(var entry in game.State.ownedCards){if(entry.card?.name!=null){_names.TryGetValue(entry.card.name,out int count);_names[entry.card.name]=count+1;}if(!entry.stored&&string.IsNullOrEmpty(entry.pouchOf)&&CardLibrary.IsSellable(entry.card))Sellables.Add(entry);}}
            public int Owned(CardDef card)=>card?.name!=null&&_names.TryGetValue(card.name,out int count)?count:0;
            public bool Fits(CardDef card){if(card==null)return false;if(!_fits.TryGetValue(card,out bool fits))_fits.Add(card,fits=_game.CanReceiveCard(card));return fits;}
        }
    }
    // A retained control replaces its event; replaying an earlier event cannot run a new quote.
    sealed class CurrentShopAction:MonoBehaviour
    {
        int _version;
        public void Bind(Button button,Func<bool> current,Action run){int version=++_version;button.onClick=new Button.ButtonClickedEvent();button.onClick.AddListener(()=>{if(this==null||!isActiveAndEnabled||version!=_version||button==null||!button.isActiveAndEnabled||!button.IsInteractable()||!current())return;AudioService.I.PlaySfx("click");run?.Invoke();});}
    }
    internal static class CurrentShopAssets
    {
        static readonly Dictionary<string,Sprite> Cache=new Dictionary<string,Sprite>();
        public static Sprite Get(string key){if(Cache.TryGetValue(key,out var hit))return hit;var t=Resources.Load<Texture2D>("Art/CurrentShop/"+key);if(t==null)return null;return Cache[key]=Sprite.Create(t,new Rect(0,0,t.width,t.height),Vector2.one*.5f,100,0,SpriteMeshType.FullRect);}
    }
    [RequireComponent(typeof(CanvasRenderer))]
    internal sealed class CurrentShopShade:MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper mesh){mesh.Clear();var r=rectTransform.rect;float[] stops={0,.2f,.32f,1};float[] alpha={0,0,.208f,.533f};for(int i=0;i<4;i++){var c=new Color(9/255f,21/255f,27/255f,alpha[i]);mesh.AddVert(new Vector2(r.xMin+r.width*stops[i],r.yMin),c,Vector2.zero);mesh.AddVert(new Vector2(r.xMin+r.width*stops[i],r.yMax),c,Vector2.one);if(i>0){int n=i*2;mesh.AddTriangle(n-2,n-1,n);mesh.AddTriangle(n-1,n+1,n);}}}
    }
}
