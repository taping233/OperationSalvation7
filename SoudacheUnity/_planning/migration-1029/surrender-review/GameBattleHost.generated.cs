// Generated verbatim from current BattleBridge.cs; do not edit.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
namespace Sdt.Boot {
    public sealed class GameBattleHost : BattleHost, BattleHostEffects, BattleContainerHost
    {
        readonly GameRuntime _g;
        readonly int _startingMaxHp;
        public GameBattleHost(GameRuntime g) { _g = g; _startingMaxHp = g.State.maxHp; }

        public int Hp { get { return _g.State.hp; } set { _g.State.hp = value; } }
        public int MaxHp => _g.State.maxHp;
        public int Atk => _g.State.atk;
        public int SpellPower => _g.State.spellPower;
        public string MyClass => _g.State.myClass;
        public string CharacterId => _g.State.characterId;
        public IReadOnlyList<Sdt.Core.OwnedCard> OwnedCards => _g.State.ownedCards;
        public void Log(string message, string kind = null) => RunLog.Log(message, kind ?? "sys");
        public void Heal(int amount) => _g.Heal(amount);
        public void GainCoins(int amount) => _g.GainCoins(amount);
        public bool ConsumeStoredCard(string uid)
        {
            return _g.TryPersistMutation(() =>
            {
                var entry = _g.State.ownedCards.Find(card => card.uid == uid && card.pouchOf == CardContainerCommands.PouchId && card.card.type == "法术");
                if (entry == null) throw new InvalidOperationException("锦囊中的法术已变化，请重新选择。");
                _g.State.ownedCards.Remove(entry);
            }, out _);
        }
        public void ChangeMaxHp(int amount)
        {
            _g.State.maxHp = Math.Max(1, _g.State.maxHp + amount);
            _g.State.hp = Math.Min(_g.State.hp, _g.State.maxHp);
        }

        /// <summary>战后先持久化消耗和固定奖励，再逐箱领取及完成首脑整理。</summary>
        public void OnBattleEnd(BattleResult result)
        {
            if (result == null || !_g.State.runActive) return;
            var g = _g;
            g.State.maxHp = _startingMaxHp;
            g.State.hp = Math.Min(g.State.hp, _startingMaxHp);
            g.State.battleActive = false;
            if (result.Win == false)
            {
                if (!g.TryPersistMutation(() =>
                {
                    RecordMetrics(result);
                    if (g.DoDeath() == null) throw new InvalidOperationException("战败结算尚未完成");
                }, out _)) { DeferRetry(result); return; }
                BattleBridge.CloseBattlePanels();
                BattleBridge._battleOpen = false;
                BattleEvents.RetrySettlement = null;
                return;
            }
            if (result.Win == true && g.CurrentNodeReceipt.battleWon)
            { BattleBridge.CloseBattlePanels(); BattleBridge._battleOpen = false; BattleBridge.ResumeRewards(g); return; }
            if (!g.TryPersistMutation(() =>
            {
                var state = g.State;
                g.ClearBattleCheckpoint();
                RecordMetrics(result);
                var movedUids = new HashSet<string>();
                if (result.Played != null) ToPocket(state, result.Played, "使用或弃置的卡牌", result.SpentCards, movedUids);
                if (result.Consumed != null) ToPocket(state, result.Consumed, "注能消耗的卡牌", result.SpentCards, movedUids);
                state.bossCleanupPending = false;
                if (result.Win != true)
                {
                    state.pendingEventLoot = null; state.Phase = "idle";
                    var progress = g.CurrentNodeReceipt.eventProgress;
                    if (progress?.battleStarted == true || progress?.stage == "battle")
                    {
                        progress.settled = true; progress.stage = "complete";
                        g.CurrentNodeReceipt.completed = true; state.settled.Add(g.CurrentNodeId);
                    }
                    return;
                }
                var names = result.FoeNames != null && result.FoeNames.Count > 0 ? result.FoeNames : new List<string> { result.Name ?? "敌人" };
                for (int index = 0; index < names.Count; index++)
                    g.Meta.Track("kill", new MetaProgress.TrackData { boss = result.IsBoss && index == 0, name = names[index], cls = state.myClass });
                g.Base.eggBattles++;
                var boxes = new List<string>();
                if (state.pendingEventLoot?.chests != null) boxes.AddRange(state.pendingEventLoot.chests);
                state.pendingEventLoot = null;
                var classChance = g.Base.CarriedPet?.effect?.classChest ?? 0;
                boxes.AddRange(ChestLoot.RollDrops(result.IsBoss, result.Layer, g.Rng, names, classChance > 0 ? classChance : .25));
                var receipt = g.CurrentNodeReceipt;
                receipt.battleWon = true; receipt.battleBoss = result.IsBoss;
                receipt.battleFoeNames = new List<string>(names);
                receipt.extraLegendaryPrepared = false;
                if (result.IsBoss) state.bossDefeated = true;
                receipt.battleConsumed = result.Consumed != null ? new List<string>(result.Consumed) : new List<string>();
                receipt.chestQueue = new List<ChestVisitReceipt>(); receipt.chestIndex = 0;
                foreach (var kind in boxes)
                {
                    var contents = ChestLoot.RollContents(kind, g.Rng, cls: state.myClass, mode: state.mode, petEggChance: g.Base.PetEggDropChance);
                    g.Base.RecordPetEggChestResult(contents.eggHit);
                    receipt.chestQueue.Add(new ChestVisitReceipt { kind = kind, coins = contents.coins,
                        cardIds = contents.cards.ConvertAll(card => card.id), claimMode = contents.claimMode,
                        choiceCount = contents.choiceCount, eggHit = contents.eggHit });
                }
                state.Phase = "modal";
                RunLog.Log(result.IsBoss ? "首脑战胜利！" : "战斗胜利！", "ok");
            }, out var reason))
            { DeferRetry(result); return; }
            BattleBridge._battleOpen = false;
            BattleEvents.RetrySettlement = null;
            BattleBridge.CloseBattlePanels();
            if (result.Win == true) BattleBridge.ResumeRewards(g);
            else
            {
                g.CompleteBattleNode(false);
                g.Audio.PlayBgm("board");
            }
        }

