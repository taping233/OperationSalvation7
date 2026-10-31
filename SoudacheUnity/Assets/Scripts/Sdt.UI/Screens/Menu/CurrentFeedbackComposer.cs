// index.html #sugLayer + menu-feedback.js composer and feedback.local.js local append semantics.
using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public static class CurrentFeedbackStore
    {
        public const string Key="sdt-suggestions-v1";
        public static bool TryAppend(JObject entry,out string error)
        {
            try
            {
                var saved=GameRuntime.I.Saves.Global.GetJson(Key);
                if(saved!=null&&!(saved is JArray))throw new InvalidOperationException("留言信箱格式损坏，原数据已保留");
                var list=saved==null?new JArray():(JArray)saved.DeepClone();list.Add(entry.DeepClone());
                GameRuntime.I.Saves.Global.SetJson(Key,list);error=null;return true;
            }
            catch(Exception e){error="写入失败，输入已保留，请重试。"+e.Message;return false;}
        }
    }
    public sealed class CurrentFeedbackComposer : MonoBehaviour
    {
        readonly List<InputField> _fields=new List<InputField>();
        Text _where;
        Panel _source;
        string _previousPhase,_pageId,_pageName,_targetName;
        object _sourceState;
        int? _slot;
        Vector2 _at;
        GameObject _previousSelection;
        bool _closed,_busy;
        public void Build(Vector2 position)
        {
            var runtime=GameRuntime.I;_source=UiStack.Top;_sourceState=runtime.State;_previousPhase=runtime.State.Phase;_slot=runtime.ActiveSlot;
            _pageId=_source!=null?_source.name:_previousPhase;_pageName=PageName(_pageId,_previousPhase);
            _at=new Vector2(Mathf.Round(position.x/Mathf.Max(1,Screen.width)*100),Mathf.Round((1-position.y/Mathf.Max(1,Screen.height))*100));
            _targetName=DescribeTarget(position);_previousSelection=EventSystem.current?.currentSelectedGameObject;
            runtime.State.Phase="modal";
            gameObject.AddComponent<Image>().color=Theme.HexA("#09090D",.5f);
            var card=E.Box(transform,"sug-panel",660,66,600,948);
            card.gameObject.AddComponent<Image>().color=Theme.HexA("#26262C",.94f);
            card.gameObject.AddComponent<Outline>().effectColor=Theme.HexA("#FFFFFF",.19f);
            var content=UIKit.Scroll(card);var viewport=(RectTransform)content.transform.parent;
            viewport.offsetMin=new Vector2(32,24);viewport.offsetMax=new Vector2(-32,-30);
            var layout=content.GetComponent<VerticalLayoutGroup>();layout.spacing=6;layout.padding=new RectOffset(0,0,0,0);
            var parent=content.transform;
            CurrentSettingsPage.Heading(parent,"记录试玩反馈",26,54);
            _where=CurrentSettingsPage.Copy(parent,"针对位置："+_targetName+"（屏幕 "+_at.x+"%, "+_at.y+"%）",16,58,"#C9C8D0");_where.name="sugWhere";
            CurrentSettingsPage.Copy(parent,"只保存在当前设备，不会自动发送。保存后请到留言信箱点击「全部导出」或「导出此条」，再把 JSON 交给制作者。",16,88,"#AAAAB7");
            Field(parent,"sugText","反馈正文（必填）",2000,150,"例如：这个按钮太小，容易误触……");
            Field(parent,"sugSteps","复现步骤（可选）",1200,70);
            Field(parent,"sugExpected","期望结果（可选）",800,70);
            Field(parent,"sugActual","实际结果（可选）",800,70);
            var row=CurrentSettingsPage.Row(parent,82);
            CurrentSettingsPage.Control(row.transform,"sugCancelBtn","返回　BACK",SuggestionBox.CloseIfOpen,48);
            CurrentSettingsPage.Control(row.transform,"sugSaveBtn","保存　SAVE",Save,48);
            _fields[0].Select();_fields[0].ActivateInputField();
        }
        void Field(Transform parent,string id,string label,int limit,float height,string placeholder="")
        {
            CurrentSettingsPage.Copy(parent,label,16,30,"#C9C8D0");
            var go=UIKit.Row(parent);go.name=id;
            go.AddComponent<LayoutElement>().minHeight=height;go.GetComponent<LayoutElement>().preferredHeight=height;
            go.AddComponent<Image>().color=Theme.HexA("#FFFFFF",.035f);go.AddComponent<Outline>().effectColor=Theme.HexA("#FFFFFF",.19f);
            var input=go.AddComponent<InputField>();input.characterLimit=limit;input.lineType=InputField.LineType.MultiLineNewline;
            var text=UIKit.Label(go.transform,"",18,Theme.Hex("#F4F3F6"));text.supportRichText=false;text.lineSpacing=1.6f;
            UiStack.Stretch(text.rectTransform);text.rectTransform.offsetMin=new Vector2(12,10);text.rectTransform.offsetMax=new Vector2(-12,-10);
            var hint=UIKit.Label(go.transform,placeholder,18,Theme.Hex("#9A9AA8"));hint.supportRichText=false;
            UiStack.Stretch(hint.rectTransform);hint.rectTransform.offsetMin=new Vector2(12,10);hint.rectTransform.offsetMax=new Vector2(-12,-10);
            input.textComponent=text;input.placeholder=hint;input.targetGraphic=go.GetComponent<Image>();_fields.Add(input);
        }
        void Save()
        {
            if(_closed||_busy)return;string text=_fields[0].text.Trim();
            if(text.Length==0){_where.text="请填写反馈正文。";_fields[0].ActivateInputField();return;}
            _busy=true;
            var entry=new JObject{{"ts",DateTimeOffset.UtcNow.ToString("o")},{"version",Sdt.Res.CurrentHomeAssets.Version},
                {"page",new JObject{{"id",_pageId},{"name",_pageName}}},{"target",new JObject{{"name",_targetName}}},
                {"at",new JObject{{"x",_at.x},{"y",_at.y}}},{"text",text},{"steps",_fields[1].text.Trim()},
                {"expected",_fields[2].text.Trim()},{"actual",_fields[3].text.Trim()}};
            bool ok=CurrentFeedbackStore.TryAppend(entry,out var error);_busy=false;
            if(ok){foreach(var input in _fields)input.text="";SuggestionBox.CloseIfOpen();}
            else _where.text=error;
        }
        public void Release()
        {
            if(_closed)return;_closed=true;
            var runtime=GameRuntime.I;
            if(UiStack.Top==_source&&ReferenceEquals(runtime.State,_sourceState)&&runtime.ActiveSlot==_slot&&runtime.State.Phase=="modal")
            {
                runtime.State.Phase=_previousPhase;
                if(_previousSelection!=null&&_previousSelection.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(_previousSelection);
            }
        }
        void OnDestroy()=>Release();
        string DescribeTarget(Vector2 position)
        {
            if(EventSystem.current==null)return _pageName;
            var data=new PointerEventData(EventSystem.current){position=position};var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(data,hits);
            foreach(var hit in hits)
            {
                var button=hit.gameObject.GetComponentInParent<Button>();
                if(button!=null){string text=button.GetComponentInChildren<Text>()?.text;if(!string.IsNullOrWhiteSpace(text))return _pageName+" · "+text.Trim();}
            }
            return _pageName;
        }
        static string PageName(string id,string phase)
        {
            switch(id)
            {
                case "Title":return "标题页";case "Settings":return "设置";case "Inbox":return "留言信箱";
                case "Hub":return "基地";case "Bag":return "背包";case "Battle":return "战斗";
                case "Slots":case "SlotPicker":return "档案选择";case "CardLibrary":return "收藏图鉴";
                case "Credits":return "制作名单";case "Guide":return "生存指南";
            }
            return phase=="idle"?"对局地图":phase=="title"?"标题页":phase=="moving"?"对局移动中":phase=="done"?"结算页":string.IsNullOrEmpty(id)?"未知页面":id;
        }
    }
}

