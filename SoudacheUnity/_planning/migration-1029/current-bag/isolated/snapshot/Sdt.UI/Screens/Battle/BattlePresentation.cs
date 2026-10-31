// Native mounts corresponding to battle.stage-view.js and battle.layers.js.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public partial class BattleScreen
    {
        const float HudEdge = 56, HudBottom = 40, ResourceWidth = 176, TacticsWidth = 248, HandGap = 64;
        RectTransform _arena, _hand, _dock, _prompt, _equipment, _items, _ruleInput;
        Text _energyText, _pageText, _encounter, _emptyHand, _forecast;
        Button _previous, _next, _endTurn, _draw, _consumed, _retry;
        RectTransform _infusionWorkspace;
        string _infusionSignature;
        readonly HandPanel _handView = new HandPanel();
        readonly Dictionary<string, UnitMount> _units = new Dictionary<string, UnitMount>();
        UnitMount _self;
        Vector2 _lastSize;
        string _promptSignature, _equipmentSignature, _itemSignature, _ruleSignature;
        readonly List<string> _battleLog = new List<string>();
        static WeakReference<BattleScreen> _logOwner;
        static bool _logInstalled;
        internal static RectTransform BattleRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }
        internal static void Fixed(RectTransform rt, Vector2 anchor, Vector2 pivot, Vector2 position, Vector2 size)
        { rt.anchorMin = rt.anchorMax = anchor; rt.pivot = pivot; rt.anchoredPosition = position; rt.sizeDelta = size; }
        internal static void ClearRegion(Transform region)
        { foreach (Transform child in region) { child.gameObject.SetActive(false); Destroy(child.gameObject); } }
        static void TextAt(Text text, Vector2 anchor, Vector2 pivot, Vector2 position, Vector2 size, TextAnchor align)
        { Fixed(text.rectTransform, anchor, pivot, position, size); text.alignment = align; text.raycastTarget = false; }
        static Sprite ControlArt(string key) => Sdt.Res.Res.BattleControl(key);
        void BuildPermanentStage()
        {
            // battle.scenery.js currently selects the same three-layer station for every encounter.
            var world = BattleRect("battle-scene-world", _stageRoot); UiExt.Stretch(world);
            world.anchoredPosition = new Vector2(0, 110);
            foreach (string key in new[] { "far", "ground" })
            { var image = UIKit.Image(world, Sdt.Res.Res.BattleLayer(key)); UiExt.Stretch(image.rectTransform); image.raycastTarget = false; }
            var front = UIKit.Image(_stageRoot, Sdt.Res.Res.BattleLayer("foreground"));
            UiExt.Stretch(front.rectTransform); front.rectTransform.anchoredPosition = new Vector2(0, 110); front.raycastTarget = false;
            var shade = UIKit.Image(_stageRoot, GroundShade()); UiExt.Stretch(shade.rectTransform); shade.raycastTarget = false;
            _arena = BattleRect("sts-arena", _stageRoot); UiExt.Stretch(_arena);
            _encounter = UIKit.Label(_stageRoot, "", 20, BtColors.Hex("#EDF2F3"));
            TextAt(_encounter, new Vector2(0, 1), new Vector2(0, 1), new Vector2(56, -112), new Vector2(900, 36), TextAnchor.MiddleLeft);
            _items = BattleRect("bt-potions", _stageRoot);
            Fixed(_items, new Vector2(0, 1), new Vector2(0, 1), new Vector2(56, -162), new Vector2(900, 56));
            _dock = BattleRect("sts-resource-dock", _stageRoot); UiExt.Stretch(_dock);
            var energy = BattleRect("sts-energy-wrap", _dock);
            Fixed(energy, Vector2.zero, Vector2.zero, new Vector2(HudEdge, HudBottom), new Vector2(ResourceWidth, 76));
            var emblem = UIKit.Image(energy, ControlArt("energy") ?? Sdt.Res.Res.Ui("bolt"));
            Fixed(emblem.rectTransform, new Vector2(0, .5f), new Vector2(0, .5f), Vector2.zero, new Vector2(48, 48)); emblem.raycastTarget = false;
            _energyText = UIKit.Label(energy, "", 36, BtColors.Hex("#EEF1ED"));
            TextAt(_energyText, Vector2.one * .5f, Vector2.one * .5f, new Vector2(32, 0), new Vector2(112, 54), TextAnchor.MiddleRight);
            var page = BattleRect("bt-hand-page", _dock);
            Fixed(page, Vector2.zero, Vector2.zero, new Vector2(HudEdge, 132), new Vector2(ResourceWidth, 104));
            var pageIcon = UIKit.Image(page, Sdt.Res.Res.Ui("hand-pages"));
            Fixed(pageIcon.rectTransform, new Vector2(0, 1), new Vector2(0, 1), Vector2.zero, new Vector2(48, 48)); pageIcon.raycastTarget = false;
            _pageText = UIKit.Label(page, "", 36, BtColors.Hex("#E6EEEA"));
            TextAt(_pageText, Vector2.one, Vector2.one, Vector2.zero, new Vector2(116, 54), TextAnchor.MiddleRight);
            _previous = BtBtn.Create(page, "‹", () => ChangeHandPage(-1), "ghost");
            _next = BtBtn.Create(page, "›", () => ChangeHandPage(1), "ghost");
            Fixed((RectTransform)_previous.transform, Vector2.zero, Vector2.zero, Vector2.zero, new Vector2(84, 34));
            Fixed((RectTransform)_next.transform, Vector2.zero, Vector2.zero, new Vector2(92, 0), new Vector2(84, 34));
            _previous.image.color = _next.image.color = Color.clear;
            _draw = BtBtn.Create(_dock, "", () => OpenPile(false), "ghost");
            Fixed((RectTransform)_draw.transform, Vector2.zero, Vector2.zero, new Vector2(HudEdge, 132), new Vector2(ResourceWidth, 54));
            _draw.image.color = Color.clear;
            _hand = BattleRect("bt-hand sts-hand", _stageRoot);
            _hand.anchorMin = new Vector2(0, 0); _hand.anchorMax = new Vector2(1, 0); _hand.pivot = new Vector2(.5f, 1);
            _hand.offsetMin = new Vector2(HudEdge + ResourceWidth + HandGap, 92);
            _hand.offsetMax = new Vector2(-HudEdge - TacticsWidth - HandGap, 392);
            _emptyHand = UIKit.Label(_hand, "", 22, BtColors.Hex("#C5D9E2"));
            TextAt(_emptyHand, Vector2.zero, new Vector2(0, 1), new Vector2(0, -300), new Vector2(1100, 50), TextAnchor.MiddleCenter);
            var tactics = BattleRect("sts-tactics", _stageRoot);
            Fixed(tactics, Vector2.right, Vector2.right, new Vector2(-HudEdge, HudBottom), new Vector2(TacticsWidth, 228));
            _endTurn = BtBtn.Create(tactics, "结束回合", () => BattleView.Commands.EndTurn(), "ok");
            Fixed((RectTransform)_endTurn.transform, Vector2.zero, Vector2.zero, Vector2.zero, new Vector2(TacticsWidth, 70));
            _forecast = UIKit.Label(tactics, "", 18, BtColors.Hex("#B9C9D2"));
            TextAt(_forecast, Vector2.zero, Vector2.zero, new Vector2(0, 86), new Vector2(TacticsWidth, 78), TextAnchor.LowerLeft);
            _forecast.raycastTarget = true;
            _forecast.gameObject.AddComponent<BattleHoverInfo>().Setup(() => ShowReadout("回合结束预估", GameSnapshotRef.Current?.Forecast?.Note ?? ""));
            _consumed = BtBtn.Create(_stageRoot, "", () => OpenPile(true), "ghost");
            Fixed((RectTransform)_consumed.transform, Vector2.right, Vector2.right, new Vector2(-HudEdge, 218), new Vector2(TacticsWidth, 48));
            _equipment = BattleRect("sts-unit-actions", _arena);
            _prompt = BattleRect("bt-infuse", _stageRoot);
            _prompt.anchorMin = new Vector2(0, 1); _prompt.anchorMax = Vector2.one; _prompt.pivot = new Vector2(.5f, 1);
            _prompt.offsetMin = new Vector2(56, -222); _prompt.offsetMax = new Vector2(-56, -112);
            _ruleInput = BattleRect("hand-selection", _stageRoot); UiExt.Stretch(_ruleInput);
            _retry = BtBtn.Create(_stageRoot, "战后保存失败，重试保存", () => BattleEvents.RetrySettlement?.Invoke(), "ok");
            Anchor((RectTransform)_retry.transform, .3f, .45f, .7f, .55f); _retry.gameObject.SetActive(false);
        }
        static Sprite _groundShade;
        static Sprite GroundShade()
        {
            if (_groundShade != null) return _groundShade;
            var texture = new Texture2D(1, 128, TextureFormat.RGBA32, false);
            for (int y = 0; y < 128; y++) texture.SetPixel(0, y, new Color(.02f, .04f, .07f, Mathf.Pow(Mathf.Clamp01((.46f - y / 127f) / .46f), 1.4f) * .86f));
            texture.Apply(); _groundShade = Sprite.Create(texture, new Rect(0, 0, 1, 128), Vector2.one * .5f, 1); return _groundShade;
        }
        void BuildHud(Transform stage, BattleSnapshot s, IBattleViewApi api, IBattleCommands cmd)
        {
            bool enemy = s.Phase == "enemy";
            _encounter.text = (enemy ? "敌方行动" : s.PendingTarget != null ? "选择目标" : s.Busy ? "结算中…" : "你的回合") + "     回合 " + s.Turn;
            _energyText.text = s.Energy + "<size=20>/" + s.MaxEnergy + "</size>";
            bool locked = InputLocked(s);
            bool infusion = s.Infusing != null;
            _hand.offsetMin = infusion ? new Vector2(420,16) : new Vector2(HudEdge + ResourceWidth + HandGap,92);
            _hand.offsetMax = infusion ? new Vector2(-52,366) : new Vector2(-HudEdge - TacticsWidth - HandGap,392);
            _dock.gameObject.SetActive(!infusion); _encounter.gameObject.SetActive(!infusion);
            _endTurn.transform.parent.gameObject.SetActive(!infusion); _equipment.gameObject.SetActive(!infusion);
            _consumed.gameObject.SetActive(!infusion);
            _cards = _handView.Sync(_hand, s, api); WireCardEvents(s, api, cmd);
            _pageText.transform.parent.gameObject.SetActive(_handView.Pages > 1);
            _pageText.text = (_handView.Page + 1) + "<size=20>/" + _handView.Pages + "</size>";
            if (_handView.NewOnOtherPages > 0) _pageText.text += "\n<size=14>新增 " + _handView.NewOnOtherPages + " 张</size>";
            _previous.interactable = !locked && _handView.Page > 0;
            _next.interactable = !locked && _handView.Page + 1 < _handView.Pages;
            _draw.gameObject.SetActive(s.Mode == "boss");
            ((RectTransform)_draw.transform).anchoredPosition = new Vector2(56, _handView.Pages > 1 ? 252 : 132);
            _draw.GetComponentInChildren<Text>().text = "[[icon:cards]] 牌库  <size=36>" + s.DrawPile.Count + "</size>";
            _consumed.GetComponentInChildren<Text>().text = "[[icon:cards]] 消耗牌堆  " + ConsumedUids(s).Count;
            _draw.interactable = _consumed.interactable = !locked;
            _endTurn.interactable = !locked && s.Phase == "player";
            _endTurn.GetComponentInChildren<Text>().text = enemy ? "敌方行动中" : s.Busy ? "结算中…" : s.Phase != "player" ? "请完成当前选择" : "结束回合";
            _emptyHand.gameObject.SetActive(_cards.Count == 0);
            _emptyHand.text = s.Mode == "boss" ? "当前栏没有手牌；结束回合后按抽牌规则补充。" : "当前栏没有可用手牌";
            // A shared Core forecast may supply exact cloned-state values. The adapter never sums raw attack into a false HP prediction.
            _forecast.text = enemy ? "" : ForecastCopy(s);
            var group = Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(_hand);
            group.alpha = enemy ? .3f : 1; group.blocksRaycasts = !s.Busy && !s.over;
            _hand.anchoredPosition = new Vector2(_hand.anchoredPosition.x, infusion ? 366 : enemy ? 302 : 392);
            RefreshGeometry(s);
        }
        static bool InputLocked(BattleSnapshot s) => s == null || s.over || s.Busy || s.Phase == "enemy" || s.Infusing != null || s.RuleChoice != null || s.RuleHandSelection != null || s.DeckSelection != null || s.Discovering != null || s.ViewingGrave;
        public static void OpenBattleSettings()
        {
            if (_logOwner != null && _logOwner.TryGetTarget(out var screen) && screen != null && UiStack.Top == screen)
                BattleSettingsScreen.Open(screen._battleLog);
        }
        string _keyboardUid;
        int _keyboardTarget;
        void Update()
        {
            var s = GameSnapshotRef.Current;
            if (UiStack.Top != this || s == null || s.Busy || s.over || s.Discovering != null || s.DeckSelection != null || s.RuleChoice != null) return;
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                CancelAim(); _skillTargeting = false; _itemTargetUid = _keyboardUid = null;
                if (s.Infusing != null) BattleView.Commands.CancelInfusion(); else BattleView.Commands.CancelPendingTarget();
                BuildStage(GameSnapshotRef.Current ?? s); return;
            }
            if (Input.GetKeyDown(KeyCode.PageUp)) ChangeHandPage(-1);
            if (Input.GetKeyDown(KeyCode.PageDown)) ChangeHandPage(1);
            for (int i = 0; i < 9; i++)
            {
                if (!Input.GetKeyDown((KeyCode)((int)KeyCode.Alpha1 + i)) && !Input.GetKeyDown((KeyCode)((int)KeyCode.Keypad1 + i))) continue;
                var card = _cards.Find(c => c.DisplayIndex == i); if (card == null) return;
                if (s.Infusing != null || s.RuleHandSelection != null) { OnCardClick(card, s, BattleView.Api, BattleView.Commands); return; }
                _keyboardUid = card.Uid;
                foreach (var c in _cards) c.SetTargeting(c == card);
                if (card.Side != null && !card.Off) BattleView.Commands.LockPendingTarget(card.Uid);
            }
            if (Input.GetKeyDown(KeyCode.LeftArrow)) _keyboardTarget--;
            if (Input.GetKeyDown(KeyCode.RightArrow)) _keyboardTarget++;
            var living = s.Foes.Select((f, i) => new { Foe = f, Index = i }).Where(x => !x.Foe.Dead).ToList();
            if (living.Count > 0) _keyboardTarget = (_keyboardTarget % living.Count + living.Count) % living.Count;
            if (!Input.GetKeyDown(KeyCode.Return) && !Input.GetKeyDown(KeyCode.KeypadEnter)) return;
            if (_skillTargeting || _itemTargetUid != null || s.PendingTarget != null)
            {
                if (s.PendingTarget != null && BattleView.Api.TargetSide(s.PendingTarget.Card) == "self") OnSelfClick(s);
                else if (living.Count > 0) OnFoeClick(s, living[_keyboardTarget].Index);
            }
            else if (_keyboardUid != null)
            { var card = _cards.Find(c => c.Uid == _keyboardUid); if (card != null) OnCardClick(card, s, BattleView.Api, BattleView.Commands); }
        }
        static IReadOnlyList<string> ConsumedUids(BattleSnapshot s) => s.ConsumedPile ?? Array.Empty<string>();
        string ForecastCopy(BattleSnapshot s)
        {
            var value = s.Forecast; if (value == null) return "";
            return "估算承伤    <size=26><color=#FFD0B9>" + value.Damage + "</color></size>\n余 <size=26>" + value.HpAfter + "</size> 生命"
                + (value.Lethal ? "\n<color=#FFC3AC>可能致死</color>" : "");
        }
        void ChangeHandPage(int step)
        {
            var s = GameSnapshotRef.Current; if (s == null || s.Busy || s.over || s.RuleChoice != null || s.RuleHandSelection != null || s.Discovering != null || s.DeckSelection != null) return;
            int next = _handView.Page + step; if (next < 0 || next >= _handView.Pages) return;
            CancelAim(); _handView.Page = next; _handView.NewOnOtherPages = 0;
            BattleView.Commands.CancelPendingTarget(); BuildStage(GameSnapshotRef.Current ?? s);
        }
        void OpenPile(bool consumed)
        {
            var s = GameSnapshotRef.Current; if (InputLocked(s)) return;
            BattlePileScreen.Open(consumed ? "消耗牌堆" : "牌库", consumed ? ConsumedUids(s) : s.DrawPile);
        }
        void RefreshGeometry(BattleSnapshot s)
        {
            if (_stageRoot == null || s?.Player == null) return;
            float bottom = _stageRoot.rect.height * .28f + 110;
            if (_self != null) _self.Root.anchoredPosition = new Vector2(0, bottom);
            Fixed(_equipment, new Vector2(.27f, 0), new Vector2(0, 0), new Vector2(-286, bottom), new Vector2(48, 280));
            var profiles = s.Foes.Select(f => BattlePortraitProfile.Find(f.Id, s.Mode == "boss")).ToList();
            float width = _stageRoot.rect.width * .36f;
            float pack = profiles.Sum(p => Mathf.Max(180, p.Height * p.Aspect) + 24);
            float factor = s.Foes.Count >= 6 ? .62f : s.Foes.Count == 5 ? .7f : s.Foes.Count == 4 ? .8f : s.Foes.Count == 3 ? .9f : 1;
            float unit = Mathf.Max(.01f, Mathf.Min(factor, (width - Mathf.Max(0, s.Foes.Count - 1) * 28) / Mathf.Max(1, pack)));
            float used = pack * unit + Mathf.Max(0, s.Foes.Count - 1) * 28;
            float x = _stageRoot.rect.width * .54f + Mathf.Max(0, width - used) / (Mathf.Max(1, s.Foes.Count) * 2);
            float spare = Mathf.Max(0, width - used) / Mathf.Max(1, s.Foes.Count);
            for (int i = 0; i < _foeRoots.Count; i++)
            {
                var p = profiles[i]; float slot = (Mathf.Max(180, p.Height * p.Aspect) + 24) * unit;
                Fixed(_foeRoots[i], Vector2.zero, new Vector2(.5f, 0), new Vector2(x + slot / 2, bottom), new Vector2(slot, p.Height * unit));
                var figure = _foeFigures[i]; float h = p.Height * unit;
                Fixed(figure, new Vector2(.5f, 0), new Vector2(.5f, 0), Vector2.zero, new Vector2(h * p.Aspect, h));
                var art = figure.GetComponentInChildren<Image>();
                float artHeight = h * p.ImageScale, artWidth = art.sprite != null ? artHeight * art.sprite.rect.width / art.sprite.rect.height : h * p.Aspect;
                Fixed(art.rectTransform, new Vector2(.5f,0), new Vector2(.5f,0), new Vector2((p.X + 50) * .01f * artWidth, p.Bottom * h), new Vector2(artWidth,artHeight));
                x += slot + 28 + spare;
            }
        }
        void LateUpdate()
        {
            if (_stageRoot == null || _lastSize == _stageRoot.rect.size) return;
            _lastSize = _stageRoot.rect.size; var s = GameSnapshotRef.Current; if (s == null) return;
            RefreshGeometry(s); HandPanel.Pose(_cards, _hand, _handView.VisibleCount);
        }
        void SyncUnits(BattleSnapshot s, IBattleViewApi api)
        {
            if (_self == null) _self = new UnitMount(_arena, "sts-me", () => OnSelfClick(GameSnapshotRef.Current));
            string character = s.Player.CharacterId ?? s.Player.MyClass;
            float body = character == "changwuyu" ? 286 : character == "heixiang" ? 252 : character == "baita" || character == "xingyue" ? 270 : 278;
            float fill = character == "changwuyu" ? .916016f : character == "baita" ? .812865f : character == "heixiang" ? .637427f : character == "xingyue" ? .783626f : .912281f;
            float height = body / fill, foot = height * (character == "changwuyu" ? .042969f : .052632f);
            Fixed(_self.Root, new Vector2(.27f, 0), new Vector2(.5f, 0), Vector2.zero, new Vector2(440, height));
            Fixed(_self.Figure, new Vector2(.5f, 0), new Vector2(.5f, 0), new Vector2(0, -foot), new Vector2(440, height));
            _self.Art.sprite = Sdt.Res.Res.BattlePortrait(character); _self.Art.preserveAspect = true;
            _self.Update(CharacterTable.CharacterName(character), s.Player.Hp, s.Player.MaxHp, PlayerStats(s), api.CurseChips(s.Pstat?.Status), null, false, false, s.Pdef?.Armor ?? 0);
            _selfFigure = _self.Figure; _selfRoot = _self.Root;
            _foeRoots.Clear(); _foeFigures.Clear(); var seen = new Dictionary<string, int>(); var kept = new HashSet<string>();
            for (int i = 0; i < s.Foes.Count; i++)
            {
                var f = s.Foes[i]; string id = f.Id ?? f.Name; int serial = seen.TryGetValue(id, out int value) ? value + 1 : 1; seen[id] = serial;
                string key = id + "#" + serial; kept.Add(key); int index = i;
                if (!_units.TryGetValue(key, out var view)) { view = new UnitMount(_arena, "sts-foe " + key, () => OnFoeClick(GameSnapshotRef.Current, index)); _units[key] = view; }
                view.Click = () => OnFoeClick(GameSnapshotRef.Current, index);
                view.Art.sprite = Sdt.Res.Res.EnemyPortrait(f.Id); view.Art.preserveAspect = true;
                string affix = string.IsNullOrEmpty(f.Affix) ? "" : " · " + (api.AffixMeta(f.Affix)?.Name ?? f.Affix);
                view.Update(f.Name + affix, f.Hp, f.MaxHp, "[[icon:swords]] 攻 " + f.Atk + (f.defense?.Shield > 0 ? "   [[icon:shield]] 盾 " + f.defense.Shield : ""), api.CurseChips(f.Status), f.Intent, f.Dead, api.AegisBlocked(f), f.defense?.Armor ?? 0);
                _foeRoots.Add(view.Root); _foeFigures.Add(view.Figure);
            }
            foreach (string key in _units.Keys.ToArray()) if (!kept.Contains(key)) { _units[key].Root.gameObject.SetActive(false); Destroy(_units[key].Root.gameObject); _units.Remove(key); }
            BuildAllies(_arena, s, api);
        }
        static string PlayerStats(BattleSnapshot s)
        {
            int atk = s.Player.Atk, spell = s.Player.spellPower;
            if (s.Pstat?.Status != null) { if (s.Pstat.Status.TryGetValue("atkUp", out int a)) atk += a; if (s.Pstat.Status.TryGetValue("spellUp", out int b)) spell += b; }
            return "[[icon:swords]] 攻 " + atk + (spell > 0 ? "   [[icon:spell-power]] 法伤 " + spell : "") + (s.Pdef?.Shield > 0 ? "   [[icon:shield]] 盾 " + s.Pdef.Shield : "") + (s.Pdef?.Guard == true ? "   格挡中" : "");
        }
        void AttachBattleLog()
        {
            _logOwner = new WeakReference<BattleScreen>(this);
            if (_logInstalled) return; _logInstalled = true;
            GameRuntime.I.Bus.On<ToastRequested>(entry => { if (_logOwner != null && _logOwner.TryGetTarget(out var screen) && screen != null) { screen._battleLog.Add(entry.Text); if (screen._battleLog.Count > 120) screen._battleLog.RemoveAt(0); } });
        }
        void DetachBattleLog() { if (_logOwner != null && _logOwner.TryGetTarget(out var owner) && owner == this) _logOwner = null; }
        void SyncPrompt(BattleSnapshot s, IBattleViewApi api, IBattleCommands cmd)
        {
            SyncInfusionWorkspace(s, api, cmd);
            if (s.Infusing != null) { _promptSignature = null; _prompt.gameObject.SetActive(false); return; }
            string signature = s.Infusing != null ? "inf:" + s.Infusing.Uid + ":" + string.Join(",", s.Infusing.Picked)
                : s.RuleHandSelection != null ? "hand-choice:" + string.Join("|", s.RuleHandSelection.candidateUids)
                : s.PendingTarget != null ? "target:" + s.PendingTarget.Uid + s.PendingHint : _skillTargeting ? "skill" : _itemTargetUid ?? "";
            if (_promptSignature == signature) return; _promptSignature = signature; ClearRegion(_prompt);
            _prompt.gameObject.SetActive(signature.Length > 0); if (signature.Length == 0) return;
            var image = Sdt.UI.Kit.UIKit.GetOrAdd<Image>(_prompt); image.color = BtColors.HexA("#1A2D3B", .94f);
            var layout = Sdt.UI.Kit.UIKit.GetOrAdd<HorizontalLayoutGroup>(_prompt);
            layout.padding = new RectOffset(16, 16, 12, 12); layout.spacing = 16; layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childControlWidth = layout.childControlHeight = true; layout.childForceExpandWidth = layout.childForceExpandHeight = false;
            var inf = s.Infusing;
            string text = inf != null ? "注能【" + inf.Card.name + "】  已选 " + inf.Picked.Count + "/" + inf.Need + " 张材料"
                : s.RuleHandSelection != null ? "选择一张高亮手牌"
                : s.PendingTarget != null ? "已拿起【" + s.PendingTarget.Card.name + "】 · 点击合法目标或拖向目标\n" + s.PendingHint
                : _skillTargeting ? "职业技能 · 请选择敌人" : "道具 · 请选择敌人";
            var copy = UIKit.Label(_prompt, text, 22, BtColors.Hex("#E0E9EE")); copy.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
            if (inf != null)
            {
                BtBtn.Mini(_prompt, "发动", cmd.ConfirmInfusion, true, inf.Picked.Count == inf.Need);
                if (inf.CanPlayDirect) BtBtn.Mini(_prompt, "直接打出", () => cmd.SkipInfusion());
                foreach (string uid in inf.Picked) { string selected = uid; BtBtn.Mini(_prompt, api.FindCard(uid)?.Card.name ?? uid, () => cmd.SelectInfusion(selected)); }
            }
            if (s.RuleHandSelection == null) BtBtn.Mini(_prompt, "取消 Esc", () => { _skillTargeting = false; _itemTargetUid = null; if (inf != null) cmd.CancelInfusion(); else cmd.CancelPendingTarget(); BuildStage(GameSnapshotRef.Current); });
        }
        void SyncInfusionWorkspace(BattleSnapshot s, IBattleViewApi api, IBattleCommands cmd)
        {
            if (_infusionWorkspace == null) { _infusionWorkspace = BattleRect("infusion-workspace", _stageRoot); UiExt.Stretch(_infusionWorkspace); }
            _infusionWorkspace.gameObject.SetActive(s.Infusing != null); if (s.Infusing == null) { _infusionSignature = null; return; }
            var inf = s.Infusing;
            string signature = inf.Uid + ":" + string.Join("|", inf.Picked) + ":" + _handView.Page + ":" + _handView.Pages;
            if (_infusionSignature == signature) return; _infusionSignature = signature; ClearRegion(_infusionWorkspace);
            var shade = UIKit.Image(_infusionWorkspace, BtSprites.White()); UiExt.Stretch(shade.rectTransform); shade.color = BtColors.HexA("#050D17", .4f); shade.raycastTarget = false;
            _infusionWorkspace.SetSiblingIndex(_hand.GetSiblingIndex()); _hand.SetAsLastSibling();
            var title = UIKit.Label(_infusionWorkspace, "为【" + inf.Card.name + "】选择材料      已选 " + inf.Picked.Count + " / " + inf.Need, 30, BtColors.Hex("#E5D3A2"));
            title.rectTransform.anchorMin = new Vector2(0,1); title.rectTransform.anchorMax = Vector2.one; title.rectTransform.pivot = new Vector2(.5f,1);
            title.rectTransform.offsetMin = new Vector2(430,-170); title.rectTransform.offsetMax = new Vector2(-64,-118); title.alignment = TextAnchor.MiddleRight;
            var source = CardFace.Create(inf.Card, CardSize.Xl, _infusionWorkspace, options:new CardFaceOptions { HideCost=false, ScrollDescription=true, CostOverride=api.EffCostOf(inf.Card) });
            Fixed((RectTransform)source.transform, new Vector2(0,1), new Vector2(0,1), new Vector2(64,-190), new Vector2(300,450));
            var sourcePaper = source.transform.Find("paper-card") as RectTransform; if (sourcePaper != null) sourcePaper.sizeDelta = new Vector2(300,450);
            var selected = BattleRect("infusion-selected-cards", _infusionWorkspace);
            selected.anchorMin = new Vector2(0,1); selected.anchorMax = Vector2.one; selected.pivot = new Vector2(.5f,1); selected.offsetMin = new Vector2(430,-572); selected.offsetMax = new Vector2(-64,-220);
            var scroll = UIKit.Scroll(selected); var old = scroll.GetComponent<VerticalLayoutGroup>(); if (old != null) { old.enabled=false; Destroy(old); }
            var row = scroll.AddComponent<HorizontalLayoutGroup>(); row.spacing=24; row.childControlWidth=row.childControlHeight=true; row.childForceExpandWidth=row.childForceExpandHeight=false;
            var sr = scroll.GetComponentInParent<ScrollRect>(); sr.horizontal=true; sr.vertical=false;
            var fitter = scroll.GetComponent<ContentSizeFitter>(); if (fitter != null) { fitter.horizontalFit=ContentSizeFitter.FitMode.PreferredSize; fitter.verticalFit=ContentSizeFitter.FitMode.Unconstrained; }
            foreach (string picked in inf.Picked)
            {
                string uid = picked; var card = api.FindCard(uid)?.Card; if (card == null) continue;
                var face = CardFace.Create(card,CardSize.Xl,scroll.transform);
                var le = face.GetComponent<LayoutElement>(); le.minWidth=le.preferredWidth=190; le.minHeight=le.preferredHeight=285;
                var paper = face.transform.Find("paper-card") as RectTransform; if (paper != null) paper.sizeDelta=new Vector2(190,285);
                var button=face.AddComponent<Button>(); button.targetGraphic=face.GetComponent<Image>(); button.onClick.AddListener(()=>cmd.SelectInfusion(uid));
            }
            var actions=BattleRect("infusion-footer",_infusionWorkspace); actions.anchorMin=new Vector2(0,1); actions.anchorMax=Vector2.one; actions.pivot=new Vector2(.5f,1); actions.offsetMin=new Vector2(430,-676); actions.offsetMax=new Vector2(-64,-604);
            var flow=actions.gameObject.AddComponent<HorizontalLayoutGroup>(); flow.spacing=16; flow.childControlWidth=flow.childControlHeight=true; flow.childForceExpandWidth=flow.childForceExpandHeight=false;
            BtBtn.Create(actions,"取消",cmd.CancelInfusion,"ghost"); if(inf.CanPlayDirect)BtBtn.Create(actions,"直接打出",()=>cmd.SkipInfusion(),"ghost");
            BtBtn.Create(actions,"确认注能",cmd.ConfirmInfusion,"ok",inf.Picked.Count==inf.Need);
            if(_handView.Pages>1)
            {
                var prev=BtBtn.Create(_infusionWorkspace,"‹",()=>ChangeHandPage(-1),"ghost",_handView.Page>0); Fixed((RectTransform)prev.transform,Vector2.right,Vector2.right,new Vector2(-240,372),new Vector2(100,36));
                var next=BtBtn.Create(_infusionWorkspace,"›",()=>ChangeHandPage(1),"ghost",_handView.Page+1<_handView.Pages); Fixed((RectTransform)next.transform,Vector2.right,Vector2.right,new Vector2(-64,372),new Vector2(100,36));
            }
        }
        sealed class UnitMount
        {
            public readonly RectTransform Root, Figure;
            public readonly Image Art;
            public Action Click;
            readonly Text _name, _stats, _intent, _armor;
            readonly GameObject _hp, _chips;
            string _chipSignature;
            public UnitMount(Transform parent, string name, Action onClick)
            {
                Root = BattleRect(name, parent); Figure = BattleRect("sts-figure", Root);
                var portrait = BattleRect("sts-portrait", Figure); UiExt.Stretch(portrait);
                Art = portrait.gameObject.AddComponent<Image>(); Art.preserveAspect = true;
                Click = onClick;
                var button = Root.gameObject.AddComponent<Button>(); button.targetGraphic = Art; button.transition = Selectable.Transition.None; button.onClick.AddListener(() => Click?.Invoke());
                _name = UIKit.Label(Root, "", 20, BtColors.Hex("#E8E9DE"));
                TextAt(_name, new Vector2(.5f, 1), new Vector2(.5f, 0), new Vector2(0, 20), new Vector2(290, 34), TextAnchor.MiddleCenter);
                _stats = UIKit.IconText(Root, ""); _stats.fontSize = 20; _stats.color = BtColors.Hex("#EEF2EF");
                TextAt(_stats, new Vector2(.5f, 1), new Vector2(.5f, 0), new Vector2(0, 54), new Vector2(360, 36), TextAnchor.MiddleCenter);
                _hp = BtHpBar.Create(Root, name == "sts-me" ? 264 : 230);
                Fixed((RectTransform)_hp.transform, new Vector2(.5f, 0), new Vector2(.5f, 1), new Vector2(0, -10), new Vector2(name == "sts-me" ? 264 : 230, 36));
                _armor = UIKit.Label(_hp.transform, "", 18, BtColors.Hex("#E8EEF2"));
                TextAt(_armor, new Vector2(0,1), new Vector2(0,1), Vector2.zero, new Vector2(44,30), TextAnchor.MiddleCenter);
                _chips = BattleRect("sts-chips", Root).gameObject;
                Fixed((RectTransform)_chips.transform, new Vector2(.5f, 1), new Vector2(.5f, 0), new Vector2(0, 94), new Vector2(280, 36));
                _intent = UIKit.IconText(Root, ""); _intent.fontSize = 24; _intent.color = BtColors.Hex("#F0B5A7");
                TextAt(_intent, new Vector2(.5f, 1), new Vector2(.5f, 0), new Vector2(0, 134), new Vector2(360, 48), TextAnchor.MiddleCenter);
            }
            public void Update(string name, int hp, int max, string stats, IReadOnlyList<StatusChip> chips, FoeIntent intent, bool dead, bool immune, int armor = 0)
            {
                _name.text = name; _stats.text = stats; BtHpBar.Set(_hp, hp, max);
                _armor.text = armor > 0 ? "甲 " + armor : ""; _armor.gameObject.SetActive(armor > 0);
                var group = Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(Root); group.alpha = dead ? .22f : 1;
                string signature = chips == null ? "" : string.Join("|", chips.Select(c => c.Name + c.Value));
                if (_chipSignature != signature) { _chipSignature = signature; ClearRegion(_chips.transform); if (chips != null && chips.Count > 0) BtChips.Create(_chips.transform, chips); }
                bool frozen = chips?.Any(c => c.Name.Contains("冰冻")) == true;
                _intent.text = dead ? "" : frozen ? "[[icon:status-freeze]] 冰冻 · 无法行动" : intent == null ? "" : intent.Icon + " " + intent.Label + (intent.Damage > 0 ? " " + intent.Damage : "");
                var outline = Sdt.UI.Kit.UIKit.GetOrAdd<Outline>(Art); outline.effectColor = immune ? BtColors.HexA("#A0A0A0", .85f) : Color.clear; outline.effectDistance = new Vector2(4, -4);
            }
            public void SetStatless(bool statless) { _hp.SetActive(!statless); _stats.gameObject.SetActive(!statless); }
        }
    }
}
