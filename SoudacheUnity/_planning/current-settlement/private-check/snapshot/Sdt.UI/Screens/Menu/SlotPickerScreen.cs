// ported from game.menu.js openSlotPicker/slotInfoHTML/SLOT_ICONS（选档页：5 档横排暗色卡片）
//
// 原 DOM → uGUI 控件映射：
//   .pg.slot-page + .slot-bg（bokeh/剪影 SVG 背景） → 全屏 Panel（深蓝渐变底；SVG 雾气/鹿马剪影不移植，纯色+光斑近似）
//   .slot-deck（5 卡横排 grid）                     → GridLayoutGroup 1 行 5 列（每卡 250×520）
//   .slot-card（icon+档名+分隔线+描述+CTA+ops）      → 卡片 Image + 圆形图标（SLOT_ICONS 以 ◆/城堡等字形近似）+ 档名/SLOT 0X/信息行/按钮
//   .slot-card-ops .mini-btn（覆盖重开/删除）        → MiniBtn（两步确认 arm：首次变「确认？」2.6s 还原）
//   .pg-close / .slot-page-help                     → 右上 ✕ + ？（UI.registerHelp('slots') 文案照抄）
//   数据：readSlot(i)→Saves.ReadSlot / SDT.Base.peek(i)→BaseData.Peek / launch→GameRuntime.EnterSlot
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Menu
{
    public sealed class SlotPickerScreen : Panel
    {
        public override void Build()
        {
            var root = UIKit.Panel("slot-page", transform);
            var bg = root.AddComponent<Image>();
            bg.color = Theme.HexA("#0B1B26", 0.98f);
            for (int i = 0; i < 8; i++)   // .bokeh 光斑
            {
                var bokeh = UIKit.Image(root.transform, null);
                bokeh.color = Theme.HexA("#3E5A78", 0.10f);
                var brt = bokeh.rectTransform;
                brt.anchorMin = brt.anchorMax = new Vector2(UnityEngine.Random.value, UnityEngine.Random.value);
                brt.sizeDelta = new Vector2(120 + UnityEngine.Random.value * 220, 120 + UnityEngine.Random.value * 220);
            }

            // .pg-close（返回标题）
            MakeCloseBtn(root.transform, () => { Close(); App.ShowTitle(); });

            // ？帮助（registerHelp('slots')，文案照抄）
            var helpPos = new GameObject("slot-page-help", typeof(RectTransform));
            helpPos.transform.SetParent(root.transform, false);
            var hrt = (RectTransform)helpPos.transform;
            hrt.anchorMin = hrt.anchorMax = new Vector2(1, 1);
            hrt.pivot = new Vector2(1, 1);
            hrt.anchoredPosition = new Vector2(-60, -16);
            HelpSystem.Register("slots", "存档说明", new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("独立存档", "五个档位的基地与进度完全独立（资源/仓库/职业/成就/卡背各自保存）。"),
                new KeyValuePair<string, string>("继续对局", "有未完成对局的档位会直接回到那一局；没有对局则先进基地，再从基地出发。"),
            }, () => UiStack.Show<SlotPickerScreen>("SlotPicker"));
            var hb = HelpSystem.HelpBtn(helpPos.transform, "slots");
            var hle = hb.GetComponent<LayoutElement>(); hle.flexibleWidth = 0; hle.flexibleHeight = 0;

            // header：选择存档 + 分隔线
            var head = UIKit.Label(root.transform, "选择存档", 26, Theme.Txt);
            var hrt2 = (RectTransform)head.transform;
            hrt2.anchorMin = hrt2.anchorMax = new Vector2(0.5f, 1);
            hrt2.pivot = new Vector2(0.5f, 1);
            hrt2.anchoredPosition = new Vector2(0, -40);
            hrt2.sizeDelta = new Vector2(400, 40);
            head.alignment = TextAnchor.MiddleCenter;
            var rule = UIKit.Image(root.transform, null);
            rule.color = Theme.HexA("#B7BFB4", 0.3f);
            var rrt = rule.rectTransform;
            rrt.anchorMin = rrt.anchorMax = new Vector2(0.5f, 1);
            rrt.pivot = new Vector2(0.5f, 1);
            rrt.anchoredPosition = new Vector2(0, -86);
            rrt.sizeDelta = new Vector2(300, 1);

            // .slot-deck：5 档横排
            var deck = new GameObject("slot-deck", typeof(RectTransform));
            deck.transform.SetParent(root.transform, false);
            var drt = (RectTransform)deck.transform;
            drt.anchorMin = new Vector2(0.5f, 0.5f);
            drt.anchorMax = new Vector2(0.5f, 0.5f);
            drt.sizeDelta = new Vector2(1560, 560);
            var grid = deck.AddComponent<GridLayoutGroup>();
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 5;
            grid.cellSize = new Vector2(280, 540);
            grid.spacing = new Vector2(16, 0);

            var rt = GameRuntime.I;
            for (int i = 1; i <= SaveSystem.SlotCount; i++)
            {
                var run = rt.Saves.ReadSlot(i);
                bool readError = rt.Saves.HasReadError;
                string readMessage = rt.Saves.LastError;
                var baseData = BaseData.Peek(rt.Saves, i);
                bool exists = run != null || baseData != null || rt.Saves.HasRun(i);
                BuildCard(deck.transform, i, run, baseData, exists, readError, readMessage);
            }
        }

        void BuildCard(Transform parent, int slot, RunSaveData run, BaseData baseData, bool exists, bool readError, string readMessage)
        {
            var card = new GameObject("slot-card-" + slot, typeof(RectTransform));
            card.transform.SetParent(parent, false);
            var img = card.AddComponent<Image>();
            img.color = exists ? Theme.HexA("#16242E", 0.96f) : Theme.HexA("#0E1A22", 0.96f);
            var outl = card.AddComponent<Outline>();
            outl.effectColor = exists ? Theme.HexA("#A9EFC3", 0.35f) : Theme.HexA("#B7BFB4", 0.25f);
            outl.effectDistance = new Vector2(1, -1);
            var vl = card.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 6; vl.padding = new RectOffset(14, 14, 18, 14);
            vl.childAlignment = TextAnchor.UpperCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // .slot-card-art（SLOT_ICONS 五枚发光图标 → 字形近似）+ 档名/SLOT 0X
            var art = UIKit.Label(card.transform, SlotGlyph(slot), 56, exists ? Theme.Hex("#DDE7E2") : Theme.Hex("#6C7E7A"));
            art.alignment = TextAnchor.MiddleCenter;
            art.gameObject.AddComponent<LayoutElement>().minHeight = 88;
            var name = UIKit.Label(card.transform, "档位 0" + slot, 22, exists ? Theme.Txt : Theme.Dim);
            name.alignment = TextAnchor.MiddleCenter;
            name.fontStyle = FontStyle.Bold;
            name.gameObject.AddComponent<LayoutElement>().minHeight = 30;
            var sub = UIKit.Label(card.transform, "SLOT 0" + slot, 12, Theme.Dim);
            sub.alignment = TextAnchor.MiddleCenter;
            sub.gameObject.AddComponent<LayoutElement>().minHeight = 18;
            var rule = UIKit.Image(card.transform, null);
            rule.color = Theme.HexA("#B7BFB4", 0.25f);
            var le = rule.gameObject.AddComponent<LayoutElement>(); le.minHeight = 1; le.flexibleHeight = 0;

            // .slot-card-desc = slotInfoHTML（文案照抄）
            var info = UIKit.Label(card.transform, SlotInfo(baseData, run), 13, Theme.Sub);
            info.gameObject.AddComponent<LayoutElement>().minHeight = 60;

            // CTA：开新档 NEW GAME / 继续对局 CONTINUE / 进入存档 ENTER
            var ctaText = !exists ? "开新档 NEW GAME" : run != null ? "继续对局 CONTINUE" : "进入存档 ENTER";
            var cta = exists
                ? UIKit.Btn(card.transform, ctaText, () => LaunchEnter(slot, run != null))
                : UIKit.BtnOk(card.transform, ctaText, () => LaunchNew(slot));
            cta.gameObject.AddComponent<LayoutElement>().minHeight = 40;
            if (readError)
            {
                cta.interactable = false;
                UIKit.Label(card.transform, "存档读取失败，原文件已保留：" + readMessage, 14, Theme.ExitRedHover);
            }

            if (exists)
            {
                // 覆盖重开 / 删除（两步确认 armConfirm：2.6 秒还原）
                var ops = UIKit.Row(card.transform);
                var hl = ops.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 8; hl.childAlignment = TextAnchor.MiddleCenter;
                hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
                hl.childControlWidth = true; hl.childControlHeight = true;
                Button ow = null;
                ow = UIKit.MiniBtn(ops.transform, "覆盖重开", () =>
                {
                    if (!ArmConfirm(ow, "确认重开？", "覆盖重开")) return;
                    GameRuntime.I.ClearSlot(slot);
                    LaunchNew(slot);
                });
                Button del = null;
                del = UIKit.MiniBtn(ops.transform, "删除", () =>
                {
                    if (!ArmConfirm(del, "确认删除？", "删除")) return;
                    GameRuntime.I.ClearSlot(slot);
                    GameRuntime.I.Bus.Emit(new ToastRequested { Text = "[[icon:trash]] 已删除【档位 " + slot + "】的存档（含基地数据）", Tone = "warn" });
                    Rebuild();
                }, danger: true);
                del.GetComponent<Image>().color = Theme.HexA("#3A1010", 0.9f);
            }
        }

        // ---------- slotInfoHTML（文案照抄） ----------
        static string SlotInfo(BaseData baseData, RunSaveData run)
        {
            if (baseData == null && run == null) return "EMPTY SLOT · 空档位";
            double total = System.Math.Max(baseData?.stats?.playSeconds ?? 0, run?.elapsed ?? 0);
            var names = new System.Collections.Generic.List<string>();
            if (baseData != null)
                foreach (var a in MetaProgress.Achievements)
                    if (MetaProgress.IsUnlocked(a, baseData)) names.Add(a.name);
            string achNames = names.Count > 0 ? string.Join("、", names) : "暂无";
            return $"<color=#849DA7>PLAYTIME</color> 游玩时间 <b>{TitleScreen.FmtPlayTime(total)}</b>\n" +
                   $"<color=#849DA7>ACHIEVEMENTS</color> 已解锁成就 <b>{names.Count}</b>  {achNames}";
        }

        // ---------- launch（game.menu.js） ----------
        static void LaunchNew(int slot)
        {
            GameRuntime.I.ResetSlot(slot);
            if (!GameRuntime.I.Saves.LastWriteSucceeded) return;
            while (UiStack.Count > 0) UiStack.Pop();
            GameRuntime.I.Bus.Emit(new ToastRequested { Text = "[[icon:archive]] 已进入 <b>档位 " + slot + "</b>（基地与进度独立保存到该档位）", Tone = "sys" });
            Screens.Hub.HubScreen.Open("deploy");
        }

        static void LaunchEnter(int slot, bool hasRun)
        {
            var previousPages = UiStack.CapturePanels();
            GameRuntime.I.EnterSlot(slot);
            if (hasRun)
            {
                if (!GameRuntime.I.LoadRun(slot))
                {
                    GameRuntime.I.Bus.Emit(new ToastRequested { Text = "存档读取失败，原文件已保留：" + GameRuntime.I.Saves.LastError, Tone = "warn" });
                    return;
                }
                foreach (var page in previousPages) UiStack.Close(page);
            }
            else
            {
                foreach (var page in previousPages) UiStack.Close(page);
                Screens.Hub.HubScreen.Open("deploy");
            }
            GameRuntime.I.Bus.Emit(new ToastRequested { Text = "[[icon:archive]] 已进入 <b>档位 " + slot + "</b>（基地与进度独立保存到该档位）", Tone = "sys" });
        }

        // ---------- 两步确认（armConfirm：首次变 armedText，2.6 秒还原） ----------
        static readonly Dictionary<Button, CoroutineArm> _armed = new Dictionary<Button, CoroutineArm>();
        sealed class CoroutineArm { public float t; public string normal; }
        static bool ArmConfirm(Button btn, string armedText, string normalText)
        {
            if (_armed.TryGetValue(btn, out var a)) return true;   // 第二次点击 → 执行
            foreach (var t in btn.GetComponentsInChildren<Text>()) t.text = armedText;
            btn.GetComponent<Image>().color = Theme.BtnArmBg;
            _armed[btn] = new CoroutineArm { t = 2.6f, normal = normalText };
            return false;
        }
        void Update()
        {
            // 还原计时（不用协程：Update 轮询）
            List<Button> done = null;
            foreach (var kv in _armed)
            {
                var a = kv.Value; a.t -= Time.deltaTime;
                if (a.t > 0 || kv.Key == null) continue;
                foreach (var t in kv.Key.GetComponentsInChildren<Text>()) t.text = a.normal;
                if (kv.Key != null) kv.Key.GetComponent<Image>().color = Theme.BtnBg;
                (done ??= new List<Button>()).Add(kv.Key);
            }
            if (done != null) foreach (var b in done) _armed.Remove(b);
        }

        // SLOT_ICONS：五档 AK 风发光 SVG → 字形近似（指挥◆ / 特勤🏰→像形城堡字 / 后勤▲ / 矛头◎ / 突击⚔）
        static string SlotGlyph(int slot) => slot switch
        {
            1 => "◆", 2 => "⌂", 3 => "▲", 4 => "◎", 5 => "⚔", _ => "◆",
        };

        internal static void MakeCloseBtn(Transform parent, Action onClick)
        {
            var go = new GameObject("pg-close", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            go.AddComponent<LayoutElement>().ignoreLayout = true;
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(1, 1);
            rt.anchoredPosition = new Vector2(-16, -16);
            rt.sizeDelta = new Vector2(36, 36);
            var img = go.AddComponent<Image>(); img.color = Theme.HexA("#222527", 0.9f);
            var btn = go.AddComponent<Button>(); btn.targetGraphic = img;
            btn.onClick.AddListener(() => { AudioService.I.PlaySfx("close"); onClick(); });
            var t = UIKit.Label(go.transform, "[[icon:cross]]", 18, Theme.Txt);
            var trt = (RectTransform)t.transform;
            UiStack.Stretch(trt);
            t.alignment = TextAnchor.MiddleCenter;
        }
    }
}
