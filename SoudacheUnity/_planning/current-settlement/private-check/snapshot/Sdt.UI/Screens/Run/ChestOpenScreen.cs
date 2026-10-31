// Chest candidates and claims share the runtime's atomic save transaction.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;

namespace Sdt.UI.Screens.Run
{
    public class ChestOpenScreen : Panel
    {
        Action _onDone;
        List<string> _pendingKinds;
        string _error;
        ChestVisitReceipt Current
        {
            get
            {
                var receipt = GameRuntime.I.CurrentNodeReceipt;
                return receipt.chestQueue != null && receipt.chestIndex >= 0 && receipt.chestIndex < receipt.chestQueue.Count
                    ? receipt.chestQueue[receipt.chestIndex] : null;
            }
        }

        public static void Open(List<string> kinds, Action onDone)
        {
            var screen = ScreenMount.Show<ChestOpenScreen>("ChestOpen");
            screen._onDone = onDone;
            screen._pendingKinds = kinds == null ? new List<string>() : new List<string>(kinds);
            screen.PrepareCandidates();
        }

        void PrepareCandidates()
        {
            var runtime = GameRuntime.I;
            if (!runtime.TryPersistMutation(() =>
            {
                var receipt = runtime.CurrentNodeReceipt;
                if (receipt.chestQueue != null && receipt.chestQueue.Count > 0) return;
                receipt.chestQueue = new List<ChestVisitReceipt>();
                foreach (var kind in _pendingKinds)
                {
                    var contents = ChestLoot.RollContents(kind, runtime.Rng, cls: runtime.State.myClass, mode: runtime.State.mode, petEggChance: runtime.Base.PetEggDropChance);
                    runtime.Base.RecordPetEggChestResult(contents.eggHit);
                    receipt.chestQueue.Add(new ChestVisitReceipt { kind = kind, coins = contents.coins,
                        cardIds = contents.cards.Select(card => card.id).ToList(), claimMode = contents.claimMode,
                        choiceCount = contents.choiceCount, eggHit = contents.eggHit });
                }
                receipt.chestIndex = 0;
            }, out _error)) { Rebuild(); return; }
            _pendingKinds = null;
            Next();
        }

        public static void OpenPending(Action onDone)
        {
            var screen = ScreenMount.Show<ChestOpenScreen>("ChestOpen");
            screen._onDone = onDone;
            screen.Next();
        }

        void Next()
        {
            var runtime = GameRuntime.I;
            var receipt = runtime.CurrentNodeReceipt;
            int next = receipt.chestIndex;
            while (receipt.chestQueue != null && next < receipt.chestQueue.Count && receipt.chestQueue[next].completed) next++;
            if (next != receipt.chestIndex && !runtime.TryPersistMutation(() => runtime.CurrentNodeReceipt.chestIndex = next, out _error))
            { Rebuild(); return; }
            receipt = runtime.CurrentNodeReceipt;
            if (receipt.chestQueue == null || receipt.chestIndex >= receipt.chestQueue.Count)
            {
                var callback = _onDone; _onDone = null;
                Close(); callback?.Invoke(); return;
            }
            Rebuild();
        }

