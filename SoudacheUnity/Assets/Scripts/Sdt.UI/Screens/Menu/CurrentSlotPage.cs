using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentSlotPage : MonoBehaviour
    {
        SlotPickerScreen _owner;Action _close;RectTransform _root;Text _error;bool _busy,_closing;int _revision;
        List<CurrentSlotSnapshot> _slots;readonly HashSet<int> _more=new HashSet<int>(),_archive=new HashSet<int>();string _archiveFocus;
        bool Current=>this!=null&&isActiveAndEnabled&&_owner!=null&&!_closing;
        bool Ready=>Current&&!_busy&&UiStack.Top==_owner;
        public void Build(SlotPickerScreen owner,Action close){_owner=owner;_close=close;Draw();}
        void Draw()
        {
            var selected=UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;
            string focus=selected!=null&&_root!=null&&selected.transform.IsChildOf(_root)?selected.name:_archiveFocus;
            _revision++;if(_root!=null){_root.gameObject.SetActive(false);Destroy(_root.gameObject);}_slots=CurrentSlotSnapshot.Read(GameRuntime.I.Saves);
            _root=A.Full(transform,"slot-page");A.Paint(_root,"slot-page");
            var canvas=GetComponentInParent<Canvas>().GetComponent<RectTransform>().rect;float width=canvas.width,height=canvas.height;
            var ambience=UIKit.GetOrAdd<CurrentSlotAmbience>(_root);ambience.Build(_root,width,height);
            var back=Sdt.UI.Screens.Hub.HubScreen.ArchiveBack(_root,BeginClose);back.name="slotBack";var backRect=(RectTransform)back.transform;backRect.anchorMin=backRect.anchorMax=new Vector2(0,1);backRect.pivot=new Vector2(0,1);backRect.anchoredPosition=new Vector2(18,-16);backRect.sizeDelta=new Vector2(64,58);
            float header=Mathf.Clamp(height*.085f,52,78)+17;
            var rule=A.Box(_root,"slot-page-rule",(width-420)/2,header-3,420,1);A.Surface(rule,"#e6cb76a1").raycastTarget=false;
            var gem=A.Box(rule,"slot-rule-gem",206,-3,7,7);A.Surface(gem,"#e6cb76").raycastTarget=false;gem.localRotation=Quaternion.Euler(0,0,45);
            _error=A.Text(_root,"",16,"#f0bf8f");A.Fill(_error.rectTransform,new Vector2(100,0),new Vector2(-100,-98));_error.alignment=TextAnchor.UpperCenter;_error.raycastTarget=false;
            float gap=Mathf.Clamp(width*.024f,24,44),side=Mathf.Clamp(width*.03f,24,56),cardWidth=Mathf.Min(264,(width-side*2-gap*4)/5);
            float y=header+Mathf.Clamp(height*.04f,18,44),bottom=Mathf.Clamp(height*.05f,24,56),cardHeight=height-y-bottom,start=(width-cardWidth*5-gap*4)/2;
            foreach(var value in _slots)BuildCard(A.Box(_root,"slot-card-"+value.Slot,start+(value.Slot-1)*(cardWidth+gap),y,cardWidth,cardHeight),value,height);
            var bad=_slots.Where(s=>s.Error!=null).Select(s=>"0"+s.Slot).ToArray();if(bad.Length>0)Error("档位 "+string.Join("、",bad)+" 存档数据异常，已保留原档未写回");
            var motion=UIKit.GetOrAdd<CurrentSlotEntry>(_root);motion.Begin(_root);
            StartCoroutine(RestoreFocus(focus,_revision));
        }
        IEnumerator RestoreFocus(string key,int revision)
        {
            yield return null;if(!Ready||_revision!=revision||SuggestionBox.IsOpen)yield break;
            var buttons=_root.GetComponentsInChildren<Button>();var target=buttons.FirstOrDefault(b=>b.name==key&&b.IsInteractable())??buttons.FirstOrDefault(b=>b.name=="slotBack");
            if(target!=null)UnityEngine.EventSystems.EventSystem.current?.SetSelectedGameObject(target.gameObject);
        }
        void BuildCard(RectTransform card,CurrentSlotSnapshot slot,float screenHeight)
        {
            A.Surface(card,"#191b1d");var clipped=A.Full(card,"slot-card-paint");UIKit.GetOrAdd<RectMask2D>(clipped);
            string wallpaper=GameRuntime.I.Saves.Global.GetString(CurrentHomeAssets.PreferenceKey)??CurrentHomeAssets.DefaultWallpaper;
            if(!CurrentHomeAssets.Wallpapers.Contains(wallpaper))wallpaper=CurrentHomeAssets.DefaultWallpaper;
            var atlas=CurrentHomeAssets.Load(wallpaper);var backdrop=new GameObject("slot-card-bg",typeof(RectTransform),typeof(RawImage));backdrop.transform.SetParent(clipped,false);var raw=backdrop.GetComponent<RawImage>();raw.texture=atlas?.texture;raw.uvRect=new Rect((slot.Slot-1)/5f,0,.2f,1);raw.color=new Color(1,1,1,slot.Exists?.5f:.22f);A.Fill((RectTransform)backdrop.transform);raw.raycastTarget=false;
            var feedback=UIKit.GetOrAdd<CurrentSlotCardHover>(card);feedback.Bind(raw,slot.Exists);
            A.Paint(clipped,"slot-card-shade");A.Paint(clipped,"slot-card-light");
            var rim=UIKit.GetOrAdd<CurrentSlotRim>(A.Full(card,"slot-metal-rim"));rim.Recent=slot.Recent;rim.raycastTarget=false;
            var flow=A.Column(card,"slot-card-content",0,new RectOffset(22,22,Mathf.RoundToInt(Mathf.Clamp(screenHeight*.036f,24,38)),24));A.Fill((RectTransform)flow);
            if(slot.Error==null)
            {
            var art=new GameObject("slot-card-art",typeof(RectTransform));art.transform.SetParent(flow,false);A.Size(art.transform,0,Mathf.Clamp(screenHeight*.17f,90,156),1,1);
            var emblem=UIKit.Image(art.transform,CurrentArchiveAssets.Load("slot-emblem-"+slot.Slot));emblem.preserveAspect=true;emblem.raycastTarget=false;float iconSize=Mathf.Clamp(screenHeight*.13f,76,122);var ir=emblem.rectTransform;ir.anchorMin=ir.anchorMax=new Vector2(.5f,.5f);ir.sizeDelta=new Vector2(iconSize,iconSize);ir.anchoredPosition=Vector2.zero;emblem.color=new Color(1,1,1,slot.Exists?1:.26f);
            if(slot.Exists){var glow=UIKit.Image(art.transform,CurrentArchiveAssets.Load("slot-glow-"+slot.Slot));glow.raycastTarget=false;glow.rectTransform.anchorMin=glow.rectTransform.anchorMax=new Vector2(.5f,.5f);glow.rectTransform.sizeDelta=Vector2.one*(iconSize*258/122);glow.rectTransform.anchoredPosition=Vector2.zero;glow.transform.SetAsFirstSibling();}
            feedback.Emblem=emblem;
            if(!slot.Exists){var note=A.Text(art.transform,"N\nE\nW\n \nG\nA\nM\nE",10,"#e6cb7680");note.alignment=TextAnchor.LowerCenter;A.Fill(note.rectTransform,new Vector2(0,4),new Vector2(0,-iconSize));}
            }
            Spacer(flow,18);var name=A.FlowText(flow,"档位 0"+slot.Slot,22,"#ebebeb",31);name.alignment=TextAnchor.MiddleCenter;
            Spacer(flow,14);var statusRow=A.Row(flow,"slot-status-row",0);A.Size((Component)statusRow,0,31,1);statusRow.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleCenter;
            var pill=new GameObject("slot-card-status",typeof(RectTransform));pill.transform.SetParent(statusRow,false);A.Surface(pill.transform,slot.Recent?"#3a3321cc":"#191b1dbb");A.Border(pill.transform,slot.Recent?"#e4cb7a":"#999ea166");
            var status=A.Text(pill.transform,"●  "+slot.Status,11,slot.Error!=null?"#f0bf8f":slot.Recent?"#f8e7b1":"#d0d2d3");status.alignment=TextAnchor.MiddleCenter;A.Fill(status.rectTransform,new Vector2(8,3),new Vector2(-8,-3));A.Size(pill.transform,Mathf.Ceil(status.preferredWidth+16),31);
            Spacer(flow,16);var rule=new GameObject("slot-card-rule",typeof(RectTransform));rule.transform.SetParent(flow,false);A.Surface(rule.transform,"#e6cb76a1");A.Size(rule.transform,0,1,1);Spacer(flow,16);
            if(slot.Error!=null)A.FlowText(flow,"读取失败，原档已保留。请重试。",14,"#e9eaea",66);
            else if(!slot.Exists){var empty=A.FlowText(flow,"尚未建立存档",13,"#9da1a3",25);empty.alignment=TextAnchor.MiddleCenter;}
            else
            {
                if(slot.Run!=null)
                {
                    var progress=A.FlowText(flow,"当前进度\n<b>第 "+(slot.Run.layerIdx+1)+" 层 · "+(string.IsNullOrEmpty(slot.Run.myClass)?"未选人物":slot.Run.myClass)+"</b>",16,"#ffffff",68);progress.lineSpacing=1.45f;
                    A.FlowText(flow,"生命 <b>"+Math.Max(0,slot.Run.hp)+" / "+(slot.Run.maxHp>0?slot.Run.maxHp.ToString():"—")+"</b> · 金币 <b>"+Math.Max(0,slot.Run.coins)+"</b>",14,"#e9eaea",40);
                    if(slot.Run.savedAt>0){string saved="";try{saved=DateTimeOffset.FromUnixTimeMilliseconds(slot.Run.savedAt).ToLocalTime().ToString("MM-dd HH:mm");}catch{}if(saved!="")A.FlowText(flow,"上次保存 "+saved,14,"#eadaa4",32);}
                }
                bool expanded=_more.Contains(slot.Slot);var more=A.Button(flow,"slot-more-"+slot.Slot,(expanded?"▾ ":"▸ ")+"更多档案信息",()=>{if(!Ready)return;if(!_more.Add(slot.Slot))_more.Remove(slot.Slot);Draw();},"#00000000","#c9cbcc",14);A.Size(more,0,32,1);
                if(expanded)
                {
                    double total=Math.Max(slot.Base?.stats?.playSeconds??0,slot.Run?.elapsed??0);A.FlowText(flow,"游玩时间 <b>"+(total>0?TitleScreen.FmtPlayTime(total):"暂无记录")+"</b>",14,"#e9eaea",34);
                    var names=slot.Achievements;A.FlowText(flow,"已解锁成就 <b>"+names.Count+"</b>",14,"#e9eaea",30);if(names.Count>0)A.FlowText(flow,string.Join("、",names),12,"#979b9e",58);
                }
            }
            if(slot.Error==null)
            {
                Spacer(flow,20);var cta=A.Button(flow,"slot-enter-"+slot.Slot,slot.Cta,()=>{if(Ready)Launch(slot.Slot,!slot.Exists);},"#e4cb7a","#212326",13);A.Size(cta,0,40,1);
                if(slot.Exists){Spacer(flow,14);var ops=A.Row(flow,"slot-card-ops",12);A.Size((Component)ops,0,31,1);var overwrite=A.Button(ops,"slot-overwrite-"+slot.Slot,"覆盖重开",()=>Confirm(slot.Slot,true),"#1a1c1ebd","#d9dada",12);A.Size(overwrite,0,31,1);var delete=A.Button(ops,"slot-delete-"+slot.Slot,"删除",()=>Confirm(slot.Slot,false),"#4b22204d","#e5b5aa",12);A.Size(delete,0,31,1);}
            }
            Spacer(flow,10);var archive=A.Button(flow,"slot-archive-"+slot.Slot,(_archive.Contains(slot.Slot)?"▾ ":"▸ ")+"备份与恢复",()=>{if(!Ready)return;if(!_archive.Add(slot.Slot))_archive.Remove(slot.Slot);Draw();},"#00000000","#c9cbcc",12);A.Size(archive,0,28,1);
            if(_archive.Contains(slot.Slot))
            {
                void ArchiveAction(string key,string caption,Action action){Spacer(flow,6);var button=A.Button(flow,key+"-"+slot.Slot,caption,()=>{if(Ready){_archiveFocus=key+"-"+slot.Slot;action();}},"#1a1c1ebd","#d9dada",12);A.Size(button,0,28,1);}
                ArchiveAction("exportSlotArchive","导出整档",()=>CurrentSlotArchiveScreen.Open(slot.Slot,false,()=>Current,Draw));
                ArchiveAction("importSlotArchive","导入整档",()=>CurrentSlotArchiveScreen.Open(slot.Slot,true,()=>Current,Draw));
                ArchiveAction("slotRecovery","恢复上一备档",()=>{
                    try{var preview=GameRuntime.I.Saves.PreviewPreviousSlotArchive(slot.Slot);CurrentSlotArchiveScreen.Confirm(preview,_owner,()=>Current,Draw);}
                    catch(Exception error){Error(error.Message);}
                });
            }
        }
        static void Spacer(Transform parent,float height){var space=new GameObject("space",typeof(RectTransform));space.transform.SetParent(parent,false);A.Size(space.transform,0,height,1);}
        void Error(string value){if(_error!=null)_error.text=value;}
        void Confirm(int slot,bool overwrite)
        {
            if(!Ready)return;int revision=_revision;var dialog=UiStack.Show<CurrentSettingsConfirmation>("slot-confirmation");
            dialog.Configure(overwrite?$"覆盖重开档位 {slot}？":$"删除档位 {slot}？",overwrite?"当前对局与基地将重新开始。异常原始档案会先保全。":"此档位的基地与对局将被删除，删除后无法恢复。",overwrite?"覆盖并开始新档":"删除此档位",()=>
            {
                if(!Current||_revision!=revision||_busy)return "档位页面已变化，请返回后重试";
                if(overwrite)return Launch(slot,true,true);
                _busy=true;try{GameRuntime.I.ClearSlot(slot);Draw();return null;}catch(Exception e){Error("档位 "+slot+" 删除未保存，请重试；原档已保留");return e.Message;}finally{_busy=false;}
            },()=>{});
        }
        string Launch(int slot,bool reset,bool overwrite=false)
        {
            if(!Current||_busy)return "档位正在处理";_busy=true;var runtime=GameRuntime.I;
            try
            {
                var now=CurrentSlotSnapshot.Read(runtime.Saves).First(s=>s.Slot==slot);if(now.Error!=null)throw new InvalidOperationException("档案无法读取，原档已保留："+now.Error);
                if(reset)
                {
                    if(now.Exists&&!overwrite)throw new InvalidOperationException("该档位已有档案，请重新进入或使用明确的覆盖重开。");
                    runtime.ResetSlot(slot);if(!runtime.Saves.LastWriteSucceeded)throw new InvalidOperationException("档位初始化未保存，请检查存储空间或档位变化后重试；尚未进入基地");
                }
                else runtime.EnterSlot(slot);
                var previous=UiStack.CapturePanels();
                if(!reset&&now.Run!=null){if(!runtime.LoadRun(slot))throw new InvalidOperationException("存档读取失败，原档已保留，请重试");foreach(var page in previous)UiStack.Close(page);}
                else{foreach(var page in previous)UiStack.Close(page);Sdt.UI.Screens.Hub.HubScreen.Open("deploy");}
                return null;
            }
            catch(Exception e){runtime.ShowTitle();Error(e.Message);return e.Message;}
            finally{_busy=false;}
        }
        public void BeginClose(){if(!Ready)return;_closing=true;StartCoroutine(Leave());}
        IEnumerator Leave(){var group=UIKit.GetOrAdd<CanvasGroup>(_root);group.blocksRaycasts=false;float duration=CurrentUiPreferences.ReducedMotion?0:.2f,elapsed=0;while(elapsed<duration){elapsed+=Time.unscaledDeltaTime;float p=Mathf.Clamp01(elapsed/duration);group.alpha=1-p;_root.anchoredPosition=new Vector2(0,-8*p);_root.localScale=Vector3.one*(1-.01f*p);yield return null;}_close?.Invoke();}
    }
}
