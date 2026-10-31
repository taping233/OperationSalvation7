using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using A = Sdt.UI.Screens.Menu.CurrentArchiveUi;

namespace Sdt.UI.Screens.Menu
{
    // Source: menu-guide.js -> beginner-guide.js + data/beginner-guide.json.
    public sealed partial class CurrentBeginnerGuide : MonoBehaviour
    {
        [Serializable] public sealed class Document { public Page[] pages; }
        [Serializable] public sealed class Page
        { public string id,title,navTitle,image,caption,eyebrow,lead,tip,moreTitle; public Step[] steps; public Note[] notes; public Note feature; public Control[] controls; }
        [Serializable] public sealed class Step { public string title,text; public float[] point; }
        [Serializable] public sealed class Note { public string title,text; }
        [Serializable] public sealed class Control { public string key,text; }
        static Document _data;
        static readonly Dictionary<string,Sprite> _art=new Dictionary<string,Sprite>();
        Panel _owner; RectTransform _frame,_header,_navigation,_article,_pager,_reading;
        RectTransform _articleContent; ScrollRect _articleScroll; CanvasGroup _articleGroup;
        readonly Dictionary<int,float> _positions=new Dictionary<int,float>();
        readonly List<Button> _chapters=new List<Button>();
        sealed class Entry { public RectTransform Rect; public CanvasGroup Group; public GuideSticky Sticky; public Vector2 Base; }
        readonly List<Entry> _entries=new List<Entry>();
        Button _previous,_next,_imageOpen; Text _pageStatus; Coroutine _change;
        int _index; bool _more;
        public int CurrentPage=>_index;
        public int PageCount=>_data?.pages?.Length??0;
        public bool ImageReading=>_reading!=null&&_reading.gameObject.activeSelf;
        bool Current=>_owner!=null&&UiStack.Top==_owner;
        static bool Reduced=>CurrentUiPreferences.ReducedMotion;
        Page Chapter=>_data.pages[_index];

