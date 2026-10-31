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
    // ============================================================
    // 快速参考（openTitleGuide：guide-list 文案照抄）
    // ============================================================
    public sealed class GuideScreen : Panel
    {
        static readonly (string key, string desc)[] Rows =
        {
            ("鼠标点选", "选择相邻地点并确认前往"),
            ("Q / E", "旋转地图视角"),
            ("G", "全景总览"),
            ("F", "定位角色"),
            ("B", "打开 / 关闭背包"),
            ("N", "结点编号开关"),
            ("Esc", "关闭当前页面"),
            ("鼠标拖拽", "平移地图"),
            ("滚轮", "缩放地图"),
        };

        public override void Build()
        {
            var card = MenuShared.MakeOverlayCard(transform, "[[icon:question]] 快速参考");
            var body = card.GetComponent<VerticalLayoutGroup>();
            foreach (var (key, desc) in Rows)
            {
                var row = UIKit.Row(card.transform);
                var hl = row.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 20; hl.padding = new RectOffset(6, 6, 4, 4);
                hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
                hl.childControlWidth = true; hl.childControlHeight = true;
                var b = UIKit.Label(row.transform, key, 16, Theme.Txt);
                b.fontStyle = FontStyle.Bold;
                var bLe = b.gameObject.AddComponent<LayoutElement>(); bLe.minWidth = 150; bLe.minHeight = 24;
                var s = UIKit.Label(row.transform, desc, 15, Theme.Sub);
                s.gameObject.AddComponent<LayoutElement>().minHeight = 24;
            }
            var note = UIKit.Label(card.transform, "「开始远征」选择档位进入基地；整备卡牌与物资后出发，搜打撤一气呵成。", 14, Theme.Sub);
            note.gameObject.AddComponent<LayoutElement>().minHeight = 40;
            MenuShared.MakeBtnRow(card, r =>
            {
                UIKit.Btn(r, "返回 <i>BACK</i>", () => { Close(); });
            });
        }
    }

    // ============================================================
    // 成就总览（openTitleAchievements：以最近游玩档位的基地档案为准，只读）
    // ============================================================
    public sealed class AchievementsScreen : Panel
    {
        public override void Build()
        {
            // pickLatestSlot
            var rt = GameRuntime.I;
            int? bestSlot = null; long bestTs = 0; BaseData bestBase = null;
            for (int i = 1; i <= SaveSystem.SlotCount; i++)
            {
                var run = rt.Saves.ReadSlot(i);
                var b = BaseData.Peek(rt.Saves, i);
                if (run == null && b == null) continue;
                long ts = run?.savedAt ?? 0;
                if (bestSlot == null || ts > bestTs) { bestSlot = i; bestTs = ts; bestBase = b; }
            }

            var card = MenuShared.MakeOverlayCard(transform, "[[icon:medal]] 成就总览", wide: true);
            string note = bestSlot != null
                ? $"以 <b>档位 0{bestSlot}</b> 的基地档案为准；成就奖励需进入基地领取。"
                : "暂无任何档案——完成一次远征后，成就将随基地档案记录。";
            var noteL = UIKit.Label(card.transform, note, 14, Theme.Sub);
            noteL.gameObject.AddComponent<LayoutElement>().minHeight = 26;

            var scroll = UIKit.Scroll(card.transform);
            scroll.AddComponent<LayoutElement>().flexibleHeight = 1;
            foreach (var a in MetaProgress.Achievements)
            {
                bool unlocked = bestBase != null && MetaProgress.IsUnlocked(a, bestBase);
                bool claimed = bestBase != null && bestBase.achClaimed.TryGetValue(a.id, out var c) && c;
                string mark = claimed ? "[[icon:check]] 已领取" : unlocked ? "[[icon:sparkles]] 已解锁" : "[[icon:lock]] 未解锁";
                var row = UIKit.Row(scroll.transform);
                var img = row.AddComponent<Image>();
                img.color = unlocked ? Theme.HexA("#1A3038", 0.9f) : Theme.HexA("#0E1A22", 0.9f);
                var hl = row.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 14; hl.padding = new RectOffset(10, 10, 8, 8);
                hl.childForceExpandWidth = true; hl.childForceExpandHeight = false;
                hl.childControlWidth = true; hl.childControlHeight = true;
                var ico = UIKit.Label(row.transform, a.icon, 26, unlocked ? Theme.Amber : Theme.Dim);
                ico.alignment = TextAnchor.MiddleCenter;
                var icoLe = ico.gameObject.AddComponent<LayoutElement>(); icoLe.minWidth = 40; icoLe.minHeight = 40;
                var info = UIKit.Label(row.transform, $"<b>{a.name}</b>  {a.desc}", 15, unlocked ? Theme.Txt : Theme.Sub);
                info.gameObject.AddComponent<LayoutElement>().minHeight = 40;
                var markT = UIKit.IconText(row.transform, mark);
                markT.fontSize = 13; markT.color = claimed ? Theme.Ok : unlocked ? Theme.Amber : Theme.Dim;
                var mLe = markT.gameObject.AddComponent<LayoutElement>(); mLe.minWidth = 110; mLe.minHeight = 40;
                markT.alignment = TextAnchor.MiddleRight;
            }
            MenuShared.MakeBtnRow(card, r => UIKit.Btn(r, "返回 <i>BACK</i>", Close));
        }
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
        public static void Open() => UiStack.Show<LeaveMenuScreen>("LeaveMenu");

        public override void Build()
        {
            var g = GameRuntime.I;
            var card = MenuShared.MakeOverlayCard(transform, "[[icon:door]] 离开对局？");
            var n1 = UIKit.Label(card.transform, $"当前对局进度已自动保存——下次「开始游戏」进入 <b>档位 {g.ActiveSlot}</b> 会直接继续这场对局。", 14, Theme.Sub);
            n1.gameObject.AddComponent<LayoutElement>().minHeight = 40;
            var n2 = UIKit.IconText(card.transform, "[[icon:question]] 若选择<b>放弃对局</b>：带入本局的卡牌<b>全部丢失</b>；对局中获得的卡牌只有存入<b>安全格</b>的会被宠物运回基地；物资与金币全部散失。");
            n2.fontSize = 14; n2.color = Hex("#F0B9AE");
            n2.supportRichText = true;
            n2.gameObject.AddComponent<LayoutElement>().minHeight = 60;

            MenuShared.MakeBtnRow(card, r =>
            {
                UIKit.BtnOk(r, "[[icon:save]] 保存并回主菜单", () => { if (g.ExitToTitle()) App.ShowTitle(); });
                Button abandon = null;
                abandon = UIKit.BtnDanger(r, "[[icon:flag]] 放弃对局", () =>
                {
                    var arm = abandon.gameObject.GetComponent<ArmLabel>();
                    if (arm == null) arm = abandon.gameObject.AddComponent<ArmLabel>();
                    if (arm.armed)
                    {
                        var res = g.AbandonRun();
                        if (res == null) return;
                        Close();
                        UiStack.Show<AbandonResultScreen>("AbandonResult").Setup(res);
                        return;
                    }
                    arm.armed = true; arm.t = 2.6f;
                    abandon.GetComponentInChildren<Text>().text = "确认放弃？（卡牌将全部丢失）";
                });
                UIKit.Btn(r, "↩ 继续对局", Close);
            });
        }

        /// <summary>放弃钮两步确认计时（还原文案「放弃对局」）。</summary>
        sealed class ArmLabel : MonoBehaviour
        {
            public bool armed; public float t;
            void Update()
            {
                if (!armed) return;
                t -= Time.deltaTime;
                if (t <= 0)
                {
                    armed = false;
                    var txt = GetComponentInChildren<Text>();
                    if (txt != null) txt.text = "放弃对局";
                }
            }
        }
        static Color Hex(string h) => Theme.Hex(h);
    }

    /// <summary>放弃对局结算（abandonRun 文案照抄）。</summary>
    public sealed class AbandonResultScreen : Panel
    {
        AbandonResult _res;
        public void Setup(AbandonResult res) { _res = res; Rebuild(); }

        public override void Build()
        {
            if (_res == null) return;
            var card = MenuShared.MakeOverlayCard(transform, "[[icon:flag]] 已放弃对局");
            var stats = UIKit.Label(card.transform,
                $"带入本局的 <b>{_res.BroughtN}</b> 张卡牌全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；\n物资与 <color=#{ColorUtility.ToHtmlStringRGB(Theme.Gold)}>{_res.Coins} 币</color>一并散失。",
                15, Theme.Txt);
            stats.gameObject.AddComponent<LayoutElement>().minHeight = 60;
            string kept;
            if (_res.KeptStacks.Count > 0)
            {
                var names = _res.KeptStacks.Select(s => s.card.name + (s.count > 1 ? " ×" + s.count : ""));
                kept = "[[icon:lock]] 宠物从安全格抢运回 <b>" + _res.KeptN + "</b> 张对局中获得的卡牌：" + string.Join("、", names);
            }
            else kept = "安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。";
            var keptL = UIKit.IconText(card.transform, kept);
            keptL.fontSize = 14; keptL.color = Theme.Sub;
            keptL.supportRichText = true;
            keptL.gameObject.AddComponent<LayoutElement>().minHeight = 44;

            MenuShared.MakeBtnRow(card, r =>
            {
                UIKit.Btn(r, "[[icon:home]] 回基地", () => { Close(); Screens.Hub.HubScreen.Open("deploy"); });
                UIKit.BtnOk(r, "[[icon:archive]] 回主菜单", () => { Close(); App.ShowTitle(); });
            });
        }
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
