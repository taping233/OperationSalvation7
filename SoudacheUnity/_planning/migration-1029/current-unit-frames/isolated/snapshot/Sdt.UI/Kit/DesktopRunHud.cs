using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.View;
using Sdt.UI.Screens.Menu;

namespace Sdt.UI.Kit
{
    /// <summary>相邻节点的选择、确认与地图HUD；规则复检统一交给GameRuntime。</summary>
    public sealed class DesktopRunHud : MonoBehaviour
    {
        GameObject _hud, _notice;
        Text _state, _selectionText, _message;
        Transform _routes;
        MapModel _boundMap;
        string _selected, _routeKey;
        float _messageUntil;
        bool _persistentError;

        public static void Install()
        {
            var go = new GameObject("DesktopRunHud");
            go.transform.SetParent(App.UiRoot, false);
            go.AddComponent<DesktopRunHud>().Initialize();
        }

        void Initialize()
        {
            _hud = UIKit.Panel("MapHud", App.UiRoot);
            _hud.transform.SetAsFirstSibling();
            var top = MakeBar(_hud.transform, "MapStatus", new Vector2(0.02f, .89f), new Vector2(.98f, .98f));
            _state = UIKit.Label(top, "", 19, Theme.Txt);
            _state.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
            UIKit.Btn(top, "背包 B", () => GameRuntime.I.Bus.Emit(new BagOpened()));
            UIKit.Btn(top, "保存", () => GameRuntime.I.SaveCurrent());
            UIKit.Btn(top, "离开", LeaveMenuScreen.Open);
            var bottom = MakeBar(_hud.transform, "MapRoutes", new Vector2(.02f, .02f), new Vector2(.98f, .13f));
            _selectionText = UIKit.Label(bottom, "点选相邻地点查看，再次点击确认前往", 16, Theme.Sub);
            _selectionText.gameObject.AddComponent<LayoutElement>().preferredWidth = 330;
            _routes = bottom;
            _notice = UIKit.Panel("OperationNotice", App.UiRoot);
            var rt = (RectTransform)_notice.transform;
            rt.anchorMin = new Vector2(.22f, .82f); rt.anchorMax = new Vector2(.78f, .89f);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var background = _notice.AddComponent<Image>(); background.color = Theme.HexA("#101E27", .96f); background.raycastTarget = false;
            _message = UIKit.Label(_notice.transform, "", 18, Theme.Txt);
            UiStack.Stretch(_message.rectTransform); _message.alignment = TextAnchor.MiddleCenter;
            _notice.SetActive(false);
            var bus = GameRuntime.I.Bus;
            bus.On<RunStarted>(_ => BindMap());
            bus.On<RunLoaded>(_ => BindMap());
            bus.On<NodeMovementCompleted>(_ => RefreshMap());
            bus.On<ToastRequested>(notice => ShowMessage(notice.Text, notice.Tone == "warn"));
            bus.On<LogRequested>(notice => { if (notice.Tone == "warn") ShowMessage(notice.Text, true); });
            bus.On<SaveCompleted>(_ => { if (_persistentError) { _persistentError = false; _messageUntil = Time.unscaledTime + 2f; _message.text = "保存完成"; } });
            BoardViewHost.OnNodeClicked += SelectOrMove;
            if (BoardViewHost.View != null) BoardViewHost.View.InputBlocked = () => UiStack.Blocked;
        }

        static Transform MakeBar(Transform parent, string name, Vector2 min, Vector2 max)
        {
            var go = UIKit.Panel(name, parent);
            var rt = (RectTransform)go.transform; rt.anchorMin = min; rt.anchorMax = max; rt.offsetMin = rt.offsetMax = Vector2.zero;
            var image = go.AddComponent<Image>(); image.color = Theme.HexA("#101E27", .94f);
            var layout = go.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = 10; layout.padding = new RectOffset(14, 14, 10, 10);
            layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childForceExpandWidth = false; layout.childForceExpandHeight = false;
            layout.childControlWidth = true; layout.childControlHeight = true;
            return go.transform;
        }

        void BindMap()
        {
            _selected = null; _routeKey = null;
            var runtime = GameRuntime.I;
            if (runtime.Map == null || BoardViewHost.View == null) return;
            _boundMap = runtime.Map;
            BoardViewHost.View.Build(_boundMap);
            RefreshMap();
            BoardViewHost.FitPlayer();
            if (!string.IsNullOrEmpty(runtime.State.myClass) && !runtime.EntrySupplyComplete)
                Sdt.UI.Screens.Run.EntrySupplyScreen.Open();
        }

        void RefreshMap()
        {
            var state = GameRuntime.I.State;
            if (BoardViewHost.View == null || !state.runActive) return;
            BoardViewHost.View.SetLayer(state.layerIdx);
            BoardViewHost.View.SetPlayerNode(state.layerIdx + "," + state.trackPos);
            BoardViewHost.View.SetExploration(state.revealed);
            BoardViewHost.View.SetPlayerCharacter(state.characterId);
            BoardViewHost.View.SetNodeStates(state.explored, state.settled, GameRuntime.I.GetReachableNodeIds());
            _routeKey = null;
        }

