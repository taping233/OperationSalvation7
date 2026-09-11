using System;
using System.Collections.Generic;
using System.Linq;
using Soudache.Battle;

// ported from 搜打撤/tests/battle-all-cards.test.js —— 全卡库真实战斗实打审计。
// 在真实 BattleEngine（无视图层）里逐张开战、逐张打出/使用，验证每张卡
// 「能打出、不崩、战斗能正常收尾」。分层：
//   A 手牌战斗卡（武术/法术/装备/能力卡）→ play 管线（含注能/发现/抉择/手选面板）
//   B 牌库类卡（描述含洗入/置入牌库等，普通战打不出）→ BOSS 编组流程实打
//   C 道具卡 → 药水栏 usePotion 管线（普通战）
//   D 开战被动装备（「对战开始时」）→ 普通战不进手牌且不触发
//   E 资源/事件/生物 → 断言正确地不进手牌（不可打出是设计行为）
// 判定口径：崩溃/意外败北/（同步引擎无悬挂）= 硬失败；
// 打出后零可观测变化 = 软警告清单（人工复核用，恒通过，以趋势为准）。

internal static class BattleAuditTests
{
    private sealed record AuditRecord(string Id, string Name, string Type, string Path, string Problem);

    private static readonly List<AuditRecord> Results = new();

    private static void Record(CardRecord card, string path, string problem) =>
        Results.Add(new AuditRecord(card.Id, card.Name, card.Type, path, problem));

    private static IEnumerable<AuditRecord> HardFails => Results.Where(r => !r.Problem.StartsWith("零可观测"));

    public static int Run()
    {
        Results.Clear();
        var cards = BattleHarness.SharedCards().All.ToList();
        foreach (var card in cards)
        {
            try
            {
                AuditOne(card);
            }
            catch (Exception e)
            {
                // 同步引擎：结算异常直接归因到该卡（网页版经 unhandledRejection 捕获）
                Record(card, "异步结算", "崩溃:" + e.Message);
            }
        }
        var hard = HardFails.ToList();
        var soft = Results.Where(r => r.Problem.StartsWith("零可观测")).ToList();
        var counts = new
        {
            Total = cards.Count,
            Hand = cards.Count(c => BattleHarness.Classify(c) == "hand"),
            BossOnly = cards.Count(c => BattleHarness.Classify(c) == "bossOnly"),
            Item = cards.Count(c => BattleHarness.Classify(c) == "item"),
            Passive = cards.Count(c => BattleHarness.Classify(c) == "passive"),
            Excluded = cards.Count(c => BattleHarness.Classify(c) == "excluded"),
        };
        Console.WriteLine($"===== 全卡实打审计：共 {counts.Total} 张（A 手牌 {counts.Hand} / B BOSS专 {counts.BossOnly} / C 道具 {counts.Item} / D 开战被动 {counts.Passive} / E 排除 {counts.Excluded}），硬失败 {hard.Count}，零效果警告 {soft.Count} =====");
        if (hard.Count > 0)
            Console.WriteLine("—— 硬失败清单 ——\n" + string.Join("\n", hard.Select(r => $"【{r.Name}】({r.Type}) {r.Path}: {r.Problem}")));
        if (soft.Count > 0)
            Console.WriteLine("—— 零效果警告（人工复核，不判失败）——\n" + string.Join("\n", soft.Select(r => $"【{r.Name}】({r.Type}) {r.Path}")));
        if (hard.Count > 0) throw new InvalidOperationException($"全卡实打审计存在 {hard.Count} 个硬失败（见清单）");
        return counts.Total;
    }

    // 注能燃料：互不同名的通用牌
    private static readonly string[] FillerNames = { "初始攻击", "毒药", "坚冰结界", "禁言术" };

