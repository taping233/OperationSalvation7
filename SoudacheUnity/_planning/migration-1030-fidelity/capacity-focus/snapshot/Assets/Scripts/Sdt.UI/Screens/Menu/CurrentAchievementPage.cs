using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    internal sealed class CurrentAchievementEntry
    {
        public AchievementDef Definition;public int Index,Category;public bool Unlocked,Claimed;
        public string Id=>Definition.id;
        public string State=>Claimed?"已领取":Unlocked?"已获得 · 待领取":"未获得";
        public string StateColor=>Claimed?"#466c52":Unlocked?"#89682a":"#637068";
        public string Rewards
        {
            get{var a=Definition;var result=new List<string>();if(a.reward?.wood>0)result.Add("木材 ×"+a.reward.wood);if(a.reward?.rations>0)result.Add("口粮 ×"+a.reward.rations);if(a.reward?.keys>0)result.Add("钥匙 ×"+a.reward.keys);if(!string.IsNullOrEmpty(a.reward?.card))result.Add(CardLibrary.FindById(a.reward.card)?.name??"稀有卡牌");if(!string.IsNullOrEmpty(a.back))result.Add("卡背 · "+(CardLibrary.CardBacks.FirstOrDefault(b=>b.id==a.back)?.name??a.back));return result.Count>0?string.Join(" / ",result):"远征纪念";}
        }
    }
    public sealed class CurrentAchievementPage : MonoBehaviour
    {
        internal static readonly string[] CategoryNames={"全部奖章","远征奖章","战斗奖章","成长奖章","典藏奖章","研究奖章"};
        static readonly string[][] Categories={Array.Empty<string>(),new[]{"firstExtract","extract3","rich30"},new[]{"kill10","firstBoss","allBoss","unlimitedEnergy","weaponMaster","excuseMe"},new[]{"bagMax","safeMax","class3","petHatch1","petHatch3","petMax","petAll"},new[]{"stash20","collectGold","collectLegend","collect5","runeFan","beautifulVase"},new[]{"savior","labScore1","labScore2","labScore3"}};
        readonly List<CurrentAchievementEntry> _entries=new List<CurrentAchievementEntry>();readonly Dictionary<string,Button> _controls=new Dictionary<string,Button>();
        List<CurrentAchievementEntry> _visible;RectTransform _root,_inspector,_content,_progressFill,_glint,_total;CurrentAchievementGrid _grid;ScrollRect _scroll;Text _result;InputField _search;GameObject _menu;CanvasGroup _progress;
        string _filter="all",_style;int _category;bool _gridView,_ambient=true;CurrentAchievementEntry _selected;AchievementsScreen _owner;Action _close;Coroutine _polish,_detailMotion,_listMotion;float _width,_height;Sdt.UI.Screens.Hub.HubArchiveBackFeedback _back;
        bool Ready=>this!=null&&isActiveAndEnabled&&_owner!=null&&UiStack.Top==_owner;
        public void Build(AchievementsScreen owner,Action close)
        {
            _owner=owner;_close=close;var snapshot=CurrentSlotSnapshot.Latest(GameRuntime.I.Saves);var data=snapshot?.Base;
            for(int i=0;i<MetaProgress.Achievements.Count;i++){var a=MetaProgress.Achievements[i];int category=1;for(int c=1;c<Categories.Length;c++)if(Categories[c].Contains(a.id)){category=c;break;}_entries.Add(new CurrentAchievementEntry{Definition=a,Index=i,Category=category,Unlocked=data!=null&&MetaProgress.IsUnlocked(a,data),Claimed=data?.achClaimed.TryGetValue(a.id,out var claimed)==true&&claimed});}
            _style=CurrentArchiveAssets.Styles[UnityEngine.Random.Range(0,CurrentArchiveAssets.Styles.Length)];var bounds=GetComponentInParent<Canvas>().GetComponent<RectTransform>().rect;_width=bounds.width;_height=bounds.height;
            _root=A.Full(transform,"achievement-gallery");A.Surface(_root,"#e5e7e2");
            Header(snapshot?.Slot);Toolbar();Body();_menu.transform.SetAsLastSibling();Refresh("initial");if(!CurrentUiPreferences.ReducedMotion){UIKit.GetOrAdd<CanvasGroup>(_content).alpha=0;UIKit.GetOrAdd<CanvasGroup>(_total).alpha=0;_progressFill.localScale=new Vector3(0,1,1);}var film=UIKit.GetOrAdd<CurrentAchievementMotion>(this);film.Begin(_root,()=>Reveal("initial"));
        }
        void Header(int? slot)
        {
            var header=A.Box(_root,"ag-header",0,0,_width,140);A.Surface(header,"#f7f8f5");
            var back=Sdt.UI.Screens.Hub.HubScreen.ArchiveBack(header,()=>{if(Ready)_close?.Invoke();});back.name="achBack";var rect=(RectTransform)back.transform;rect.anchorMin=rect.anchorMax=new Vector2(0,1);rect.pivot=new Vector2(0,1);rect.anchoredPosition=new Vector2(18,-15);rect.sizeDelta=new Vector2(64,58);_back=back.GetComponent<Sdt.UI.Screens.Hub.HubArchiveBackFeedback>();_back.Icon.color=A.Color("#303735");
            var title=A.Text(A.Box(header,"collection-page-identity",106,12,220,64),"成就陈列室",30,"#303735",true);A.Fill(title.rectTransform);title.alignment=TextAnchor.MiddleLeft;
            int done=_entries.Count(e=>e.Unlocked);var count=A.Text(A.Box(header,"ag-total",342,24,180,40),"已获得 <size=24><b>"+done+"</b></size> / "+_entries.Count,18,"#637068");A.Fill(count.rectTransform);count.alignment=TextAnchor.MiddleLeft;_total=count.rectTransform;
            var track=A.Box(header,"ag-progress",540,43,100,3);A.Surface(track,"#c5cdc5");UIKit.GetOrAdd<RectMask2D>(track);_progress=UIKit.GetOrAdd<CanvasGroup>(track);_progressFill=A.Area(track,"ag-progress-value",Vector2.zero,new Vector2(_entries.Count==0?0:done/(float)_entries.Count,1),Vector2.zero,Vector2.zero);_progressFill.pivot=new Vector2(0,.5f);A.Surface(_progressFill,"#a68b48");_glint=A.Full(track,"ag-cabinet-glint");UIKit.GetOrAdd<CurrentAchievementGlint>(_glint).raycastTarget=false;UIKit.GetOrAdd<CanvasGroup>(_glint).alpha=0;
            var archive=A.Text(A.Box(header,"ag-archive",658,24,300,40),slot.HasValue?"档案 "+slot.Value.ToString("00"):"尚无远征档案",18,"#637068");A.Fill(archive.rectTransform);archive.alignment=TextAnchor.MiddleLeft;
            var display=A.Button(A.Box(header,"display-menu-host",_width-170,20,138,48),"ag-display-menu","展柜灯光",()=>{if(Ready)_menu.SetActive(!_menu.activeSelf);},"#00000000","#637068",16);A.Fill((RectTransform)display.transform);
            var nav=A.Box(header,"ag-categories",106,88,_width-138,52);float x=0;
            for(int i=0;i<CategoryNames.Length;i++){int c=i,countIn=i==0?_entries.Count:_entries.Count(e=>e.Category==i);float w=i==0?144:134;var item=A.Button(A.Box(nav,"category-host-"+i,x,0,w,52),"ag-category-"+i,CategoryNames[i]+"  <size=16>"+countIn+"</size>",()=>{if(!Ready||_category==c)return;_category=c;Refresh("category");},"#00000000","#637068",20);A.Fill((RectTransform)item.transform);var underline=A.Area(item.transform,"category-underline",Vector2.zero,new Vector2(1,0),Vector2.zero,new Vector2(0,2));A.Surface(underline,"#8fc6d8").raycastTarget=false;_controls["category"+i]=item;x+=w+8;}
            _menu=A.Box(_root,"ag-display-options",_width-232,76,200,132).gameObject;A.Surface(_menu.transform,"#f7f8f5");A.Border(_menu.transform,"#c5cdc5");
            var ambient=A.Button(A.Box(_menu.transform,"ambient-host",16,16,168,40),"ag-ambient","微光 · 开",()=>{if(!Ready)return;_ambient=!_ambient;_progress.alpha=_ambient?1:.6f;_controls["ambient"].GetComponentInChildren<Text>().text=_ambient?"微光 · 开":"微光 · 关";},"#00000000","#637068",16);A.Fill((RectTransform)ambient.transform);_controls["ambient"]=ambient;
            var polish=A.Button(A.Box(_menu.transform,"polish-host",16,76,168,40),"ag-polish","擦亮展柜",Polish,"#00000000","#637068",16);A.Fill((RectTransform)polish.transform);_menu.SetActive(false);
        }
        void Toolbar()
        {
            var toolbar=A.Box(_root,"ag-tools",32,160,_width-64,67);var searchHost=A.Box(toolbar,"ag-search",0,0,420,48);_search=A.Search(searchHost,"ag-search-input","搜索奖章或获得条件",_=>{if(Ready)Refresh("search");});
            var filters=new[]{("all","全部"),("unlocked","已获得"),("locked","未获得"),("pending","待领取 "+_entries.Count(e=>e.Unlocked&&!e.Claimed)),("claimed","已领取 "+_entries.Count(e=>e.Claimed))};float x=444;
            foreach(var filter in filters){string key=filter.Item1;float width=key=="pending"||key=="claimed"?116:92;var button=A.Button(A.Box(toolbar,"filter-host-"+key,x,2,width,44),"ag-filter-"+key,filter.Item2,()=>{if(!Ready||_filter==key)return;_filter=key;Refresh("filter");},"#00000000","#637068",18);A.Fill((RectTransform)button.transform);_controls[key]=button;x+=width+6;}
            _result=A.Text(A.Box(toolbar,"ag-result-count",_width-385,2,140,44),"",18,"#637068");A.Fill(_result.rectTransform);_result.alignment=TextAnchor.MiddleRight;
            foreach(var pair in new[]{(false,"列表"),(true,"网格")}){bool grid=pair.Item1;var button=A.Button(A.Box(toolbar,"view-host-"+grid,_width-222+(grid?78:0),2,72,44),"ag-view-"+grid,pair.Item2,()=>{if(!Ready||_gridView==grid)return;_gridView=grid;Refresh("layout");},"#00000000","#637068",18);A.Fill((RectTransform)button.transform);_controls["view"+grid]=button;}
            var line=A.Box(toolbar,"ag-toolbar-line",0,66,_width-64,1);A.Surface(line,"#c9ceca");
        }
        void Body()
        {
            float inspectorWidth=Mathf.Clamp(_width*.25f,320,420);_inspector=A.Area(_root,"ag-inspector",new Vector2(1,0),Vector2.one,new Vector2(-32-inspectorWidth,32),new Vector2(-32,-251));A.Surface(_inspector,"#f7f8f5");A.Border(_inspector,"#c5cdc5");
            var content=A.Scroll(_root,"ag-scroll",Vector2.zero,Vector2.one,new Vector2(34,32),new Vector2(-32-inspectorWidth-28,-251));_content=(RectTransform)content;_scroll=content.parent.GetComponent<ScrollRect>();var old=content.GetComponent<VerticalLayoutGroup>();if(old!=null){old.enabled=false;DestroyImmediate(old);}_grid=UIKit.GetOrAdd<CurrentAchievementGrid>(content);_grid.padding=new RectOffset(2,10,2,16);DrawDetail(false);
        }
        bool Matches(CurrentAchievementEntry e)
        {
            string query=(_search?.text??"").Trim();bool state=_filter=="all"||_filter=="pending"&&e.Unlocked&&!e.Claimed||_filter=="claimed"&&e.Claimed||_filter=="unlocked"&&e.Unlocked||_filter=="locked"&&!e.Unlocked;
            return state&&(_category==0||e.Category==_category)&&(e.Definition.name+" "+e.Definition.desc).IndexOf(query,StringComparison.CurrentCultureIgnoreCase)>=0;
        }
        void Refresh(string reason)
        {
            CurrentAchievementEntry anchor=null;float offset=0;if(_visible!=null&&_grid.Tops!=null)for(int i=0;i<_visible.Count&&i<_grid.Tops.Length;i++)if(_grid.Tops[i]+_grid.Heights[i]>_content.anchoredPosition.y){anchor=_visible[i];offset=_grid.Tops[i]-_content.anchoredPosition.y;break;}
            foreach(Transform child in _content){child.gameObject.SetActive(false);Destroy(child.gameObject);}_visible=_entries.Where(Matches).ToList();_grid.Grid=_gridView;
            foreach(var entry in _visible)
            {
                var captured=entry;var button=A.Button(_content,"ag-medal-"+entry.Id,"",()=>{if(Ready)Select(captured);},_selected==entry?"#e0ebeb":"#f7f8f5","#303735",18);A.Border(button.transform,_selected==entry?"#89aeb5":"#c9d0c7");var tile=UIKit.GetOrAdd<CurrentAchievementTile>(button);tile.Build(entry,_style);tile.SetSelection(_selected==entry);
            }
            if(_visible.Count==0)
            {
                var empty=A.Column(_content,"ag-empty",16,new RectOffset(24,24,60,24));A.FlowText(empty,"暂无符合条件的奖章",26,"#303735",42,true).alignment=TextAnchor.MiddleCenter;
                string message=_filter=="unlocked"&&string.IsNullOrWhiteSpace(_search.text)?"尚未获得奖章。":_filter=="pending"?"当前范围没有待领取奖励。":_filter=="claimed"?"当前范围没有已领取的奖章。":"试试其他分类、名称或获得条件。";
                A.FlowText(empty,message,22,"#637068",76).alignment=TextAnchor.MiddleCenter;var reset=A.Button(empty,"ag-reset","查看全部奖章",()=>{if(!Ready)return;_filter="all";_category=0;_search.SetTextWithoutNotify("");Refresh("reset");_search.ActivateInputField();},"#f7f8f5","#303735",18);A.Size(reset,0,48,1);_grid.Empty=true;
            }
            else _grid.Empty=false;
            _result.text=_visible.Count+" 枚奖章";foreach(var pair in _controls){if(pair.Key=="ambient")continue;bool category=pair.Key.StartsWith("category"),selected=category?pair.Key=="category"+_category:pair.Key.StartsWith("view")?pair.Key=="view"+_gridView:pair.Key==_filter;pair.Value.GetComponent<Image>().color=A.Color(selected&&!category?"#29424e":"#00000000");pair.Value.GetComponentInChildren<Text>().color=A.Color(selected?category?"#303735":"#f0f5f7":"#637068");if(category)pair.Value.transform.Find("category-underline").gameObject.SetActive(selected);}
            if(_selected!=null&&!_visible.Contains(_selected)){_selected=null;DrawDetail(false);}else if(_selected!=null)SyncDetailNavigation();
            Canvas.ForceUpdateCanvases();LayoutRebuilder.ForceRebuildLayoutImmediate(_content);
            if(reason=="category"||reason=="reset"||reason=="initial")_content.anchoredPosition=Vector2.zero;
            else if(anchor!=null&&_visible.Count>0){var target=_visible.Contains(anchor)?anchor:_visible.FirstOrDefault(e=>e.Index>=anchor.Index)??_visible.Last();int index=_visible.IndexOf(target);_content.anchoredPosition=new Vector2(0,Mathf.Max(0,_grid.Tops[index]-(target==anchor?offset:0)));}
            if(reason!="initial")Reveal(reason);
        }
        void Select(CurrentAchievementEntry entry)
        {_selected=entry;foreach(var tile in _content.GetComponentsInChildren<CurrentAchievementTile>())tile.SetSelection(tile.Id==entry.Id);DrawDetail(true);}
        void DrawDetail(bool animate)
        {
            foreach(Transform child in _inspector)if(!child.name.StartsWith("border-")){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            if(_selected==null){var empty=A.Text(_inspector,"<color=#a68b48>◇</color>\n\n<b>选择一枚奖章</b>\n\n查看获得方式与奖励，可连续切换比较。",22,"#637068");A.Fill(empty.rectTransform,new Vector2(32,32),new Vector2(-32,-32));empty.alignment=TextAnchor.MiddleCenter;return;}
            var toolbar=A.Box(_inspector,"ag-detail-toolbar",18,14,_inspector.rect.width-36,42);int index=_visible.IndexOf(_selected);
            foreach(int step in new[]{-1,1}){int delta=step;var button=A.Button(A.Box(toolbar,"detail-nav-host"+step,step<0?0:52,0,42,42),step<0?"ag-prev":"ag-next",step<0?"←":"→",()=>{if(!Ready)return;int next=_visible.IndexOf(_selected)+delta;if(next<0||next>=_visible.Count)return;Select(_visible[next]);EnsureVisible(next);},"#00000000","#46554a",18);A.Fill((RectTransform)button.transform);button.interactable=index+step>=0&&index+step<_visible.Count;A.Border(button.transform,"#bdc7bf");}
            var dismiss=A.Button(A.Area(toolbar,"detail-close-host",new Vector2(1,0),Vector2.one,new Vector2(-120,0),Vector2.zero),"ag-dismiss","收起详情",()=>{if(Ready)CloseDetail();},"#00000000","#46554a",18);A.Fill((RectTransform)dismiss.transform);A.Border(dismiss.transform,"#bdc7bf");
            var content=A.Scroll(_inspector,"ag-detail-content",Vector2.zero,Vector2.one,Vector2.zero,new Vector2(0,-70));var layout=content.GetComponent<VerticalLayoutGroup>();layout.padding=new RectOffset();layout.spacing=0;
            var art=new GameObject("ag-detail-art",typeof(RectTransform));art.transform.SetParent(content,false);A.Size(art.transform,0,216,1);A.Surface(art.transform,"#e8ebe3");var image=UIKit.Image(art.transform,CurrentArchiveAssets.Medal(_selected.Id,_style));image.preserveAspect=true;image.rectTransform.anchorMin=image.rectTransform.anchorMax=new Vector2(.5f,.5f);image.rectTransform.sizeDelta=new Vector2(160,160);image.rectTransform.anchoredPosition=Vector2.zero;
            var copy=A.Column(content,"ag-detail-copy",16,new RectOffset(24,24,24,24));A.Size((Component)copy,0,0,1).preferredHeight=-1;
            DetailCopy(copy,CategoryNames[_selected.Category]+" / NO. "+(_selected.Index+1).ToString("00"),16,"#748077");DetailCopy(copy,_selected.Definition.name,26,"#303735",true);DetailCopy(copy,(_selected.Unlocked?"✓ ":"◇ ")+_selected.State,16,_selected.StateColor);DetailCopy(copy,"获得方式",16,"#637068",true);DetailCopy(copy,_selected.Definition.desc,20,"#303735");DetailCopy(copy,"达成奖励",16,"#637068",true);DetailCopy(copy,_selected.Rewards,20,"#303735");DetailCopy(copy,_selected.Claimed?"奖励已记入该档位的基地档案。":_selected.Unlocked?"请进入该档位的基地领取奖励。":"完成以上条件后，即可解锁这枚奖章。",20,"#637068");
            if(animate){if(_detailMotion!=null)StopCoroutine(_detailMotion);_detailMotion=StartCoroutine(Fade(content,.16f,.6f));}
        }
        static void DetailCopy(Transform parent,string value,int size,string color,bool bold=false){var text=A.FlowText(parent,value,size,color,0,bold);var bounds=text.GetComponent<LayoutElement>();bounds.preferredHeight=-1;bounds.minHeight=size*1.5f;text.lineSpacing=1.2f;}
        void SyncDetailNavigation(){int index=_visible.IndexOf(_selected);foreach(var button in _inspector.GetComponentsInChildren<Button>()){if(button.name=="ag-prev")button.interactable=index>0;else if(button.name=="ag-next")button.interactable=index>=0&&index<_visible.Count-1;}}
        void EnsureVisible(int index){float top=_grid.Tops[index],bottom=top+_grid.Heights[index],at=_content.anchoredPosition.y,view=_scroll.viewport.rect.height;if(top<at)_content.anchoredPosition=new Vector2(0,top);else if(bottom>at+view)_content.anchoredPosition=new Vector2(0,bottom-view);}
        public bool CloseDetail(){if(_menu!=null&&_menu.activeSelf){_menu.SetActive(false);return true;}if(_selected==null)return false;string previous=_selected.Id;_selected=null;DrawDetail(false);foreach(var tile in _content.GetComponentsInChildren<CurrentAchievementTile>()){tile.SetSelection(false);if(tile.Id==previous)EventSystem.current?.SetSelectedGameObject(tile.gameObject);}return true;}
        void Polish(){if(!Ready||CurrentUiPreferences.ReducedMotion)return;if(_polish!=null)StopCoroutine(_polish);_polish=StartCoroutine(Glint());}
        IEnumerator Glint(){var alpha=_glint.GetComponent<CanvasGroup>();float elapsed=0;while(elapsed<1.1f){elapsed+=Time.unscaledDeltaTime;float p=CurrentArchiveMotion.Ease(elapsed/1.1f,.42f,0,.58f,1);_glint.anchoredPosition=new Vector2(p<.45f?Mathf.Lerp(-110,0,p/.45f):Mathf.Lerp(0,110,(p-.45f)/.55f),0);alpha.alpha=Mathf.Clamp01(p<.45f?p/.45f:(1-p)/.55f);yield return null;}alpha.alpha=0;_glint.anchoredPosition=Vector2.zero;}
        void Reveal(string reason)
        {
            if(_listMotion!=null)StopCoroutine(_listMotion);UIKit.GetOrAdd<CanvasGroup>(_content).alpha=1;
            if(CurrentUiPreferences.ReducedMotion||reason=="search")return;
            if(reason=="initial"||reason=="category"||reason=="reset")
            {
                int count=0;var tiles=_content.GetComponentsInChildren<CurrentAchievementTile>();for(int i=0;i<tiles.Length&&count<12;i++){if(i>=_grid.Tops.Length)break;float top=_grid.Tops[i]-_content.anchoredPosition.y;if(top+_grid.Heights[i]<=0||top>=_scroll.viewport.rect.height)continue;tiles[i].Reveal(reason=="initial",reason=="initial"?.035f+Mathf.Min(count*.035f,.105f):Mathf.Min(count*.035f,.105f));count++;}
                if(reason=="initial")StartCoroutine(HeaderEntry());return;
            }
            _listMotion=StartCoroutine(Fade(_content,.18f,.86f));
        }
        IEnumerator HeaderEntry(){float elapsed=0;var group=UIKit.GetOrAdd<CanvasGroup>(_total);while(elapsed<.365f){elapsed+=Time.unscaledDeltaTime;group.alpha=CurrentArchiveMotion.Ease((elapsed-.07f)/.26f);_total.anchoredPosition=new Vector2(0,-12*(1-group.alpha));_progressFill.localScale=new Vector3(CurrentArchiveMotion.Ease((elapsed-.105f)/.26f),1,1);yield return null;}group.alpha=1;_total.anchoredPosition=Vector2.zero;_progressFill.localScale=Vector3.one;}
        void LateUpdate(){if(_back!=null&&_back.Background.color.a<.001f)_back.Icon.color=A.Color("#303735");}
        IEnumerator Fade(Transform target,float duration,float from){if(CurrentUiPreferences.ReducedMotion)yield break;var group=UIKit.GetOrAdd<CanvasGroup>(target);float elapsed=0;while(elapsed<duration){if(target==null)yield break;elapsed+=Time.unscaledDeltaTime;group.alpha=Mathf.Lerp(from,1,CurrentArchiveMotion.Ease(elapsed/duration));yield return null;}if(group!=null)group.alpha=1;}
    }
}