        void SelectOrMove(string id)
        {
            var runtime = GameRuntime.I;
            if (UiStack.Blocked || !runtime.State.runActive) return;
            if (!runtime.CanMoveToNode(id, out var reason)) { ShowMessage(reason, false); return; }
            if (_selected == id)
            {
                if (!runtime.TryMoveToNode(id, out reason)) ShowMessage(reason, true);
                _selected = null;
            }
            else
            {
                _selected = id;
                BoardViewHost.FocusNode(id);
            }
            _routeKey = null;
        }

        void ShowMessage(string text, bool warning)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            bool saveError = text.Contains("保存失败") || text.Contains("存档读取失败") || text.Contains("未能保存");
            if (_persistentError && !saveError) return;
            _persistentError = saveError;
            _message.text = App.StripIcons(text);
            _message.color = warning ? Theme.Hex("#F0B78D") : Theme.Txt;
            _messageUntil = Time.unscaledTime + 4f;
            _notice.SetActive(true); _notice.transform.SetAsLastSibling();
        }

        void Update()
        {
            var runtime = GameRuntime.I;
            bool visible = runtime.State.runActive && !UiStack.Blocked;
            _hud.SetActive(visible);
            if (_notice.activeSelf && !_persistentError && Time.unscaledTime >= _messageUntil) _notice.SetActive(false);
            if (!visible) return;
            if (_boundMap != runtime.Map) BindMap();
            var s = runtime.State;
            _state.text = "第 " + (s.layerIdx + 1) + " 层   " + CharacterTable.Name(s.characterId)
                + "   生命 " + s.hp + "/" + s.maxHp + "   金币 " + s.coins;
            var ids = runtime.GetReachableNodeIds();
            var routeKey = string.Join("|", ids) + "#" + _selected + "#" + s.Phase + "#" + runtime.CurrentNodeId + "#" + s.closed.Contains(runtime.CurrentNodeId);
            if (routeKey == _routeKey) return;
            _routeKey = routeKey;
            for (int i = _routes.childCount - 1; i >= 1; i--) Destroy(_routes.GetChild(i).gameObject);
            _selectionText.text = _selected == null ? "点选相邻地点查看，再次点击确认前往" : "再次点击确认前往所选地点";
            if (!runtime.EntrySupplyComplete)
                UIKit.Btn(_routes, "领取入城补给", Sdt.UI.Screens.Run.EntrySupplyScreen.Open);
            var current = runtime.Map.Nodes.FirstOrDefault(item => item.id == s.layerIdx + "," + s.trackPos);
            if (current != null && current.type == "fire")
                UIKit.Btn(_routes, "营火休整", Sdt.UI.Screens.Run.FireRestScreen.Open);
            if (Sdt.UI.Screens.Run.ShopScreen.CanOpen(runtime))
                UIKit.Btn(_routes, "进入商店", Sdt.UI.Screens.Run.ShopScreen.Open);
            if (current != null && current.type == "door")
                UIKit.Btn(_routes, "隔离闸门", () => runtime.TryMoveToNode(runtime.CurrentNodeId, out _));
            if (current != null && current.type == "extraction")
                UIKit.Btn(_routes, "终局撤离", Sdt.UI.Screens.Run.FinalExtractionModal.Open);
            if (current != null && current.type == "altar")
                UIKit.Btn(_routes, "祭坛", Sdt.UI.Screens.Run.AltarModal.Open);
            if (current != null && current.type == "emergencyExit")
                UIKit.Btn(_routes, "紧急撤离", Sdt.UI.Screens.Run.EmergencyModal.Open);
            if (current != null && current.type == "resource" && runtime.CurrentNodeReceipt.rewardTaken == null)
                UIKit.Btn(_routes, "领取物资", Sdt.UI.Screens.Run.EntrySupplyScreen.OpenResource);
            if ((runtime.CurrentNodeReceipt.chestQueue != null && runtime.CurrentNodeReceipt.chestQueue.Any(chest => !chest.completed))
                || (runtime.CurrentNodeReceipt.battleWon && !runtime.CurrentNodeReceipt.completed))
                UIKit.Btn(_routes, "战利品与战后整理", () => runtime.TryMoveToNode(runtime.CurrentNodeId, out _));
            foreach (var id in ids)
            {
                var node = runtime.Map.Nodes.FirstOrDefault(item => item.id == id);
                var name = node == null ? id : (node.layerIdx != s.layerIdx ? "第" + (node.layerIdx + 1) + "层 · " : "") + node.name;
                string captured = id;
                var button = UIKit.Btn(_routes, (_selected == id ? "前往：" : "查看：") + name, () => SelectOrMove(captured));
                button.interactable = s.Phase == "idle";
                button.GetComponent<LayoutElement>().preferredWidth = 200;
            }
        }

        void OnDestroy() => BoardViewHost.OnNodeClicked -= SelectOrMove;
    }
}
