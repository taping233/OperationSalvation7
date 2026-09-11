using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Soudache;

/// <summary>Loads the exported cards.json without embedding card names or numbers in code.</summary>
public sealed class CardCatalog
{
    private readonly ContentRegistry<CardDefinition> _registry = new();
    public IReadOnlyList<CardDefinition> All => _registry.All;
    public int Count => _registry.Count;
    public bool TryGet(StableId id, out CardDefinition? definition) => _registry.TryGet(id, out definition);
    public CardDefinition GetRequired(StableId id) => _registry.GetRequired(id);

    public static CardCatalog Load(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) throw new ArgumentException("Card catalog JSON is required.", nameof(json));
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("cards", out var cards) || cards.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("Card catalog must contain a cards array.");
        var catalog = new CardCatalog();
        foreach (var card in cards.EnumerateArray()) catalog._registry.Register(ParseCard(card));
        return catalog;
    }

    public static CardCatalog LoadFile(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        return Load(File.ReadAllText(path));
    }

    public static CardDefinition ParseCard(JsonElement card)
    {
        var id = new StableId(ReadString(card, "id") ?? throw new InvalidDataException("Card id is required."));
        var name = ReadString(card, "name") ?? id.Value;
        var type = ParseType(ReadString(card, "type"));
        var cost = Math.Max(0, ReadInt(card, "cost"));
        var damage = ReadInt(card, "dmg");
        var block = Math.Max(0, ReadInt(card, "block"));
        var armor = Math.Max(0, ReadInt(card, "armor"));
        var heal = Math.Max(0, ReadInt(card, "heal"));
        var draw = Math.Max(0, ReadInt(card, "draw"));
        var infuse = Math.Max(0, ReadInt(card, "infuse"));
        var description = ReadString(card, "desc") ?? string.Empty;
        var className = ReadString(card, "cls");
        var dmgType = ParseDamageType(ReadString(card, "dmgType"));
        var effects = BuildEffects(damage, dmgType, type, block, armor, heal, draw, infuse, description);
        var onInfused = BuildTriggeredEffects(description, "被注能时");
        var onDraw = BuildTriggeredEffects(description, "抽到时施放");
        var specialId = SpecialFor(id.Value);
        var layer = type is CardType.Resource or CardType.Event || specialId?.StartsWith("run.", StringComparison.Ordinal) == true ? CardLayer.Run : CardLayer.Combat;
        return new CardDefinition(id, name, type, cost, damage, block, heal, draw,
            exhaustOnPlay: Regex.IsMatch(description, "(?:本牌|此牌|这张牌).*(?:消耗|耗尽)|(?:消耗|耗尽).*(?:本牌|此牌|这张牌)"),
            dmgType: dmgType, effects: effects, description: description, armor: armor, infuseCount: infuse, className: className,
            onInfusedEffects: onInfused, onDrawEffects: onDraw, specialId: specialId, layer: layer);
    }

    private static IReadOnlyList<CardEffect> BuildEffects(int damage, DamageType damageType, CardType type,
        int block, int armor, int heal, int draw, int infuse, string description)
    {
        var effects = new List<CardEffect>();
        var area = Regex.IsMatch(description, "所有敌人|敌方全体|全体敌人|对全体");
        var immediate = string.Join("，", description.Split(new[] { '。', '；', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(clause => !Regex.IsMatch(clause, "^(?:每回合开始时|回合开始时|下回合开始时?|下个回合开始时?|每回合结束时|回合结束时|注能\\s*[（(]|被注能时|抽到时施放)")));
        if ((damageType == DamageType.Attack || damage != 0) && (damage != 0 || damageType == DamageType.Attack))
        {
            var alternate = Regex.Match(description, "注能[^：:]*[：:]?[^。；]*改为\\s*(\\d+)").Groups[1];
            var bonus = Regex.Match(description, "注能[^：:]*[：:]?[^。；]*伤害\\s*\\+\\s*(\\d+)").Groups[1];
            int? altAmount = alternate.Success ? int.Parse(alternate.Value) : bonus.Success ? checked(damage + int.Parse(bonus.Value)) : null;
            var repeats = Regex.Match(description, "触发\\s*(\\d+)\\s*次").Groups[1];
            var repeat = repeats.Success && !description.Contains("注能", StringComparison.Ordinal) ? int.Parse(repeats.Value) : 1;
            var infusedRepeat = repeats.Success && description.Contains("注能", StringComparison.Ordinal) ? int.Parse(repeats.Value) : 1;
            effects.Add(CardEffect.Damage(damage, damageType, area ? EffectTarget.AllEnemies : EffectTarget.SelectedEnemy, altAmount, repeat, infusedRepeat, ParseCondition(description)));
        }
        if (block > 0) effects.Add(CardEffect.Block(block));
        if (armor > 0) effects.Add(CardEffect.Armor(armor));
        if (heal > 0) effects.Add(CardEffect.Heal(heal));
        if (draw > 0) effects.Add(CardEffect.Draw(draw));

        if (block == 0)
        {
            var bm = Regex.Match(immediate, "(?:获得|增加)\\s*(\\d+)\\s*点?格挡");
            if (bm.Success) effects.Add(CardEffect.Block(int.Parse(bm.Groups[1].Value)));
        }
        if (armor == 0)
        {
            var am = Regex.Match(immediate, "(?:获得|增加)\\s*(\\d+)\\s*点?护甲");
            if (am.Success) effects.Add(CardEffect.Armor(int.Parse(am.Groups[1].Value)));
        }
        if (draw == 0)
        {
            var dm = Regex.Match(immediate, "抽\\s*(\\d+)\\s*张");
            if (dm.Success) effects.Add(CardEffect.Draw(int.Parse(dm.Groups[1].Value)));
        }
        var em = Regex.Match(immediate, "获得\\s*(\\d+)\\s*点?能量");
        if (em.Success) effects.Add(CardEffect.Energy(int.Parse(em.Groups[1].Value)));
        var discover = Regex.Match(immediate, "(?:发现|随机获取|获取)\\s*(?:并直接施放\\s*)?(?:(\\d+)\\s*张?)?\\s*(其它职业|其他职业|装备|药水|武术|招式|法术|随机卡牌|卡牌)?");
        if (discover.Success && Regex.IsMatch(immediate, "发现|随机获取"))
        {
            var count = discover.Groups[1].Success ? int.Parse(discover.Groups[1].Value) : 1;
            var filter = discover.Groups[2].Success ? discover.Groups[2].Value : null;
            var otherClass = filter is "其它职业" or "其他职业" ? "OTHER" : null;
            if (filter is "随机卡牌" or "卡牌") filter = null;
            effects.Add(CardEffect.Discover(filter, otherClass, count, immediate.Contains("直接施放", StringComparison.Ordinal)));
        }
        if (Regex.IsMatch(immediate, "消耗所有手牌|消耗全部手牌"))
            effects.Add(new CardEffect(CardEffectKind.Exhaust, 0, target: EffectTarget.Hand));
        else if (Regex.IsMatch(immediate, "弃置所有手牌|弃弃所有手牌"))
            effects.Add(new CardEffect(CardEffectKind.Discard, 0, target: EffectTarget.Hand));

        AddStatus(effects, immediate, "流血", CombatStatus.Bleed, area);
        AddStatus(effects, immediate, "中毒", CombatStatus.Poison, area);
        AddStatus(effects, immediate, "冰冻|冻结", CombatStatus.Freeze, area);
        AddStatus(effects, immediate, "破甲", CombatStatus.ArmorBreak, area);
        AddStatus(effects, immediate, "沉默", CombatStatus.Silence, area);
        AddStatus(effects, immediate, "禁疗", CombatStatus.HealingBan, area);
        var pin = Regex.IsMatch(immediate, "目标下回合无法行动");
        if (pin) effects.Add(CardEffect.ApplyStatus(CombatStatus.Freeze, 1, 1, EffectTarget.SelectedEnemy));
        if (Regex.IsMatch(immediate, "所受伤害降为\\s*1|格挡")) effects.Add(CardEffect.Guard());
        if (Regex.IsMatch(immediate, "净化")) effects.Add(CardEffect.Purify());
        if (Regex.IsMatch(immediate, "潜行")) effects.Add(CardEffect.ApplyStatus(CombatStatus.Stealth, ReadDuration(immediate, 1), ReadDuration(immediate, 1), EffectTarget.Self));
        if (Regex.IsMatch(immediate, "免疫伤害|无敌")) effects.Add(CardEffect.ApplyStatus(CombatStatus.Immune, ReadDuration(immediate, 1), ReadDuration(immediate, 1), EffectTarget.Self));
        var reduce = Regex.Match(immediate, "减伤\\s*(\\d+)?");
        if (reduce.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.DamageReduction, reduce.Groups[1].Success ? int.Parse(reduce.Groups[1].Value) : 1, ReadDuration(description, 0), EffectTarget.Self));
        var curseCond = new EffectCondition(EffectConditionKind.TargetHasAnyCurse);
        var attackBuff = Regex.Match(immediate, "诅咒状态下[^。；]*攻(?:击力)?\\s*\\+\\s*(\\d+)");
        if (attackBuff.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.AttackUp, int.Parse(attackBuff.Groups[1].Value), 0, EffectTarget.Self, curseCond));
        var spellBuff = Regex.Match(immediate, "诅咒状态下[^。；]*法伤(?:害)?\\s*\\+\\s*(\\d+)");
        if (spellBuff.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.SpellUp, int.Parse(spellBuff.Groups[1].Value), 0, EffectTarget.Self, curseCond));
        var genericAttack = Regex.Match(immediate, "(?:获得\\s*)?(?:攻击力|攻)\\s*\\+\\s*(\\d+)|\\+\\s*(\\d+)\\s*攻");
        if (genericAttack.Success && !attackBuff.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.AttackUp, int.Parse(genericAttack.Groups[1].Success ? genericAttack.Groups[1].Value : genericAttack.Groups[2].Value), ReadDuration(description, 0), EffectTarget.Self));
        var genericSpell = Regex.Match(immediate, "法伤(?:害)?\\s*\\+\\s*(\\d+)");
        if (genericSpell.Success && !spellBuff.Success) effects.Add(CardEffect.ApplyStatus(CombatStatus.SpellUp, int.Parse(genericSpell.Groups[1].Value), ReadDuration(description, 0), EffectTarget.Self));
        if (Regex.IsMatch(immediate, "立即触发(?:一次)?毒伤")) effects.Add(CardEffect.TriggerPoison(area ? EffectTarget.AllEnemies : EffectTarget.SelectedEnemy));
        AddDelayedEffects(effects, description);
        return effects.AsReadOnly();
    }

    private static EffectCondition? ParseCondition(string text)
    {
        var absolute = Regex.Match(text, "(\\d+)\\s*血以下");
        if (absolute.Success) return new EffectCondition(EffectConditionKind.TargetHealthAtMost, threshold: int.Parse(absolute.Groups[1].Value));
        if (Regex.IsMatch(text, "血量一半及以下|生命一半及以下")) return new EffectCondition(EffectConditionKind.TargetHealthAtMostPercent, threshold: 50);
        if (Regex.IsMatch(text, "若[^。；]*(?:流血|出血)") && !Regex.IsMatch(text, "伤害\\s*\\+")) return new EffectCondition(EffectConditionKind.TargetHasStatus, CombatStatus.Bleed);
        if (Regex.IsMatch(text, "^诅咒状态下")) return new EffectCondition(EffectConditionKind.TargetHasAnyCurse);
        return null;
    }

    private static void AddDelayedEffects(List<CardEffect> effects, string description)
    {
        foreach (var clause in description.Split(new[] { '。', '；', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var match = Regex.Match(clause.Trim(), "^(每回合开始时|回合开始时|下回合开始时?|下个回合开始时?|每回合结束时|回合结束时)[:：，,]?\\s*(.+)$");
            if (!match.Success) continue;
            var body = match.Groups[2].Value;
            CardEffect? nested = null;
            var energy = Regex.Match(body, "获得\\s*(\\d+)\\s*点?能量");
            var heal = Regex.Match(body, "(?:回复|恢复)\\s*(\\d+)\\s*(?:点)?(?:生命|血)?");
            var draw = Regex.Match(body, "抽\\s*(\\d+)\\s*张");
            var armor = Regex.Match(body, "获得\\s*(\\d+)\\s*点?护甲");
            var selfDamage = Regex.Match(body, "受到\\s*(\\d+)\\s*点?伤害");
            var atk = Regex.Match(body, "攻击(?:力)?\\s*\\+\\s*(\\d+)");
            var spell = Regex.Match(body, "法伤(?:害)?\\s*\\+\\s*(\\d+)");
            if (energy.Success) nested = CardEffect.Energy(int.Parse(energy.Groups[1].Value));
            else if (heal.Success) nested = CardEffect.Heal(int.Parse(heal.Groups[1].Value));
            else if (draw.Success) nested = CardEffect.Draw(int.Parse(draw.Groups[1].Value));
            else if (armor.Success) nested = CardEffect.Armor(int.Parse(armor.Groups[1].Value));
            else if (selfDamage.Success) nested = CardEffect.Damage(int.Parse(selfDamage.Groups[1].Value), DamageType.Fixed, EffectTarget.Self);
            else if (atk.Success) nested = CardEffect.ApplyStatus(CombatStatus.AttackUp, int.Parse(atk.Groups[1].Value), 0, EffectTarget.Self);
            else if (spell.Success) nested = CardEffect.ApplyStatus(CombatStatus.SpellUp, int.Parse(spell.Groups[1].Value), 0, EffectTarget.Self);
            if (nested is not null)
            {
                var repeat = match.Groups[1].Value.StartsWith("每回合", StringComparison.Ordinal);
                effects.Add(CardEffect.Delayed(1, nested, repeat));
            }
        }
    }

    private static IReadOnlyList<CardEffect> BuildTriggeredEffects(string description, string trigger)
    {
        var effects = new List<CardEffect>();
        foreach (var clause in description.Split(new[] { '。', '；', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var triggerPattern = trigger == "被注能时" ? "(?:被注能时|注能\\s*[（(][^）)]*[）)])" : Regex.Escape(trigger);
            var match = Regex.Match(clause.Trim(), $"^{triggerPattern}[:：，,]?\\s*(.+)$");
            if (!match.Success) continue;
            var body = match.Groups[1].Value;
            var target = EffectTarget.SelectedEnemy;
            var area = Regex.IsMatch(body, "所有敌人|敌方全体|全体敌人");
            if (area) target = EffectTarget.AllEnemies;
            var damage = Regex.Match(body, "(?:造成|施放)\\s*(\\d+)\\s*点?(?:法术)?伤害");
            if (damage.Success) effects.Add(CardEffect.Damage(int.Parse(damage.Groups[1].Value), body.Contains("法术", StringComparison.Ordinal) ? DamageType.Spell : DamageType.Fixed, target));
            var notation = Regex.Match(body, "^\\s*(\\d+)\\s*′");
            if (notation.Success) effects.Add(CardEffect.Damage(int.Parse(notation.Groups[1].Value), DamageType.Spell, target));
            AddStatus(effects, body, "流血", CombatStatus.Bleed, area);
            AddStatus(effects, body, "中毒", CombatStatus.Poison, area);
            AddStatus(effects, body, "冰冻|冻结", CombatStatus.Freeze, area);
            AddStatus(effects, body, "沉默", CombatStatus.Silence, area);
            AddStatus(effects, body, "破甲", CombatStatus.ArmorBreak, area);
            AddStatus(effects, body, "禁疗", CombatStatus.HealingBan, area);
            if (Regex.IsMatch(body, "冰冻.*流血.*中毒"))
            {
                effects.Add(CardEffect.ApplyStatus(CombatStatus.Freeze, 1, 1, target));
                effects.Add(CardEffect.ApplyStatus(CombatStatus.Bleed, 1, 0, target));
                effects.Add(CardEffect.ApplyStatus(CombatStatus.Poison, 1, 0, target));
            }
        }
        return effects.AsReadOnly();
    }

    private static void AddStatus(List<CardEffect> effects, string text, string pattern, CombatStatus status, bool area)
    {
        var applies = status == CombatStatus.Freeze
            ? Regex.IsMatch(text, "(?:附加|施加)?\\s*(?:冰冻|冻结)(?:所有|\\s*[一二两三四五\\d]*\\s*名?)?(?:敌人|角色|持续|与|[，。；、]|$)")
            : Regex.IsMatch(text, $"(?:附加|施加|获得)\\s*[^。；]*{pattern}");
        if (!applies || Regex.IsMatch(text, "延长|免疫|对冰冻|冰冻角色")) return;
        var n = Regex.Match(text, $"(?:{pattern})\\s*(\\d+)\\s*层?").Groups[1];
        var amount = n.Success ? int.Parse(n.Value) : 1;
        var duration = ReadDuration(text, status is CombatStatus.Freeze or CombatStatus.Silence or CombatStatus.ArmorBreak or CombatStatus.HealingBan ? 1 : 0);
        effects.Add(CardEffect.ApplyStatus(status, amount, duration, area ? EffectTarget.AllEnemies : EffectTarget.SelectedEnemy));
    }

    private static int ReadDuration(string text, int fallback)
    {
        var match = Regex.Match(text, "(?:持续|状态)?\\s*(\\d+)\\s*回合");
        return match.Success ? int.Parse(match.Groups[1].Value) : fallback;
    }

    private static CardType ParseType(string? type) => type switch
    {
        "武术" => CardType.Attack,
        "法术" => CardType.Skill,
        "装备" => CardType.Equipment,
        "资源" => CardType.Resource,
        "事件" => CardType.Event,
        "能力卡" => CardType.Power,
        _ => CardType.Skill
    };

    private static string? SpecialFor(string id) => id switch
    {
        "cmtn1epgt20j" => "discover.infusion-free",
        "cmtn1gfhczzj" => "discover.curse-cards",
        "cmtn233trmeg" => "retain.uninfusable",
        "cc-doom" => "discover.curse-cards",
        "tt2-comboarrow" => "previous.attack-zero",
        "tt2-apollo" => "discover.trigger-apollo",
        "tt2-pouch" => "storage.three-slots",
        "tt2-turtlearmor" => "consume.equipment-armor",
        "cmtn2jc142dj" => "copy.random-hand-at-turn-start",
        "cmtn6ulm4boj" or "tt3-shadow-clone" or "tt7-recruit" => "summon.infantry",
        "cmtn79743r2n" => "door.random-curse",
        "cmtn7err0a7" => "door.random-blessing",
        "tt3-blooddrinker" => "trigger.kill-attack",
        "tt3-chaos-eye" => "combat.start-max-health",
        "tt3-copy-potion" => "potion.copy-mixed",
        "tt3-fate-potion" or "tt3sp-rageoil" => "potion.mix",
        "tt3-crimson-pouch" => "copy.selected-hand",
        "tt3-dig-treasure" => "discover.deck-bottom-price-armor",
        "tt3-flux-slash" => "copy.light-shadow-to-deck",
        "tt3-element-seal" => "infusion.unlock-element-seal",
        "tt3-frostfall" => "release.selected-attack",
        "tt3-mana-blood" => "trigger.spell-energy",
        "tt3-mystery-potion" => "transform.mystery-delayed",
        "tt3-fate-wheel" => "turn.extra",
        "tt3-magic-lamp" => "choice.magic-lamp",
        "tt3-reverse-bow" => "release.hand-arrows",
        "tt3-noon-duel" => "delayed.four-shots",
        "tt3-wolf-bow" => "grant.random-arrow",
        "tt3-thunderblast" => "damage.grave-spell-count",
        "tt3eq-boiler" => "discover.consume-up-to-two",
        "tt3eq-mistbox" => "transform.start-kill-to-random",
        "tt3sp-devour" => "kill.attack-at-most-four",
        "tt3sp-doom" => "kill.two-attack-at-most-five",
        "tt3sp-shadowbug" => "steal.attack-to-one",
        "tt3sp-bloodstorm" => "lifesteal.last-damage",
        "tt3wu-shike" => "lower.attack-two",
        "tt7-marchrush" => "repeat.last-hand",
        "tt7-elementstorm" => "spell.next-double",
        "tt7-holyheal" => "heal.infusion-price",
        "tt7-provoke" => "enemies.mutual-attack",
        "tt7-stratagem" => "storage.spell-slot",
        "tt7-twinfireball" => "grant.fireball-two",
        "tt7-meteorstrong" => "grant.fireball-three",
        "tt8-demonslay" => "draw.attack-all-and-cover-weapons",
        "tt8-hero-guardian" => "combat.energy-cap-plus-one",
        "tt8-hero-mage" => "hero.mage-passive",
        "tt8-hero-priest" => "hand.fill-spell-heal",
        "tt8-hero-summoner" => "choice.delayed-door",
        "tt8-hero-sword" => "draw-five-cast-melee",
        "tt8-hero-warlock" => "grant.curses-and-draw",
        "tt8-hero-warrior" => "transform.kill-to-dragonblade",
        "tt8-hero-ranger" => "grant.swords-to-deck",
        "tt2-treasuremap" or "tt4-smoke-bomb" or "tt6-airdrop" or "tt6-bandits" or "tt6-chestdraw" or "tt6-demondeal" or "tt6-goldhammer" or "tt6-goldmine" or "tt6-mystery" or "tt6-systemsupply" or "tt6-timeskip" => "run.special",
        _ => null
    };

    private static DamageType ParseDamageType(string? type) => type switch
    {
        "attack" => DamageType.Attack,
        "spell" => DamageType.Spell,
        "true" => DamageType.True,
        _ => DamageType.Fixed
    };

    private static string? ReadString(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int ReadInt(JsonElement obj, string key)
        => obj.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : 0;
}
