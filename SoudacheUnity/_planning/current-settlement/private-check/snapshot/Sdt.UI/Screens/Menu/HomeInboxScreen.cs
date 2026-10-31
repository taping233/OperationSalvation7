// menu-feedback.js openSuggestionInbox / renderSugBox; local persistence is feedback.local.js.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public sealed class HomeInboxScreen : Panel
    {
        public const string StoreKey = "sdt-suggestions-v1";
        const int PageSize = 20;
        int _page;
        JArray _entries;
        string _error;
        Transform _content;
        Text _notice;
        Button _exportAll;
        public override void Build()
        {
            var root = UIKit.Panel("sugin-page", transform);
            var background = root.AddComponent<Image>(); background.color=E.Hex("#11171F");
            E.Fill(root.transform,"pg-head",Theme.HexA("#0D1218",.7f),0,0,1920,88);
            var back=E.Box(root.transform,"sugBack",18,16,64,58);E.Hit(back,Close);
            E.Art(back,"linked-back",20,17,24,24);
            var title=E.Text(root.transform,"pg-title","留言信箱",30,E.Hex("#E8EEF4"),142,20,760,48,2,true);
            var book=UIKit.Image(root.transform,Sdt.Res.Res.Ui("book"));
            var br=book.rectTransform;br.anchorMin=br.anchorMax=new Vector2(0,1);br.pivot=new Vector2(0,1);
            br.anchoredPosition=new Vector2(98,-29);br.sizeDelta=new Vector2(30,30);
            _exportAll=Control(root.transform,"sugExportAll","全部导出",()=>ExportAll());
            var er=(RectTransform)_exportAll.transform;er.anchorMin=er.anchorMax=new Vector2(1,1);er.pivot=new Vector2(1,1);
            er.anchoredPosition=new Vector2(-134.4f,-20);er.sizeDelta=new Vector2(144,48);
            var scrollContent=UIKit.Scroll(root.transform);_content=scrollContent.transform;
            var viewport=(RectTransform)_content.parent;
            viewport.anchorMin=viewport.anchorMax=new Vector2(.5f,1);viewport.pivot=new Vector2(.5f,1);
            viewport.anchoredPosition=new Vector2(0,-116);viewport.sizeDelta=new Vector2(1080,912);
            var layout=scrollContent.GetComponent<VerticalLayoutGroup>();layout.spacing=16;layout.padding=new RectOffset(8,8,0,24);
            Read();Render();
        }
        void Read()
        {
            try
            {
                var raw=GameRuntime.I.Saves.Global.GetJson(StoreKey);
                if(raw!=null && !(raw is JArray))throw new InvalidDataException("留言信箱格式损坏，原数据已保留");
                _entries=raw==null ? new JArray() : (JArray)raw.DeepClone();_error=null;
            }
            catch(Exception e){_entries=null;_error=e.Message;}
        }
        void Render()
        {
            for(int i=_content.childCount-1;i>=0;i--)Destroy(_content.GetChild(i).gameObject);
            _exportAll.interactable=_entries!=null && _entries.Count>0;
            if(_entries==null)
            {
                Copy(_content,_error??"留言信箱读取失败，原数据已保留",18,"#F0B9AE");
                Control(_content,"sugRetry","重新读取",()=>{Read();Render();});return;
            }
            if(_entries.Count==0){Empty();return;}
            var descending=_entries.OfType<JObject>().Reverse().ToList();
            var pending=descending.Where(e=>!Done(e)).ToList();var completed=descending.Where(Done).ToList();
            int pages=Math.Max(1,(int)Math.Ceiling(descending.Count/(double)PageSize));_page=Math.Max(0,Math.Min(_page,pages-1));
            _notice=Copy(_content,$"共 {descending.Count} 条留言 · 待处理 {pending.Count} · 已完成 {completed.Count} · 删除需再次确认",18,"#AAB7C2");
            bool? previous=null;
            foreach(var entry in pending.Concat(completed).Skip(_page*PageSize).Take(PageSize))
            {
                bool done=Done(entry);if(previous!=done)Copy(_content,done?"已完成":"待处理",22,"#E2C98D");
                previous=done;Row(entry,done);
            }
            if(pages>1)
            {
                var row=UIKit.Row(_content);UIKit.Toolbar(row,48,16);
                var prev=Control(row.transform,"sugPagePrev","上一页",()=>TurnPage(-1));prev.interactable=_page>0;
                Copy(row.transform,$"第 {_page+1} / {pages} 页",18,"#AAB7C2");
                var next=Control(row.transform,"sugPageNext","下一页",()=>TurnPage(1));next.interactable=_page<pages-1;
            }
        }
        void Empty()
        {
            var row=UIKit.Row(_content);var group=row.AddComponent<HorizontalLayoutGroup>();group.spacing=24;
            group.padding=new RectOffset(24,24,24,24);group.childControlHeight=true;group.childForceExpandHeight=false;
            var face=row.AddComponent<Image>();face.color=Theme.HexA("#19232D",.7f);
            var art=UIKit.Image(row.transform,Sdt.Res.CurrentHomeAssets.Load("mail-empty"));
            var le=art.gameObject.AddComponent<LayoutElement>();le.minWidth=le.preferredWidth=128;le.preferredHeight=220;
            var column=UIKit.Column(row.transform);var layout=column.AddComponent<VerticalLayoutGroup>();layout.spacing=12;
            layout.childForceExpandHeight=false;layout.childControlHeight=layout.childControlWidth=true;
            Copy(column.transform,"邮筒还是空的",26,"#E8EEF4");
            Copy(column.transform,"在游戏任意界面点击右键，就能给制作者写一张留言。",18,"#AAB7C2");
            Copy(column.transform,"保存后可点「全部导出」，一次导出所有留言的 JSON 交给制作者；处理完的留言会盖「已完成」章归档。",18,"#AAB7C2");
            row.AddComponent<LayoutElement>().preferredHeight=268;
        }
        void Row(JObject entry,bool done)
        {
            var row=UIKit.Column(_content);row.name="sugin-row";
            var background=row.AddComponent<Image>();background.color=Theme.HexA("#19232D",.7f);
            var outline=row.AddComponent<Outline>();outline.effectColor=Theme.HexA("#DCE7EF",.15f);
            var layout=row.AddComponent<VerticalLayoutGroup>();layout.spacing=12;layout.padding=new RectOffset(24,24,20,20);
            layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandHeight=false;
            var header=UIKit.Row(row.transform);UIKit.Toolbar(header,44,10);
            string page=String(entry["page"]?["name"]);if(string.IsNullOrEmpty(page))page=String(entry["target"]?["name"]).Split(new[]{" · "},StringSplitOptions.None)[0];
            var mark=UIKit.Image(header.transform,Sdt.Res.Res.Ui(done?"check":"book"));mark.gameObject.AddComponent<LayoutElement>().preferredWidth=24;
            Copy(header.transform,TimeLabel(entry["ts"]),16,"#AAB7C2");Copy(header.transform,string.IsNullOrEmpty(page)?"未知位置":page,16,"#E8EEF4");
            Control(header.transform,"sugExport","导出此条",()=>Export(entry));
            if(!done)Control(header.transform,"sugDel","删除",()=>ConfirmDelete(String(entry["ts"])));
            var body=Copy(row.transform,String(entry["text"]),22,done?"#C1CBD4":"#ECEFF2");body.lineSpacing=1.75f;
            body.GetComponent<LayoutElement>().preferredHeight=Mathf.Max(38.5f,body.preferredHeight);
            Copy(row.transform,"版本："+(string.IsNullOrEmpty(String(entry["version"]))?"未知":String(entry["version"])),16,"#AAB7C2");
            foreach(var pair in new[]{("steps","复现步骤"),("expected","期望结果"),("actual","实际结果")})
                if(!string.IsNullOrEmpty(String(entry[pair.Item1])))Copy(row.transform,pair.Item2+"\n"+String(entry[pair.Item1]),18,"#C1CBD4");
            if(!string.IsNullOrEmpty(String(entry["target"]?["name"])))Copy(row.transform,String(entry["target"]?["name"]),16,"#AAB7C2");
            if(!done)Control(row.transform,"sugDone","标记完成",()=>Mutate(String(entry["ts"]),false));
        }
        void ConfirmDelete(string ts)
        {
            var dialog=UiStack.Show<HomeInboxDeleteDialog>("DeleteFeedback");
            dialog.Confirm=()=>{if(this!=null)Mutate(ts,true);};
        }
        void Mutate(string ts,bool delete)
        {
            try
            {
                var current=GameRuntime.I.Saves.Global.GetJson(StoreKey) as JArray;
                if(current==null)throw new InvalidDataException("留言已改变，请重新打开信箱");
                var value=(JArray)current.DeepClone();var matches=value.OfType<JObject>().Where(e=>String(e["ts"])==ts).ToList();
                if(matches.Count==0)throw new InvalidOperationException("留言已改变，请重新打开信箱");
                foreach(var e in matches){if(delete){if(Done(e))continue;e.Remove();}else e["done"]=true;}
                GameRuntime.I.Saves.Global.SetJson(StoreKey,value);_entries=value;Render();
            }
            catch(Exception e){if(_notice!=null)_notice.text=e.Message;}
        }
        void TurnPage(int delta)
        {
            _page+=delta;Render();var scroll=_content.parent.GetComponent<ScrollRect>();scroll.verticalNormalizedPosition=1;
        }
        void Export(JObject entry)
        {
            string ts=String(entry["ts"]);string safe=new string(ts.Select(c=>char.IsLetterOrDigit(c)||c=='_'||c=='-'?c:'-').Take(40).ToArray());
            WriteExport(ExportRecord(entry),"sdt-feedback-"+(safe.Length>0?safe:"unknown")+".json");
        }
        void ExportAll()
        {
            if(_entries==null || _entries.Count==0)return;
            string timestamp=DateTimeOffset.UtcNow.ToString("o");
            var records=new JArray(_entries.OfType<JObject>().Select(e=>{var r=ExportRecord(e);r["done"]=Done(e);return r;}));
            WriteExport(new JObject{{"formatVersion",1},{"exportedAt",timestamp},{"total",records.Count},{"records",records}},
                "sdt-feedback-all-"+DateTime.Now.ToString("yyyy-MM-dd-HH-mm-ss")+".json");
        }
        static JObject ExportRecord(JObject entry)
        {
            return new JObject{{"formatVersion",1},{"ts",String(entry["ts"])},{"gameVersion",String(entry["version"],"未知")},
                {"page",new JObject{{"id",String(entry["page"]?["id"])},{"name",String(entry["page"]?["name"],"未知页面")}}},
                {"target",new JObject{{"name",String(entry["target"]?["name"])}}},{"at",entry["at"]?.DeepClone()},
                {"text",String(entry["text"])},{"steps",String(entry["steps"])},{"expected",String(entry["expected"])},{"actual",String(entry["actual"])}};
        }
        void WriteExport(JObject value,string filename)
        {
            try
            {
                string dir=Path.Combine(Application.persistentDataPath,"output","feedback");Directory.CreateDirectory(dir);
                string path=Path.Combine(dir,filename);File.WriteAllText(path,value.ToString(Formatting.Indented));
                if(_notice!=null)_notice.text="已导出："+path;
            }
            catch(Exception e){if(_notice!=null)_notice.text="导出失败，请重试："+e.Message;}
        }
        static bool Done(JObject entry)=>entry["done"]?.Type==JTokenType.Boolean && (bool)entry["done"];
        static string String(JToken value,string fallback="")=>value==null||value.Type==JTokenType.Null?fallback:value.ToString();
        static string TimeLabel(JToken value)=>DateTimeOffset.TryParse(String(value),out var t)?t.LocalDateTime.ToString("MM-dd HH:mm"):"";
        static Text Copy(Transform parent,string value,int size,string colour)
        {
            var text=UIKit.Label(parent,value,size,E.Hex(colour));text.supportRichText=false;text.rectTransform.sizeDelta=new Vector2(1016,50);
            var le=text.gameObject.AddComponent<LayoutElement>();le.minHeight=le.preferredHeight=Mathf.Max(size*1.5f,text.preferredHeight);le.flexibleWidth=1;
            return text;
        }
        static Button Control(Transform parent,string name,string label,Action action)
        {
            var button=UIKit.Btn(parent,label,action);button.name=name;
            button.GetComponent<Image>().color=Theme.HexA("#91A9BC",.13f);
            button.GetComponent<Outline>().effectColor=Theme.HexA("#C2D4E1",.21f);
            var le=button.GetComponent<LayoutElement>();le.minHeight=le.preferredHeight=44;le.minWidth=120;le.flexibleWidth=0;
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=20;text.color=E.Hex("#DDE7EE");}
            return button;
        }
    }
}