        static bool IsPick(ChestVisitReceipt chest) => chest.claimMode == "one";
        static bool ChoiceTaken(ChestVisitReceipt chest) => chest.taken.Any(index => index < chest.choiceCount);
        static bool CandidateUnavailable(ChestVisitReceipt chest, int index) => chest.taken.Contains(index) || (IsPick(chest) && index < chest.choiceCount && ChoiceTaken(chest));
        static void UpdateCompletion(ChestVisitReceipt chest)
        {
            chest.completed = IsPick(chest)
                ? ChoiceTaken(chest) && Enumerable.Range(chest.choiceCount, Math.Max(0, chest.cardIds.Count - chest.choiceCount)).All(chest.taken.Contains)
                : chest.taken.Count == chest.cardIds.Count;
        }
        public override void Build()
        {
            var chest = Current;
            if (_pendingKinds != null && chest == null)
            {
                var retry = MenuShared.MakeOverlayCard(transform, "奖励准备未完成");
                UIKit.Label(retry.transform, _error ?? "请重试以保存本次奖励", 17, Theme.Sub);
                UIKit.BtnOk(retry.transform, "重试", PrepareCandidates);
                UIKit.Btn(retry.transform, "返回地图", Close);
                return;
            }
            if (chest == null) return;
            var runtime = GameRuntime.I;
            var receipt = runtime.CurrentNodeReceipt;
            var root = MenuShared.MakeOverlayCard(transform, "搜刮！" + (chest.title ?? KindOf(chest.kind)?.name ?? chest.kind)
                + " · 第 " + (receipt.chestIndex + 1) + "/" + receipt.chestQueue.Count, wide: chest.cardIds.Count > 4);
            UIKit.Label(root.transform, IsPick(chest) ? "从候选中选择一张" : "领取已发现的卡牌，未领内容保留在当前地点", 17, Theme.Sub);
            if (_error != null) UIKit.Label(root.transform, _error, 16, Theme.Hex("#F0B78D"));
            var scroll = UIKit.Scroll(root.transform);
            var grid = UIKit.Grid(scroll.transform, Mathf.Clamp(chest.cardIds.Count, 1, 4), new Vector2(150, 235), new Vector2(12, 12));
            grid.AddComponent<LayoutElement>().minHeight = ((chest.cardIds.Count + 3) / 4) * 247;
            for (int index = 0; index < chest.cardIds.Count; index++)
            {
                int selected = index;
                var card = CardLibrary.FindById(chest.cardIds[index]);
                var item = UIKit.Column(grid.transform);
                var layout = item.AddComponent<VerticalLayoutGroup>(); layout.spacing = 6;
                layout.childControlWidth = true; layout.childControlHeight = false;
                layout.childForceExpandWidth = false; layout.childForceExpandHeight = false;
                if (card != null) CardFace.Create(card, CardSize.Md, item.transform);
                else UIKit.Label(item.transform, "卡牌暂不可用：" + chest.cardIds[index], 15, Theme.Sub);
                var take = UIKit.Btn(item.transform, CandidateUnavailable(chest, index) ? "已处理" : IsPick(chest) && index >= chest.choiceCount ? "领取额外奖励" : "领取", () => TakeOne(selected));
                take.interactable = !chest.completed && !CandidateUnavailable(chest, index) && card != null;
            }
            MenuShared.MakeBtnRow(root, row =>
            {
                if (chest.completed) UIKit.BtnOk(row, "继续", Next);
                else if (!IsPick(chest)) UIKit.BtnOk(row, "全部收下" + (chest.coinsTaken ? "" : "（含 " + chest.coins + " 币）"), TakeAll);
                UIKit.Btn(row, "整理背包", () => runtime.Bus.Emit(new BagOpened()));
                UIKit.Btn(row, "返回地图", Close);
            });
            var fx = root.AddComponent<RevealSfxTimer>();
            foreach (var id in chest.cardIds) fx.Push(CardLibrary.FindById(id)?.rarity);
        }

        void TakeOne(int index)
        {
            var chest = Current;
            if (chest == null || chest.completed || CandidateUnavailable(chest, index)) return;
            var runtime = GameRuntime.I;
            if (!runtime.TryPersistMutation(() =>
            {
                var current = Current;
                var card = CardLibrary.FindById(current.cardIds[index]);
                if (card == null || !runtime.GrantCard(card)) throw new InvalidOperationException("背包需腾位，候选仍保留在这里");
                current.taken.Add(index);
                if (!current.coinsTaken) { if (current.coins > 0) runtime.GainCoins(current.coins); current.coinsTaken = true; }
                UpdateCompletion(current);
            }, out _error)) { Rebuild(); return; }
            if (Current.completed) Next(); else Rebuild();
        }

        void TakeAll()
        {
            var chest = Current;
            if (chest == null || chest.completed || IsPick(chest)) return;
            var runtime = GameRuntime.I;
            bool full = false;
            if (!runtime.TryPersistMutation(() =>
            {
                var current = Current;
                for (int index = 0; index < current.cardIds.Count; index++)
                {
                    if (current.taken.Contains(index)) continue;
                    var card = CardLibrary.FindById(current.cardIds[index]);
                    if (card == null || !runtime.GrantCard(card)) { full = true; break; }
                    current.taken.Add(index);
                }
                if (!current.coinsTaken) { if (current.coins > 0) runtime.GainCoins(current.coins); current.coinsTaken = true; }
                UpdateCompletion(current);
            }, out _error)) { Rebuild(); return; }
            if (full) _error = "背包需腾位，未领候选仍保留在这里";
            if (Current.completed) Next(); else Rebuild();
        }

        internal override void OnClose()
        {
            _onDone = null;
            // Phase is a session flag; the persisted queue retains every unclaimed reward.
            if (GameRuntime.I.State.runActive) GameRuntime.I.State.Phase = "idle";
        }
        static ChestKind KindOf(string kind) => ChestLoot.Definition(kind);

        /// <summary>scheduleRevealSfx：逐卡揭晓音效（140ms 起每张 +170ms；传说号角、史诗叮鸣，key 均存在于 AudioService）。</summary>
        sealed class RevealSfxTimer : MonoBehaviour
        {
            readonly List<(float at, string key)> _queue = new List<(float at, string key)>();
            float _clock;

            public void Push(string rarity)
            {
                float at = 0.14f + _queue.Count * 0.17f;
                _queue.Add((at, "reveal"));
                if (rarity == "传说") _queue.Add((at, "legend"));
                else if (rarity == "史诗") _queue.Add((at, "ding"));
            }

            void Update()
            {
                _clock += Time.unscaledDeltaTime;
                for (int i = _queue.Count - 1; i >= 0; i--)
                    if (_clock >= _queue[i].at)
                    {
                        AudioService.I.PlaySfx(_queue[i].key);
                        _queue.RemoveAt(i);
                    }
            }
        }
    }
}
