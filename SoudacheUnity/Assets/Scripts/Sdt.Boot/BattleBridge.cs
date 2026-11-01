// 战斗装配桥（battle.core.js start/commands/getSnapshot → C# 的 Boot 接线；主会话 2026-09-06）
//   BattleRequested 消费 → new BattleSession().Start(...) → BattleScreen 呈现
//   BattleHost（血量/卡组/日志/结束回调）映射 GameRuntime；读侧门面见 BattleViewApi（E 包）。
//   快照链：BattleSession.SnapshotChanged(Core 静态) → BattleEvents.Raise(UI 静态) → BattleScreen 重建。
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;

namespace Sdt.Boot
{
    /// <summary>宿主桥：BattleSession 经此读写对局状态（对齐 battle.core.js 里注入的 game 宿主 G）。</summary>
    public sealed class GameBattleHost : BattleHost, BattleHostEffects, BattleContainerHost
    {
        readonly GameRuntime _g;
        readonly int _startingMaxHp;
        BattleResult _waitingActorResult, _presentedActorResult, _audibleBattleResult;
        public GameBattleHost(GameRuntime g) { _g = g; _startingMaxHp = g.State.maxHp; }

        public int Hp { get { return _g.State.hp; } set { _g.State.hp = value; } }
        public int MaxHp => _g.State.maxHp;
        public int Atk => _g.State.atk;
        public int SpellPower => _g.State.spellPower;
        public string MyClass => _g.State.myClass;
        public string CharacterId => _g.State.characterId;
        public IReadOnlyList<Sdt.Core.OwnedCard> OwnedCards => _g.State.ownedCards;
        // Source battle host UI.log writes the log even when its tone is warn.
        // Explicit UI action failures retain their own notice feedback.
        public void Log(string message, string kind = null) => _g.Bus.Emit(new LogRequested { Text=message,Tone=kind??"sys",SuppressNotice=true });
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
            if (ReferenceEquals(_waitingActorResult, result)) return;
            bool actualDeath = result.Win == false && _g.State.hp <= 0;
            if ((actualDeath || result.Win == true) && !ReferenceEquals(_presentedActorResult, result))
            {
                var session = BattleViewApi.Session;
                string token = session?.BattleToken;
                if (BattleScreen.WaitForActorResult(token, actualDeath, () =>
                {
                    _waitingActorResult = null; _presentedActorResult = result;
                    if (ReferenceEquals(BattleViewApi.Session, session) && session?.BattleToken == token)
                        OnBattleEnd(result);
                })) { _waitingActorResult = result; return; }
                _presentedActorResult = result;
            }
            var g = _g;
            if (!ReferenceEquals(_audibleBattleResult,result))
            {
                _audibleBattleResult=result;
                g.Audio.PlaySfx(result.Win==true ? result.IsBoss ? "bossVictory" : "victory" : result.Win==false ? "defeat" : "flee");
            }
            g.State.maxHp = _startingMaxHp;
            g.State.hp = Math.Min(g.State.hp, _startingMaxHp);
            g.State.battleActive = false;
            if (result.Win == false)
            {
                if (!g.TryPersistMutation(() =>
                {
                    RecordMetrics(result);
                    if (g.DoDeath(ToSettlementReview(result.Summary,result.IsBoss),g.State.hp>0?"你主动选择撤离，按失败结算":null) == null) throw new InvalidOperationException("战败结算尚未完成");
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

        static SettlementBattleReview ToSettlementReview(BattleSummary summary,bool isBoss)
        {
            if(summary==null)return null;
            return new SettlementBattleReview { round=summary.round,isBoss=isBoss,coverage=summary.damageCoverage,
                foes=(summary.remainingFoes??Array.Empty<BattleSummaryFoe>()).Select(foe=>new SettlementBattleFoe{name=foe.name,hp=foe.hp,maxHp=foe.maxHp}).ToList(),
                hits=(summary.damageTaken??Array.Empty<BattleSummaryHit>()).Select(hit=>new SettlementBattleHit{source=hit.source,damage=hit.damage}).ToList() };
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

    /// <summary>命令转发：BattleScreen 的 IBattleCommands → BattleSession 实例命令（写侧门面）。</summary>
    public sealed class BattleCommands : IBattleCommands
    {
        readonly BattleSession _s;
        public BattleCommands(BattleSession s) { _s = s; }

        public CommandResult PlayCard(string uid, int targetIndex, bool infused) => _s.PlayCard(uid, targetIndex, infused);
        public CommandResult UseEquipment(string uid) => _s.UseEquipment(uid);
        public CommandResult UseItem(string uid, int targetIndex = -1) => _s.UseItem(uid, targetIndex);
        public CommandResult ChooseRuleOption(int index) => _s.ChooseRuleOption(index);
        public CommandResult SelectRuleTarget(int index,string battleToken,int selectionId) => _s.SelectRuleTarget(index,battleToken,selectionId);
        public CommandResult SelectRuleHand(string uid) => _s.SelectRuleHand(uid);
        public CommandResult CancelRuleHandSelection(long selectionId) => _s.CancelRuleHandSelection(selectionId);
        public CommandResult ConfirmRuleHandPayment(long selectionId, string[] materialUids) => _s.ConfirmRuleHandPayment(selectionId, materialUids);
        public CommandResult UseHeroSkill(int targetIndex = -1) => _s.UseHeroSkill(targetIndex);
        public void SelectInfusion(string uid) => _s.SelectInfusion(uid);
        public void ConfirmInfusion() => _s.ConfirmInfusion(-1);   // -1 = 首个存活敌人（对齐原版无参 confirmInfusion）
        public void CancelInfusion() => _s.CancelInfusion();
        public CommandResult SkipInfusion() => _s.SkipInfusion();
        public void EndTurn() => _s.EndTurn();
        public void Flee()
        {
            var result = _s.Surrender();
            if (!result.Ok) GameRuntime.I.Bus.Emit(new ToastRequested { Text = result.Reason, Tone = "warn" });
        }
        public void OpenGrave() => _s.OpenGrave();
        public void CloseGrave() => _s.CloseGrave();
        public void CancelPendingTarget() => _s.CancelPendingTarget();
        public void PickDiscover(int index) => _s.PickDiscover(index);
        public void SetPendingHint(string text) => _s.SetPendingHint(text);
        public void LockPendingTarget(string uid)
        {
            // The session preserves a same-UID target's selection state without projecting the full battle.
            _s.LockPendingTarget(new PendingTargetSnapshot { uid = uid });
        }
        public void SelectDeckCard(string uid) => _s.SelectDeckCard(uid);
        public void ConfirmDeck()
        {
            var selection = _s.Snapshot.DeckSelection;
            if (selection == null) return;
            if (selection.selected.Count < selection.need || selection.selected.Count > selection.Maximum)
            { var rejected = _s.ConfirmDeck(); if (!rejected.Ok) GameRuntime.I.Bus.Emit(new ToastRequested(rejected.Reason)); return; }
            var checkpoint = _s.CaptureCheckpoint();
            checkpoint.selectedDeck = selection.selected.ToList();
            if (!GameRuntime.I.TryUpdateBattleCheckpoint(checkpoint, out _)) return;
            _s.ConfirmDeck();
        }
        public void CancelDeck() => _s.CancelDeckSelection();
    }

    /// <summary>战斗接线总装：GameBoot.Install() 调 BattleBridge.Install() 一次性接好读写两侧。</summary>
    public static class BattleBridge
    {
        internal static void CloseBattlePanels()
        {
            var panels = UiStack.CapturePanels();
            for (int index = panels.Count - 1; index >= 0; index--)
                if (panels[index] != null && panels[index].GetType().Namespace == typeof(BattleScreen).Namespace)
                    UiStack.Close(panels[index]);
        }

        internal static void ResumeRewards(GameRuntime game)
        {
            var receipt = game.CurrentNodeReceipt;
            if (!receipt.battleWon || receipt.completed) return;
            ChestOpenScreen.OpenPending(() =>
            {
                if (!receipt.extraLegendaryPrepared)
                {
                    if (!game.TryPersistMutation(() =>
                    {
                        var current = game.CurrentNodeReceipt;
                        int count = current.battleBoss ? 1 : 0;
                        if (!current.battleBoss && current.battleFoeNames.Any(name => name.Contains("巨兽")) && game.Rng.Random("loot", "reward") < .3) count++;
                        var pool = CardLibrary.All().Where(card => card.rarity == "传说" && CardLibrary.IsRandomObtainable(card)).ToList();
                        var cards = new List<string>();
                        for (int index = 0; index < count && pool.Count > 0; index++) cards.Add(pool[(int)(game.Rng.Random("loot", "reward") * pool.Count)].id);
                        current.extraLegendaryPrepared = true;
                        if (cards.Count > 0) current.chestQueue.Add(new ChestVisitReceipt { kind = "extra-legendary", title = current.battleBoss ? "首脑宝库 · 额外传说奖励" : "巨兽战利品 · 额外传说奖励", claimMode = "all", cardIds = cards });
                    }, out _)) return;
                    ResumeRewards(game);
                    return;
                }
                CompleteRewardNode(game, receipt.battleBoss);
            });
        }

        static void CompleteRewardNode(GameRuntime game, bool boss)
        {
            if (!game.TryPersistMutation(() =>
            {
                if (boss) game.NotifyBossDefeated();
                game.State.bossCleanupPending = false;
                game.CompleteBattleNode(true);
            }, out var reason))
            {
                game.Bus.Emit(new ToastRequested("奖励结算保存失败，请重新打开当前地点重试：" + reason));
            }
            else
            {
                game.Audio.PlayBgm("board");
                if (!game.Base.ammoTaught && game.TryPersistMutation(() => { game.Base.ammoTaught = true; }, out _))
                    AmmoTeachScreen.Open();
            }
        }

        static bool _installed;
        public static void Install()
        {
            if (_installed) return;
            _installed = true;
            BattleViewApi.Install();
            var g = GameRuntime.I;
            g.Bus.On<RunStarted>(_ => ResetBattleView());
            g.Bus.On<RunLoaded>(_ => ResetBattleView());
            g.Bus.On<RunEnded>(_ => ResetBattleView());
            g.RestoreBattleCheckpoint = checkpoint =>
            {
                CloseBattlePanels();
                var session = new BattleSession();
                if (!g.TryPersistMutation(() =>
                {
                    g.State.battleActive = true; g.State.Phase = "modal";
                    if (!session.RestoreCheckpoint(new GameBattleHost(g), checkpoint.battle, g.Rng, out var reason))
                        throw new InvalidOperationException(reason);
                }, out _)) { _battleOpen = false; return false; }
                _battleOpen = true;
                BattleEvents.RetrySettlement = null;
                BattleViewApi.Session = session;
                BattleView.Commands = new BattleCommands(session);
                g.Audio.PlayBgm("battle");
                UiStack.Show<BattleScreen>("Battle");
                BattleEvents.Raise(session.Snapshot);
                return true;
            };
            g.Bus.On<BattleRequested>(req => OpenBattle(g, req != null ? req.Request : null));
            BattleSession.SnapshotChanged += s => BattleEvents.Raise(s);
        }

        internal static bool _battleOpen;   // 防重入：一场战斗只开一次（BattleRequested 与 Present 双通道保险）；OnBattleEnd 复位
        static void ResetBattleView()
        {
            // A stale entrance cannot start a battle after a new run or restore takes ownership.
            if (CurrentRunFilm.Current?.Kind == "battle" || CurrentRunFilm.Current?.Kind == "boss") CurrentRunFilm.CancelActive();
            CloseBattlePanels(); _battleOpen = false;
            BattleEvents.RetrySettlement = null;
            BattleViewApi.Session = null; BattleView.Commands = null;
        }

        /// <summary>game.run.js SDT.Battle.start 等价：构建敌人输入 → 开会话 → 压战斗屏（RunLoopBridge 的战斗格分发也走这里）。</summary>
        internal static void OpenBattle(GameRuntime g, BattleRequest req)
        {
            if (req == null || req.Foes == null || req.Foes.Count == 0) return;
            if (_battleOpen) { UnityEngine.Debug.Log("[BattleBridge] 已有战斗进行中，忽略重复开战请求"); return; }
            if (CurrentRunFilm.AfterPassage(() => OpenBattle(g, req))) return;
            if (req.IsBoss && CurrentRunFilm.Current?.Kind == "boss" && !CurrentRunFilm.Current.WaitingForDestination)
            { OpenPreparedBattle(g, req); return; }
            // Event choices start their battle directly after the event's own entrance.
            // Only actual map battle cells and the boss gate call source enterNode(battle/boss).
            bool mapEncounter = g.State.nodeRewards.TryGetValue(g.CurrentNodeId, out var receipt) && (receipt.type == "battle" || receipt.type == "boss");
            if (!req.IsBoss && !mapEncounter) { OpenPreparedBattle(g, req); return; }
            if (CurrentRunFilm.Current?.WaitingForDestination == true && (CurrentRunFilm.Current.Kind == "battle" || CurrentRunFilm.Current.Kind == "boss")) return;
            var seed = g.State.seed; var slot = g.ActiveSlot; var node = g.CurrentNodeId;
            CurrentRunFilm.Play(req.IsBoss ? "boss" : "battle", () => OpenPreparedBattle(g, req),
                () => g.State.runActive && g.State.seed == seed && g.ActiveSlot == slot && g.CurrentNodeId == node && !g.State.closed.Contains(node));
        }

        static void OpenPreparedBattle(GameRuntime g, BattleRequest req)
        {
            if (_battleOpen || !g.State.runActive) return;

            var enemies = new List<EnemyInput>();
            foreach (var f in req.Foes)
            {
                var boss = req.IsBoss ? MapData.AltarBosses.FirstOrDefault(entry => entry.id == f.id) : null;
                enemies.Add(new EnemyInput { id = f.id, name = f.name, behavior = f.behavior, hp = f.hp, atk = f.atk,
                    affix = boss?.affix, affixName = boss?.affixName,
                    elite = f.elite, eliteSkill = f.eliteSkill, desc = f.desc, damageCap = f.damageCap, evenAttack = f.evenAttack });
            }

            // 伤害只作用于本次复制的敌人，保存失败后重试不会再次扣原始请求。
            if (req.PreDamage > 0)
            {
                enemies[0].hp -= req.PreDamage;
                if (enemies[0].hp <= 0)
                {
                    g.TryPersistMutation(() =>
                    {
                        g.GainCoins(2); g.CompleteBattleNode(true);
                        RunLog.Log("[[icon:tools]] 闪金之锤一击制敌（" + enemies[0].name + "）！+2 币", "coin");
                    }, out _);
                    return;
                }
            }

            var session = new BattleSession();
            var context = new BattleStartContext
            {
                host = new GameBattleHost(g),
                enemies = enemies,
                isBoss = req.IsBoss,
                layer = req.Layer,
                returnTo = req.ReturnTo,
                name = req.Name,
                risk = req.Risk,
                runMode = g.State.mode,
                rng = g.Rng,
            };
            if (!g.TryBeginBattleCheckpoint(BattleSession.PrepareCheckpoint(context), out _))
            {
                g.State.battleActive = false; g.State.Phase = "idle";
                g.Bus.Emit(new ToastRequested { Text = "开战前保存失败，敌人和原存档已保留；重新进入当前地点即可重试。", Tone = "warn" });
                return;
            }
            _battleOpen = true;
            g.Audio.PlayBgm("battle");
            g.State.Phase = "modal";
            g.State.battleActive = true;
            BattleEvents.RetrySettlement = null;
            BattleViewApi.Session = session;
            BattleView.Commands = new BattleCommands(session);
            session.Start(context);
            UiStack.Show<BattleScreen>("Battle");
            // Start 的初始快照早于页面订阅；呈现当前会话后补发一次。
            BattleEvents.Raise(session.Snapshot);
        }
    }
}
