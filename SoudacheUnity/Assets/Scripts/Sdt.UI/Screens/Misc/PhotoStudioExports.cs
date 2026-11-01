using System;
using System.IO;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using A = Sdt.UI.Screens.Menu.CurrentArchiveUi;

namespace Sdt.UI.Screens.Misc
{
    public sealed partial class CardLibraryScreen
    {
        bool _exportToolsOpen;
        Button _exportToggle, _exportCards, _exportNotes;
        bool ExportSourceCurrent => this != null && isActiveAndEnabled && !_leaving &&
            ReferenceEquals(GameRuntime.I.State, _state) && GameRuntime.I.ActiveSlot == _slot && GameRuntime.I.DevMode;
        void BuildExportTools()
        {
            _exportToggle = ExportTool("photoExportTools", "导出工具", 24, () =>
            {
                _exportToolsOpen = !_exportToolsOpen; SyncExportTools();
            });
            _exportCards = ExportTool("photoExportCards", "导出卡牌", 164, () => OpenExport(false));
            _exportNotes = ExportTool("photoExportNotes", "导出备注", 304, () => OpenExport(true));
            SyncExportTools();
        }
        Button ExportTool(string name, string caption, float right, Action action)
        {
            var button = PhotoStudioElements.Button(_header, name, caption, () =>
            {
                if (ExportSourceCurrent && UiStack.Top == this) action();
            });
            var rect = (RectTransform)button.transform; rect.anchorMin = rect.anchorMax = rect.pivot = Vector2.one;
            rect.anchoredPosition = new Vector2(-right, -24); rect.sizeDelta = new Vector2(130, 44);
            return button;
        }
        void SyncExportTools()
        {
            bool enabled = GameRuntime.I.DevMode;
            _exportToggle.gameObject.SetActive(enabled);
            _exportCards.gameObject.SetActive(enabled && _exportToolsOpen);
            _exportNotes.gameObject.SetActive(enabled && _exportToolsOpen);
            _exportToggle.GetComponentInChildren<Text>().text = _exportToolsOpen ? "收起工具" : "导出工具";
        }
        void OpenExport(bool notes)
        {
            if (!ExportSourceCurrent || UiStack.Top != this || !_exportToolsOpen) return;
            PhotoStudioExportScreen.Open(this, () => ExportSourceCurrent, notes);
        }
    }

    public sealed class PhotoStudioExportScreen : Panel
    {
        const int PreviewLimit = 8000;
        CardLibraryScreen _owner;
        Func<bool> _current;
        bool _notes, _closed, _written;
        string _payload, _file;
        Text _notice;
        Button _download;
        public override void Build() { }
        internal static void Open(CardLibraryScreen owner, Func<bool> current, bool notes)
        {
            if (!current() || UiStack.Top != owner) return;
            var page = ScreenMount.Show<PhotoStudioExportScreen>("PhotoStudioExport");
            page._owner = owner; page._current = current; page._notes = notes; page.Draw();
        }
        bool Live => this != null && !_closed && isActiveAndEnabled && UiStack.Top == this && _owner != null && _current();
        void Draw()
        {
            var bounds = ((RectTransform)transform).rect;
            float width = Mathf.Min(1040, bounds.width - 96), height = Mathf.Min(840, bounds.height - 96);
            var card = A.Box(transform, "photo-export-dialog", (bounds.width-width)/2, (bounds.height-height)/2, width, height);
            A.Surface(card,"#191b1d"); A.Border(card,"#999ea166");
            var column = A.Column(card,"photo-export-content",16,new RectOffset(28,28,24,24)); A.Fill((RectTransform)column);
            A.FlowText(column, _notes ? "导出照片备注" : "导出全部卡牌", 28,"#ebebeb",44,true);
            string help = _notes ? "合并底稿、已保存手写和本次会话未保存修改。导出文件不会代替备注存档。" : "包含本机全部卡牌及自定义定义，不受照相馆当前筛选影响。";
            help += "\n预览显示前8000字符；复制与文件包含全部JSON。";
            SourceTextLayout.Cjk(A.FlowText(column,help,18,"#c9cbcc",70));
            var area = A.JsonArea(column,"photoExportJson",true);
            _notice = A.FlowText(column,"",17,"#e9cda4",60); _notice.name = "photoExportNotice";
            _notice.GetComponent<LayoutElement>().preferredHeight=-1; _notice.supportRichText=false; SourceTextLayout.Cjk(_notice);
            try
            {
                _payload = _notes ? PhotoStudioExport.NotesJson(GameRuntime.I.Saves, PhotoDetailScreen.CapturePendingNotes()) : PhotoStudioExport.CardsJson();
                area.text = _payload.Length > PreviewLimit ? _payload.Substring(0,PreviewLimit) + "\n…（预览截断，完整内容请复制或导出文件）" : _payload;
            }
            catch (Exception error) { _notice.text = "读取未完成，未生成导出内容：" + error.Message; }
            var row = A.Row(column,"photo-export-actions",12); A.Size((Component)row,0,48,1);
            var copy = Control(row,"photoExportCopy","复制完整JSON",Copy); copy.interactable=_payload!=null;
            _download = Control(row,"photoExportFile","导出文件",Download); _download.interactable=_payload!=null;
            var back = Control(row,"photoExportBack","返回照相馆",Close);
            Canvas.ForceUpdateCanvases(); EventSystem.current?.SetSelectedGameObject((_payload!=null?copy:back).gameObject);
        }
        Button Control(Transform parent,string name,string label,Action action)
        {
            var button=A.Button(parent,name,label,()=>{if(Live)action();},"#25282b","#e9eaea",18);
            A.Size(button,0,48,1); return button;
        }
        void Copy()
        {
            if (!Live || _payload==null) return;
            try { GUIUtility.systemCopyBuffer=_payload; _notice.text="完整JSON已复制。"; }
            catch (Exception error) { _notice.text="复制未完成："+error.Message; }
        }
        void Download()
        {
            if (!Live || _payload==null || _written) return;
            if (_file==null)
            {
                string folder=DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff")+"-"+Guid.NewGuid().ToString("N");
                _file=Path.Combine(SaveSystem.Dir,"exports","photo-studio",folder,_notes?"card-notes.json":"sdt-cards.json");
            }
            if (!AtomicJsonFile.TryWrite(_file,_payload,out var error)) { _notice.text="导出未完成："+error; return; }
            _written=true; _download.interactable=false;
            _notice.text="完整JSON已导出："+_file;
        }
        public override void CloseFromEscape() { if (Live) Close(); }
        internal override void OnClose()
        {
            _closed=true;
            if (_owner!=null && _current() && UiStack.Top==_owner)
            {
                var button=_owner.GetComponentsInChildren<Button>();
                var target=Array.Find(button,item=>item.name==(_notes?"photoExportNotes":"photoExportCards"));
                if(target!=null&&target.IsActive()&&target.IsInteractable())EventSystem.current?.SetSelectedGameObject(target.gameObject);
            }
        }
    }
}
