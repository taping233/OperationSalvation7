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
        readonly System.Collections.Generic.Dictionary<string,string> _materialPicked = new System.Collections.Generic.Dictionary<string,string>();
        long _materialSelectionId;
        int _materialRemaining;
        string _materialBattleToken;
        bool _materialSubmitting;
        static int MaterialNeed(RuleHandSelectionSnapshot selection) => selection.act == "play" ? 1 : selection.n;
        static string MaterialLabel(RuleHandSelectionSnapshot selection) => selection.act == "payment" ? "选择消耗代价"
            : selection.act == "copy" ? "选择复制的手牌" : selection.act == "zero" ? "选择变为零费的手牌"
            : selection.act == "play" ? "选择免费施放的手牌" : "选择消耗手牌";
        void SyncMaterialDraft(BattleSnapshot s)
        {
            if (_materialSubmitting) return;
            long id = s.RuleHandSelection?.selectionId ?? 0;
            int remaining = s.RuleHandSelection?.n ?? 0;
            if (_materialSelectionId != id || _materialBattleToken != s.BattleToken || _materialRemaining != remaining)
            { _materialPicked.Clear(); _materialSelectionId = id; _materialBattleToken = s.BattleToken; _materialRemaining = remaining; }
        }
        static bool MaterialEligible(string uid, BattleSnapshot s, IBattleViewApi api) => s.RuleHandSelection?.candidateUids.Contains(uid) == true
            && s.Hand.Contains(uid) && api.FindCard(uid)?.Card != null && BattleRules.MatchesHandSelectKey(api.FindCard(uid).Card,s.RuleHandSelection.type);
        void ToggleRuleMaterial(string uid, BattleSnapshot s, IBattleViewApi api)
        {
            SyncMaterialDraft(s); var selection = s.RuleHandSelection;
            if (_materialSubmitting || selection == null) return;
            if (_materialPicked.ContainsKey(uid)) _materialPicked.Remove(uid);
            else if (MaterialEligible(uid,s,api) && _materialPicked.Count < MaterialNeed(selection))
                _materialPicked.Add(uid,Newtonsoft.Json.JsonConvert.SerializeObject(api.FindCard(uid).Card));
            BuildStage(s);
        }
        bool MaterialDraftValid(BattleSnapshot s, IBattleViewApi api)
        {
            var selection = s?.RuleHandSelection;
            return !_materialSubmitting && selection != null && !s.over && !s.Busy && s.Phase != "enemy"
                && _materialBattleToken == s.BattleToken && _materialSelectionId == selection.selectionId && _materialRemaining == selection.n
                && _materialPicked.Count == MaterialNeed(selection) && _materialPicked.All(p => MaterialEligible(p.Key,s,api)
                    && Newtonsoft.Json.JsonConvert.SerializeObject(api.FindCard(p.Key).Card) == p.Value);
        }
        bool CurrentMaterial(string token, long selectionId)
        {
            var current = GameSnapshotRef.Current;
            return UiStack.Top == this && !PresentationBusy && current?.BattleToken == token
                && current.RuleHandSelection?.selectionId == selectionId && !current.over && !current.Busy;
        }
        void ConfirmMaterialDraft(string token, long selectionId, IBattleViewApi api, IBattleCommands commands)
        {
            var current = GameSnapshotRef.Current;
            if (!CurrentMaterial(token,selectionId) || !MaterialDraftValid(current,api)) return;
            var picked = _materialPicked.ToArray();
            _materialSubmitting = true;
            try
            {
                if (current.RuleHandSelection.act == "payment")
                { var result = commands.ConfirmRuleHandPayment(selectionId,picked.Select(p => p.Key).ToArray()); if (!result.Ok) RunLog.Log(result.Reason,"warn"); }
                else for (int i = 0; i < picked.Length; i++)
                {
                    var now = GameSnapshotRef.Current;
                    if (now?.BattleToken != token || now.RuleHandSelection?.selectionId != selectionId || now.RuleHandSelection.n != current.RuleHandSelection.n - i
                        || !MaterialEligible(picked[i].Key,now,api) || Newtonsoft.Json.JsonConvert.SerializeObject(api.FindCard(picked[i].Key).Card) != picked[i].Value) break;
                    var result = commands.SelectRuleHand(picked[i].Key);
                    if (!result.Ok) { RunLog.Log(result.Reason,"warn"); break; }
                }
            }
            finally { _materialSubmitting = false; _materialPicked.Clear(); if (GameSnapshotRef.Current != null) BuildStage(GameSnapshotRef.Current); }
        }
        void CancelMaterialDraft(string token, long selectionId, IBattleCommands commands)
        {
            if (!CurrentMaterial(token,selectionId) || GameSnapshotRef.Current.RuleHandSelection.canCancel != true) return;
            _materialPicked.Clear();
            var result = commands.CancelRuleHandSelection(selectionId); if (!result.Ok) RunLog.Log(result.Reason,"warn");
        }
        RectTransform _materialControls;
        string _materialControlsSignature;
        void SyncHandSelection(BattleSnapshot s, IBattleViewApi api, IBattleCommands commands)
        {
            if (_materialControls == null) _materialControls = BattleRect("hand-material-selection",_stageRoot);
            var selection = s.RuleHandSelection;
            _materialControls.gameObject.SetActive(selection != null);
            if (selection == null) { _materialControlsSignature = null; return; }
            bool valid=MaterialDraftValid(s,api);
            string signature=s.BattleToken+":"+selection.selectionId+":"+selection.n+":"+string.Join("|",_materialPicked.Keys)+":"+valid+":"+selection.canCancel;
            if (_materialControlsSignature == signature) return;
            _materialControlsSignature = signature;
            var eventSystem=UnityEngine.EventSystems.EventSystem.current;
            var focused=eventSystem!=null?eventSystem.currentSelectedGameObject:null;
            string focus=focused!=null?focused.name:null;
            ClearRegion(_materialControls);
            _materialControls.anchorMin=new Vector2(0,.5f);_materialControls.anchorMax=new Vector2(1,.5f);_materialControls.pivot=Vector2.one*.5f;
            _materialControls.offsetMin=new Vector2(0,-44);_materialControls.offsetMax=new Vector2(0,44);_materialControls.SetAsLastSibling();
            var flow=UIKit.GetOrAdd<HorizontalLayoutGroup>(_materialControls);flow.spacing=16;flow.childAlignment=TextAnchor.MiddleCenter;
            flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandWidth=flow.childForceExpandHeight=false;
            string token=s.BattleToken;long id=selection.selectionId;
            var cancel=BtBtn.Create(_materialControls,"取消",()=>CancelMaterialDraft(token,id,commands),"ghost",selection.canCancel);cancel.name="hand-material-cancel";
            BattleRect("selection-left-space",_materialControls).gameObject.AddComponent<LayoutElement>().flexibleWidth=1;
            var status=BattleRect("hand-material-status",_materialControls);UIKit.GetOrAdd<Image>(status).color=BtColors.HexA("#10232B",.91f);
            var statusSize=status.gameObject.AddComponent<LayoutElement>();statusSize.preferredWidth=600;statusSize.minHeight=statusSize.preferredHeight=48;
            var text=UIKit.Label(status,MaterialLabel(selection)+" · "+_materialPicked.Count+"/"+MaterialNeed(selection),21,BtColors.Hex("#F0E0B8"));
            UiExt.Stretch(text.rectTransform);text.alignment=TextAnchor.MiddleCenter;text.raycastTarget=false;
            BattleRect("selection-right-space",_materialControls).gameObject.AddComponent<LayoutElement>().flexibleWidth=1;
            var confirm=BtBtn.Create(_materialControls,"确定",()=>ConfirmMaterialDraft(token,id,api,commands),"ok",valid);confirm.name="hand-material-confirm";
            foreach(var button in new[]{cancel,confirm})
            {var size=button.GetComponent<LayoutElement>();size.minWidth=size.preferredWidth=220;size.minHeight=size.preferredHeight=88;button.GetComponentInChildren<Text>().fontSize=30;button.GetComponent<HorizontalLayoutGroup>().padding=new RectOffset(32,32,18,18);}
            if(eventSystem!=null&&(focus==cancel.name||focus==confirm.name))eventSystem.SetSelectedGameObject(focus==cancel.name?cancel.gameObject:confirm.gameObject);
        }
        RectTransform _allies;
        string _allySignature;
        void BuildAllies(Transform arena, BattleSnapshot snapshot, IBattleViewApi api)
        {
            if (_allies == null) { _allies = BattleRect("sts-allies", arena); _allies.anchorMin = new Vector2(.35f, 0); _allies.anchorMax = new Vector2(.52f, 0); _allies.pivot = new Vector2(.5f, 0); }
            _allies.anchoredPosition = new Vector2(0, _stageRoot.rect.height * .28f + 110); _allies.sizeDelta = new Vector2(0, 180);
            string signature = snapshot.Allies == null ? "" : string.Join("|", snapshot.Allies.Select(a => a.Id + a.Hp + ":" + a.Atk + ":" + string.Join(",", a.Status ?? new System.Collections.Generic.Dictionary<string,int>())));
            if (_allySignature == signature) return; _allySignature = signature; ClearRegion(_allies); _allyViews.Clear();
            if (snapshot.Allies == null) return;
            for (int i = 0; i < snapshot.Allies.Count; i++)
            {
                var ally = snapshot.Allies[i];
                var view = new UnitMount(_allies, "sts-ally", () => ShowReadout(ally.Name, ally.desc ?? "盟友"));
                _allyViews.Add(view);
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
                button.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout(skill.name, CurrentHeroSkillPresentation.Hint(skill, s.Mode)));
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
                    else ShowReadout(entry.card.name, Sdt.Res.CurrentCardPresentation.Description(entry.card,CardFace.BattleDescription(GameSnapshotRef.Current,entry.uid)));
                }, true);
                button.image.color = entry.canUse ? BtColors.Hex("#5D5638") : BtColors.Hex("#15212C");
                button.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout(entry.card.name, Sdt.Res.CurrentCardPresentation.Description(entry.card,CardFace.BattleDescription(GameSnapshotRef.Current,entry.uid))));
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
            SyncMaterialDraft(s);
            bool selecting = s.RuleHandSelection != null;
            foreach (var card in _cards)
            {
                if (selecting) card.SetOff(!MaterialEligible(card.Uid,s,api));
                card.SetMaterialSelected(selecting && _materialPicked.ContainsKey(card.Uid));
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