    private static void AuditOne(CardRecord card)
    {
        var kind = BattleHarness.Classify(card);
        var cards = BattleHarness.SharedCards();
        var need = Math.Max(0, card.Infuse > 0 ? card.Infuse : CardLib.DeriveInfuse(card));
        var fill = need > 0
            ? FillerNames.Select(n => cards.ByName(n)).Where(c => c is not null && c.Name != card.Name).Cast<CardRecord>().Take(need + 1).ToList()
            : new List<CardRecord>();

        if (kind == "excluded")
        {
            var game = new TestGame(new[] { card });
            var engine = BattleHarness.Start(game);
            var s = engine.Snapshot;
            if (s.Hand.Count != 0) Record(card, "E-排除", $"不应进手牌却进了（hand={s.Hand.Count}）");
            return;
        }
        if (kind == "passive")
        {
            var game = new TestGame(new[] { card });
            var engine = BattleHarness.Start(game);
            var s = engine.Snapshot;
            var uid = game.Owned[0].Uid;
            if (s.Hand.Contains(uid)) Record(card, "D-被动", "开战被动装备不应进手牌");
            // 2026-09-10 定版：对战开始时的装备只在 BOSS 战生效——普通战斗不触发即正确
            else if (game.Logs.Any(l => l.Contains("开战被动"))) Record(card, "D-被动", "普通战斗不应触发展开战被动（现仅 BOSS 战生效）");
            return;
        }
        if (kind == "item")
        {
            var game = new TestGame(new[] { card });
            var engine = BattleHarness.Start(game);
            var uid = game.Owned[0].Uid;
            engine.DrainFloats();
            var before = BattleHarness.Observe(game, engine);
            engine.UsePotion(uid);
            var s = BattleHarness.Drain(engine);
            var consumed = game.Owned.Count == 0;
            var after = BattleHarness.Observe(game, engine);
            if (!consumed && after == before) Record(card, "C-道具", "零可观测效果（也未消耗）");
            if (s.Busy) Record(card, "C-道具", "结算悬挂（busy 未清）");
            if (game.LastEnd is { Win: false }) Record(card, "C-道具", "使用后意外败北");   // 烟雾弹逃跑 Win=null 豁免
            return;
        }
        if (kind == "bossOnly")
        {
            var game = new TestGame(new[] { card });
            var engine = BattleHarness.StartBoss(game);
            var s = engine.Snapshot;
            if (s.DeckSelection is null) { Record(card, "B-BOSS", "未进入编组牌库阶段"); return; }
            var cap = Math.Min(s.DeckSelection.Need, s.DeckSelection.Cards.Count);
            while (engine.Snapshot.DeckSelection is { } ds && ds.Selected.Count < cap)
            {
                var next = ds.Cards.FirstOrDefault(c => !ds.Selected.Contains(c.Uid));
                if (next is null) break;
                engine.SelectDeckCard(next.Uid);
            }
            engine.ConfirmDeck();
            s = engine.Snapshot;
            var uid = game.Owned[0].Uid;
            if (!s.Hand.Contains(uid))
            {
                // 「抽到时施放」类衍生牌抽到即结算：超过开场两条日志即视为已触发
                if (game.Logs.Count <= 2) Record(card, "B-BOSS", "编组后未进手牌也未结算");
            }
            else
            {
                var (before, after, _) = BattleHarness.PlayInBattle(game, engine, uid, card);
                if (after == before) Record(card, "B-BOSS", "零可观测效果");
            }
            if (engine.Snapshot.Busy) Record(card, "B-BOSS", "结算悬挂（busy 未清）");
            if (game.LastEnd is { Win: false }) Record(card, "B-BOSS", "打出后意外败北");
            return;
        }

        // kind === 'hand'
        var handGame = new TestGame(new[] { card }.Concat(fill));
        var handEngine = BattleHarness.Start(handGame);
        var hUid = handGame.Owned[0].Uid;
        if (!handEngine.Snapshot.Hand.Contains(hUid)) { Record(card, "A-手牌", "战斗卡未进手牌"); return; }
        var (hBefore, hAfter, hEnd) = BattleHarness.PlayInBattle(handGame, handEngine, hUid, card);
        if (hAfter == hBefore) Record(card, "A-手牌", "零可观测效果");
        if (hEnd.Busy) Record(card, "A-手牌", "结算悬挂（busy 未清）");
        if (handGame.LastEnd is { Win: false }) Record(card, "A-手牌", "打出后意外败北");
    }
}
