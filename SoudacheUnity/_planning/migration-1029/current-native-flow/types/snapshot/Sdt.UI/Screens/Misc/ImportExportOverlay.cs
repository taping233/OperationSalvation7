using System.Collections.Generic;
// ported from src/game.cardslib.js showCardsExportOverlay()/showCardsImportOverlay()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//【导出】p.ov-note（把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。）
//        textarea#ovExport（readonly）→ 多行 InputField（只读，预填 JSON）
//        .ov-btns → 复制到剪贴板 / 下载文件 / ← 返回卡牌库
//【导入】p.ov-note（粘贴卡牌 JSON（按 id 合并覆盖）。）
//        textarea#ovImport（placeholder {"game":"sdt","cards":[…]}）→ 多行 InputField
//        .ov-btns → 导入 / 取消
// 导入按源码逐字段 clamp（name≤12/desc≤100/cost∈0-5/数值 0-99，rarity/type 白名单），文案照抄。
using System;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;
using Sdt.Core;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>卡牌库 JSON 导入/导出（textarea 语义）。</summary>
    public class ImportExportOverlay : Panel
    {
        Action _back;

        public override void Build() { }   // 由 ShowExport/ShowImport 分支构建

        public static void ShowExport(Action back = null)
        {
            var json = JsonConvert.SerializeObject(new { game = "sdt", format = "cards", version = 2, cards = CardLibrary.All() },
                Formatting.Indented);
            var s = ScreenMount.Show<ImportExportOverlay>("CardsExport");
            s._back = back;
            s.BuildExport(json);
        }

        public static void ShowImport(Action back)
        {
            if (!App.CardEditingEnabled) return;
            var s = ScreenMount.Show<ImportExportOverlay>("CardsImport");
            s._back = back;
            s.BuildImport();
        }

        GameObject Root()
        {
            var root = UIKit.Panel("io", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.94f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(50, 50, 40, 40);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            return root;
        }

        void BuildExport(string json)
        {
            var root = Root();
            UIKit.IconText(root.transform, "[[icon:upload]] 导出卡牌").fontSize = 24;
            UIKit.Label(root.transform, "把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。", 14, UiPalette.Dim);
            var area = MakeArea(root, json, "", 380, readOnly: true);

            var btns = UiExt.Row(root.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 12; hl.childAlignment = TextAnchor.MiddleCenter;
            UIKit.Btn(btns.transform, "复制到剪贴板", () =>
            {
                GUIUtility.systemCopyBuffer = json;
                RunLog.Log("卡牌 JSON 已复制", "ok");
            });
            UIKit.Btn(btns.transform, "下载文件", () =>
            {
                // 网页 download a[download] 的桌面对应物：写到持久目录 sdt/exports
                try
                {
                    var dir = System.IO.Path.Combine(Application.persistentDataPath, "sdt", "exports");
                    System.IO.Directory.CreateDirectory(dir);
                    System.IO.File.WriteAllText(System.IO.Path.Combine(dir, "sdt-cards.json"), json);
                    RunLog.Log("已写入 " + dir + "\\sdt-cards.json", "ok");
                }
                catch (Exception e) { RunLog.Log("下载失败：" + e.Message, "warn"); }
            });
            UIKit.Btn(btns.transform, "← 返回卡牌库", () => { Close(); _back?.Invoke(); });
        }

        void BuildImport()
        {
            var root = Root();
            UIKit.IconText(root.transform, "[[icon:download]] 导入卡牌").fontSize = 24;
            UIKit.Label(root.transform, "粘贴卡牌 JSON（按 id 合并覆盖）。", 14, UiPalette.Dim);
            var area = MakeArea(root, "", "{\"game\":\"sdt\",\"cards\":[…]}", 380, readOnly: false);

            var btns = UiExt.Row(root.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 12; hl.childAlignment = TextAnchor.MiddleCenter;
            UIKit.Btn(btns.transform, "导入", () => DoImport(area.text));
            UIKit.Btn(btns.transform, "取消", () => { Close(); _back?.Invoke(); });
        }

        void DoImport(string text)
        {
            try
            {
                var parsed = JsonConvert.DeserializeObject<ImportDoc>(text);
                var cards = parsed != null && parsed.cards != null ? parsed.cards.ToList()
                    : JsonConvert.DeserializeObject<System.Collections.Generic.List<CardDef>>(text);
                if (cards == null || cards.Count == 0) throw new Exception("缺少 cards 数组");
                foreach (var c in cards)
                {
                    if (string.IsNullOrEmpty(c.name)) continue;
                    CardLibrary.Upsert(new CardDef
                    {
                        id = c.id,
                        name = c.name.Length > 12 ? c.name.Substring(0, 12) : c.name,
                        cost = Math.Max(0, Math.Min(5, c.cost)),
                        rarity = Rarities.Contains(c.rarity) ? c.rarity : "古朴",
                        type = Types.Contains(c.type) ? c.type : "武术",
                        dmg = Clamp99(c.dmg ?? 0),
                        dmgType = DmgTypes.Contains(c.dmgType) ? c.dmgType : null,
                        draw = Clamp99(c.draw ?? 0), infuse = Clamp99(c.infuse ?? 0), heal = Clamp99(c.heal ?? 0), armor = Clamp99(c.armor ?? 0),
                        desc = c.desc != null ? (c.desc.Length > 100 ? c.desc.Substring(0, 100) : c.desc) : "",
                        value = Clamp99(c.value ?? 0),
                        sellable = c.sellable,
                    });
                }
                RunLog.Log("卡牌导入完成", "ok");
                Close();
                _back?.Invoke();
            }
            catch (Exception err) { RunLog.Log("导入失败：" + err.Message, "warn"); }
        }

        static readonly string[] Rarities = { "初始", "古朴", "稀有", "史诗", "传说", "棱彩" };
        static readonly string[] Types = { "武术", "法术", "生物", "道具", "装备", "事件", "英雄卡", "资源" };
        static readonly string[] DmgTypes = { "attack", "spell", "fixed", "true" };
        static int Clamp99(int v) => Math.Max(0, Math.Min(99, v));

        class ImportDoc { public System.Collections.Generic.List<CardDef> cards; }

        InputField MakeArea(GameObject root, string value, string placeholder, float minHeight, bool readOnly)
        {
            var go = new GameObject("ovExport", typeof(RectTransform));
            go.transform.SetParent(root.transform, false);
            var le = go.AddComponent<LayoutElement>(); le.minHeight = minHeight; le.flexibleWidth = 1; le.flexibleHeight = 1;
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.9f)); UiExt.Stretch(img.rectTransform);
            var inf = go.AddComponent<InputField>();
            inf.lineType = InputField.LineType.MultiLineNewline;
            var area = new GameObject("text", typeof(RectTransform));
            area.transform.SetParent(go.transform, false);
            UiExt.Stretch(area.GetComponent<RectTransform>());
            area.AddComponent<RectMask2D>();
            var txt = UIKit.Label(area.transform, value, 13, UiPalette.Hex("#D8E4EC"));
            txt.alignment = TextAnchor.UpperLeft; txt.supportRichText = false;
            var ph = UIKit.Label(area.transform, placeholder, 13, UiPalette.Dim);
            ph.alignment = TextAnchor.UpperLeft;
            inf.textComponent = txt; inf.placeholder = ph; inf.text = value;
            if (readOnly) inf.readOnly = true;
            return inf;
        }
    }
}
