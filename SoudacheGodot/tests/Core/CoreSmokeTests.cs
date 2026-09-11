using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Soudache;
using SoudacheGodot.App;

internal static class CoreSmokeTests
{
    private static int _checks;

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        _checks++;
    }

    public static int Main()
    {
        RngIsReplayable();
        DeckMovesWithoutDuplication();
        QueueIsFifo();
        CombatResolvesDamageBlockAndHeal();
        SaveRoundTripsAndFallsBackToBackup();
        ClearSlotRemovesSaveAndBackup();
        BattleSfxTrackerProducesSoundJsKeys();
        CoreUiSnapshotsAssembleInterfaceFields();
        Console.WriteLine($"CORE_SMOKE_OK checks={_checks}");
        return 0;
    }

    private static void RngIsReplayable()
    {
        var a = new DeterministicRng(1234UL);
        var b = new DeterministicRng(1234UL);
        for (var i = 0; i < 12; i++) Check(a.NextUInt64() == b.NextUInt64(), "RNG sequence diverged");
        var state = a.State;
        var next = a.NextUInt64();
        a.RestoreState(state);
        Check(a.NextUInt64() == next, "RNG state did not restore");
    }

    private static void DeckMovesWithoutDuplication()
    {
        var deck = new CardDeck();
        var def = new CardDefinition("strike", "Strike", CardType.Attack, cost: 1, damage: 5);
        var exhaust = new CardDefinition("burn", "Burn", CardType.Skill, exhaustOnPlay: true);
        deck.AddToDrawPile(new CardInstance("strike-1", def.Id));
        deck.AddToDrawPile(new CardInstance("burn-1", exhaust.Id));
        Check(deck.Draw(3, new DeterministicRng(9)) == 2, "draw count incorrect");
        Check(deck.Hand.Count == 2 && deck.DrawPile.Count == 0, "hand/draw zones incorrect");
        Check(deck.TryPlay("strike-1", def), "strike should move to discard");
        Check(deck.TryPlay("burn-1", exhaust), "burn should move to exhaust");
        Check(deck.Discard.Count == 1 && deck.Exhaust.Count == 1 && deck.Count == 2, "card zone duplication");
        Check(!deck.TryPlay("strike-1", def), "discarded card played twice");
    }

    private static void QueueIsFifo()
    {
        var combat = new CombatState("player");
        combat.AddCombatant(new CombatantState("player", "Player", 20, false));
        var order = new List<string>();
        combat.Actions.Enqueue(new MarkerAction("first", order));
        combat.Actions.Enqueue(new MarkerAction("second", order));
        Check(combat.ResolveActions() == 2, "queue count incorrect");
        Check(order[0] == "first" && order[1] == "second", "queue was not FIFO");
    }

    private static void CombatResolvesDamageBlockAndHeal()
    {
        var combat = new CombatState("player");
        combat.AddCombatant(new CombatantState("player", "Player", 20, false));
        combat.AddCombatant(new CombatantState("foe", "Foe", 15, true));
        combat.AddBlock("player", 3);
        var result = combat.DealDamage("player", 8);
        Check(result.Blocked == 3 && result.HealthDamage == 5, "damage/block result incorrect");
        Check(combat.RestoreHealth("player", 2) == 2, "heal result incorrect");
        combat.Actions.Enqueue(new DamageAction("foe", 15));
        Check(combat.ResolveActions() == 1 && combat.Phase == CombatPhase.Victory, "victory outcome incorrect");
    }

    private static void SaveRoundTripsAndFallsBackToBackup()
    {
        var root = Path.Combine(Path.GetTempPath(), "soudache-core-smoke-" + Guid.NewGuid().ToString("N"));
        try
        {
            var service = new AtomicJsonSaveService(root, maxSlots: 2);
            var snapshot = new SaveGameDto { RngState = 77UL };
            snapshot.Deck.Cards.Add(new CardInstanceDto { InstanceId = "c1", DefinitionId = "strike", Zone = CardZone.Hand });
            service.Save(0, snapshot);
            Check(service.Load(0).RngState == 77UL, "save round trip failed");
            service.Save(0, new SaveGameDto { RngState = 88UL });
            File.WriteAllText(service.GetSlotPath(0), "{not-json");
            Check(service.TryLoad(0, out var restored, out var usedBackup) && restored!.RngState == 77UL && usedBackup, "backup fallback failed");
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    private sealed class MarkerAction : IGameAction
    {
        private readonly List<string> _order;
        public string ActionId { get; }
        public MarkerAction(string id, List<string> order) { ActionId = id; _order = order; }
        public void Execute(ActionContext context) => _order.Add(ActionId);
    }

    // 批次 5 rider [6c→A]：战斗音效信号生产器（PublishBattle 透传 SfxRequests 的核心语义）。
    // 触发点对照 _planning/audio-inventory.md §3：execPlay→card、hitFoe→hit、玩家受伤→hurt、
    // 恢复→heal、finish(true/false)→victory/defeat。
    private static void BattleSfxTrackerProducesSoundJsKeys()
    {
        var sfx = new BattleSfxTracker();
        Check(sfx.Drain().Count == 0, "a fresh tracker must have no pending sfx");
        sfx.OnCardResolved(enemiesHpBefore: 30, enemiesHpAfter: 22, playerHpBefore: 30, playerHpAfter: 30);
        Check(sfx.Pending.SequenceEqual(new[] { "card", "hit" }), "card play with enemy damage must request card+hit");
        sfx.OnCardResolved(22, 22, 30, 25);
        Check(sfx.Pending.SequenceEqual(new[] { "card", "hit", "card", "hurt" }), "player damage during play must append hurt");
        sfx.OnCardResolved(22, 25, 25, 28);
        Check(sfx.Pending.Last() == "heal", "player healing during play must request heal");
        sfx.OnEnemyTurnResolved(28, 20);
        Check(sfx.Pending.Last() == "hurt", "enemy turn damage must request hurt");
        sfx.OnEnemyTurnResolved(20, 20);
        Check(sfx.Pending.Last() == "hurt", "unchanged HP must not append a key");
        sfx.Push("");
        sfx.Push(null!);
        Check(sfx.Pending.Count == 7, "blank keys must be rejected");
        sfx.OnCombatEnded(victory: true);
        sfx.OnCombatEnded(victory: false);
        Check(sfx.Pending[^2] == "victory" && sfx.Pending[^1] == "defeat", "combat end must request victory/defeat");
        var drained = sfx.Drain();
        Check(drained.SequenceEqual(new[] { "card", "hit", "card", "hurt", "card", "heal", "hurt", "victory", "defeat" }),
            "drain must return every requested key in order");
        Check(sfx.Drain().Count == 0, "drain must clear the pending queue");
    }

    // 批次 8-prep 接口 [6b'→A]：RunUiSnapshot 明细行的纯组装逻辑（CoreUiSnapshots，adapter 双路径共用）。
    // 逐项断言 TokenCounts / BaseStash / BasePocket / CollectedIds 的字段映射与口径。
    private static void CoreUiSnapshotsAssembleInterfaceFields()
    {
        // TokenCounts：只收令牌三卡、同 id 计数、非令牌与缺卡不出键
        var stacks = new[]
        {
            new RunCardStack(new RunCard("tt-token-gold", "员工通行证B", "资源", "传说"), 2),
            new RunCardStack(new RunCard("builtin-sha", "初始攻击", "武术", "初始", 0, false, true), 5),
            new RunCardStack(new RunCard("cmtmvq6ss84l", "彩色令牌", "道具", "传说"), 1)
        };
        var tokens = CoreUiSnapshots.TokenCounts(stacks);
        Check(tokens.Count == 2 && tokens["tt-token-gold"] == 2 && tokens["cmtmvq6ss84l"] == 1,
            "token counts must track only the three pass/token ids");
        Check(CoreUiSnapshots.TokenCounts(Array.Empty<RunCardStack>()).Count == 0, "empty stacks must yield no token keys");
        Check(CoreUiSnapshots.TokenCardIds.SequenceEqual(new[] { "tt-token-gold", "tt-token-color", "cmtmvq6ss84l" }),
            "token id list drifted from cards.json ids");

        // StashRows：字段映射（cost 由回调注入、卖价下限 1、收藏态/材料/cls 透传、保持仓库栈顺序）
        var collected = new HashSet<string>(StringComparer.Ordinal) { "r1" };
        var stash = new[]
        {
            new RunCardStack(new RunCard("r1", "已藏卡", "装备", "稀有", 3, true) { Cls = "侠客" }, 2),
            new RunCardStack(new RunCard("m1", "木材", "资源", "古朴") { MaterialKind = "wood" }, 4)
        };
        var rows = CoreUiSnapshots.StashRows(stash, collected, id => id == "r1" ? 2 : 0);
        Check(rows.Length == 2 && rows[0].CardId == "r1" && rows[0].Count == 2 && rows[0].Cost == 2, "stash row must map id/count/cost");
        Check(rows[0].SellPrice == 3 && rows[0].Sellable && rows[0].Collected && rows[0].Cls == "侠客", "stash row must map sell state and collection mark");
        Check(rows[1].Cost == 0 && rows[1].MaterialKind == "wood" && !rows[1].Collected, "stash row must keep material kind and zero cost");
        Check(CoreUiSnapshots.StashRows(new[] { new RunCardStack(new RunCard("z", "无价卡", "装备", "古朴", 0, true)) }, collected, _ => 9)[0].SellPrice == 1,
            "sell price must clamp to at least 1");

        // PocketRows：pocketKeyCost=稀有度价×张数（与 RunBaseState.PocketKeyCost 同源）
        var pocket = CoreUiSnapshots.PocketRows(new[]
        {
            new RunCardStack(new RunCard("p1", "传说残页", "装备", "传说"), 2),
            new RunCardStack(new RunCard("p2", "初始攻击", "武术", "初始", 0, false, true), 1)
        });
        Check(pocket[0].PocketKeyCost == 8 && pocket[1].PocketKeyCost == 1, "pocket rows must carry the rarity-priced restore cost");

        // CollectedIds：全量集合 → 稳定排序（图鉴 isCollected 注入口）
        var ids = CoreUiSnapshots.CollectedIds(new HashSet<string>(StringComparer.Ordinal) { "tt-gold", "aaa", "zzz" });
        Check(ids.SequenceEqual(new[] { "aaa", "tt-gold", "zzz" }), "collected ids must be ordinal-sorted for stable snapshots");
        Console.WriteLine("[8-prep] 快照组装（TokenCounts/BaseStash/BasePocket/CollectedIds）断言通过");
    }

    // 批次 4b rider：存档槽动作 RequestClearSlot 的服务端语义（删除存档含 .bak 备份，
    // 对照网页 game.menu.js delSlot/overwriteSlot 共用的 clearSlot；槽号越界抛错）。
    private static void ClearSlotRemovesSaveAndBackup()
    {
        var root = Path.Combine(Path.GetTempPath(), "soudache-core-clear-" + Guid.NewGuid().ToString("N"));
        try
        {
            var service = new AtomicJsonSaveService(root, maxSlots: 2);
            service.Save(0, new SaveGameDto { RngState = 7UL });
            Check(service.HasSave(0), "slot should hold a save before ClearSlot");
            File.WriteAllText(service.GetBackupPath(0), "{}");
            var slotPath = service.GetSlotPath(0);
            var backupPath = service.GetBackupPath(0);
            Check(service.ClearSlot(0), "ClearSlot must report an existing save");
            Check(!File.Exists(slotPath) && !File.Exists(backupPath), "ClearSlot must delete the save and its backup");
            Check(!service.HasSave(0), "slot must be empty after ClearSlot");
            Check(!service.ClearSlot(0), "ClearSlot on an empty slot reports false");
            try { service.ClearSlot(2); throw new InvalidOperationException("out-of-range slot was accepted"); }
            catch (ArgumentOutOfRangeException) { _checks++; }
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }
}
