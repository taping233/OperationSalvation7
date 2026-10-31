// ported from src/game.notes.js openCellEditor()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//   p.ov-stats = 结点 中央区 · #n / 环n · #n
//   p.ov-note（左对齐） = info 行（环名 · 轨道编号 / 出生入口 / 环间门 / 污染核心入口 / 事件配置）
//   textarea#ovNote.ov-textarea（placeholder=给这个结点写说明……）→ InputField（多行，占位文案照抄）
//   .ov-btns → 保存备注(ok) / 清空 / 取消
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Misc
{
    /// <summary>结点备注编辑器：保存到 GameRuntime 便签存储（§5 全局 sdt-cell-notes-v1）。</summary>
    public class NotesEditorScreen : Panel
    {
        int _li, _idx;
        InputField _input;

        public static void Open(int layerIdx, int nodeIdx)
        {
            var s = ScreenMount.Show<NotesEditorScreen>("NotesEditor");
            s._li = layerIdx; s._idx = nodeIdx;
            s.Build();
        }

        // TYPE_NAME（game.notes.js 照抄）
        static string TypeName(string type)
        {
            switch (type)
            {
                case "coin": return "硬币"; case "wood": return "木材"; case "battle": return "战斗";
                case "event": return "随机事件"; case "shop": return "商店"; case "fire": return "火堆";
                case "chest": return "宝箱"; case "rations": return "口粮"; case "key": return "钥匙";
                case "emergencyExit": return "紧急撤离点"; case "door": return "隔离闸门";
                case "altar": return "污染核心"; case "boss": return "首脑"; case "entrance": return "清扫口";
                default: return type;
            }
        }

        public override void Build()
        {
            bool isCenter = _li == -1;
            var nodeInfo = GameRuntime.I.GetNodeInfo(_li, _idx); // { layerName, nodeKind, hasDoor, doorExit, doorTo, hasAltarEntrance, entranceName }

            var root = UIKit.Panel("notes-editor", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.94f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(60, 60, 50, 50);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            UIKit.IconText(root.transform, "[[icon:pen]] 编辑结点备注").fontSize = 24;
            UIKit.Label(root.transform, "结点 " + (isCenter ? "中央区 · #" + _idx : "环" + (_li + 1) + " · #" + _idx), 20, Color.white).fontStyle = FontStyle.Bold;

            var info = new List<string>();
            if (!isCenter)
            {
                info.Add((nodeInfo != null ? nodeInfo.layerName : "") + " · 轨道编号 <b>" + _idx + "</b>");
                if (nodeInfo != null && !string.IsNullOrEmpty(nodeInfo.entranceName)) info.Add("[[icon:door]] 出生入口：" + nodeInfo.entranceName);
                if (nodeInfo != null && nodeInfo.hasDoor) info.Add("[[icon:door]] 环间门" + (nodeInfo.doorExit ? "（撤离出口）" : "") + " ⇄ " + nodeInfo.doorTo);
                if (nodeInfo != null && nodeInfo.hasAltarEntrance) info.Add("[[icon:crystal]] 污染核心入口");
                info.Add("事件配置：" + (nodeInfo != null && !string.IsNullOrEmpty(nodeInfo.nodeKind)
                    ? TypeName(nodeInfo.nodeKind) + (nodeInfo.n > 0 ? " +" + nodeInfo.n + "币" : "") : "无"));
            }
            else info.Add("中央区：污染核心");

            foreach (var line in info)
            {
                var t = UIKit.IconText(root.transform, line);
                t.fontSize = 14; t.color = UiPalette.Dim; t.alignment = TextAnchor.MiddleLeft;
                var le = t.gameObject.AddComponent<LayoutElement>(); le.minHeight = 20; le.flexibleHeight = 0;
            }

            // textarea（多行 InputField，placeholder 照抄）
            var inputGo = new GameObject("ovNote", typeof(RectTransform));
            inputGo.transform.SetParent(root.transform, false);
            var leI = inputGo.AddComponent<LayoutElement>(); leI.minHeight = 120; leI.flexibleWidth = 1;
            var bgImg = UiExt.Box(inputGo.transform, UiPalette.HexA("#12222E", 0.9f));
            UiExt.Stretch(bgImg.rectTransform);
            _input = inputGo.AddComponent<InputField>();
            var textArea = new GameObject("text", typeof(RectTransform));
            textArea.transform.SetParent(inputGo.transform, false);
            UiExt.Stretch(textArea.GetComponent<RectTransform>());
            textArea.AddComponent<RectMask2D>();
            var txt = UIKit.Label(textArea.transform, "", 15, Color.white);
            txt.alignment = TextAnchor.UpperLeft; txt.supportRichText = false;
            var ph = UIKit.Label(textArea.transform, "给这个结点写说明……", 15, UiPalette.Dim);
            ph.alignment = TextAnchor.UpperLeft;
            _input.textComponent = txt; _input.placeholder = ph;
            _input.lineType = InputField.LineType.MultiLineNewline;
            _input.text = GameRuntime.I.GetNodeNote(_li, _idx) ?? "";

            var btns = UiExt.Row(root.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 12; hl.childAlignment = TextAnchor.MiddleCenter;
            UIKit.Btn(btns.transform, "保存备注", () =>
            {
                GameRuntime.I.SetNodeNote(_li, _idx, _input.text);
                Close();
                RunLog.Log("已保存结点备注", "ok");
            });
            UIKit.Btn(btns.transform, "清空", () =>
            {
                GameRuntime.I.SetNodeNote(_li, _idx, "");
                Close();
                RunLog.Log("已清空结点备注", "dim");
            });
            UIKit.Btn(btns.transform, "取消", () => Close());
        }
    }
}
