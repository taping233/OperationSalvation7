using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public partial class BattleScreen
    {
        bool _skillTargeting;
        RectTransform _allies;
        string _allySignature;
        void BuildAllies(Transform arena, BattleSnapshot snapshot, IBattleViewApi api)
        {
            if (_allies == null) { _allies = BattleRect("sts-allies", arena); _allies.anchorMin = new Vector2(.35f, 0); _allies.anchorMax = new Vector2(.52f, 0); _allies.pivot = new Vector2(.5f, 0); }
            _allies.anchoredPosition = new Vector2(0, _stageRoot.rect.height * .28f + 110); _allies.sizeDelta = new Vector2(0, 180);
            string signature = snapshot.Allies == null ? "" : string.Join("|", snapshot.Allies.Select(a => a.Id + a.Hp + ":" + a.Atk + ":" + string.Join(",", a.Status ?? new System.Collections.Generic.Dictionary<string,int>())));
            if (_allySignature == signature) return; _allySignature = signature; ClearRegion(_allies);
            if (snapshot.Allies == null) return;
            for (int i = 0; i < snapshot.Allies.Count; i++)
            {
                var ally = snapshot.Allies[i];
                var view = new UnitMount(_allies, "sts-ally", () => ShowReadout(ally.Name, ally.desc ?? "盟友"));
                Fixed(view.Root, new Vector2(.5f, 0), new Vector2(.5f, 0), new Vector2((i - (snapshot.Allies.Count - 1) / 2f) * 172, 0), new Vector2(156, 180));
                Fixed(view.Figure, new Vector2(.5f, 0), new Vector2(.5f, 0), Vector2.zero, new Vector2(156, 180));
                view.Art.sprite = Sdt.Res.Res.EnemyPortrait(ally.Id);
                view.Update(ally.Name, ally.Hp, ally.MaxHp, ally.Statless ? "" : "[[icon:swords]] 攻 " + ally.Atk, api.CurseChips(ally.Status), null, ally.Dead, false);
                view.SetStatless(ally.Statless);
            }
        }
        void BuildEquipment(BattleSnapshot s, IBattleCommands commands)
        {
            var skill = s.HeroSkill;
            string signature = (skill == null ? "" : skill.name + skill.cost + skill.used + _skillTargeting) + "|" + InputLocked(s) + "|" + s.Energy
                + (s.Equipment == null ? "" : string.Join("|", s.Equipment.Select(e => e.uid + e.canUse)));
            if (_equipmentSignature == signature) return; _equipmentSignature = signature; ClearRegion(_equipment);
            var flow = Sdt.UI.Kit.UIKit.GetOrAdd<VerticalLayoutGroup>(_equipment);
            flow.spacing = 5; flow.childForceExpandWidth = flow.childForceExpandHeight = false; flow.childControlWidth = flow.childControlHeight = true;
            flow.childAlignment = TextAnchor.LowerCenter;
            if (skill != null)
            {
                var button = IconAction(_equipment, skill.name, Sdt.Res.Res.BattleControl(skill.kind ?? "attack"), () =>
                {
                    var current = GameSnapshotRef.Current; if (InputLocked(current)) return;
                    var now = current.HeroSkill; if (now == null || now.used || current.Energy < now.cost) return;
                    _itemTargetUid = null;
                    if (now.needsTarget) { _skillTargeting = !_skillTargeting; BuildStage(current); }
                    else { var result = commands.UseHeroSkill(); if (!result.Ok) RunLog.Log(result.Reason, "warn"); }
                }, !InputLocked(s) && !skill.used && s.Energy >= skill.cost);
                var fee = UIKit.Label(button.transform, skill.cost.ToString(), 12, Color.white);
                TextAt(fee, Vector2.right, Vector2.right, Vector2.zero, new Vector2(18, 18), TextAnchor.MiddleCenter);
                if (skill.used || _skillTargeting)
                {
                    var mark = UIKit.Label(button.transform, skill.used ? "✓" : "◎", 12, Color.white);
                    TextAt(mark, Vector2.one, Vector2.one, Vector2.zero, new Vector2(18, 18), TextAnchor.MiddleCenter);
                }
                button.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout(skill.name, skill.cost + "费 · 每回合一次\n" + (skill.needsTarget ? "选择敌人施放" : skill.heal > 0 ? "回复 " + skill.heal + " 生命" : "使用职业技能")));
            }
            if (s.Equipment == null) return;
            foreach (var entry in s.Equipment)
            {
                string uid = entry.uid;
                var art = Sdt.Res.Res.CardIllustration(entry.card.id, entry.card.art, entry.card.type, entry.card.name, true);
                var button = IconAction(_equipment, entry.card.name, art, () =>
                {
                    var current = GameSnapshotRef.Current; if (InputLocked(current)) return;
                    if (current.Equipment?.Any(e => e.uid == uid && e.canUse) == true)
                    { var result = commands.UseEquipment(uid); if (!result.Ok) RunLog.Log(result.Reason, "warn"); }
                    else ShowReadout(entry.card.name, entry.card.desc);
                }, true);
                button.image.color = entry.canUse ? BtColors.Hex("#5D5638") : BtColors.Hex("#15212C");
                button.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout(entry.card.name, entry.card.desc));
            }
        }
        Button IconAction(Transform parent, string label, Sprite art, Action action, bool enabled)
        {
            var button = BtBtn.Create(parent, "", action, "ghost", enabled);
            button.name = label;
            var element = button.GetComponent<LayoutElement>(); element.minWidth = element.preferredWidth = 48; element.minHeight = element.preferredHeight = 48;
            var image = UIKit.Image(button.transform, art ?? Sdt.Res.Res.Ui("swords")); image.preserveAspect = true; image.raycastTarget = false;
            UiExt.Stretch(image.rectTransform); image.rectTransform.offsetMin = Vector2.one * 2; image.rectTransform.offsetMax = -Vector2.one * 2;
            image.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            return button;
        }
        void BuildRuleInputs(BattleSnapshot s, IBattleViewApi api, IBattleCommands commands)
        {
            bool selecting = s.RuleHandSelection != null;
            foreach (var card in _cards)
            {
                if (selecting) card.SetOff(!s.RuleHandSelection.candidateUids.Contains(card.Uid));
            }
            string signature = s.RuleChoice == null ? "" : string.Join("|", s.RuleChoice.labels);
            if (_ruleSignature == signature) return; _ruleSignature = signature; ClearRegion(_ruleInput);
            _ruleInput.gameObject.SetActive(signature.Length > 0); if (signature.Length == 0) return;
            var mask = UIKit.Image(_ruleInput, BtSprites.White()); UiExt.Stretch(mask.rectTransform); mask.color = BtColors.HexA("#000000", .55f);
            var panel = BattleRect("battle-decision choice", _ruleInput); Anchor(panel, .2f, .25f, .8f, .85f);
            panel.gameObject.AddComponent<Image>().color = BtColors.Hex("#10232B");
            var flow = panel.gameObject.AddComponent<VerticalLayoutGroup>(); flow.padding = new RectOffset(24,24,24,24); flow.spacing = 18;
            flow.childForceExpandHeight = false; flow.childControlWidth = flow.childControlHeight = true;
            UIKit.Label(panel, "选择卡牌效果", 30, BtColors.Hex("#F0E0B8"));
            for (int i = 0; i < s.RuleChoice.labels.Count; i++)
            {
                int selected = i; BtBtn.Create(panel, s.RuleChoice.labels[i], () => commands.ChooseRuleOption(selected));
            }
        }
        void ShowReadout(string title, string detail) { BattleReadout.Show(_stageRoot, title, detail); }
    }
}
