// ported from src/game.menu.js openTitleGuide / openTitleAchievements / openSettings / quitGame(#exitScr) /
//            openLeaveMenu + abandonRun / openSuggestionBox（W6 标题域弹层集合）
//
// 原 DOM → uGUI 控件映射：
//   UI.showOverlay(...) 模态卡          → Panel：居中卡片 Image(#112530 .96) + VerticalLayoutGroup
//   h2#ovTitle / .ov-note / .guide-row  → IconText 标题 / 说明 Label / 行控件（b 键位 + span 说明）
//   .ach-row（ico+info+ops）            → 行 Image + 图标字形 + 名称/描述 + 状态 Label
//   input[type=checkbox]                → ChkRow（勾选/空框前缀按钮，即时生效）
//   input[type=range]                   → VolSlider（拖条：底条+填充+手柄，IDragHandler 自写）
//   #exitScr 静态告别屏                 → 全屏渐变 Panel + exit-msg + menu-btn（#DDB876 底）
//   #sugLayer                           → 独立反馈层；CurrentFeedbackComposer 写 Saves.Global 的现行共享信箱
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Menu
{
    // Current menu-guide.js opens the complete six-chapter illustrated manual.
    public sealed class GuideScreen : Panel
    {
        CurrentBeginnerGuide _guide;
        public override void Build(){_guide=UIKit.GetOrAdd<CurrentBeginnerGuide>(this);_guide.Build(this);}
        public override void CloseFromEscape(){if(_guide==null||!_guide.CloseImageReading())Close();}
    }
    // ============================================================
    // 成就总览（openTitleAchievements：以最近游玩档位的基地档案为准，只读）
    // ============================================================
    public sealed class AchievementsScreen : Panel
    {
        CurrentAchievementPage _page;
        public override void Build(){_page=UIKit.GetOrAdd<CurrentAchievementPage>(this);_page.Build(this,Close);}
        public override void CloseFromEscape(){if(_page==null||!_page.CloseDetail())Close();}
    }

    // ============================================================
    // 现行设置：menu-settings.js / settings-navigation.js / settings-input.js
    // ============================================================
    public sealed class SettingsScreen : Panel
    {
        CurrentSettingsPage _page;
        public override void Build()
        {
            _page=gameObject.AddComponent<CurrentSettingsPage>();_page.Build(this,Close);
        }
        internal override void OnClose(){_page?.Release();}
    }

    /// <summary>音量滑条（input[type=range] 等价：底条 + 填充 + 手柄，指针拖动即时回调）。</summary>
    sealed class VolSlider : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        RectTransform _fill;Action<float> _change;Text _label;int _value;
        public Action Released;
        public void Setup(int value,Action<float> change)
        {
            _change=change;var track=gameObject.AddComponent<Image>();track.color=Theme.Hex("#19212A");
            gameObject.AddComponent<Outline>().effectColor=Theme.Hex("#657B8D");
            _fill=new GameObject("range-fill",typeof(RectTransform)).GetComponent<RectTransform>();_fill.SetParent(transform,false);
            _fill.anchorMin=Vector2.zero;_fill.anchorMax=new Vector2(0,1);_fill.pivot=new Vector2(0,.5f);
            _fill.gameObject.AddComponent<Image>().color=Theme.Hex("#6C9BA9");
            _label=UIKit.Label(transform,"",18,Theme.Hex("#DDE7EE"));_label.alignment=TextAnchor.MiddleCenter;UiStack.Stretch(_label.rectTransform);
            Set(value,false);
        }
        void Set(int value,bool notify)
        {
            _value=Mathf.Clamp(value,0,100);_fill.anchorMax=new Vector2(_value/100f,1);_fill.offsetMin=_fill.offsetMax=Vector2.zero;
            _label.text=_value+"%";if(notify)_change?.Invoke(_value/100f);
        }
        void Move(PointerEventData data)
        {
            var rect=(RectTransform)transform;if(!RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,data.position,data.pressEventCamera,out var point))return;
            Set(Mathf.RoundToInt((point.x-rect.rect.xMin)/Mathf.Max(1,rect.rect.width)*100),true);
        }
        public void OnPointerDown(PointerEventData data){if(data.button==PointerEventData.InputButton.Left)Move(data);}
        public void OnDrag(PointerEventData data){if(data.button==PointerEventData.InputButton.Left)Move(data);}
        public void OnPointerUp(PointerEventData data){if(data.button==PointerEventData.InputButton.Left)Released?.Invoke();}
    }

    // ============================================================
    // 退出告别屏（index.html #exitScr，quitGame 网页分支）
    // ============================================================
    public sealed class QuitScreen : Panel
    {
        public override void Build()
        {
            var root = UIKit.Panel("exitScr", transform);
            var bg = root.AddComponent<Image>();
            bg.color = Theme.HexA("#132C39", 1f);   // linear-gradient(130deg,#132c39,#0a1821) 起点色
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 30; vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = false; vl.childForceExpandHeight = false;
            vl.childControlWidth = false; vl.childControlHeight = false;
            var msg = UIKit.Label(root.transform, "信号已断开。愿风雪之后，仍有重逢。", 24, Theme.Txt);
            msg.fontSize = 24;
            var msgLe = msg.gameObject.AddComponent<LayoutElement>(); msgLe.minWidth = 600; msgLe.minHeight = 50;
            var back = UIKit.Btn(root.transform, "重 新 进 入", () => { Close(); App.ShowTitle(); });
            var backImg = back.GetComponent<Image>();
            backImg.color = Theme.Amber;   // .menu-btn：#ddb876 底 #152b35 字
            foreach (var t in back.GetComponentsInChildren<Text>()) { t.color = Hex("#152B35"); t.fontSize = 18; }
            back.gameObject.AddComponent<LayoutElement>().minWidth = 260;
            UIKit.BtnOk(root.transform, "退出游戏", () => Application.Quit());
        }
        static Color Hex(string h) => Theme.Hex(h);
    }

    // ============================================================
    // 离开对局菜单（openLeaveMenu）+ 放弃结算（abandonRun 展示段）
    // ============================================================
    public sealed class LeaveMenuScreen : Panel
    {
        CurrentLeavePage _page;
        public static void Open()
        {
            if(!GameRuntime.I.State.runActive||UiStack.Top is LeaveMenuScreen||UiStack.Top is CurrentLeaveConfirmation)return;
            UiStack.Show<LeaveMenuScreen>("LeaveMenu");
        }
        public override void Build(){_page=UIKit.GetOrAdd<CurrentLeavePage>(this);_page.Build(this);}
        public override void CloseFromEscape()=>_page?.Continue();
    }

    public sealed class AbandonResultScreen : Panel
    {
        AbandonResult _result;
        public override bool CanCloseWithEscape=>false;
        public void Setup(AbandonResult result){_result=result;Build();}
        public override void Build(){if(_result!=null)UIKit.GetOrAdd<CurrentLeaveResult>(this).Build(this,_result);}
    }

    // ============================================================
    // 现行试玩反馈：menu-feedback.js / feedback.local.js
    // ============================================================
    public sealed class SuggestionBox
    {
        static GameObject _root;
        public static bool IsOpen=>_root!=null;
        public static void OpenForCurrentScreen()
        {
            if(IsOpen||App.UiRoot==null)return;
            var position=(Vector2)Input.mousePosition;
            _root=new GameObject("sugLayer",typeof(RectTransform));_root.transform.SetParent(App.UiRoot,false);UiStack.Stretch((RectTransform)_root.transform);
            _root.AddComponent<CurrentFeedbackComposer>().Build(position);
        }
        public static void CloseIfOpen()
        {
            if(_root==null)return;_root.GetComponent<CurrentFeedbackComposer>()?.Release();UnityEngine.Object.Destroy(_root);_root=null;
        }
    }

    // ============================================================
    // 共享：showOverlay 卡片（.card：#ovTitle + #ovBody）
    // ============================================================
    internal static class MenuShared
    {
    internal static GameObject MakeOverlayCard(Transform parent, string title, bool wide = false)
    {
        var overlay = UIKit.Panel("overlay", parent);
        var dim = overlay.AddComponent<Image>();
        dim.color = Theme.HexA("#000000", 0.55f);
        var card = new GameObject("card", typeof(RectTransform));
        card.transform.SetParent(overlay.transform, false);
        var crt = (RectTransform)card.transform;
        crt.anchorMin = crt.anchorMax = new Vector2(0.5f, 0.5f);
        crt.sizeDelta = new Vector2(wide ? 900 : 620, wide ? 820 : 560);
        var img = card.AddComponent<Image>();
        img.color = Theme.HexA("#112530", 0.97f);
        var outl = card.AddComponent<Outline>(); outl.effectColor = Theme.Line; outl.effectDistance = new Vector2(2, -2);
        var vl = card.AddComponent<VerticalLayoutGroup>();
        vl.spacing = 8; vl.padding = new RectOffset(24, 24, 20, 20);
        vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
        vl.childControlWidth = true; vl.childControlHeight = true;
        var h2 = UIKit.IconText(card.transform, title);
        h2.fontSize = 24; h2.fontStyle = FontStyle.Bold; h2.color = Theme.Txt;
        h2.gameObject.AddComponent<LayoutElement>().minHeight = 34;
        return card;
    }

    internal static void MakeBtnRow(GameObject card, Action<GameObject> fill)
    {
        var btns = UIKit.Row(card.transform);
        var hl = btns.AddComponent<HorizontalLayoutGroup>();
        hl.spacing = 10; hl.childAlignment = TextAnchor.MiddleRight;
        hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
        hl.childControlWidth = true; hl.childControlHeight = true;
        fill(btns);
    }
}
    }