        void DeferRetry(BattleResult result)
        {
            _g.State.battleActive = true;
            _g.Audio.PlayBgm("battle");
            BattleEvents.RetrySettlement = () => OnBattleEnd(result);
            _g.Bus.Emit(new ToastRequested("战后保存失败，请重试保存：" + _g.Saves.LastError));
            if (BattleViewApi.Session != null) BattleEvents.Raise(BattleViewApi.Session.Snapshot);
        }
        void RecordMetrics(BattleResult result)
        {
            if (result.TurnMovesMax > 0) _g.Meta.Track("turnMoves", new MetaProgress.TrackData { n = result.TurnMovesMax });
            if (result.BattleEquipsMax > 0) _g.Meta.Track("battleEquips", new MetaProgress.TrackData { n = result.BattleEquipsMax });
            for (int index = 0; index < result.ReviveKills; index++) _g.Meta.Track("reviveKill");
        }
        /// <summary>toPocket（chests.js/bag.js 共用语义）：uid 对应的背包卡移入消耗口袋，同名堆叠。</summary>
        static int ToPocket(Sdt.Core.RunState st, List<string> uids, string why, List<Sdt.Core.OwnedCard> spent, HashSet<string> movedUids)
        {
            var moved = new List<CardDef>();
            foreach (var uid in uids)
            {
                if (movedUids.Contains(uid)) continue;
                var i = st.ownedCards.FindIndex(o => o.uid == uid);
                var card = i >= 0 ? st.ownedCards[i].card : spent?.Find(entry => entry.uid == uid)?.card;
                if (card == null) continue;
                moved.Add(card); movedUids.Add(uid);
                if (i >= 0) st.ownedCards.RemoveAt(i);
            }
            foreach (var card in moved)
            {
                var stack = st.usedPocket.Find(p => p.card.name == card.name);
                if (stack != null) stack.count++;
                else st.usedPocket.Add(new Sdt.Core.PocketStack { card = card, count = 1 });
            }
            if (moved.Count > 0)
                RunLog.Log("[[icon:archive]] " + why + "：<b>" + moved.Count + "</b> 张卡牌进入消耗口袋（本局无法再用，基地/火堆可复原）", "sys");
            return moved.Count;
        }

    }


}