        public void Build(Panel owner)
        {
            _owner=owner;
            if(_data==null){var source=Resources.Load<TextAsset>("Data/CurrentBeginnerGuide");_data=source==null?new Document():JsonUtility.FromJson<Document>(source.text);}
            var dim=A.Full(transform,"guide-overlay");A.Surface(dim,"#101215").color=new Color(.063f,.071f,.082f,.72f);
            _frame=A.Full(transform,"beginner-guide");A.Surface(_frame,"#e9e9e6");A.Border(_frame,"#484c50");
            _header=A.Box(_frame,"bg-head",0,0,0,88);_header.anchorMax=new Vector2(1,1);A.Surface(_header,"#f0f0ed");
            var back=Sdt.UI.Screens.Hub.HubScreen.ArchiveBack(_header,()=>{if(Current)UiStack.Close(_owner);});back.name="guideBack";Place(back.transform,20,15,64,58);
            TextAt(_header,"guide-eyebrow","城市远征 · 入城手册",150,17,420,16,11,"#797365");
            TextAt(_header,"beginnerGuideTitle","生存指南",150,34,420,40,29,"#26292c",true);
            var note=TextAt(_header,"guide-head-note","准备行囊，带回收获",-290,0,260,88,13,"#767975");note.rectTransform.anchorMin=note.rectTransform.anchorMax=new Vector2(1,1);note.alignment=TextAnchor.MiddleRight;
            _navigation=A.Area(_frame,"bg-nav",Vector2.zero,new Vector2(0,1),new Vector2(0,66),new Vector2(206,-88));A.Surface(_navigation,"#282c2f");
            var navContent=UIKit.Scroll(_navigation);navContent.transform.parent.name="guide-navigation-scroll";
            var navLayout=navContent.GetComponent<VerticalLayoutGroup>();navLayout.padding=new RectOffset(14,14,25,25);navLayout.spacing=7;
            Flow(navContent.transform,"阅读目录",12,"#a7aaa8",1.5f,false,32);
            for(int i=0;i<PageCount;i++)
            { int target=i;var chapter=Button(navContent.transform,"guidePage-"+i,(i+1).ToString("00")+"   "+(_data.pages[i].navTitle??_data.pages[i].title),()=>ChangePage(target),"#282c2f","#c3c6c4",17);A.Size(chapter,0,62,1);var rail=A.Area(chapter.transform,"current-rail",Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(3,0));A.Surface(rail,"#cab374").raycastTarget=false;_chapters.Add(chapter); }
            _article=A.Area(_frame,"bg-page",Vector2.zero,Vector2.one,new Vector2(206,66),new Vector2(0,-88));
            _articleContent=(RectTransform)UIKit.Scroll(_article).transform;_articleScroll=_articleContent.parent.GetComponent<ScrollRect>();_articleScroll.name="guide-article-scroll";_articleScroll.movementType=ScrollRect.MovementType.Clamped;
            _articleGroup=UIKit.GetOrAdd<CanvasGroup>(_articleContent);
            var articleLayout=_articleContent.GetComponent<VerticalLayoutGroup>();articleLayout.padding=new RectOffset(28,28,24,30);articleLayout.spacing=23;
            _pager=A.Area(_frame,"bg-pager",Vector2.zero,new Vector2(1,0),Vector2.zero,new Vector2(0,66));A.Surface(_pager,"#e1e3dc");
            _previous=Button(_pager,"guidePrev","← 上一章",()=>ChangePage(_index-1),"#303a3b","#e9ede6",16);Place(_previous.transform,28,11,130,42);
            _next=Button(_pager,"guideNext","下一章 →",()=>ChangePage(_index+1),"#303a3b","#e9ede6",16);Place(_next.transform,-158,11,130,42);((RectTransform)_next.transform).anchorMin=((RectTransform)_next.transform).anchorMax=new Vector2(1,1);
            _pageStatus=TextAt(_pager,"guide-page-status","",-70,10,140,46,15,"#35413e");_pageStatus.rectTransform.anchorMin=_pageStatus.rectTransform.anchorMax=new Vector2(.5f,1);_pageStatus.alignment=TextAnchor.MiddleCenter;
            _reading=A.Full(_frame,"bg-image-reader");_reading.gameObject.SetActive(false);
            LayoutFrame();BuildPage();
        }
        void LayoutFrame()
        {
            if(_frame==null)return;var parent=(RectTransform)transform;float width=parent.rect.width,height=parent.rect.height;
            if(width<=1||height<=1)return;_frame.anchorMin=_frame.anchorMax=Vector2.one*.5f;_frame.pivot=Vector2.one*.5f;_frame.anchoredPosition=Vector2.zero;_frame.sizeDelta=new Vector2(Mathf.Min(1840,width*.96f),height*.94f);
        }
        void OnRectTransformDimensionsChange(){LayoutFrame();}
        public void ChangePage(int requested)
        {
            if(!Current||ImageReading||PageCount==0)return;int next=Mathf.Clamp(requested,0,PageCount-1);
            if(_change!=null){StopCoroutine(_change);_change=null;_articleGroup.alpha=1;_articleGroup.interactable=_articleGroup.blocksRaycasts=true;foreach(var entry in _entries){entry.Group.alpha=1;Offset(entry,Vector2.zero);}_articleContent.anchoredPosition=new Vector2(0,_articleContent.anchoredPosition.y);}
            if(next==_index)return;_positions[_index]=Mathf.Max(0,_articleContent.anchoredPosition.y);_change=StartCoroutine(Swap(next));
        }
        IEnumerator Swap(int next)
        {
            int direction=Math.Sign(next-_index);_articleGroup.interactable=_articleGroup.blocksRaycasts=false;
            if(!Reduced)for(float t=0;t<.09f;t+=Time.unscaledDeltaTime){_articleGroup.alpha=1-t/.09f;_articleContent.anchoredPosition=new Vector2(-direction*8*t/.09f,_articleContent.anchoredPosition.y);yield return null;}
            _index=next;_more=false;BuildPage();_articleGroup.alpha=1;
            if(!Reduced)foreach(var entry in _entries){entry.Group.alpha=0;Offset(entry,new Vector2(direction*8,-4));}
            yield return null;
            _articleScroll.StopMovement();_articleContent.anchoredPosition=new Vector2(0,_positions.TryGetValue(_index,out var y)?y:0);
            // transitionRegion's declared heading/illustration/copy groups enter in reading order.
            if(!Reduced)for(float t=0;t<.25f;t+=Time.unscaledDeltaTime){for(int i=0;i<_entries.Count;i++){float k=1-Mathf.Pow(1-Mathf.Clamp01((t-i*.035f)/.18f),3);_entries[i].Group.alpha=k;Offset(_entries[i],new Vector2(direction*8*(1-k),-4*(1-k)));}yield return null;}
            foreach(var entry in _entries){entry.Group.alpha=1;Offset(entry,Vector2.zero);}
            _articleGroup.alpha=1;_articleContent.anchoredPosition=new Vector2(0,_articleContent.anchoredPosition.y);_articleGroup.interactable=_articleGroup.blocksRaycasts=true;_change=null;
        }
        void BuildPage()
        {
            _entries.Clear();foreach(Transform child in _articleContent){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            if(PageCount==0){Flow(_articleContent,"指南内容暂不可用，请返回后重试。",18,"#62666a");return;}
            BuildArticle(Chapter);
            for(int i=0;i<_chapters.Count;i++){_chapters[i].GetComponent<Image>().color=Theme.Hex(i==_index?"#454744":"#282c2f");_chapters[i].GetComponentInChildren<Text>().color=Theme.Hex(i==_index?"#fff4d4":"#c3c6c4");_chapters[i].transform.Find("current-rail").gameObject.SetActive(i==_index);}
            _previous.interactable=_index>0;_next.interactable=_index<PageCount-1;_pageStatus.text=(_index+1).ToString("00")+"  /  "+PageCount.ToString("00")+"\n章节";
            Canvas.ForceUpdateCanvases();LayoutRebuilder.ForceRebuildLayoutImmediate(_articleContent);
            foreach(var entry in _entries)entry.Base=entry.Rect.anchoredPosition;
        }
        void EnterGroup(Transform region,GuideSticky sticky=null){_entries.Add(new Entry{Rect=(RectTransform)region,Group=UIKit.GetOrAdd<CanvasGroup>(region),Sticky=sticky});}
        static void Offset(Entry entry,Vector2 value){if(entry.Sticky!=null)entry.Sticky.VisualOffset=value;else entry.Rect.anchoredPosition=entry.Base+value;}
        public bool CloseImageReading()
        {
            if(!ImageReading)return false;_reading.gameObject.SetActive(false);
            if(_imageOpen!=null)EventSystem.current?.SetSelectedGameObject(_imageOpen.gameObject);return true;
        }
        void OpenImage()
        {
            if(!Current||PageCount==0)return;
            foreach(Transform child in _reading){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            _reading.gameObject.SetActive(true);_reading.SetAsLastSibling();A.Surface(_reading,"#171d20");
            var head=A.Box(_reading,"reader-heading",0,0,0,88);head.anchorMax=new Vector2(1,1);
            TextAt(head,"reader-eyebrow","原图阅读",25,15,500,20,11,"#cbb780");TextAt(head,"reader-caption",Chapter.caption,25,39,1100,30,18,"#e9ece7");
            var close=Button(head,"guideImageClose","关闭大图  Esc",()=>CloseImageReading(),"#323c3b","#e8eadf",15);Place(close.transform,-205,21,180,44);((RectTransform)close.transform).anchorMin=((RectTransform)close.transform).anchorMax=new Vector2(1,1);
            var view=A.Area(_reading,"guide-original-scroll",Vector2.zero,Vector2.one,new Vector2(18,18),new Vector2(-18,-88));A.Surface(view,"#171d20");UIKit.GetOrAdd<RectMask2D>(view);
            var sr=UIKit.GetOrAdd<ScrollRect>(view);sr.horizontal=sr.vertical=true;sr.movementType=ScrollRect.MovementType.Clamped;sr.viewport=view;sr.scrollSensitivity=36;
            var image=UIKit.Image(view,ImageFor(Chapter.id));image.name="guide-original-image";image.raycastTarget=false;
            var rect=image.rectTransform;rect.anchorMin=rect.anchorMax=new Vector2(.5f,1);rect.pivot=new Vector2(.5f,1);rect.anchoredPosition=Vector2.zero;
            rect.sizeDelta=image.sprite==null?new Vector2(1920,1080):image.sprite.rect.size;sr.content=rect;
            EventSystem.current?.SetSelectedGameObject(close.gameObject);
        }
        static Button Button(Transform parent,string name,string value,Action action,string background,string ink,int font)=>A.Button(parent,name,value,action,background,ink,font);
        static Sprite ImageFor(string id)
        {
            if(_art.TryGetValue(id,out var sprite))return sprite;var texture=Resources.Load<Texture2D>("Art/CurrentGuide/"+id);
            if(texture==null)return null;sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),Vector2.one*.5f,100,0,SpriteMeshType.FullRect);_art[id]=sprite;return sprite;
        }
        static void Place(Transform item,float x,float y,float width,float height){var rt=(RectTransform)item;rt.anchorMin=rt.anchorMax=new Vector2(0,1);rt.pivot=new Vector2(0,1);rt.anchoredPosition=new Vector2(x,-y);rt.sizeDelta=new Vector2(width,height);}
        static Text TextAt(Transform parent,string name,string value,float x,float y,float width,float height,int font,string ink,bool bold=false){var text=A.Text(parent,value,font,ink,bold);text.name=name;Place(text.transform,x,y,width,height);return text;}
        static Text Flow(Transform parent,string value,int size,string ink,float spacing=1.65f,bool bold=false,float minimum=0)
        {
            var text=A.Text(parent,value??"",size,ink,bold);text.lineSpacing=spacing;text.verticalOverflow=VerticalWrapMode.Overflow;
            var le=A.Size(text,0,minimum,1);text.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(100,((RectTransform)parent).rect.width));
            var fit=UIKit.GetOrAdd<ContentSizeFitter>(text);fit.verticalFit=ContentSizeFitter.FitMode.PreferredSize;le.preferredHeight=-1;return text;
        }
    }
}
