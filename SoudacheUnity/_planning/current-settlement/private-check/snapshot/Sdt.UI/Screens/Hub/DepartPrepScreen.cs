// Current source: game.hub.depart.js + departure-selected.css (cover-v3). Selection is uncommitted until ConfirmDeploy.
using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class DepartPrepScreen : Panel
    {
        static BaseData _draftBase;
        static int? _draftSlot;
        static string _character, _hint = "", _rarity = "", _type = "", _cost = "";
        static Dictionary<string, int> _pick = new Dictionary<string, int>();
        static Dictionary<string, int> _recommended, _undo;
        static string _recommendedSignature, _undoSignature;
        bool _submitting, _petSaving, _survival, _entered;
        BaseData _viewBase;
        int? _viewSlot;
        Transform _pool, _bag;
        Text _capacity, _status, _filterCount;
        Button _confirm;
        readonly Dictionary<string, PoolItem> _poolItems = new Dictionary<string, PoolItem>();
        readonly Dictionary<string, BagItem> _bagItems = new Dictionary<string, BagItem>();
        readonly List<Button> _petButtons = new List<Button>();
        sealed class PoolItem { public StashStack stack; public GameObject root; public Text quantity; public CanvasGroup face; public DepartureDragHandle drag; }
        sealed class BagItem { public GameObject root; public Text quantity; public DepartureDragHandle drag; public CardDef card; }
        BaseData B => GameRuntime.I.Base;
        static bool DraftCurrent => ReferenceEquals(_draftBase, GameRuntime.I.Base) && _draftSlot == GameRuntime.I.ActiveSlot && _draftSlot != null && !GameRuntime.I.State.runActive;
        bool Current => this != null && ReferenceEquals(_viewBase, B) && _viewSlot == GameRuntime.I.ActiveSlot && DraftCurrent;
        public static bool HasDraft => DraftCurrent && CharacterTable.For(_character) != null;
        public static string DraftCharacterId => HasDraft ? _character : null;
        public static int DraftCardCount => HasDraft ? _pick.Values.Sum(n => Math.Max(0, n)) : 0;
        static void BindDraft()
        {
            if (DraftCurrent) return;
            _draftBase = GameRuntime.I.Base; _draftSlot = GameRuntime.I.ActiveSlot;
            _character = null; _pick = new Dictionary<string, int>(); _hint = _rarity = _type = _cost = "";
            _recommended = _undo = null;
        }
        public static void Open()
        {
            if (GameRuntime.I.ActiveSlot == null || GameRuntime.I.State.runActive) return;
            BindDraft(); if (HasDraft) ShowDraft(); else ChooseCharacter();
        }
        static void ChooseCharacter()
        {
            BindDraft(); var owner = _draftBase; var slot = _draftSlot;
            ClassChoiceScreen.Request(id =>
            {
                if (!DraftCurrent || !ReferenceEquals(owner, _draftBase) || slot != _draftSlot) return;
                _character = id; _hint = ""; _recommended = _undo = null; ShowDraft();
            }, () => { if (DraftCurrent && ReferenceEquals(owner, _draftBase) && slot == _draftSlot) HubScreen.Open("deploy"); }, _character);
        }
        static void ShowDraft()
        {
            var screen = ScreenMount.Show<DepartPrepScreen>("DepartPrep"); screen._viewBase = _draftBase; screen._viewSlot = _draftSlot; screen._survival = !_draftBase.ammoTaught; screen.Build();
        }
        public static void OpenPreset(PreparationPreset preset)
        {
            if (GameRuntime.I.State.runActive || GameRuntime.I.ActiveSlot == null) return;
            var runtime = GameRuntime.I; var preview = runtime.Base.PreviewPreparation(preset);
            if (!preview.canStart) { RunLog.Log(string.Join("；", preview.errors), "warn"); return; }
            if (!string.IsNullOrEmpty(preset.petId) && !runtime.Base.TrySelectPet(preset.petId, out var reason)) { RunLog.Log(reason, "warn"); return; }
            BindDraft(); _pick = runtime.NormalizeDeparturePicks(preview.deploymentPicks); _character = CharacterTable.For(preset.characterId)?.id;
            _recommended = _undo = null; _rarity = _type = _cost = "";
            _hint = "预设「" + preset.name + "」已应用；确认出发前可继续调整。";
            if (HasDraft) ShowDraft(); else ChooseCharacter();
        }
        public override void CloseFromEscape() => ChooseAgain();
        void ChooseAgain() { if (!Current || _submitting || _petSaving) return; Close(); ChooseCharacter(); }
        void ToBase() { if (!Current || _submitting || _petSaving) return; Close(); HubScreen.Open("deploy"); }
        public override void Build()
        {
            if (!Current) { Close(); return; }
            _poolItems.Clear(); _bagItems.Clear(); _petButtons.Clear();
            var root = UIKit.Panel("depMain cover-v3", transform).transform;
            var backdrop = D.Area(root, "base-operations-v5", Vector2.zero, Vector2.one); backdrop.gameObject.AddComponent<RectMask2D>();
            var scene = D.Area(backdrop, "cover", Vector2.zero, Vector2.one).gameObject.AddComponent<Image>(); D.Cover(scene, Sdt.Res.Res.Scene("base-operations-v5"));
            var tint = D.Area(root, "departure-background-tint", Vector2.zero, Vector2.one); D.Surface(tint, Theme.HexA("#102C36", .43f)).raycastTarget = false;
            var head = D.Area(root, "hub-head", new Vector2(0, 1), Vector2.one, new Vector2(0, -94), Vector2.zero); D.Surface(head, Theme.HexA("#152D38", .64f), false, true); D.Line(head, Theme.HexA("#DCEFF0", .36f));
            D.CommandAt(head, "depBack", "‹", ChooseAgain, Vector2.zero, new Vector2(0, 1), new Vector2(36, 20), new Vector2(90, -20), Color.clear, D.Ink, 36);
            D.TextAt(head, "出征整备", 30, Vector2.zero, Vector2.one, new Vector2(114, 20), new Vector2(-450, -20)).fontStyle = FontStyle.Bold;
            D.CommandAt(head, "depMode", "01 模式", ToBase, new Vector2(1, 0), Vector2.one, new Vector2(-440, 24), new Vector2(-320, -24), Color.clear);
            D.CommandAt(head, "depCharacter", "02 人物", ChooseAgain, new Vector2(1, 0), Vector2.one, new Vector2(-296, 24), new Vector2(-176, -24), Color.clear);
            D.TextAt(head, "03 整备", 19, new Vector2(1, 0), Vector2.one, new Vector2(-152, 24), new Vector2(-36, -24)).fontStyle = FontStyle.Bold;
            var body = D.Area(root, "dep-body", Vector2.zero, Vector2.one, new Vector2(36, 140), new Vector2(-36, -118));
            if (!_entered) { DepartureSourceMotion.Enter(body, .38f, new Vector2(96, 0)); _entered = true; }
            var storage = D.Area(body, "dep-storage", Vector2.zero, new Vector2(.5f, 1), Vector2.zero, new Vector2(-12, 0));
            var pack = D.Area(body, "dep-pack", new Vector2(.5f, 0), Vector2.one, new Vector2(12, 0), Vector2.zero);
            D.Surface(storage, Theme.HexA("#17333F", .67f), true, true, 20); D.Surface(pack, Theme.HexA("#17333F", .67f), true, true, 20);
            D.TextAt(storage, "仓库候选", 26, new Vector2(0, 1), Vector2.one, new Vector2(24, -72), new Vector2(-24, -24));
            D.TextAt(pack, "本次携带", 26, new Vector2(0, 1), Vector2.one, new Vector2(24, -72), new Vector2(-24, -24));
            BuildFilters(storage);
            _pool = D.Scroll(storage, "depPool", Vector2.zero, Vector2.one, new Vector2(24, 24), new Vector2(-24, -148)); D.Grid(_pool, 220, 392);
            _pool.parent.gameObject.AddComponent<DepartureDropZone>().Receive = drag => { if (drag.Removing) RemovePick(drag.Key); };
            _bag = D.Scroll(pack, "depBag", Vector2.zero, Vector2.one, new Vector2(24, _survival ? 210 : 124), new Vector2(-24, -88)); D.Grid(_bag, 220, 392);
            _bag.parent.gameObject.AddComponent<DepartureDropZone>().Receive = drag => { if (!drag.Removing) AddPick(drag.Key); };
            BuildPoolItems(); BuildPets(pack);
            D.CommandAt(pack, "dep-survival", (_survival ? "▾ " : "▸ ") + "用过的牌去哪了？", () => { _survival = !_survival; Rebuild(); }, Vector2.zero, new Vector2(1, 0), new Vector2(24, _survival ? 116 : 24), new Vector2(-24, _survival ? 160 : 68), Theme.HexA("#102D3A", .35f), Theme.Hex("#E6D8AF"), 18);
            if (_survival) D.TextAt(pack, "用过的牌进入<b>消耗区</b>，复原后可再用。方法见背包。", 18, Vector2.zero, new Vector2(1, 0), new Vector2(34, 24), new Vector2(-34, 112), Theme.Hex("#D6E4E1"));
            _status = D.TextAt(root, _hint, 17, Vector2.zero, new Vector2(1, 0), new Vector2(52, 100), new Vector2(-52, 136), Theme.Hex("#E8C9A9"));
            var foot = D.Area(root, "dep-foot", Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 94)); D.Surface(foot, Theme.HexA("#17313D", .72f), false, true);
            _capacity = D.TextAt(foot, "", 22, Vector2.zero, Vector2.one, new Vector2(36, 18), new Vector2(-350, -22), Theme.Hex("#C9DBD9"));
            _confirm = D.CommandAt(foot, "btnDeploy", "出发   →", ConfirmDeploy, new Vector2(1, 0), Vector2.one, new Vector2(-316, 18), new Vector2(-36, -22), D.Accent, Theme.Hex("#173B42"), 22);
            RefreshSelection();
        }
        void AddPick(string key)
        {
            if (!Current || _submitting || _petSaving) return;
            var stack = GameRuntime.I.FindDepartureStack(key); if (stack?.card == null) return;
            if (stack.card.rarity == "职业") { Notice("职业卡不能带入对局——可在仓库归档培养或出售。"); return; }
            int count = _pick.TryGetValue(key, out var n) ? n : 0; if (count >= stack.count) { DepartureCardZoom.Open(new[] { stack.card }); return; }
            var next = new Dictionary<string, int>(_pick) { [key] = count + 1 };
            if (!GameRuntime.I.ProjectDeparture(next).capacity.capacityOk) { Notice("普通格空间不足，资源专用格仅能放资源卡。"); DepartureCardZoom.Open(new[] { stack.card }); return; }
            _pick[key] = count + 1; _hint = ""; RefreshSelection();
        }
        void RemovePick(string key)
        {
            if (!Current || _submitting || _petSaving) return;
            int count = _pick.TryGetValue(key, out var n) ? n : 0; if (count <= 0) return;
            var before = GameRuntime.I.ProjectDeparture(_pick); var next = new Dictionary<string, int>(_pick) { [key] = count - 1 }; var after = GameRuntime.I.ProjectDeparture(next);
            if (after.capacity.totalCap < before.capacity.totalCap && !after.capacity.capacityOk) { Notice("移出容器会减少资源专用格，请先移出超出的资源卡。"); return; }
            _pick[key] = count - 1; _hint = ""; RefreshSelection();
        }
        void Notice(string text) { _hint = text; if (_status != null) _status.text = text; }
        void ConfirmDeploy()
        {
            if (!Current || _submitting || _petSaving || !HasDraft) return;
            try { GameRuntime.I.NormalizeDeparturePicks(_pick, true); }
            catch (Exception error) { Notice(error.Message); return; }
            if (!GameRuntime.I.ProjectDeparture(_pick).capacity.capacityOk) { Notice("普通卡牌占用基础格，额外容量仅放资源。请移出超出容量的卡牌后出发。"); return; }
            _submitting = true; _confirm.interactable = false;
            var runtime = GameRuntime.I; var pages = UiStack.CapturePanels(); var picks = new Dictionary<string, int>(_pick); string id = _character;
            AudioService.I.PlaySfx("prepReady");
            DepartureCinematic.Open(() =>
            {
                if (!Current) return false;
                if (!runtime.TryPersistMutation(() => { runtime.NewRun(_viewSlot.Value, id, B.selMode, picks); B.ammoTaught = true; }, out var reason))
                { _submitting = false; Notice(reason + " 携带选择已保留；可调整后重试。"); RefreshSelection(); return false; }
                _pick = new Dictionary<string, int>(); _character = null; _draftBase = null; _draftSlot = null;
                foreach (var page in pages) UiStack.Close(page);
                AudioService.I.PlaySfx("deployStart"); return true;
            }, EntrySupplyScreen.Open);
        }
    }
}
