// menu-settings.js + settings-navigation.js + settings-input.js, final settings-navigation.css layout.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public static class CurrentSettingsActions
    {
        public static Action OpenRunData;
    }
    public sealed class CurrentSettingsPage : MonoBehaviour
    {
        public static bool QualityProjectionAvailable;
        static readonly string[] Categories = { "通用", "画面与反馈", "音频", "输入" };
        readonly List<Button> _tabs = new List<Button>();
        readonly Dictionary<string, Button> _bindings = new Dictionary<string, Button>();
        readonly float[] _positions = { 1, 1, 1, 1 };
        readonly HashSet<string> _expanded = new HashSet<string>();
        SettingsScreen _owner;
        RectTransform _marker;
        Transform _body;
        ScrollRect _scroll;
        CanvasGroup _bodyGroup;
        Coroutine _regionChange;
        int _requestedCategory;
        Text _notice, _bindingStatus, _musicStatus, _sfxStatus;
        Button _musicRetry;
        int _category, _revision;
        string _listening;
        bool Current => this != null && _owner != null && UiStack.Top == _owner && !SuggestionBox.IsOpen;

        public void Build(SettingsScreen owner, Action back)
        {
            _owner = owner;
            var root = UIKit.Panel("settings-page settings-tabbed", transform);
            root.AddComponent<Image>().color = Theme.Hex("#11171F");
            CurrentSettingsBackdrop.Build(root.transform);
            E.Fill(root.transform,"pg-head",Theme.HexA("#0D1218",.7f),0,0,1920,88);
            E.Text(root.transform,"pg-title","设置",30,Theme.Hex("#E8EEF4"),134.4f,20,800,48,2,true);
            var backRect=E.Box(root.transform,"closeSettings",18,16,64,58);E.Hit(backRect,back);
            E.Art(backRect,"linked-back",20,17,24,24);
            var nav=E.Box(root.transform,"settings-nav",190,130,260,908);
            E.Fill(nav,"settings-nav-border",Theme.HexA("#DCE7EF",.14f),259,0,1,908);
            for(int index=0;index<Categories.Length;index++)
            {
                int selected=index;
                var rect=E.Box(nav,"settings-tab-"+index,0,28+index*84,236,74);
                var button=E.Hit(rect,()=>SelectCategory(selected));
                E.Text(rect,"ui-control-label",Categories[index],22,Theme.Hex("#A7B5C2"),20,16,198,42,1);
                _tabs.Add(button);
            }
            _marker=E.Fill(nav,"settings-selection-marker",Theme.Hex("#6C9BA9"),0,28,3,74).rectTransform;
            var paper=E.Box(root.transform,"settings-content",490,130,1240,908);
            paper.gameObject.AddComponent<Image>().color=Theme.Hex("#141C25");
            var edge=paper.gameObject.AddComponent<Outline>();edge.effectColor=Theme.HexA("#D5E1ED",.15f);
            E.Fill(paper,"settings-content-wash",Theme.HexA("#6C9BA9",.08f),0,0,1240,210);
            var content=UIKit.Scroll(paper);_body=content.transform;
            _bodyGroup=content.AddComponent<CanvasGroup>();
            var viewport=(RectTransform)_body.parent;viewport.offsetMin=new Vector2(32,32);viewport.offsetMax=new Vector2(-32,-28);
            _scroll=viewport.GetComponent<ScrollRect>();
            var layout=content.GetComponent<VerticalLayoutGroup>();layout.spacing=0;layout.padding=new RectOffset(0,0,0,0);
            _notice=E.Text(root.transform,"settings-write-status","",18,Theme.Hex("#F0B9AE"),490,1044,1240,30);
            CurrentInputBindings.Changed+=UpdateBindings;
            SelectCategory(0);
        }
        void SelectCategory(int category)
        {
            if(!Current || category<0 || category>=Categories.Length)return;
            _requestedCategory=category;
            if(_regionChange!=null)StopCoroutine(_regionChange);
            if(_body.childCount>0&&!CurrentUiPreferences.ReducedMotion){_regionChange=StartCoroutine(ChangeRegion(category));return;}
            RenderCategory(category);_bodyGroup.alpha=1;_bodyGroup.interactable=true;
        }
        IEnumerator ChangeRegion(int category)
        {
            _bodyGroup.interactable=false;float start=_bodyGroup.alpha;
            for(float time=0;time<.12f;time+=Time.unscaledDeltaTime){_bodyGroup.alpha=Mathf.Lerp(start,0,time/.12f);yield return null;}
            if(_requestedCategory!=category||this==null||_owner==null)yield break;
            RenderCategory(category);
            for(float time=0;time<.16f;time+=Time.unscaledDeltaTime){_bodyGroup.alpha=Mathf.Clamp01(time/.16f);yield return null;}
            _bodyGroup.alpha=1;_bodyGroup.interactable=true;_regionChange=null;
        }
        void RenderCategory(int category)
        {
            CancelListening(false);_positions[_category]=_scroll.verticalNormalizedPosition;_category=category;
            for(int i=0;i<_tabs.Count;i++)
            {
                _tabs[i].GetComponent<Image>().color=i==category?Theme.HexA("#6C9BA9",.21f):Color.clear;
                var label=_tabs[i].GetComponentInChildren<Text>();label.color=Theme.Hex(i==category?"#EDF3F9":"#A7B5C2");label.fontStyle=i==category?FontStyle.Bold:FontStyle.Normal;
            }
            if(CurrentUiPreferences.ReducedMotion)_marker.anchoredPosition=new Vector2(0,-28-category*84);
            for(int i=_body.childCount-1;i>=0;i--){var child=_body.GetChild(i).gameObject;child.SetActive(false);Destroy(child);}
            _bindings.Clear();_bindingStatus=null;_musicStatus=null;_sfxStatus=null;_musicRetry=null;
            Heading(_body,Categories[category],26,76);
            if(category==0)General();else if(category==1)Display();else if(category==2)Audio();else InputSettings();
            LayoutRebuilder.ForceRebuildLayoutImmediate((RectTransform)_body);
            _scroll.verticalNormalizedPosition=_positions[_category];
        }
        void Update()
        {
            if(_marker!=null&&!CurrentUiPreferences.ReducedMotion)_marker.anchoredPosition=Vector2.Lerp(_marker.anchoredPosition,new Vector2(0,-28-_category*84),Mathf.Min(1,Time.unscaledDeltaTime/.08f));
            if(!Current)return;
            var selected=EventSystem.current?.currentSelectedGameObject;
            if(_listening!=null&&selected!=null&&_bindings.TryGetValue(_listening,out var listening)&&selected!=listening.gameObject)CancelListening(true);
            if(CurrentInputBindings.SuppressGameplayInput)return;
            int tab=_tabs.FindIndex(button=>button.gameObject==selected);if(tab<0)return;
            int next=Input.GetKeyDown(KeyCode.Home)?0:Input.GetKeyDown(KeyCode.End)?3:Input.GetKeyDown(KeyCode.UpArrow)?(tab+3)%4:Input.GetKeyDown(KeyCode.DownArrow)?(tab+1)%4:tab;
            if(next!=tab){SelectCategory(next);_tabs[next].Select();}
        }
        void General()
        {
            var g=GameRuntime.I;
            Switch(_body,"setIndex","结点编号",()=>g.State.togglesIndex,value=>{g.State.togglesIndex=value;Sdt.View.BoardViewHost.SetNodeLabelsVisible(value);return null;});
            Preference("setHint","底部操作提示条","sdt-hintbar",true);
            Preference("setBanner","环层横幅","sdt-banner",true);
            Switch(_body,"setDev","开发者模式（测试工具）",()=>g.DevMode,value=>{if(!CurrentUiPreferences.TrySetFlag("sdt-dev",value,out var error))return error;g.DevMode=value;return null;});
            if(g.BattleCheckpoint!=null&&g.RestoreBattleCheckpoint!=null)
                Control(_body,"setBattleRestart","重新开始本场战斗",()=>Confirm("重新开始本场战斗？","本场战斗的出牌、受伤与消耗将回到开战时。","重新开始",()=>{if(g.BattleCheckpoint==null||g.RestoreBattleCheckpoint?.Invoke(g.BattleCheckpoint)!=true)throw new InvalidOperationException("未能重新开始本场战斗，请重试。");}),72);
            Preference("setReadingLarge","大字阅读（卡牌说明与词条）","sdt-reading-large");
            Preference("setEndTurnHold","结束回合长按确认","sdt-end-turn-hold");
            Fold("records","数据与档案",parent=>
            {
                Heading(parent,"留言信箱",26,52);Control(parent,"openInbox","查看历史留言　›",()=>UiStack.Show<HomeInboxScreen>("Inbox"),72);
                Heading(parent,"跑局数据",26,52);var data=Control(parent,"openDataPageUi","查看跑局数据　›",()=>CurrentSettingsActions.OpenRunData?.Invoke(),72);data.interactable=CurrentSettingsActions.OpenRunData!=null;
            });
            Fold("danger","危险操作",parent=>
            {
                Heading(parent,"危险区",26,58);
                var row=Row(parent,64);
                Control(row.transform,"wipeNotes","清空格子备注",()=>Confirm("清空全部格子备注？","将删除所有格子备注，清空后无法恢复。","清空格子备注",()=>{NotesStore.ClearAll(g.Saves);Status("已清空全部格子备注");}),52,true);
                Control(row.transform,"wipeCards","清空卡牌库",()=>Confirm("清空卡牌库？","将清空自定义卡牌库，清空后无法恢复。","清空卡牌库",()=>{g.Saves.Global.Delete("sdt-cards-v1");CardLibrary.ResetCustomsCache();Status("已清空卡牌库");}),52,true);
                Control(parent,"wipeSave","清空全部存档",()=>Confirm("删除五个档位的全部档案？","五个档位的基地与对局存档将被删除。建议先导出整档备份，删除后无法恢复。","删除五个档位的全部档案",()=>{g.ClearAllSlots();Status("已清空全部五个档位的存档");}),62,true);
                Copy(parent,"清空后无法恢复。\n「清空全部存档」会删除五个档位的全部档案。",18,72,"#AE929B");
            });
            Fold("credits","致谢与来源",parent=>
            {
                Copy(parent,"图标　game-icons.net · Lorc、Delapouite、Carl Olsen、Caro Asercion\n　　　 CC-BY 3.0",18,84);
                Copy(parent,"战斗音效　rubberduck、Tinysized、Kenney 等创作者\n　　　　　CC0",18,84);
                Control(parent,"audioSources","查看音效来源　↗",()=>UiStack.Show<CurrentAudioSources>("AudioSources"),48);
            });
        }
        void Display()
        {
            var quality=Choice("setQuality","画质档位",new[]{"节能","均衡（推荐）","高画质"},CurrentUiPreferences.Quality=="low"?0:CurrentUiPreferences.Quality=="high"?2:1,
                index=>SavePerformance(index==0?"low":index==2?"high":"balanced",CurrentUiPreferences.FrameLimit));
            quality.interactable=QualityProjectionAvailable;
            Copy(_body,CurrentUiPreferences.Quality=="low"?"减少光效，节省性能。":CurrentUiPreferences.Quality=="high"?"精细画面，完整光效。":"画质与性能均衡。",18,48);
            Choice("setFrameLimit","动画帧率",new[]{"30 FPS","60 FPS（推荐）","120 FPS"},CurrentUiPreferences.FrameLimit==30?0:CurrentUiPreferences.FrameLimit==120?2:1,
                index=>SavePerformance(CurrentUiPreferences.Quality,index==0?30:index==2?120:60));
            Copy(_body,"原生窗口按所选上限渲染；不改变战斗速度。",18,54);
            Switch(_body,"setShake","屏幕震动反馈",()=>!CurrentUiPreferences.ReduceShake,value=>SaveFlag("sdt-reduce-shake",!value));
            Preference("setReduceMotion","减少动态效果","sdt-reduce-motion");
            Copy(_body,"立即生效；战斗速度不变。",18,54);
        }
        void Audio()
        {
            var audio=AudioService.I;
            Switch(_body,"setMusic","背景音乐",()=>!audio.MusicMuted,value=>AudioWrite(()=>audio.SetMusicMuted(!value)));
            Volume("setMusicVol","音乐音量",audio.MusicVolume,value=>AudioWrite(()=>audio.SetMusicVolume(value)));
            _musicStatus=Copy(_body,"",18,44);
            _musicRetry=Control(_body,"setMusicRetry","重试加载音乐",()=>{string scene=audio.MusicScene;audio.PlayBgm(null);audio.PlayBgm(scene);UpdateAudioStatus();},48);
            Switch(_body,"setSfx","音效",()=>!audio.SfxMuted,value=>AudioWrite(()=>{audio.SetSfxMuted(!value);audio.PlaySfx("ding");}));
            Volume("setSfxVol","音效音量",audio.SfxVolume,value=>AudioWrite(()=>audio.SetSfxVolume(value)),()=>audio.PlaySfx("ding"));
            _sfxStatus=Copy(_body,"",18,48);Copy(_body,"自动保存 · 侧栏可静音",18,48);
            UpdateAudioStatus();
        }
        void UpdateAudioStatus()
        {
            if(_musicStatus==null)return;var audio=AudioService.I;
            bool missing=!string.IsNullOrEmpty(audio.MusicScene)&&string.IsNullOrEmpty(audio.MusicAsset);
            _musicStatus.text=audio.Muted||audio.MusicMuted?"音乐已静音。":missing?"音乐资源未加载，当前保持静音。可手动重试。":!string.IsNullOrEmpty(audio.MusicAsset)?"音乐已就绪。":"当前没有场景音乐。";
            _musicRetry.gameObject.SetActive(missing&&!audio.Muted&&!audio.MusicMuted);
            _sfxStatus.text=audio.Muted||audio.SfxMuted?"音效已静音。":"音效已启用。";
        }
        string AudioWrite(Action change)
        {
            change();UpdateAudioStatus();var saves=GameRuntime.I.Saves;
            return saves.LastWriteSucceeded?null:"本次调整已生效但保存失败，请重试。"+saves.LastError;
        }
        void InputSettings()
        {
            Heading(_body,"键盘操作",26,58);
            Copy(_body,"选择按键后按新键。Esc取消修改，冲突会先询问。",18,52);
            Switch(_body,"setLetterShortcuts","启用单字母快捷键",()=>CurrentInputBindings.LettersEnabled,value=>{CancelListening(false);return CurrentInputBindings.TrySetLettersEnabled(value,out var error)?null:error;});
            foreach(string action in CurrentInputBindings.Actions)
            {
                string captured=action;var row=Row(_body,64);Rule(row.transform);Copy(row.transform,CurrentInputBindings.ActionName(action),22,64,"#C4D0DA");
                var button=Control(row.transform,"rebind-"+action,CurrentInputBindings.BindingLabel(action),()=>Listen(captured),48);
                var le=button.GetComponent<LayoutElement>();le.flexibleWidth=0;le.minWidth=le.preferredWidth=220;_bindings[action]=button;
            }
            _bindingStatus=Copy(_body,"",18,54);
            Control(_body,"binding-reset","恢复默认键位",()=>{CancelListening(false);BindingStatus(CurrentInputBindings.TryReset(out var error)?"已恢复默认键位":error);UpdateBindings();},48);
        }
        void Listen(string action)
        {
            if(!Current)return;CancelListening(false);_listening=action;_revision++;
            CurrentInputBindings.KeyCaptureHandler=Capture;
            UpdateBindings();_bindings[action].GetComponentInChildren<Text>().text="请按新键…";BindingStatus("Esc取消修改");
        }
        bool Capture(string key,bool ctrl,bool alt,bool meta)
        {
            if(_listening==null)return false;
            if(!Current){CancelListening(false);return true;}
            if(key=="escape"||key=="tab"){CancelListening(true);return true;}
            if(ctrl||alt||meta||string.IsNullOrEmpty(key))return true;
            string action=_listening;int request=_revision;_listening=null;CurrentInputBindings.KeyCaptureHandler=null;
            string conflict=CurrentInputBindings.ConflictFor(action,key);
            Action apply=()=>{if(this==null||request!=_revision||(UiStack.Top!=_owner&&!(UiStack.Top is CurrentSettingsConfirmation)))return;if(!CurrentInputBindings.TryRebind(action,key,out var error))throw new InvalidOperationException(error);BindingStatus("已修改“"+CurrentInputBindings.ActionName(action)+"”");UpdateBindings();};
            if(conflict!=null)
            {
                Confirm("按键已被使用","此键用于“"+CurrentInputBindings.ActionName(conflict)+"”。继续将替换该绑定，并使原动作未绑定。","替换绑定",apply,
                    ()=>{if(this!=null&&request==_revision){BindingStatus("已取消修改");UpdateBindings();}});
            }
            else{try{apply();}catch(Exception e){BindingStatus(e.Message);UpdateBindings();}}
            return true;
        }
        void CancelListening(bool announce)
        {
            _revision++;_listening=null;if(CurrentInputBindings.KeyCaptureHandler==Capture)CurrentInputBindings.KeyCaptureHandler=null;
            if(announce)BindingStatus("已取消修改");UpdateBindings();
        }
        void BindingStatus(string text){if(_bindingStatus!=null)_bindingStatus.text=text;}
        void UpdateBindings(){foreach(var pair in _bindings)if(pair.Value!=null)pair.Value.GetComponentInChildren<Text>().text=CurrentInputBindings.BindingLabel(pair.Key);}
        void OnDestroy(){CancelListening(false);CurrentInputBindings.Changed-=UpdateBindings;}
        public void Release()=>CancelListening(false);
        void Preference(string id,string label,string key,bool defaultValue=false)=>Switch(_body,id,label,()=>CurrentUiPreferences.Flag(key,defaultValue),value=>SaveFlag(key,value));
        string SaveFlag(string key,bool value)=>CurrentUiPreferences.TrySetFlag(key,value,out var error)?null:error;
        bool SavePerformance(string quality,int fps){bool saved=CurrentUiPreferences.TrySetPerformance(quality,fps,out var error);Status(saved?"已保存，立即生效":error);return saved;}
        void Status(string value){if(_notice!=null)_notice.text=value??"";}
        void Confirm(string title,string message,string confirm,Action apply,Action cancelled=null)
        {
            if(!Current)return;
            var dialog=UiStack.Show<CurrentSettingsConfirmation>("SettingsConfirmation");
            dialog.Configure(title,message,confirm,()=>{if(this==null||_owner==null||UiStack.Top!=dialog)return "页面已改变，请重新打开设置。";try{apply();return null;}catch(Exception e){Status("操作失败，未能完成："+e.Message);return e.Message;}},cancelled);
        }
        void Fold(string id,string label,Action<Transform> content)
        {
            var container=UIKit.Column(_body);container.name="settings-extra-"+id;
            var vl=container.AddComponent<VerticalLayoutGroup>();vl.spacing=0;vl.childControlHeight=vl.childControlWidth=true;vl.childForceExpandHeight=false;
            var button=Control(container.transform,"summary-"+id,(_expanded.Contains(id)?"⌄ ":"› ")+label,null,68);
            var children=UIKit.Column(container.transform);children.name="details-"+id;
            var layout=children.AddComponent<VerticalLayoutGroup>();layout.childControlHeight=layout.childControlWidth=true;layout.childForceExpandHeight=false;
            content(children.transform);children.SetActive(_expanded.Contains(id));
            button.onClick.AddListener(()=>{if(!Current)return;bool open=!children.activeSelf;children.SetActive(open);if(open)_expanded.Add(id);else _expanded.Remove(id);button.GetComponentInChildren<Text>().text=(open?"⌄ ":"› ")+label;LayoutRebuilder.ForceRebuildLayoutImmediate((RectTransform)_body);});
        }
        void Switch(Transform parent,string id,string label,Func<bool> read,Func<bool,string> change)
        {
            var row=Row(parent,72);row.name=id;Rule(row.transform);
            var button=row.AddComponent<Button>();var bg=row.AddComponent<Image>();bg.color=Color.clear;button.targetGraphic=bg;
            Copy(row.transform,label,22,72,"#C4D0DA");
            var slot=UIKit.Row(row.transform);var le=slot.AddComponent<LayoutElement>();le.preferredWidth=le.minWidth=48;le.preferredHeight=26;le.flexibleWidth=0;
            var track=E.Fill(slot.transform,"switch-track",Color.clear,0,0,48,26);track.sprite=CurrentSettingsPaint.Capsule;track.type=Image.Type.Sliced;var outline=track.gameObject.AddComponent<Outline>();outline.effectColor=Theme.Hex("#657B8D");
            var thumb=E.Fill(slot.transform,"switch-thumb",Color.white,4,5,16,16);thumb.sprite=CurrentSettingsPaint.Capsule;thumb.type=Image.Type.Sliced;
            Action paint=()=>{bool value=read();track.color=value?Theme.HexA("#6C9BA9",.65f):Theme.Hex("#1C2631");thumb.color=Theme.Hex(value?"#EEF5FA":"#8397A8");thumb.rectTransform.anchoredPosition=new Vector2(value?26:4,-5);};
            paint();button.onClick.AddListener(()=>{if(!Current)return;CancelListening(false);string error=null;try{error=change(!read());}catch(Exception e){error="操作失败："+e.Message;}Status(error);paint();});
        }
        void Volume(string id,string label,float value,Func<float,string> change,Action released=null)
        {
            var row=Row(_body,72);Rule(row.transform);Copy(row.transform,label,22,72,"#C4D0DA");
            var go=UIKit.Row(row.transform);go.name=id;var le=go.AddComponent<LayoutElement>();le.minWidth=le.preferredWidth=300;le.preferredHeight=28;le.flexibleWidth=0;
            var slider=go.AddComponent<VolSlider>();slider.Setup(Mathf.RoundToInt(value*100),v=>{if(Current)Status(change(v));});slider.Released=released;
        }
        Button Choice(string id,string label,string[] values,int selected,Func<int,bool> change)
        {
            var row=Row(_body,72);Rule(row.transform);Copy(row.transform,label,22,72,"#C4D0DA");
            int index=selected;Button button=null;
            button=Control(row.transform,id,values[index]+"　⌄",()=>
            {
                if(!Current)return;
                var dialog=UiStack.Show<CurrentSettingsChoice>("SettingsChoice");
                dialog.Configure(label,values,index,next=>{if(this==null||UiStack.Top!=_owner)return;if(change(next))index=next;button.GetComponentInChildren<Text>().text=values[index]+"　⌄";});
            },48);
            var le=button.GetComponent<LayoutElement>();le.flexibleWidth=0;le.minWidth=le.preferredWidth=300;return button;
        }
        internal static GameObject Row(Transform parent,float height)
        {
            var row=UIKit.Row(parent);var layout=UIKit.Toolbar(row,height,24);layout.padding=new RectOffset(20,20,0,0);return row;
        }
        static void Rule(Transform parent)
        {
            var go=new GameObject("settings-row-rule",typeof(RectTransform));go.transform.SetParent(parent,false);
            go.AddComponent<LayoutElement>().ignoreLayout=true;
            var rect=(RectTransform)go.transform;rect.anchorMin=new Vector2(0,0);rect.anchorMax=new Vector2(1,0);rect.pivot=new Vector2(.5f,0);
            rect.sizeDelta=new Vector2(0,1);rect.anchoredPosition=Vector2.zero;
            go.AddComponent<Image>().color=Theme.HexA("#D9E6EF",.13f);go.GetComponent<Image>().raycastTarget=false;
        }
        internal static Text Copy(Transform parent,string value,int size,float height,string colour="#95A8B9")
        {
            var text=UIKit.Label(parent,value,size,Theme.Hex(colour));text.supportRichText=false;text.alignment=TextAnchor.MiddleLeft;
            var le=text.gameObject.AddComponent<LayoutElement>();le.minHeight=le.preferredHeight=height;le.flexibleWidth=1;return text;
        }
        internal static void Heading(Transform parent,string value,int size,float height)=>Copy(parent,value,size,height,"#F0F3F6").fontStyle=FontStyle.Bold;
        internal static Button Control(Transform parent,string name,string label,Action click,float height=44,bool danger=false)
        {
            var button=UIKit.Btn(parent,label,click);button.name=name;
            button.GetComponent<Image>().color=danger?Theme.HexA("#8D4655",.2f):Theme.HexA("#91A9BC",.13f);
            button.GetComponent<Outline>().effectColor=danger?Theme.HexA("#C47C8B",.45f):Theme.HexA("#C2D4E1",.21f);
            var le=button.GetComponent<LayoutElement>();le.minHeight=le.preferredHeight=height;le.flexibleHeight=0;
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=20;text.color=Theme.Hex(danger?"#E2B6C0":"#DDE7EE");text.alignment=TextAnchor.MiddleLeft;}
            return button;
        }
    }
}
