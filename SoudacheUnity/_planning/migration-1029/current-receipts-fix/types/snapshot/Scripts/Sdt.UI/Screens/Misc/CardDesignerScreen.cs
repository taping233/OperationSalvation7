// ported from src/game.cardslib.js openCardDesigner()/renderDesigner()/mechChipsHTML()/mechToggle()/updateDesignerPreview()/saveDraftCard()
//
// 原界面 DOM 结构 → uGUI 控件树映射（.pg.cdes）：
//   header：h2 卡牌制作坊 + （← 返回卡牌库）+ 保存修改/保存到卡牌库
//   .cdes-main > .cdes-stage#cdesStage > #cardTilt > #cardPreview
//     → 左侧舞台：CardFace(Xl) 实时预览 + stage-hint「移动鼠标可以转动卡牌」；
//       卡面 3D 倾斜跟鼠标 → 简化为绕 z 轴旋转倾斜（CardTilt 组件，按指针相对角度旋转，契约允许）
//   .cdes-form（右侧表单，实时回填预览）：
//     基础设定：卡牌名称 InputField(max12) / 类型 seg（TYPES 按钮组）/ 费用 0-5 seg / 稀有度 seg
//     战斗词条：伤害类型 seg（四类）+ 伤害 −/number/＋ / 抽卡 0-5 / 注能 0-5 / 回复+护甲 number
//     机制词条：MECH_GROUPS 三组 chip（点击 mechToggle 写入/叠加/移除规范句式，实时反映 on 态与次数角标）
//     描述与经济：效果描述 textarea(100字+计数) / 币值 −/number/＋ + 可出售 Toggle
//   保存 saveDraftCard：名称非空校验 → CardDatabase.Upsert（身份字段 cls/hero/unrandom 回写）
using System;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;
using Sdt.Run;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>卡牌制作坊：表单字段实时回填卡面预览。</summary>
    public class CardDesignerScreen : Panel
    {
        static readonly string[] Types = { "武术", "法术", "生物", "道具", "装备", "事件", "英雄卡", "资源" };
        static readonly string[] Rarities = { "初始", "古朴", "稀有", "史诗", "传说", "棱彩" };
        static readonly string[] DmgTypes = { "attack", "spell", "fixed", "true" };

        // MECH_GROUPS（cards.js 照抄：label/icon/tpl/max + sen/cnt 正则）
        class MechItem { public string k, label; public Func<int, string> tpl; public Regex sen, cnt; public int max; }
        static readonly (string group, MechItem[] items)[] MechGroups = new[]
        {
            ("诅咒 · 拖到敌人身上", new MechItem[]
            {
                M("bleed","流血", n=>$"附加 {n} 层流血。", Re(@"附加\s*\d*\s*层?\s*流血[^。；;]*。?"), Re(@"附加\s*(\d+)\s*层?\s*流血"), 5),
                M("poison","中毒", n=>$"附加 {n} 层中毒。", Re(@"附加\s*(?:\d+\s*层)?\s*中毒[^。；;]*。?"), Re(@"附加\s*(?:(\d+)\s*层)?\s*中毒"), 5),
                M("freeze","冰冻", n=>$"附加冰冻，持续 {n} 回合。", Re(@"附加冰冻[^。；;]*。?"), Re(@"持续\s*(\d+)\s*回合"), 3),
                M("silence","沉默", n=>$"附加沉默，持续 {n} 回合。", Re(@"附加沉默[^。；;]*。?"), Re(@"持续\s*(\d+)\s*回合"), 3),
                M("abreak","破甲", _=>"附加破甲。", Re(@"附加破甲[^。；;]*。?"), null, 1),
                M("healban","禁疗", _=>"附加禁疗。", Re(@"附加禁疗[^。；;]*。?"), null, 1),
            }),
            ("祝福 · 作用于自己", new MechItem[]
            {
                M("stealth","潜行", n=>$"获得潜行，持续 {n} 回合。", Re(@"获得潜行[^。；;]*。?"), Re(@"持续\s*(\d+)\s*回合"), 3),
                M("immune","免疫伤害", n=>$"免疫伤害，持续 {n} 回合。", Re(@"免疫伤害[^。；;]*。?"), Re(@"持续\s*(\d+)\s*回合"), 3),
                M("atkUp","攻击力+", n=>$"获得 {n} 点攻击力。", Re(@"获得\s*\d+\s*点\s*攻击力[^。；;]*。?"), Re(@"获得\s*(\d+)\s*点\s*攻击力"), 5),
                M("spellUp","法伤+", n=>$"法伤 +{n}。", Re(@"法伤\s*\+\s*\d+[^。；;]*。?"), Re(@"法伤\s*\+\s*(\d+)"), 5),
                M("reduce","减伤", n=>$"减伤 {n}。", Re(@"减伤\s*\d*[^。；;]*。?"), Re(@"减伤\s*(\d+)"), 5),
                M("shield","护盾", n=>$"获得 {n} 点护盾。", Re(@"获得\s*\d+\s*点?\s*护盾[^。；;]*。?"), Re(@"获得\s*(\d+)\s*点?\s*护盾"), 9),
                M("guard","格挡", _=>"本回合所受伤害降为 1。", Re(@"本回合所受伤害降为[^。；;]*。?"), null, 1),
                M("purify","净化", _=>"净化。", Re(@"净化[^。；;]*。?"), null, 1),
            }),
            ("资源 · 抽牌 / 能量", new MechItem[]
            {
                M("drawTxt","抽牌", n=>$"抽 {n} 张牌。", Re(@"抽\s*\d+\s*张牌[^。；;]*。?"), Re(@"抽\s*(\d+)\s*张牌"), 5),
                M("discover","发现", n=>$"发现 {n} 张卡牌。", Re(@"发现\s*\d*\s*张?\s*(?:传说)?(?:卡牌|牌|卡)[^。；;]*。?"), Re(@"发现\s*(\d+)\s*张?\s*(?:传说)?(?:卡牌|牌|卡)"), 3),
                M("random","随机卡牌", n=>$"获得 {n} 张随机卡牌。", Re(@"(?:获得|获取)?\s*\d+\s*张随机卡牌[^。；;]*。?"), Re(@"获得\s*(\d+)\s*张随机卡牌"), 3),
                M("energy","获得能量", n=>$"获得 {n} 点能量。", Re(@"获得\s*\d+\s*点?能量(?!上限)[^。；;]*。?"), Re(@"获得\s*(\d+)\s*点?能量"), 3),
                M("maxEner","能量上限+", _=>"能量上限 +1。", Re(@"能量上限\s*\+\s*\d+[^。；;]*。?"), null, 1),
            }),
        };
        static MechItem M(string k, string label, Func<int, string> tpl, Regex sen, Regex cnt, int max)
            => new MechItem { k = k, label = label, tpl = tpl, sen = sen, cnt = cnt, max = max };
        static Regex Re(string p) => new Regex(p, RegexOptions.Compiled);

        /// <summary>mechToggle：描述追加/递增/整句移除机制句式（照抄语义）。</summary>
        static string MechToggle(string desc, MechItem item)
        {
            if (!item.sen.IsMatch(desc))
            {
                var phrase = item.tpl(1);
                var d = desc.TrimEnd();
                if (string.IsNullOrEmpty(d)) return phrase;
                return d + (d.EndsWith("。") || d.EndsWith("；") || d.EndsWith(";") ? "" : "；") + phrase;
            }
            var m = item.cnt != null ? item.cnt.Match(desc) : null;
            var n = m != null && m.Success && m.Groups[1].Success ? int.Parse(m.Groups[1].Value) : 1;
            if (item.max > 1 && n < item.max) return item.sen.Replace(desc, item.tpl(n + 1));
            return item.sen.Replace(desc, "").TrimStart('；', ';', ' ', '\t').Trim();
        }

        // draft（openCardDesigner 草稿）
        CardDef _editing;
        CardDef _draft = new CardDef { cost = 1, rarity = "古朴", type = "武术", dmgType = "attack", name = "", desc = "" };
        bool _sellable;
        Transform _stage, _mechWrap, _previewSlot, _formSlot;
        InputField _nameInput, _descInput, _dmgInput, _healInput, _armorInput, _valueInput;
        Text _descCount;
        Toggle _sellToggle;

        public static void Open(CardDef card)
        {
            if (!App.CardEditingEnabled) return;
            var s = ScreenMount.Show<CardDesignerScreen>("CardDesigner");
            s._editing = card;
            if (card != null)
            {
                s._draft = new CardDef
                {
                    id = card.id, name = card.name, cost = card.cost, rarity = card.rarity, type = card.type,
                    dmg = Math.Max(0, card.dmg ?? 0), dmgType = card.dmgType ?? "fixed", draw = card.draw, infuse = card.infuse,
                    heal = card.heal, armor = card.armor, desc = card.desc ?? "", value = card.value,
                    cls = card.cls, hero = card.hero, unrandom = card.unrandom,
                };
                s._sellable = CardLibrary.IsSellable(card);
            }
            s.Build();
            App.RegisterKey(KeyCode.Escape, CloseFromKey);
        }

        static CardDesignerScreen Current;
        static void CloseFromKey() { if (Current != null) Current.CloseDesigner(); }

        void CloseDesigner()
        {
            Close();
            CardLibraryScreen.Open();   // 制作坊关闭回卡牌库（designerReturnLib 主路径）
        }

        protected override void OnDestroy()
        {
            if (Current == this) { Current = null; App.UnregisterKey(KeyCode.Escape); }
        }

        public override void Build()
        {
            Current = this;
            var root = UIKit.Panel("cdes", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.97f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(20, 20, 14, 14);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // header
            var head = UiExt.Row(root.transform);
            var hl = head.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 12; hl.childAlignment = TextAnchor.MiddleLeft;
            UIKit.IconText(head.transform, "[[icon:cards]] 卡牌制作坊").fontSize = 24;
            var sp = new GameObject("spacer", typeof(RectTransform)); sp.transform.SetParent(head.transform, false);
            sp.AddComponent<LayoutElement>().flexibleWidth = 1;
            UIKit.Btn(head.transform, "← 返回卡牌库", () => CloseDesigner());
            UIKit.Btn(head.transform, "[[icon:save]] " + (_editing != null ? "保存修改" : "保存到卡牌库"), () => SaveDraftCard());

            // main：左舞台 + 右表单
            var main = UiExt.Row(root.transform);
            var mhl = main.AddComponent<HorizontalLayoutGroup>();
            mhl.spacing = 18; mhl.childForceExpandWidth = true; mhl.childForceExpandHeight = true;
            mhl.childControlWidth = true; mhl.childControlHeight = true;
            var leM = main.AddComponent<LayoutElement>(); leM.flexibleHeight = 1;

            var stage = UiExt.Col(main.transform);
            var svl = stage.AddComponent<VerticalLayoutGroup>();
            svl.spacing = 8; svl.childForceExpandWidth = true; svl.childForceExpandHeight = false;
            svl.childAlignment = TextAnchor.UpperCenter;
            var leS = stage.AddComponent<LayoutElement>(); leS.flexibleWidth = 1; leS.minWidth = 320;
            _stage = stage.transform;
            var previewGo = new GameObject("cardPreview", typeof(RectTransform));
            previewGo.transform.SetParent(stage.transform, false);
            _previewSlot = previewGo.transform;
            var leP = previewGo.AddComponent<LayoutElement>(); leP.minHeight = 400; leP.flexibleHeight = 1;
            previewGo.AddComponent<CardTilt>();   // 3D 倾斜跟鼠标（简化为旋转倾斜）
            var hint = UIKit.IconText(stage.transform, "[[icon:mouse]] 移动鼠标可以转动卡牌");
            hint.fontSize = 13; hint.alignment = TextAnchor.MiddleCenter; hint.color = UiPalette.Dim;

            var formScroll = UIKit.Scroll(main.transform);
            var leF = formScroll.AddComponent<LayoutElement>(); leF.flexibleWidth = 1.6f; leF.flexibleHeight = 1;
            _formSlot = formScroll.transform;
            BuildForm();
            UpdatePreview();
        }

        void BuildForm()
        {
            var f = _formSlot;
            bool isDmgType = _draft.type == "武术" || _draft.type == "法术";

            UiExt.SectionLabel(f, "基础设定");
            _nameInput = Field(f, "卡牌名称", _draft.name, "起个名字（≤12 字）", maxLen: 12, onv: v => { _draft.name = v; UpdatePreview(); });
            SegRow(f, "类型", Types, _draft.type, t =>
            {
                _draft.type = t;
                if (!(t == "武术" || t == "法术")) _draft.dmg = 0;
                else if (string.IsNullOrEmpty(_draft.dmgType)) _draft.dmgType = t == "法术" ? "spell" : "attack";
                RebuildForm();
            });
            SegRow(f, "费用", new[] { "0", "1", "2", "3", "4", "5" }, _draft.cost.ToString(), v => { _draft.cost = int.Parse(v); UpdatePreview(); });
            SegRow(f, "稀有度", Rarities, _draft.rarity, v => { _draft.rarity = v; UpdatePreview(); });

            UiExt.SectionLabel(f, "战斗词条");
            if (isDmgType)
            {
                SegRow(f, "伤害类型", DmgTypes, _draft.dmgType, v => { _draft.dmgType = v; UpdatePreview(); });
                _dmgInput = NumField(f, "伤害词条", _draft.dmg ?? 0, v => { _draft.dmg = Clamp99(v); UpdatePreview(); });
            }
            SegRow(f, "抽卡", new[] { "0", "1", "2", "3", "4", "5" }, _draft.draw.ToString(), v => { _draft.draw = int.Parse(v); UpdatePreview(); });
            SegRow(f, "注能", new[] { "0", "1", "2", "3", "4", "5" }, _draft.infuse.ToString(), v => { _draft.infuse = int.Parse(v); UpdatePreview(); });
            _healInput = NumField(f, "回复", _draft.heal ?? 0, v => { _draft.heal = Clamp99(v); UpdatePreview(); });
            _armorInput = NumField(f, "护甲", _draft.armor ?? 0, v => { _draft.armor = Clamp99(v); UpdatePreview(); });

            UiExt.SectionLabel(f, "机制词条（点击写入规范句式 · 战斗中自动实装）");
            var mechWrap = new GameObject("mechChips", typeof(RectTransform));
            mechWrap.transform.SetParent(f, false);
            var mvl = mechWrap.AddComponent<VerticalLayoutGroup>();
            mvl.spacing = 6; mvl.childForceExpandWidth = true; mvl.childForceExpandHeight = false;
            _mechWrap = mechWrap.transform;
            BuildMechChips();
            var mechHint = UIKit.Label(f, "[[icon:lantern]] 再点一次叠加次数，到上限后再点移除；句式与战斗结算（battle.core 词条解析）一一对应，也可在描述里手写其他效果。", 12, UiPalette.Dim);
            var leMH = mechHint.gameObject.AddComponent<LayoutElement>(); leMH.minHeight = 30;

            UiExt.SectionLabel(f, "描述与经济");
            _descInput = AreaField(f, "效果描述", _draft.desc, "点上方机制词条自动生成，或手写描述。", 100, v =>
            {
                _draft.desc = v.Length > 100 ? v.Substring(0, 100) : v;
                if (_descCount != null) _descCount.text = _draft.desc.Length + "/100";
                BuildMechChips();
                UpdatePreview();
            });
            _valueInput = NumField(f, "币值", _draft.value ?? 0, v => { _draft.value = Clamp99(v); UpdatePreview(); });
            var sellRow = UiExt.Row(f);
            var shl = sellRow.AddComponent<HorizontalLayoutGroup>();
            shl.spacing = 8;
            _sellToggle = UIKit.Label(sellRow.transform, "可出售", 14, Color.white).gameObject.AddComponent<Toggle>();
            _sellToggle.isOn = _sellable;
            _sellToggle.onValueChanged.AddListener(v => _sellable = v);
            UIKit.Label(sellRow.transform, "所有卡牌默认不可出售，勾选后才能在商店卖掉", 12, UiPalette.Dim);
        }

        void BuildMechChips()
        {
            if (_mechWrap == null) return;
            for (int i = _mechWrap.childCount - 1; i >= 0; i--) Destroy(_mechWrap.GetChild(i).gameObject);
            foreach (var (gname, items) in MechGroups)
            {
                UIKit.Label(_mechWrap, gname, 13, UiPalette.Dim).fontStyle = FontStyle.Bold;
                var row = UiExt.Row(_mechWrap);
                var hl = row.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 6; hl.childForceExpandWidth = false; hl.childControlWidth = true; hl.childControlHeight = true;
                foreach (var it in items)
                {
                    var on = it.sen.IsMatch(_draft.desc ?? "");
                    var m = on && it.cnt != null ? it.cnt.Match(_draft.desc) : null;
                    var n = m != null && m.Success && m.Groups[1].Success ? int.Parse(m.Groups[1].Value) : 1;
                    var label = it.label + (on && n > 1 ? " ×" + n : "");
                    var chip = UIKit.Btn(row.transform, label, () =>
                    {
                        _draft.desc = MechToggle(_draft.desc ?? "", it);
                        if (_draft.desc.Length > 100) { RunLog.Log("描述超过 100 字上限，最后一条词条放不下了", "warn"); }
                        if (_descInput != null) _descInput.text = _draft.desc;
                        if (_descCount != null) _descCount.text = _draft.desc.Length + "/100";
                        BuildMechChips();
                        UpdatePreview();
                    });
                    chip.image.color = on ? UiPalette.HexA("#1F4A3C", 0.9f) : UiPalette.HexA("#0E2230", 0.9f);
                }
            }
        }

        void UpdatePreview()
        {
            if (_previewSlot == null) return;
            for (int i = _previewSlot.childCount - 1; i >= 0; i--) Destroy(_previewSlot.GetChild(i).gameObject);
            var previewCard = new CardDef
            {
                id = _draft.id, name = (_draft.name ?? "").Trim(), cost = _draft.cost, rarity = _draft.rarity, type = _draft.type,
                dmg = _draft.dmg, dmgType = _draft.dmgType, draw = _draft.draw, infuse = _draft.infuse,
                heal = _draft.heal, armor = _draft.armor, desc = _draft.desc, value = _draft.value,
            };
            var face = CardFace.Create(previewCard, CardSize.Xl, _previewSlot);
            var frt = face.GetComponent<RectTransform>();
            frt.anchorMin = new Vector2(0.5f, 0.5f); frt.anchorMax = new Vector2(0.5f, 0.5f);
            frt.anchoredPosition = Vector2.zero;
        }

        void RebuildForm()
        {
            if (_formSlot == null) return;
            for (int i = _formSlot.childCount - 1; i >= 0; i--) Destroy(_formSlot.GetChild(i).gameObject);
            BuildForm();
            UpdatePreview();
        }

        // saveDraftCard（文案照抄；保存走 CardDatabase.Upsert 自定义卡入库）
        void SaveDraftCard()
        {
            if (string.IsNullOrEmpty((_draft.name ?? "").Trim())) { RunLog.Log("卡牌名称不能为空", "warn"); return; }
            bool wasEditing = _editing != null;
            bool isDmgType = _draft.type == "武术" || _draft.type == "法术";
            var card = CardLibrary.Upsert(new CardDef
            {
                id = _draft.id,
                name = _draft.name.Trim(),
                cost = _draft.cost,
                rarity = _draft.rarity,
                type = _draft.type,
                dmg = isDmgType ? _draft.dmg : 0,
                dmgType = isDmgType && _draft.dmg > 0 ? _draft.dmgType : null,
                draw = _draft.draw > 0 ? _draft.draw : 0,
                infuse = _draft.infuse > 0 ? _draft.infuse : 0,
                heal = _draft.heal > 0 ? _draft.heal : 0,
                armor = _draft.armor > 0 ? _draft.armor : 0,
                desc = (_draft.desc ?? "").Trim(),
                value = _draft.value,
                sellable = _sellable,
                cls = _draft.cls, hero = _draft.hero, unrandom = _draft.unrandom,
            });
            AudioService.I.PlaySfx("ding");
            RunLog.Log("[[icon:cards]] 卡牌【<b>" + card.name + "</b>】已" + (wasEditing ? "更新" : "保存到卡牌库"), "ok");
            Close();
            CardLibraryScreen.Open();
        }

        static int Clamp99(int v) => Math.Max(0, Math.Min(99, v));

        // ---------- 表单小件 ----------
        InputField Field(Transform parent, string label, string value, string placeholder, int maxLen, Action<string> onv)
        {
            UIKit.Label(parent, label, 13, UiPalette.Dim);
            var go = new GameObject("input", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var le = go.AddComponent<LayoutElement>(); le.minHeight = 30; le.flexibleWidth = 1;
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.9f)); UiExt.Stretch(img.rectTransform);
            var inf = go.AddComponent<InputField>();
            inf.characterLimit = maxLen;
            var txt = UIKit.Label(go.transform, value ?? "", 14, Color.white); txt.supportRichText = false;
            var ph = UIKit.Label(go.transform, placeholder, 14, UiPalette.Dim);
            inf.textComponent = txt; inf.placeholder = ph; inf.text = value ?? "";
            inf.onValueChanged.AddListener(v => onv(v));
            return inf;
        }

        InputField NumField(Transform parent, string label, int value, Action<int> onv)
        {
            UIKit.Label(parent, label, 13, UiPalette.Dim);
            var go = new GameObject("num", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var le = go.AddComponent<LayoutElement>(); le.minHeight = 28; le.minWidth = 90;
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.9f)); UiExt.Stretch(img.rectTransform);
            var inf = go.AddComponent<InputField>();
            inf.contentType = InputField.ContentType.IntegerNumber;
            var txt = UIKit.Label(go.transform, value.ToString(), 14, Color.white); txt.supportRichText = false;
            inf.textComponent = txt; inf.text = value.ToString();
            inf.onValueChanged.AddListener(v => { int p; if (int.TryParse(v, out p)) onv(p); });
            return inf;
        }

        InputField AreaField(Transform parent, string label, string value, string placeholder, int maxLen, Action<string> onv)
        {
            UIKit.Label(parent, label, 13, UiPalette.Dim);
            var go = new GameObject("textarea", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var le = go.AddComponent<LayoutElement>(); le.minHeight = 90; le.flexibleWidth = 1;
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.9f)); UiExt.Stretch(img.rectTransform);
            var inf = go.AddComponent<InputField>();
            inf.characterLimit = maxLen;
            inf.lineType = InputField.LineType.MultiLineNewline;
            var area = new GameObject("text", typeof(RectTransform));
            area.transform.SetParent(go.transform, false);
            UiExt.Stretch(area.GetComponent<RectTransform>());
            area.AddComponent<RectMask2D>();
            var txt = UIKit.Label(area.transform, value ?? "", 14, Color.white);
            txt.alignment = TextAnchor.UpperLeft; txt.supportRichText = false;
            var ph = UIKit.Label(area.transform, placeholder, 14, UiPalette.Dim);
            ph.alignment = TextAnchor.UpperLeft;
            inf.textComponent = txt; inf.placeholder = ph; inf.text = value ?? "";
            // 字数计数
            var cntGo = new GameObject("descCount", typeof(RectTransform));
            cntGo.transform.SetParent(go.transform, false);
            var crt = cntGo.GetComponent<RectTransform>();
            crt.anchorMin = crt.anchorMax = new Vector2(1, 1); crt.anchoredPosition = new Vector2(-6, -4); crt.pivot = new Vector2(1, 1);
            _descCount = UIKit.Label(cntGo.transform, (value ?? "").Length + "/" + maxLen, 12, UiPalette.Dim);
            UiExt.Stretch(_descCount.rectTransform);
            inf.onValueChanged.AddListener(new UnityEngine.Events.UnityAction<string>(onv));
            return inf;
        }

        void SegRow(Transform parent, string label, string[] options, string cur, Action<string> onPick)
        {
            UIKit.Label(parent, label, 13, UiPalette.Dim);
            var row = UiExt.Row(parent);
            var hl = row.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 4; hl.childForceExpandWidth = false;
            foreach (var o in options)
            {
                var capture = o;
                var b = UIKit.Btn(row.transform, o, () => onPick(capture));
                b.image.color = o == cur ? UiPalette.HexA("#1F4A3C", 0.9f) : UiPalette.HexA("#0E2230", 0.9f);
            }
        }
    }

    /// <summary>卡面 3D 倾斜跟鼠标：简化为绕 z 轴旋转 + 轻微缩放（指针相对卡心的角度驱动）。</summary>
    public class CardTilt : MonoBehaviour
    {
        RectTransform _rt;
        void Awake() { _rt = GetComponent<RectTransform>(); }
        void Update()
        {
            if (_rt == null) return;
            Vector2 local;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(_rt, Input.mousePosition, null, out local))
            {
                var w = Mathf.Max(1, _rt.rect.width); var h = Mathf.Max(1, _rt.rect.height);
                var px = Mathf.Clamp(local.x / w + 0.5f, 0f, 1f) - 0.5f;
                var py = Mathf.Clamp(local.y / h + 0.5f, 0f, 1f) - 0.5f;
                float inside = Mathf.Abs(px) <= 0.5f && Mathf.Abs(py) <= 0.5f ? 1f : 0f;
                var targetZ = (px * -16f + py * 10f) * inside;
                var targetScale = 1f + 0.04f * inside;
                transform.localRotation = Quaternion.Lerp(transform.localRotation, Quaternion.Euler(0, 0, targetZ), Time.deltaTime * 10f);
                transform.localScale = Vector3.Lerp(transform.localScale, Vector3.one * targetScale, Time.deltaTime * 10f);
            }
        }
    }
}
