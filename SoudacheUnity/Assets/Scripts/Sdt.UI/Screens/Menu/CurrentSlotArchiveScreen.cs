// menu-slots / save-management: per-slot export, validated preview and explicit import confirmation.
using System;using System.Collections;using System.IO;
using Sdt.Run;using Sdt.UI.Kit;using Sdt.UI.Screens.Run;
using UnityEngine;using UnityEngine.UI;using UnityEngine.EventSystems;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentSlotArchiveScreen:Panel
    {
        int _slot;bool _import,_busy;string _export;Func<bool> _current;Action _refresh;InputField _area;Text _notice;Panel _parent;
        public override void Build(){}
        public static void Open(int slot,bool import,Func<bool> current,Action refresh)
        {
            if(!current())return;var owner=UiStack.Top;var page=ScreenMount.Show<CurrentSlotArchiveScreen>("SlotArchive");page._parent=owner;page._slot=slot;page._import=import;page._current=current;page._refresh=refresh;page.Draw();
        }
        bool Live=>this!=null&&_current()&&!_busy&&UiStack.Top==this;
        void Draw()
        {
            var bounds=((RectTransform)transform).rect;float width=Mathf.Min(1040,bounds.width-96),height=Mathf.Min(840,bounds.height-96);
            var card=A.Box(transform,"slot-archive-dialog",(bounds.width-width)*.5f,(bounds.height-height)*.5f,width,height);A.Surface(card,"#191b1d");A.Border(card,"#999ea166");
            var column=A.Column(card,"slot-archive-content",16,new RectOffset(28,28,24,24));A.Fill((RectTransform)column);
            A.FlowText(column,(_import?"导入整档":"导出整档")+" · 档位 0"+_slot,28,"#ebebeb",44,true);
            var help=A.FlowText(column,_import?"粘贴 Unity 桌面版整档备份。先校验并预览，再确认写入此档位。":"本备份包含此档位的基地、对局与结算，可复制保存或导出 JSON 文件。",18,"#c9cbcc",60);SourceTextLayout.Cjk(help);
            _area=MakeArea(column);_area.name="slotArchiveJson";
            _notice=A.FlowText(column,"",17,"#e9cda4",60);_notice.GetComponent<LayoutElement>().preferredHeight=-1;SourceTextLayout.Cjk(_notice);
            var row=A.Row(column,"slot-archive-actions",12);A.Size((Component)row,0,48,1);
            Button action;
            if(_import)action=Control(row,"slotArchivePreview","校验并预览",Preview,true);
            else
            {
                try{_export=GameRuntime.I.Saves.ExportSlotArchive(_slot);_area.text=_export;}catch(Exception error){_notice.text=error.Message;}
                action=Control(row,"slotArchiveCopy","复制到剪贴板",()=>{if(!Live||_export==null)return;GUIUtility.systemCopyBuffer=_export;_notice.text="整档备份已复制。";});
                action.interactable=_export!=null;var file=Control(row,"slotArchiveDownload","导出文件",Download,true);file.interactable=_export!=null;
            }
            Control(row,"slotArchiveBack","返回",Close);
            Canvas.ForceUpdateCanvases();EventSystem.current?.SetSelectedGameObject((_import?_area.gameObject:action.gameObject));
        }
        Button Control(Transform parent,string name,string label,Action run,bool primary=false)
        {var button=A.Button(parent,name,label,()=>{if(Live)run();},primary?"#e4cb7a":"#25282b",primary?"#212326":"#e9eaea",18);A.Size(button,0,48,1);return button;}
        InputField MakeArea(Transform parent)
        {
            var rect=A.Full(parent,"slot-archive-json");var size=A.Size(rect,0,150,1,1);size.preferredHeight=-1;A.Surface(rect,"#101214");A.Border(rect,"#777d82");
            var viewport=A.Full(rect,"json-viewport");A.Fill(viewport,new Vector2(14,12),new Vector2(-14,-12));UIKit.GetOrAdd<RectMask2D>(viewport);
            var text=A.Text(viewport,"",16,"#d8e4ec");text.supportRichText=false;text.alignment=TextAnchor.UpperLeft;A.Fill(text.rectTransform);
            var placeholder=A.Text(viewport,"在此粘贴整档备份 JSON……",16,"#8a939a");placeholder.supportRichText=false;placeholder.alignment=TextAnchor.UpperLeft;A.Fill(placeholder.rectTransform);
            var field=UIKit.GetOrAdd<InputField>(rect);field.textComponent=text;field.placeholder=placeholder;field.lineType=InputField.LineType.MultiLineNewline;field.readOnly=!_import;field.characterLimit=20_000_000;return field;
        }
        void Download()
        {
            if(!Live||_export==null)return;try{string directory=Path.Combine(SaveSystem.Dir,"exports");Directory.CreateDirectory(directory);
                string file=Path.Combine(directory,"代号柒-Unity档位"+_slot+"-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff")+"-"+Guid.NewGuid().ToString("N").Substring(0,6)+".json");
                using(var writer=new StreamWriter(new FileStream(file,FileMode.CreateNew,FileAccess.Write,FileShare.Read),new System.Text.UTF8Encoding(false)))writer.Write(_export);
                _notice.text="整档备份已导出："+file;
            }catch(Exception error){_notice.text="导出未完成："+error.Message;}
        }
        void Preview()
        {
            if(!Live)return;try{var preview=GameRuntime.I.Saves.PreviewSlotArchive(_area.text,_slot);Confirm(preview,this,()=>_current(),()=>StartCoroutine(Imported()));}
            catch(Exception error){_notice.text=error.Message;}
        }
        IEnumerator Imported(){_busy=true;yield return null;Close();}
        internal override void OnClose(){if(_parent!=null&&UiStack.Top==_parent&&_current())_refresh?.Invoke();}
        internal static void Confirm(SlotArchivePreview preview,Panel owner,Func<bool> current,Action finished)
        {
            var source=EventSystem.current?.currentSelectedGameObject;
            var dialog=UiStack.Show<CurrentSettingsConfirmation>("slot-archive-confirmation");
            string saved=preview.SavedAt>0?DateTimeOffset.FromUnixTimeMilliseconds(preview.SavedAt).ToLocalTime().ToString("yyyy-MM-dd HH:mm"):"未记录";
            dialog.Configure("导入至档位 "+preview.Slot+"？","来源档位："+preview.SourceSlot+"\n上次保存："+saved+"\n"+(preview.PendingExtraction?"包含尚未完成的撤离整理。\n":"")+(preview.Overwrites?"目标已有档案，将被此备份替换。":"将把备份写入此档位。"),"确认导入整档",()=>{
                if(owner==null||!current())return "档位页面已变化，请重新预检。";
                if(!GameRuntime.I.Saves.ImportSlotArchive(preview,true,out var error))return error;finished?.Invoke();return null;
            },()=>{if(source!=null&&source.activeInHierarchy&&UiStack.Top==owner&&!SuggestionBox.IsOpen)EventSystem.current?.SetSelectedGameObject(source);});
            var cancel=Array.Find(dialog.GetComponentsInChildren<Button>(),button=>button.name=="confirmation-cancel");
            if(cancel!=null&&UiStack.Top==dialog&&!SuggestionBox.IsOpen)EventSystem.current?.SetSelectedGameObject(cancel.gameObject);
        }
        public override void CloseFromEscape(){if(!_busy)Close();}
    }
}
