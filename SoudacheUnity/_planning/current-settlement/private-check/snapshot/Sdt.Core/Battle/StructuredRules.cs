using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Sdt.Core.Battle
{
    public interface BattleHostEffects
    {
        void GainCoins(int amount);
        void ChangeMaxHp(int amount);
    }
    public interface BattleContainerHost { bool ConsumeStoredCard(string uid); }
    public sealed class RuleChoiceSnapshot { public IReadOnlyList<string> labels; }
    public sealed class RuleHandSelectionSnapshot { public IReadOnlyList<string> candidateUids; public bool canCancel; }
    public sealed class EquipmentSnapshot { public string uid; public CardDef card; public bool canUse; public int? alternatingPhase; public bool alternatingTriggered; }
    public sealed class HeroSkillSnapshot { public string name, kind; public int cost, dmg, heal; public bool needsTarget, used; }

    public sealed partial class BattleSession
    {
        private sealed class RuleContext
        {
            public CardDef card; public string uid; public BattleFoe target; public int beforeHp, fuelCost, consumedCount;
            public bool infused, wasStealthed, lastHand, brokeStealth;
            public List<string> drawn = new List<string>();
        }
        private sealed class RuleRegistration { public CardDef card; public string uid; public int left = -1; }
        private sealed class RuleJob { public CardDef card; public RuleValue[] operations; public int turn; public BattleFoe target; public bool repeat; }
        private sealed class RuleMark { public BattleFoe target; public RuleValue operation; public CardDef card; }
        private sealed class RuleAlly : Combatant { public bool taunt, statless; }
        private sealed class RuleInfusionBonus { public int fuel, every, stacks; public string key; }
        private readonly List<RuleRegistration> registeredCards = new List<RuleRegistration>();
        private readonly List<EquipmentSnapshot> equippedCards = new List<EquipmentSnapshot>();
        private readonly HashSet<string> equipmentUsed = new HashSet<string>();
        private readonly HashSet<string> persistentRules = new HashSet<string>();
        private readonly List<RuleJob> ruleJobs = new List<RuleJob>();
        private readonly List<RuleMark> enemyMarks = new List<RuleMark>();
        private readonly List<RuleAlly> ruleAllies = new List<RuleAlly>();
        private readonly List<Action> ruleContinuations = new List<Action>();
        private readonly Dictionary<CardDef, int> growingCards = new Dictionary<CardDef, int>();
        private readonly HashSet<string> castOnDraw = new HashSet<string>();
        private readonly List<(UnitStatus status, string key, int original, int turn)> timedRuleStatuses = new List<(UnitStatus, string, int, int)>();
        private readonly List<(BattleFoe foe, int amount, int turn)> stolenAttackReturns = new List<(BattleFoe, int, int)>();
        private readonly List<RuleInfusionBonus> infusionBonuses = new List<RuleInfusionBonus>();
        private readonly Dictionary<string, (int firstTurn, int triggeredTurn)> alternatingRefunds = new Dictionary<string, (int, int)>();
        private RuleChoiceSnapshot ruleChoice;
        private RuleHandSelectionSnapshot ruleHandSelection;
        private Action<int> ruleChoiceAction;
        private Action<string> ruleHandAction;
        private Action<CardDef> structuredDiscoverAction;
        private RuleContext castContext;
        private int ruleDepth, rulePlayedMoves, rulePlayedMartial, ruleConsumedSpells, infusionTotal;
        private int turnMovesMax;
        private int deathSaves, temporaryDeckCap;
        private string previousCardType;
        private bool enemyDamageThisTurn, doubleNextSpell, extraTurn;
        private bool priestFlipped;
        private int heroUsedTurn;
        private int discoverExtra;
        private bool combiningHand, sealCombined;
        private int conditionalAttack, conditionalSpell;
        private readonly HashSet<string> infusionUnlocked = new HashSet<string>();
        private readonly List<(BattleFoe foe, int amount)> attackReductions = new List<(BattleFoe,int)>();
        private readonly HashSet<string> skipInfusionCards = new HashSet<string>();
        private readonly HashSet<object> acquiringRuleCards = new HashSet<object>();
        public bool RuleInputPending => ruleChoice != null || ruleHandSelection != null || discovering != null;

        private void InitializeStructuredBattle()
        {
            itemJobs.Clear();resolvingItemUid=null;
            registeredCards.Clear(); equippedCards.Clear(); equipmentUsed.Clear(); persistentRules.Clear(); ruleJobs.Clear();
            enemyMarks.Clear(); ruleAllies.Clear(); ruleContinuations.Clear(); growingCards.Clear(); castOnDraw.Clear(); timedRuleStatuses.Clear();
            stolenAttackReturns.Clear(); infusionBonuses.Clear(); alternatingRefunds.Clear();
            cardOverrides.Clear(); costDecayCards.Clear(); armorDecay = 0; lastAcquired = null;
            ruleChoice = null; ruleHandSelection = null; ruleChoiceAction = null; ruleHandAction = null; structuredDiscoverAction = null;
            ruleDepth = rulePlayedMoves = rulePlayedMartial = ruleConsumedSpells = infusionTotal = 0;
            turnMovesMax=0;bossTriggeredTurns.Clear();
            deathSaves = temporaryDeckCap = 0; previousCardType = null;
            enemyDamageThisTurn = doubleNextSpell = extraTurn = false; castContext = null;
            priestFlipped = false; heroUsedTurn = -1;
            discoverExtra = 0;
            combiningHand = sealCombined = false; conditionalAttack = conditionalSpell = 0; infusionUnlocked.Clear(); attackReductions.Clear();
            skipInfusionCards.Clear();
            acquiringRuleCards.Clear();
            if (mode == "boss")
            {
                foreach (var owned in G.OwnedCards)
                    if (sel.Contains(owned.uid) && IsBattleStartEquipment(owned.card) && equippedCards.Count < EquipmentCapacity())
                    {
                        RegisterEquipment(owned.uid, owned.card);
                        hand.Remove(owned.uid); drawPile.Remove(owned.uid); discard.Remove(owned.uid);
                        if (!consumed.Contains(owned.uid)) consumed.Add(owned.uid);
                        if (!grave.Contains(owned.uid)) grave.Add(owned.uid);
                        RunRuleOps(owned.card, owned.card.rules.Get("equip").Operations("battleStart").ToArray(), Alive().FirstOrDefault());
                    }
            }
        }
        private static bool IsMove(CardDef card) { return card != null && (card.type == "武术" || card.type == "法术"); }
        private static bool IsBattleStartEquipment(CardDef card) { return card?.rules?.Get("equip")?.Items("battleStart").Length > 0; }
        private int EquipmentCapacity() { return 2 + G.OwnedCards.Sum(owned => owned.card.rules?.Get("battle")?.Number("ownedEquipCapacity") ?? 0); }
        private int BossDeckMinimum() { return Math.Min(GameRules.BossDeckSize, selPool.Count(entry => !IsBattleStartEquipment(entry.card)) + Math.Min(EquipmentCapacity(),selPool.Count(entry => IsBattleStartEquipment(entry.card)))); }
        private int BossDeckMaximum(HashSet<string> selected = null)
        {
            selected = selected ?? sel;
            return GameRules.BossDeckSize + selPool.Where(entry => selected.Contains(entry.uid)).Sum(entry =>
                (entry.card.rules?.Get("equip")?.Operations("battleStart") ?? Array.Empty<RuleValue>()).Where(op => op.Text("op")=="deckCap").Sum(op => op.Number("n")));
        }
        private static bool RequiresInfusion(CardDef card)
        {
            if (card.rules?.Get("battle")?.Operations("requirements").Any(rule => rule.Text("kind")=="infused") == true) return true;
            if (card.rules != null) return false;
            return (card.desc??"").TrimStart().StartsWith("注能") && (card.dmg??0)==0 && (card.heal??0)==0 && (card.armor??0)==0;
        }
        public CommandResult SkipInfusion()
        {
            if (infusing==null || RequiresInfusion(infusing.card)) return CommandResult.No("本牌需要先注能");
            var uid=infusing.uid; var targetIndex=infusing.targetIndex; infusing=null; skipInfusionCards.Add(uid);
            return PlayCard(uid,targetIndex,false);
        }
        private IReadOnlyList<EquipmentSnapshot> EquipmentState()
        {
            return equippedCards.Select(entry =>
            {
                var refund = entry.card.rules?.Get("equip")?.Get("passive")?.Get("alternatingRefund");
                int count = refund?.Items("types").Length ?? 0;
                var state = alternatingRefunds.TryGetValue(entry.uid, out var stored) ? stored : (firstTurn:turn, triggeredTurn:-1);
                return new EquipmentSnapshot { uid = entry.uid, card = entry.card,
                    canUse = !equipmentUsed.Contains(entry.uid) && entry.card.rules?.Get("equip")?.Get("skill") != null,
                    alternatingPhase = count > 0 ? (int?)(Math.Abs(turn-state.firstTurn)%count) : null,
                    alternatingTriggered = state.triggeredTurn == turn };
            }).ToList();
        }
        private void RegisterCard(CardDef card, string uid = null)
        {
            if (registeredCards.Any(entry => entry.uid == uid && uid != null)) return;
            if (card.rules?.Get("triggers") == null) return;
            registeredCards.Add(new RuleRegistration { card = card, uid = uid,
                left = card.rules.Get("triggers").Number("duration", -1) });
        }
        private void RegisterEquipment(string uid, CardDef card)
        {
            if (equippedCards.Any(entry => entry.uid == uid)) return;
            equippedCards.Add(new EquipmentSnapshot { uid = uid, card = card });
            RegisterCard(card, uid);
            var equip = card.rules?.Get("equip");
            if (equip?.Get("passive")?.Get("alternatingRefund") != null) alternatingRefunds[uid] = (turn, -1);
            RunRuleOps(card, equip?.Operations("onEquip").ToArray() ?? Array.Empty<RuleValue>(), Alive().FirstOrDefault());
            var aura = equip?.Get("passive")?.Get("aura");
            if (equip?.Get("passive")?.Get("cond") == null && aura != null)
            {
                pstat.status.atkUp += aura.Number("atk"); pstat.status.spellUp += aura.Number("spellPower");
                temporaryDeckCap += aura.Number("deckCap");
            }
        }
        public CommandResult UseEquipment(string uid)
        {
            if (over || busy || RuleInputPending) return CommandResult.No("当前不能使用装备");
            var entry = equippedCards.FirstOrDefault(item => item.uid == uid);
            var skill = entry?.card.rules?.Get("equip")?.Get("skill");
            if (skill == null || equipmentUsed.Contains(uid)) return CommandResult.No("装备技能不可用");
            if (skill.Flag("oncePerBattle")) equipmentUsed.Add(uid);
            BeginRuleCast(entry.card, Alive().FirstOrDefault(), new List<string>());
            RunRuleOps(entry.card, skill.Operations("ops").ToArray(), Alive().FirstOrDefault());
            ResolveRuleOutcome(); RequestRender(); return CommandResult.Yes();
        }
        public CommandResult ChooseRuleOption(int index)
        {
            if (ruleChoice == null || index < 0 || index >= ruleChoice.labels.Count) return CommandResult.No("选择已失效");
            var action = ruleChoiceAction; ruleChoice = null; ruleChoiceAction = null;
            action(index); ResumeRules(); ResolveRuleOutcome(); RequestRender(); return CommandResult.Yes();
        }
        public CommandResult SelectRuleHand(string uid)
        {
            if (ruleHandSelection == null || !ruleHandSelection.candidateUids.Contains(uid) || !hand.Contains(uid)) return CommandResult.No("手牌选择已失效");
            var action = ruleHandAction; ruleHandSelection = null; ruleHandAction = null;
            action(uid); ResumeRules(); ResolveRuleOutcome(); RequestRender(); return CommandResult.Yes();
        }
        private void ResumeRules()
        {
            while (!RuleInputPending && ruleContinuations.Count > 0)
            {
                var index = ruleContinuations.Count - 1; var next = ruleContinuations[index]; ruleContinuations.RemoveAt(index); next();
            }
            CompletePlayerResolution();
        }
        private void CompletePlayerResolution()
        {
            if(!over && _phase=="resolving" && !RuleInputPending && ruleContinuations.Count==0) _phase="player";
        }
        private void ResolveRuleOutcome()
        {
            if (over) return;
            if (G.Hp <= 0) Finish(false); else if (Alive().Count == 0) Finish(true);
        }
        private void BeginRuleCast(CardDef card, BattleFoe target, List<string> fuel)
        {
            castContext = new RuleContext { card = card, target = target, beforeHp = target?.hp ?? 0,
                infused = fuel.Count > 0 || persistentRules.Contains("allSpellsInfused") && IsMove(card),
                fuelCost = fuel.Sum(uid => FindCard(uid)?.card.cost ?? 0), consumedCount = fuel.Count,
                wasStealthed = pstat?.status.stealth > 0, lastHand = hand.Count <= fuel.Count + 1 };
        }
        private void CompleteRuleCast(CardDef card)
        {
            bool firstOfType = card.type == "武术" ? rulePlayedMartial == 0 : card.type == "法术" && rulePlayedMoves - rulePlayedMartial == 0;
            if (firstOfType) foreach (var entry in equippedCards)
            {
                var refund = entry.card.rules?.Get("equip")?.Get("passive")?.Get("alternatingRefund");
                var types = refund?.Items("types") ?? Array.Empty<object>();
                if (types.Length == 0) continue;
                if (!alternatingRefunds.TryGetValue(entry.uid, out var state)) state = (turn, -1);
                var required = types[Math.Abs(turn - state.firstTurn) % types.Length] as string;
                if (state.triggeredTurn != turn && card.type == required)
                {
                    energy += refund.Number("amount", 1);
                    alternatingRefunds[entry.uid] = (state.firstTurn, turn);
                }
            }
            if (IsMove(card)) rulePlayedMoves++;
            turnMovesMax=Math.Max(turnMovesMax,rulePlayedMoves);
            if (card.type == "武术") rulePlayedMartial++;
            previousCardType = card.type;
        }
        private int StructuredCost(CardDef card)
        {
            int cost = card.cost;
            foreach (var modifier in card.rules?.Get("battle")?.Operations("costModifiers") ?? Array.Empty<RuleValue>())
                switch (modifier.Text("kind"))
                {
                    case "previousCardTypeFree": if (previousCardType == modifier.Text("type")) cost = 0; break;
                    case "armorZeroFree": if (pdef == null || pdef.Armor == 0) cost = 0; break;
                    case "martialPlayedDiscount": cost -= rulePlayedMartial * modifier.Number("amount", 1); break;
                    case "consumedSpellDiscount": cost -= ruleConsumedSpells * modifier.Number("amount", 1); break;
                }
            return Math.Max(0, cost);
        }
        private string StructuredRequirement(CardDef card)
        {
            if (IsBattleStartEquipment(card)) return "开战装备只能在首脑战编组时选择";
            if (card.type == "装备" && equippedCards.Count >= EquipmentCapacity()) return "装备栏已满";
            foreach (var requirement in card.rules?.Get("battle")?.Operations("requirements") ?? Array.Empty<RuleValue>())
            {
                if (requirement.Text("kind") == "unplayable") return "这张卡不能直接使用";
                if (requirement.Text("kind") == "handCards" && hand.Count(uid => FindCard(uid)?.card.type == requirement.Text("type")) < requirement.Number("count", 1)) return "手牌不满足使用条件";
            }
            return null;
        }
        private bool ResolveStructuredCard(CardDef card, BattleFoe target)
        {
            if (card.rules == null) return false;
            if (card.type == "装备")
            {
                var owned = G.OwnedCards.Concat(granted).FirstOrDefault(entry => entry.card == card);
                RegisterEquipment(owned?.uid ?? NewTmpUid("equip"), card); return true;
            }
            var triggers = card.rules.Get("triggers");
            if (triggers?.Has("onPlay") != true) return false;
            RegisterCard(card, castContext?.card==card ? castContext.uid : G.OwnedCards.Concat(granted).FirstOrDefault(entry => entry.card == card)?.uid);
            bool doubled = card.type=="法术" && doubleNextSpell;
            if(doubled) doubleNextSpell=false;
            var operations=triggers.Operations("onPlay").ToArray(); int continuationBase=ruleContinuations.Count;
            RunRuleOps(card, operations, target);
            int repeats=(doubled?1:0)+(triggers.Get("replay")?.Text("on")=="lastHand" && castContext?.lastHand==true?triggers.Get("replay").Number("times",1):0);
            if(repeats>0)
            {
                var context=castContext;
                Action replay=()=>{var previous=castContext;castContext=context;for(int i=0;i<repeats;i++)RunRuleOps(card,operations,target);castContext=previous;};
                if(RuleInputPending)ruleContinuations.Insert(continuationBase,replay);else replay();
            }
            return true;
        }
        private void RunStructuredTrigger(CardDef card, string trigger, BattleFoe target)
        {
            RunRuleOps(card, card.rules?.Get("triggers")?.Operations(trigger).ToArray() ?? Array.Empty<RuleValue>(), target);
        }
        private void FireRuleAcquire(CardDef card)
        {
            if (card.rules?.Get("triggers")?.Operations("onAcquire").Any() != true) return;
            object key = (object)card.id ?? card;
            if (!acquiringRuleCards.Add(key)) return;
            try { RunStructuredTrigger(card, "onAcquire", Alive().FirstOrDefault()); }
            finally { acquiringRuleCards.Remove(key); }
        }
        private void FireStructuredTrigger(string trigger, BattleFoe target = null)
        {
            if (pstat.status.silence > 0) return;
            foreach (var registered in registeredCards.ToArray())
            {
                if (registered.left == 0) continue;
                var ops = registered.card.rules?.Get("triggers")?.Operations(trigger).ToArray();
                if (ops == null || ops.Length == 0) continue;
                RunRuleOps(registered.card, ops, target ?? Alive().FirstOrDefault());
                if (registered.left > 0) registered.left--;
            }
        }
        private bool Condition(RuleValue condition, BattleFoe target)
        {
            if (condition == null) return true;
            if (condition.Has("infused") && condition.Flag("infused") != (castContext?.infused == true)) return false;
            if (condition.Has("targetStatus") && (target?.status.Get(condition.Text("targetStatus")) ?? 0) <= 0) return false;
            if (condition.Has("foeStatus") && (target?.status.Get(condition.Text("foeStatus")) ?? 0) <= 0) return false;
            if (condition.Flag("anyCurse") && (target == null || !CombatResolver.HasCurse(target))) return false;
            if (condition.Flag("playerStealthed") && castContext?.wasStealthed != true) return false;
            if (condition.Flag("brokeStealth") && castContext?.brokeStealth != true) return false;
            if (condition.Flag("foeHpHalf") && (target == null || target.hp * 2 > target.maxHp)) return false;
            if (condition.Has("foeHpBelow") && (target == null || target.hp > condition.Number("foeHpBelow"))) return false;
            if (condition.Flag("targetUndamagedBeforeCast") && (target == null || castContext?.beforeHp != target.maxHp)) return false;
            return true;
        }
        private int Amount(CardDef card, RuleValue operation, string field = "amount", int fallback = 0)
        {
            if (operation.Has(field)) return operation.Number(field);
            string source = operation.Text("amountField");
            if (source != null) switch (source) { case "dmg": return card.dmg ?? 0; case "heal": return card.heal ?? 0; case "armor": return card.armor ?? 0; case "draw": return card.draw ?? 0; }
            var range = operation.Items("range");
            if (range.Length == 2) return (int)range[0] + (int)Math.Floor(rng.Random("generation") * ((int)range[1] - (int)range[0] + 1));
            return fallback;
        }
        private List<BattleFoe> RuleTargets(RuleValue operation, BattleFoe target)
        {
            var alive = Alive();
            if (operation.Text("target") == "allEnemies") return alive;
            if (operation.Text("target") == "randomEnemy") return alive.Count > 0 ? new List<BattleFoe> { alive[(int)(rng.Random("target") * alive.Count)] } : new List<BattleFoe>();
            if (target == null || target.dead) target = alive.FirstOrDefault();
            return target == null ? new List<BattleFoe>() : new List<BattleFoe> { target };
        }
        private void RunRuleOps(CardDef card, RuleValue[] operations, BattleFoe target, int index = 0)
        {
            if (++ruleDepth > 48) { ruleDepth--; throw new InvalidOperationException("规则递归超过安全上限"); }
            try
            {
                for (int i = index; i < operations.Length && !over; i++)
                {
                    var operation = operations[i];
                    if (!Condition(operation.Get("when"), target) || !Condition(operation.Get("cond"), target)) continue;
                    if (pstat.status.silence > 0 && card.rules?.Get("battle")?.Flag("ignoresSilence") != true && operation.Text("op") != "damage") continue;
                    if (operation.Has("schedule"))
                    {
                        var deferred = RuleValue.Obj(); foreach (var entry in operation.Values) if (entry.Key != "schedule") deferred.Values[entry.Key] = entry.Value;
                        ruleJobs.Add(new RuleJob { card = card, operations = new[] { deferred }, turn = turn + 1, target = target }); continue;
                    }
                    int continuationBase = ruleContinuations.Count;
                    ApplyRuleOperation(card, operation, target);
                    if (RuleInputPending)
                    {
                int next = i + 1; var context=castContext;
                if (next < operations.Length) ruleContinuations.Insert(continuationBase, () => { var previous=castContext;castContext=context;RunRuleOps(card, operations, target, next);castContext=previous; });
                        break;
                    }
                }
            }
            finally { ruleDepth--; }
        }

        private void ApplyRuleOperation(CardDef card, RuleValue op, BattleFoe target)
        {
            int n;
            switch (op.Text("op"))
            {
                case "damage": ApplyRuleDamage(card, op, target); break;
                case "heal":
                    if (op.Has("selfDamage")) { DamagePlayer(op.Number("selfDamage")); break; }
                    n = op.Has("perFuelCost") ? (castContext?.fuelCost ?? 0) * op.Number("perFuelCost") : Amount(card, op);
                    if (op.Has("upTo")) n = Math.Min(op.Number("upTo"), G.MaxHp - G.Hp);
                    if (pstat.status.healban == 0) G.Heal(n); break;
                case "armor":
                    n = Amount(card, op); if (op.Text("priceOf") == "discovered") n = lastAcquired == null ? 0 : CardPrice(lastAcquired);
                    var bonus = op.Get("bonus"); if (bonus?.Text("if") == "noEnemyDamageThisTurn" && !enemyDamageThisTurn) n += bonus.Number("amount");
                    pdef.Armor += n; if (op.Flag("guard")) pdef.Guard = true;
                    if (op.Has("decayAtTurnEnd")) armorDecay += op.Number("decayAtTurnEnd"); break;
                case "draw":
                    n = Amount(card, op);
                    if (op.Has("untilHandN")) n = Math.Max(0, op.Number("untilHandN") - hand.Count);
                    if (op.Flag("perCurseKinds")) n = target == null ? 0 : CombatResolver.Curses.Count(key => target.status.Get(key) > 0);
                    if (op.Flag("perConsumed")) n = castContext?.consumedCount ?? 0;
                    var filter = op.Get("filter");
                    if (filter != null) DrawFiltered(n, filter.Text("type")); else DrawCards(n); break;
                case "energy": energy += op.Number("n", Amount(card, op)); break;
                case "energyCap": maxEnergy += op.Number("n", 1); energy += op.Number("n", 1); break;
                case "refillEnergy": energy = maxEnergy; break;
                case "noDrawNext": noDrawNext = true; break;
                case "curse": ApplyRuleCurse(card, op, target); break;
                case "status": foreach (var foe in RuleTargets(op, target)) AddRuleStatus(foe, op.Text("status"), op.Number("duration", 1)); break;
                case "blessing":
                    var key = op.Text("key"); n = op.Number("stacks", op.Number("duration", 1));
                    if ((key == "atkUp" || key == "spellUp") && Alive().Any(foe => foe.eliteSkill == "blockPowerGain")) break;
                    int original = pstat.status.Get(key); CombatResolver.AddBlessing(pstat, key, n);
                    if (op.Has("duration") && (key == "atkUp" || key == "spellUp" || key == "reduce" || key == "dodge")) timedRuleStatuses.Add((pstat.status, key, pstat.status.Get(key)-original, turn + op.Number("duration")));
                    break;
                case "cleanse":
                    if (op.Text("target") == "allEnemies") foreach (var foe in Alive()) CombatResolver.Purify(foe); else CombatResolver.Purify(pstat); break;
                case "adjustCurse":
                    foreach (var foe in RuleTargets(op, target))
                    {
                        var curse = op.Text("curse");
                        if (op.Number("multiply") > 1 && foe.status.Get(curse) > 0) CombatResolver.AddCurse(foe, curse, foe.status.Get(curse) * (op.Number("multiply") - 1));
                        for (int i = 0; i < op.Number("burst") && !foe.dead; i++)
                        {
                            CombatResolver.TickPoison(foe);
                            if (foe.hp <= 0) { foe.dead = true; FireEnemyMarks(foe, "death"); OnEliteDeath(foe); FireStructuredTrigger("onKill", foe); }
                        }
                    } break;
                case "registerRule": RegisterRuleName(card, op); break;
                case "removeRule": persistentRules.Remove(op.Text("rule")); break;
                case "expireCard": ConsumeRuleHand(op.Text("uid")); break;
                case "registerInfusionBonus": infusionBonuses.Add(new RuleInfusionBonus { every = op.Number("every", 2), key = op.Text("key", "spellUp"), stacks = op.Number("stacks", 1) }); break;
                case "acquire": AcquireRuleCards(card, op, target); break;
                case "discover": StartStructuredDiscover(card, op, target); break;
                case "choice": StartRuleChoice(card, op, target); break;
                case "handSelect": StartRuleHandSelect(card, op, target); break;
                case "schedule": ruleJobs.Add(new RuleJob { card = card, operations = op.Operations("ops").ToArray(), target = target, turn = turn + op.Number("delay", 1) }); break;
                case "freezeFirstEnemies": foreach (var foe in Alive().Take(op.Number("count", 2))) AddRuleStatus(foe, "freeze", op.Number("duration", 1)); break;
                case "stealAtk":
                    foreach (var foe in RuleTargets(op, target))
                    {
                        int stolen = op.Has("capTo") ? Math.Max(0, foe.atk - op.Number("capTo")) : Math.Min(foe.atk, op.Number("amount", 1));
                        if (stolen <= 0) continue;
                        int expires = turn + op.Number("duration", 1);
                        foe.atk -= stolen; pstat.status.atkUp += stolen;
                        stolenAttackReturns.Add((foe, stolen, expires));
                        timedRuleStatuses.Add((pstat.status, "atkUp", stolen, expires));
                    } break;
                case "execute": ExecuteRule(card, op, target); break;
                case "transform":
                    var into = CardLibrary.FindByName(op.Text("into"));
                    if (into != null) foreach (var owned in G.OwnedCards.Concat(granted).Where(entry => entry.card.name == "初始攻击").ToArray()) cardOverrides[owned.uid] = into.Clone(); break;
                case "maxHp": if (G is BattleHostEffects host) host.ChangeMaxHp(op.Number("n")); break;
                case "deckCap": temporaryDeckCap += op.Number("n"); break;
                case "consumeHand":
                    if (op.Value("trigger") is bool flag && !flag) { discard.AddRange(hand); hand.Clear(); }
                    else foreach (var uid in hand.ToArray()) ConsumeRuleHand(uid); break;
                case "release":
                    if (op.Text("source") == "generated") { var created = CardLibrary.FindByName(op.Text("key")); if (created != null) CastRuleCard(created, target); }
                    else CastRuleHandBatch(hand.Where(uid => FindCard(uid)?.card.name.Contains(op.Text("key", "")) == true).ToArray(), target, op.Number("eachDraw"), op.Number("max")); break;
                case "extraTurn": extraTurn = true; break;
                case "flee": Finish(null); break;
                case "foeFight":
                    var pair = Alive().Take(2).ToArray(); if (pair.Length == 2) { ApplyRuleRawHit(card, pair[1], pair[0].atk, CombatResolver.FIXED, false); if (!pair[0].dead) ApplyRuleRawHit(card, pair[0], pair[1].atk, CombatResolver.FIXED, false); } break;
                case "insertCards": foreach (var id in op.Items("ids")) { var inserted = CardLibrary.FindById((string)id); if (inserted != null) AddDeckCard(inserted); } if (op.Flag("shuffle")) drawPile = DeckOps.ShuffleCards(drawPile, rng); break;
                case "fillHand":
                    int spells = 0;
                    while (hand.Count < op.Number("untilHandN", 6))
                    {
                        var template = RandomDiscoverCard(null); if (template == null) break;
                        int before = hand.Count; AddTempCard(template); if (hand.Count <= before) break;
                        if (template.type == "法术") spells++;
                    }
                    if (spells > 0 && pstat.status.healban == 0) G.Heal(spells * op.Number("perSpellHeal")); break;
                case "castDrawn": CastRuleHandBatch((castContext?.drawn ?? new List<string>()).Where(uid => FindCard(uid)?.card.type == op.Text("type")).ToArray(), target); break;
                case "copyRandom":
                    var copy = RandomRuleCard(hand.Select(uid => FindCard(uid)?.card).Where(candidate => candidate != null).ToList()); if (copy != null) AddTempCard(copy); break;
                case "castRandomSpells":
                    CastRuleGeneratedBatch(() => RandomRuleCard(CardLibrary.All().Where(candidate => candidate.type == "法术" && candidate.id != card.id && CardLibrary.IsRandomObtainable(candidate)).ToList()), op.Number("count", 1), target, op.Flag("infused")); break;
                case "summon": for (int i = 0; i < op.Number("count", 1); i++) ruleAllies.Add(new RuleAlly { name = op.Text("name"), hp = op.Number("hp"), maxHp = op.Number("hp"), atk = op.Number("atk"), taunt = op.Flag("taunt"), statless = op.Flag("statless") }); break;
                case "recruitEnemy":
                    var recruit = RuleTargets(op, target).FirstOrDefault();
                    if (recruit != null && !(op.Flag("excludeBoss") && mode == "boss") && (!op.Flag("wounded") || recruit.hp < recruit.maxHp)) { ruleAllies.Add(new RuleAlly { name = recruit.name, hp = recruit.hp, maxHp = recruit.maxHp, atk = recruit.atk }); recruit.dead = true; } break;
                case "markEnemy": foreach (var foe in RuleTargets(op, target)) enemyMarks.Add(new RuleMark { target = foe, card = card, operation = op }); break;
                case "restoreHeroSkill": heroUsedTurn = -1; break;
                case "discoverCopies":
                    StartStructuredDiscover(card, RuleValue.Obj("pool", RuleValue.Obj("kind", "types", "types", RuleValue.Arr(op.Text("type")), "randomEligible", true)), target,
                        chosen => { for (int i = 0; i < op.Number("copies", 2); i++) castOnDraw.Add(AddDeckCard(chosen)); drawPile = DeckOps.ShuffleCards(drawPile, rng); }); break;
                case "transformCards": TransformRuleCards(op); break;
                case "randomCurse": RandomRuleCurse(op, target); break;
                case "randomBlessing": RandomRuleBlessing(op); break;
                case "swapDiscoverCosts": StartSwapDiscoverCosts(card, target); break;
                case "restoreConsumed": RestoreRuleConsumed(op.Number("amount", 1)); break;
                case "castStored":
                    CastStoredRuleCard(target); break;
                default: throw new InvalidOperationException("尚未移植的结构化操作：" + op.Text("op") + " / " + card.id);
            }
        }
        private readonly Dictionary<string, CardDef> cardOverrides = new Dictionary<string, CardDef>();
        private OwnedCard OverrideCard(OwnedCard owned) { return cardOverrides.TryGetValue(owned.uid, out var card) ? new OwnedCard { uid = owned.uid, card = card, brought = owned.brought, safe = owned.safe, stored = owned.stored, pouchOf = owned.pouchOf } : owned; }
        private CardDef lastAcquired;
        private int armorDecay;
        private static int CardPrice(CardDef card) { return CardLibrary.Price.TryGetValue(card.rarity ?? "", out int price) ? price : Math.Max(0, card.value ?? 0); }
        private CardDef RandomRuleCard(List<CardDef> pool) { return pool.Count == 0 ? null : pool[(int)(rng.Random("generation") * pool.Count)]; }
        private void RegisterRuleName(CardDef card, RuleValue op)
        {
            string rule = op.Text("rule"); bool existed=persistentRules.Contains(rule); persistentRules.Add(rule);
            if (rule == "moveCost1") spellCost1 = true;
            if (rule == "doubleNextSpell") doubleNextSpell = true;
            if (rule == "deathSave") deathSaves = op.Number("n");
            if (rule == "growth") growingCards[card] = 0;
            if (rule == "discoverPlus") discoverExtra++;
            if (!op.Has("duration")) ruleJobs.RemoveAll(job=>job.operations.Any(operation=>operation.Text("op")=="removeRule"&&operation.Text("rule")==rule));
            if (op.Has("duration") && !existed) ruleJobs.Add(new RuleJob { card = card, turn = turn + op.Number("duration"),
                operations = new[] { RuleValue.Obj("op", "removeRule", "rule", rule) } });
        }
        private void ApplyRuleDamage(CardDef card, RuleValue op, BattleFoe chosen)
        {
            int count = op.Number("hitCount", 1); var hits = op.Get("hits");
            if (hits != null) { count = Amount(card, hits, "count", 1); if (hits.Flag("perPlayedMoves")) count = rulePlayedMoves; }
            if (count <= 0) return;
            int repeats = 1;
            for (int repeat = 0; repeat < repeats; repeat++)
            for (int hit = 0; hit < count; hit++)
            {
                var targets = RuleTargets(op, chosen);
                using var presentationGroup = BeginActorDamageGroup(card, op.Text("dmgType", card.dmgType ?? (card.type == "法术" ? "spell" : "fixed")), count);
                foreach (var foe in targets)
                {
                    int amount = Amount(card, op); string type = op.Text("dmgType", card.dmgType ?? (card.type == "法术" ? "spell" : "fixed"));
                    if (op.Has("infuseBonus") && castContext?.infused == true) amount += op.Number("infuseBonus");
                    if (op.Has("perInfusedInHand")) amount += op.Number("perInfusedInHand") * hand.Count(uid => InfuseOf(FindCard(uid)?.card ?? CardLibrary.SHA) > 0);
                    if (op.Has("spellPowerMul")) amount += (op.Number("spellPowerMul") - 1) * (G.SpellPower + pstat.status.spellUp);
                    var graveRule = op.Get("graveyard"); if (graveRule != null) amount += grave.Count(uid => FindCard(uid)?.card.type == graveRule.Text("type")) * graveRule.Number("perCard", 1);
                    if (op.Flag("perTargetPrice")) amount = castContext?.drawn?.Count > 0 ? CardPrice(FindCard(castContext.drawn.Last())?.card ?? card) : 0;
                    var bonus = op.Get("bonus"); if (bonus != null && Condition(bonus.Get("if"), foe)) { amount += bonus.Number("amount"); if (bonus.Has("pct")) amount += (int)Math.Floor((amount + (type == "attack" ? G.Atk + pstat.status.atkUp : 0)) * bonus.Number("pct") / 100d); }
                    foreach (var equip in equippedCards) if (foe.status.freeze > 0) amount += equip.card.rules?.Get("equip")?.Get("passive")?.Get("cond")?.Number("vsFreeze") ?? 0;
                    bool wasAlive = !foe.dead; int dealt = ApplyRuleRawHit(card, foe, amount, type, op.Flag("nonLethal"));
                    if (op.Flag("lifesteal") && pstat.status.healban == 0) G.Heal(dealt);
                    if (foe.dead && wasAlive)
                    {
                        var onKill = op.Get("onKill"); if (onKill != null) { pdef.Armor += onKill.Number("armor"); energy += onKill.Number("energy"); if (onKill.Number("coins")>0&&G is BattleHostEffects host) host.GainCoins(onKill.Number("coins")); }
                    }
                    var recast = op.Get("recast");
                    if (recast != null && (recast.Text("on") == "kill" && foe.dead || recast.Text("on") == "lastHand" && castContext?.lastHand == true))
                        for (int i = 0; i < recast.Number("times", 1) && Alive().Count > 0; i++) ApplyRuleRawHit(card, foe.dead ? Alive()[0] : foe, amount, type, op.Flag("nonLethal"));
                }
            }
        }
        private int ApplyRuleRawHit(CardDef card, BattleFoe foe, int amount, string type, bool nonLethal)
        {
            if (foe == null || foe.dead) return 0;
            SyncConditionalEquipment();
            if(persistentRules.Contains("stealthStrike")&&pstat.status.stealth>0)
            {
                int added=type=="attack"?G.Atk+pstat.status.atkUp+foe.status.bleed:type=="spell"?G.SpellPower+pstat.status.spellUp:0;
                amount=Math.Max(0,amount+added)*2-added;
            }
            if (nonLethal) { var preview = CombatResolver.PreviewDamage(new Combatant { atk = G.Atk, spellPower = G.SpellPower, status = pstat.status }, foe, amount, type); amount -= Math.Max(0, preview.dealt - Math.Max(0, foe.hp - 1)); }
            bool wasAlive = !foe.dead; bool wasStealthed = pstat.status.stealth > 0;
            int dealt = HitFoe(foe, card, amount, type, "");
            if (castContext != null && wasStealthed && pstat.status.stealth == 0) castContext.brokeStealth = true;
            if (dealt > 0 && card.type == "法术" && persistentRules.Contains("poisonOnSpell")) AddRuleStatus(foe, "poison", 1);
            FireEnemyMarks(foe, dealt > 0 ? "damaged" : null);
            if (wasAlive && foe.dead) { FireEnemyMarks(foe, "death"); FireStructuredTrigger("onKill", foe); OnEliteDeath(foe); }
            return dealt;
        }
        private void AddRuleStatus(BattleFoe foe, string curse, int n)
        {
            if (foe == null || foe.dead) return;
            CombatResolver.AddCurse(foe, curse, n);
            if (curse == "freeze") FireStructuredTrigger("onFreezeDealt", foe);
            if (foe.eliteSkill == "curseHeal" && foe.status.healban == 0) foe.hp = Math.Min(foe.maxHp, foe.hp + 2);
        }
        private void ApplyRuleCurse(CardDef card, RuleValue op, BattleFoe target)
        {
            foreach (var foe in RuleTargets(op, target))
            {
                if (op.Text("source") == "handMoves")
                {
                    foreach (var uid in hand) foreach (var other in FindCard(uid)?.card.rules?.Get("triggers")?.Operations("onPlay") ?? Array.Empty<RuleValue>()) if (other.Text("op") == "curse" && other.Text("curse") != null) AddRuleStatus(foe, other.Text("curse"), other.Number("stacks", other.Number("duration", 1)));
                    continue;
                }
                if (op.Has("randomKinds"))
                {
                    var remaining = CombatResolver.Curses.ToList();
                    for (int i = 0; i < op.Number("randomKinds") && remaining.Count > 0; i++) { int idx = (int)(rng.Random("target") * remaining.Count); AddRuleStatus(foe, remaining[idx], 1); remaining.RemoveAt(idx); }
                    continue;
                }
                var curse = op.Text("curse"); int n = op.Number("stacks", op.Number("duration", op.Number("amount", 1)));
                if (curse == "atkDown") { int cut = Math.Min(foe.atk, op.Number("amount", 1)); foe.atk -= cut; attackReductions.Add((foe,cut)); n = op.Number("duration",1); }
                if (op.Has("extend") && foe.status.Get(curse) > 0) n = foe.status.Get(curse) + op.Number("extend");
                bool wasCursed = CombatResolver.HasCurse(foe); AddRuleStatus(foe, curse, n);
                if (op.Flag("missingBonusIfCursed") && wasCursed) AddRuleStatus(foe, CombatResolver.Curses.FirstOrDefault(key => foe.status.Get(key) == 0) ?? "poison", 1);
                for (int i = 0; i < op.Number("burst"); i++) ApplyRuleRawHit(card, foe, foe.status.Get(curse), CombatResolver.FIXED, false);
            }
        }

        private List<CardDef> RulePool(RuleValue pool, RuleValue filter = null)
        {
            if(pool?.Text("kind")=="牌库底")return drawPile.Take(3).Select(uid=>FindCard(uid)?.card).Where(c=>c!=null).ToList();
            return CurrentBattlePools.Resolve(CardLibrary.All(),pool,G.MyClass,filter);
        }
        private void AcquireRuleCards(CardDef card, RuleValue op, BattleFoe target)
        {
            int count = op.Number("n", 1); string dest = op.Text("dest", "hand");
            if(op.Get("pool")?.Text("kind")=="牌库底"||card.id=="cmtn28jv33wx"&&count==3&&op.Get("pool")?.Text("kind")=="随机"&&dest=="hand"&&!op.Has("act")&&!op.Has("filter")){
                StartDeckBottomDiscovery(card,op);return;
            }
            if (dest == "discover") { StartStructuredDiscover(card, op, target); return; }
            var pool = CurrentBattlePools.Resolve(CardLibrary.All(),op.Get("pool"),G.MyClass,op.Get("filter"),namedAcquisition:true);
            for (int i = 0; i < count; i++)
            {
                var acquired = pool.FirstOrDefault(c=>c.name==op.Get("pool")?.Text("kind"))??RandomRuleCard(pool); if (acquired == null) break;
                acquired = acquired.Clone(); lastAcquired = acquired;
                if (op.Text("act") == "zeroCost") acquired.runtimeCost = 0;
                if(op.Text("act")=="costMinusOne")acquired.runtimeCost=Math.Max(0,acquired.cost-1);
                if(op.Text("act")=="noInfuse")acquired.noInfuse=true;
                string uid = dest == "deck" ? AddDeckCard(acquired) : AddTempCard(acquired);
                if(op.Text("act")=="dup"){if(dest=="deck")AddDeckCard(acquired);else AddTempCard(acquired);}
                if (op.Text("act") == "play") CastRuleHandCard(uid, target);
                if (op.Has("expire")) ruleJobs.Add(new RuleJob { card = card, operations = new[] { RuleValue.Obj("op", "expireCard", "uid", uid) }, turn = turn + 1 });
            }
            if(dest=="deck")drawPile=DeckOps.ShuffleCards(drawPile,rng);
        }
        private void StartStructuredDiscover(CardDef card, RuleValue op, BattleFoe target, Action<CardDef> onSelect = null)
        {
            var pool = RulePool(op.Get("pool"),op.Get("filter"));
            var options = new List<CardDef>();
            while (options.Count < 3+discoverExtra && pool.Count > 0) { int index = (int)(rng.Random("generation") * pool.Count); options.Add(pool[index]); pool.RemoveAt(index); }
            if (options.Count == 0) return;
            discovering = new DiscoveringState { options = options, n = 1 };
            structuredDiscoverAction = chosen =>
            {
                lastAcquired = chosen;
                if (onSelect != null) { onSelect(chosen); return; }
                var acquired = chosen.Clone(); if (op.Text("act") == "zeroCost") acquired.runtimeCost = 0;
                if(op.Text("act")=="noInfuse")acquired.noInfuse=true;
                if (op.Text("act") == "play"||op.Text("act")=="playKeep"){
                    string castUid=AddTempCard(acquired);
                    if(acquired.type=="道具")UseItem(castUid,target==null?-1:FoeIdx(target));
                    else CastRuleHandCard(castUid, target);
                    if(op.Text("act")=="playKeep")foreach(var other in options.Where(c=>c.id!=chosen.id))AddTempCard(other);
                }
                else
                {
                    string uid = AddTempCard(acquired);
                    if (op.Text("act") == "dup") AddTempCard(acquired);
                    if (op.Has("costDecayPerTurn")) costDecayCards[uid] = op.Number("costDecayPerTurn");
                }
                if (op.Number("n", op.Number("count", 1)) > 1)
                {
                    var next = RuleValue.Obj(); foreach (var entry in op.Values) next.Values[entry.Key] = entry.Value;
                    next.Values["n"] = op.Number("n", op.Number("count", 1)) - 1; StartStructuredDiscover(card, next, target);
                }
            };
        }
        private void StartRuleChoice(CardDef card, RuleValue op, BattleFoe target)
        {
            var options = op.Operations("options").ToArray(); if (options.Length == 0) return;
            ruleChoice = new RuleChoiceSnapshot { labels = options.Select(option => option.Text("label", "选择")).ToArray() };
            ruleChoiceAction = index =>
            {
                var selected = options[index]; var ops = selected.Operations("ops").ToArray();
                if (selected.Text("repeat") == "turnStart") ruleJobs.Add(new RuleJob { card = card, operations = ops, target = target, turn = turn + 1, repeat = true });
                else RunRuleOps(card, ops, target);
                if (op.Has("otherAfterTurns")) for (int i = 0; i < options.Length; i++) if (i != index)
                    ruleJobs.Add(new RuleJob { card = card, operations = options[i].Operations("ops").ToArray(), turn = turn + op.Number("otherAfterTurns"), target = target, repeat = options[i].Text("repeat") == "turnStart" });
            };
        }
        private void StartRuleHandSelect(CardDef card, RuleValue op, BattleFoe target)
        {
            var candidates = hand.Where(uid => op.Text("type") == null || FindCard(uid)?.card.type == op.Text("type")).ToArray();
            if (candidates.Length == 0) return;
            ruleHandSelection = new RuleHandSelectionSnapshot { candidateUids = candidates, canCancel = false };
            ruleHandAction = uid =>
            {
                var chosen = FindCard(uid)?.card; if (chosen == null) return;
                switch (op.Text("act"))
                {
                    case "copy": AddTempCard(chosen); break;
                    case "zeroNext": var altered = chosen.Clone(); altered.zeroCostUntilTurn = turn + 1; cardOverrides[uid] = altered; break;
                    case "play": CastRuleHandCard(uid, target); break;
                }
            };
        }
        private void ExecuteRule(CardDef card, RuleValue op, BattleFoe target)
        {
            if (op.Text("what") == "fireball") { var fireball = CardLibrary.FindById("tt3-fireball"); for (int i = 0; i < op.Number("count", 1) && Alive().Count > 0; i++) if (fireball != null) CastRuleCard(fireball, target); return; }
            if (op.Text("what") == "starterAttack") { int count = target == null ? 0 : CombatResolver.Curses.Sum(key => target.status.Get(key)); for (int i = 0; i < count && Alive().Count > 0; i++) CastRuleCard(CardLibrary.FindById("starter-attack") ?? CardLibrary.SHA, target); return; }
            if (mode == "boss") return;
            var cap = op.Get("cap");
            foreach (var foe in RuleTargets(op, target).Concat(Alive()).Distinct().Where(foe => (cap?.Flag("wounded") != true || foe.hp < foe.maxHp) && (cap?.Has("atk") != true || foe.atk <= cap.Number("atk"))).Take(op.Number("count", 1)).ToArray())
            { foe.hp = 0; foe.dead = true; FireEnemyMarks(foe, "death"); OnEliteDeath(foe); FireStructuredTrigger("onKill", foe); }
        }
        private void CastRuleCard(CardDef card, BattleFoe target, bool infused = true)
        {
            if (card == null || ruleDepth > 40 || over) return;
            CastRuleHandCard(AddTempCard(card), target, infused);
        }
        private void CastRuleHandCard(string uid, BattleFoe target, bool directRelease = true)
        {
            var card = FindCard(uid)?.card;
            if (card == null || !hand.Contains(uid) || over) return;
            if (!directRelease && RequiresInfusion(card) && InfuseOf(card) > 0) return;
            var previous = castContext;
            ExecPlay(uid, card, new List<string>(), target?.dead == true ? Alive().FirstOrDefault() : target, true, directRelease);
            castContext = previous;
        }
        private void CastRuleHandBatch(string[] uids, BattleFoe target, int drawEach = 0, int max = 0, int index = 0, int count = 0)
        {
            for (int i = index; i < uids.Length && !over && (max <= 0 || count < max); i++)
            {
                if (!hand.Contains(uids[i])) continue;
                int continuationBase = ruleContinuations.Count;
                CastRuleHandCard(uids[i], target); count++;
                if (RuleInputPending)
                {
                    int next = i + 1, completed = count; var context = castContext;
                    ruleContinuations.Insert(continuationBase, () => { var previous = castContext; castContext = context; DrawCards(drawEach); CastRuleHandBatch(uids, target, drawEach, max, next, completed); castContext = previous; });
                    return;
                }
                DrawCards(drawEach);
            }
        }
        private void CastRuleGeneratedBatch(Func<CardDef> nextCard, int remaining, BattleFoe target, bool infused)
        {
            while (remaining > 0 && !over && Alive().Count > 0)
            {
                var card = nextCard(); if (card == null) return;
                int continuationBase = ruleContinuations.Count;
                CastRuleCard(card, target, infused); remaining--;
                if (!RuleInputPending) continue;
                int left = remaining; var context = castContext;
                ruleContinuations.Insert(continuationBase, () => { var previous = castContext; castContext = context; CastRuleGeneratedBatch(nextCard, left, target, infused); castContext = previous; });
                return;
            }
        }
        private void AdvanceRuleInfusion(CardDef card)
        {
            if (card.type == "法术") ruleConsumedSpells++;
            infusionTotal++;
            foreach (var bonus in infusionBonuses)
                if (++bonus.fuel % Math.Max(1, bonus.every) == 0) CombatResolver.AddBlessing(pstat, bonus.key, bonus.stacks);
        }
        private void ConsumeRuleHand(string uid, bool trigger = true)
        {
            if (!hand.Remove(uid)) return; var card = FindCard(uid)?.card;
            if (!consumed.Contains(uid)) consumed.Add(uid); if (mode == "boss" && !grave.Contains(uid)) grave.Add(uid);
            if (card == null) return;
            AdvanceRuleInfusion(card);
            if (trigger) RunStructuredTrigger(card, "onConsume", castContext?.target);
            if (persistentRules.Contains("consumeFireball")) CastRuleCard(CardLibrary.FindById("tt3-fireball"), castContext?.target);
        }
        private void RecordRuleConsumption(string uid)
        {
            var card = FindCard(uid)?.card; if (card == null) return;
            AdvanceRuleInfusion(card);
            if (persistentRules.Contains("consumeFireball")) CastRuleCard(CardLibrary.FindById("tt3-fireball"), castContext?.target);
            foreach (var equipment in equippedCards)
            {
                var unlock = equipment.card.rules?.Get("equip")?.Get("passive")?.Get("infusionUnlock");
                if (unlock != null && infusionTotal >= unlock.Number("fuel") && infusionUnlocked.Add(equipment.uid))
                { pstat.status.spellUp += unlock.Number("spellPower"); DrawCards(unlock.Number("draw")); }
            }
        }
        private readonly Dictionary<string, int> costDecayCards = new Dictionary<string, int>();
        private void OnStructuredDraw(string uid)
        {
            var card = FindCard(uid)?.card; if (card == null) return;
            castContext?.drawn.Add(uid);
            if (castOnDraw.Remove(uid)) CastRuleHandCard(uid, Alive().FirstOrDefault(), false);
            else
            {
                bool triggered = card.rules?.Get("triggers")?.Operations("onDraw").Any() == true;
                if (triggered && card.id != "tt8-heavensword" && card.id != "tt8-demonslay") { hand.Remove(uid); discard.Add(uid); }
                RunStructuredTrigger(card, "onDraw", Alive().FirstOrDefault());
            }
            CheckRuleCombinations();
        }
        private void DrawFiltered(int n, string type)
        {
            for (int i = drawPile.Count - 1; i >= 0 && n > 0 && (mode!="boss"||hand.Count < GameRules.BattleHandMax); i--)
                if (FindCard(drawPile[i])?.card.type == type) { var uid = drawPile[i]; drawPile.RemoveAt(i); hand.Add(uid); n--; OnStructuredDraw(uid); }
        }
        private void AdvanceStructuredTurn()
        {
            ApplyCurrentBossTurnStart();
            pdef.Guard=false;
            enemyDamageThisTurn = false; rulePlayedMoves = rulePlayedMartial = 0; previousCardType = null;
            if (armorDecay > 0) pdef.Armor = Math.Max(0, pdef.Armor - armorDecay);
            foreach (var entry in timedRuleStatuses.Where(item => item.turn <= turn).ToArray()) { entry.status.Set(entry.key, Math.Max(0,entry.status.Get(entry.key)-entry.original)); timedRuleStatuses.Remove(entry); }
            foreach (var entry in stolenAttackReturns.Where(item => item.turn <= turn || item.foe.dead).ToArray()) { entry.foe.atk += entry.amount; stolenAttackReturns.Remove(entry); }
            foreach (var entry in attackReductions.Where(item => item.foe.status.atkDown == 0).ToArray()) { entry.foe.atk += entry.amount; attackReductions.Remove(entry); }
            foreach (var entry in costDecayCards.ToArray()) { var card = FindCard(entry.Key)?.card; if (card != null) { var altered = card.Clone(); altered.runtimeCost = Math.Max(0, (altered.runtimeCost ?? altered.cost) - entry.Value); cardOverrides[entry.Key] = altered; } }
            foreach(var uid in hand.Concat(drawPile).Concat(discard).Concat(grave).Distinct().ToArray())
            {
                var card=FindCard(uid)?.card; if(card==null)continue;
                var growth=Regex.Match(card.desc??"",@"回合开始时[，,]?\s*本牌伤害\s*\+\s*(\d+)");
                if(growth.Success){var changed=card.Clone();changed.dmg=(card.dmg??0)+int.Parse(growth.Groups[1].Value);cardOverrides[uid]=changed;}
            }
            foreach (var job in ruleJobs.Where(job => job.turn <= turn).ToArray())
            {
                ruleJobs.Remove(job); RunRuleOps(job.card, job.operations, job.target?.dead == true ? Alive().FirstOrDefault() : job.target);
                if (job.repeat) { job.turn = turn + 1; ruleJobs.Add(job); }
            }
            FireStructuredTrigger("onTurnStart");
            AdvanceBattleItems();
        }
        private void OnStructuredPlayerDamaged(BattleFoe attacker, int damage)
        {
            if (damage <= 0) return;
            foreach (var entry in equippedCards)
            {
                var response = entry.card.rules?.Get("equip")?.Get("passive")?.Get("damageResponse");
                if (response == null) continue;
                ApplyRuleRawHit(entry.card, attacker, response.Number("damage"), CombatResolver.FIXED, false);
                double chance = response.Value("drawChance") is double fraction ? fraction : 0;
                if (rng.Random("reward") < chance) DrawCards(response.Number("draw", 1));
            }
        }
        private bool TryBlockPlayerFatalDamage(int damage)
        {
            if(damage<=0 || G.Hp-damage>0 || deathSaves<=0) return false;
            deathSaves--;CombatResolver.AddBlessing(pstat,"immune",1);
            G.Log("致命一击被挡下（死亡保险剩余 "+deathSaves+" 次，本回合无敌）","ok");
            return true;
        }
        private void DamagePlayer(int damage)
        {
            if(TryBlockPlayerFatalDamage(damage)) return;
            var presentationHit=BeginPassiveHit();
            G.Hp-=damage;
            if(G.Hp>0) OnStructuredPlayerDamaged(null,damage);
            presentationHit.Dispose();
            if(damage>0 && G.Hp<=0) Finish(false);
        }
        private void FireEnemyMarks(BattleFoe foe, string timing)
        {
            if (timing == null) return;
            foreach (var mark in enemyMarks.Where(mark => mark.target == foe && mark.operation.Text("event") == timing).ToArray())
            {
                if (timing == "death") enemyMarks.Remove(mark);
                int amount = mark.operation.Has("status") ? foe.status.Get(mark.operation.Text("status")) * mark.operation.Number("multiplier", 1) : mark.operation.Number("amount");
                var candidates = Alive().Where(other => other != foe).ToList();
                if (mark.operation.Text("dest") == "randomOtherEnemy" && candidates.Count > 1) candidates = new List<BattleFoe> { candidates[(int)(rng.Random("target") * candidates.Count)] };
                foreach (var other in candidates) HitFoe(other, mark.card, amount, mark.operation.Text("dmgType", "true"), "");
            }
        }
        private void OnEliteDeath(BattleFoe fallen)
        {
            if (fallen.eliteSkill == "deathEnergy") energy += 1;
            foreach (var foe in Alive())
            {
                if (foe.eliteSkill == "allyDeathRage") foe.atk += 2;
                if (foe.eliteSkill == "allyDeathLoss") { foe.hp = Math.Max(0, foe.hp - 2); if (foe.hp == 0) { foe.dead = true; OnEliteDeath(foe); } }
                if (foe.eliteSkill == "firstTurnStealth" && Alive().Count <= 1) foe.status.stealth = 0;
                if (fallen.eliteSkill == "attackAura") foe.atk -= 2;
            }
        }
        private void RandomRuleCurse(RuleValue op, BattleFoe target)
        {
            var curses = op.Items("curses").Cast<string>().ToArray(); if (curses.Length == 0) curses = CombatResolver.Curses;
            foreach (var foe in RuleTargets(op, target)) { var choices = op.Flag("preferMissing") ? curses.Where(key => foe.status.Get(key) == 0).ToArray() : curses; if (choices.Length == 0) choices = curses; AddRuleStatus(foe, choices[(int)(rng.Random("target") * choices.Length)], op.Number("stacks", 1)); }
        }
        private void RandomRuleBlessing(RuleValue op)
        {
            var choices = op.Items("choices").Cast<string>().ToList();
            if (choices.Count == 0) choices.AddRange(new[] { "stealth", "atkUp", "spellUp", "reduce", "armor", "purify" });
            var key = choices[(int)(rng.Random("reward") * choices.Count)];
            if (key == "purify") CombatResolver.Purify(pstat); else if (key == "armor") pdef.Armor++; else CombatResolver.AddBlessing(pstat, key, 1);
        }
        private void StartSwapDiscoverCosts(CardDef card, BattleFoe target)
        {
            StartStructuredDiscover(card, RuleValue.Obj("pool", RuleValue.Obj("kind", "随机")), target, first =>
                StartStructuredDiscover(card, RuleValue.Obj("pool", RuleValue.Obj("kind", "随机")), target, second =>
                { var a = first.Clone(); var b = second.Clone(); a.runtimeCost = second.cost; b.runtimeCost = first.cost; AddTempCard(a); AddTempCard(b); }));
        }
        private void TransformRuleCards(RuleValue op)
        {
            string[] rarities = { "初始", "古朴", "稀有", "史诗", "传说" };
            var transformed = new List<CardDef>();
            foreach (var uid in drawPile.ToArray())
            {
                var card = FindCard(uid)?.card; if (card == null || !new[] { "武术", "法术", "装备" }.Contains(card.type)) continue;
                int rank = Array.IndexOf(rarities, card.rarity); if (rank < 0) continue;
                string next = rarities[Math.Min(rarities.Length - 1, rank + op.Number("raritySteps", 1))];
                var chosen = RandomRuleCard(CardLibrary.All().Where(candidate => candidate.type == card.type && candidate.rarity == next && CardLibrary.IsRandomObtainable(candidate)).ToList());
                if (chosen == null) continue;
                var altered = chosen.Clone(); cardOverrides[uid] = altered; transformed.Add(altered);
            }
            if (!op.Flag("swapCosts")) return;
            var costs = transformed.Select(card => card.cost).ToArray();
            for (int i = costs.Length - 1; i > 0; i--) { int other = (int)(rng.Random("battle", "generation") * (i + 1)); int cost = costs[i]; costs[i] = costs[other]; costs[other] = cost; }
            for (int i = 0; i < costs.Length; i++) transformed[i].cost = costs[i];
        }
        private void RestoreRuleConsumed(int n)
        {
            foreach (var uid in consumed.Take(n).ToArray()) { consumed.Remove(uid); grave.Remove(uid); if (FindCard(uid) != null && !hand.Contains(uid)) hand.Add(uid); }
        }
        private void CastStoredRuleCard(BattleFoe target)
        {
            var entries=G.OwnedCards.Where(entry=>entry.pouchOf=="tt7-stratagem"&&entry.card.type=="法术").ToArray();
            if(entries.Length==0){G.Log("锦囊是空的——背包中存入法术后才能生效","dim");return;}
            discovering=new DiscoveringState{options=entries.Select(entry=>entry.card).ToList(),n=1};
            structuredDiscoverAction=chosen=>
            {
                var source=entries.FirstOrDefault(entry=>ReferenceEquals(entry.card,chosen));
                if(source==null||!(G is BattleContainerHost host)||!host.ConsumeStoredCard(source.uid)){G.Log("锦囊法术未能消费，请重试","warn");return;}
                consumed.Add(source.uid);CastRuleCard(chosen,target);
            };
        }
        private void ApplyRuleBattleSetup()
        {
            foreach (var entry in G.OwnedCards)
            {
                var setup = entry.card.rules?.Get("battle")?.Get("setup");
                if (setup?.Text("mode") != mode || !sel.Contains(entry.uid)) continue;
                foreach (var id in setup.Items("injectIds")) { var template = CardLibrary.FindById((string)id); if (template != null) AddDeckCard(template); }
                drawPile = DeckOps.ShuffleCards(drawPile, rng);
            }
            CheckRuleCombinations();
        }
        private void CheckRuleCombinations()
        {
            if (combiningHand || G == null || hand == null) return;
            combiningHand = true;
            try
            {
                var swordIds = new[] { "tt8-heavensword", "tt8-demonslay" };
                while (true)
                {
                    var material = swordIds.Select(id => hand.FirstOrDefault(uid => FindCard(uid)?.card.id == id)).ToArray();
                    if (material.Any(uid => uid == null)) break;
                    foreach (var uid in material) { hand.Remove(uid); consumed.Add(uid); if (mode == "boss") grave.Add(uid); }
                    var result = CardLibrary.FindById("tt8-archdemon"); if (result != null) AddTempCard(result); else break;
                }
                if (!sealCombined)
                {
                    foreach (var entry in G.OwnedCards.Concat(granted).ToArray())
                    {
                        var recipe = entry.card.rules?.Get("battle")?.Get("setup")?.Get("collection"); if (recipe == null) continue;
                        var material = recipe.Items("ids").Cast<string>().Select(id => hand.FirstOrDefault(uid => FindCard(uid)?.card.id == id)).ToArray();
                        if (material.Length == 0 || material.Any(uid => uid == null)) continue;
                        sealCombined = true;
                        foreach (var uid in material) { hand.Remove(uid); consumed.Add(uid); if (mode == "boss") grave.Add(uid); }
                        var result = CardLibrary.FindById(recipe.Text("into")); if (result != null) AddTempCard(result); break;
                    }
                }
            }
            finally { combiningHand = false; }
        }
        private IReadOnlyList<FoeSnapshot> RuleAllySnapshots()
        {
            return ruleAllies.Where(ally => !ally.dead).Select((ally,index) => new FoeSnapshot { id = "ally-"+index, name = ally.name,
                hp = ally.hp, maxHp = ally.maxHp, atk = ally.atk, dead = ally.dead, Statless = ally.statless, status = ally.status.Export(),
                defense = new DefenseState { Shield=ally.defense.Shield,Armor=ally.defense.Armor,Guard=ally.defense.Guard } }).ToList();
        }
        private bool TryRuleAllyGuard(BattleFoe foe)
        {
            var guard = ruleAllies.FirstOrDefault(ally => !ally.dead && !ally.statless && ally.hp > 0 && ally.status.stealth == 0);
            if (guard == null) return false;
            using var presentationHit=BeginAllyHit(foe,guard,ruleAllies.IndexOf(guard));
            var result = CombatResolver.DealDamage(new Combatant { atk=foe.atk }, guard, 0, CombatResolver.ATTACK);
            guard.dead = guard.hp <= 0;
            G.Log(guard.name+"抵挡了"+foe.name+"的攻击，受到 "+result.dealt+" 点伤害", "sys");
            return true;
        }
        private void ResolveRuleAllyAttacks()
        {
            foreach (var ally in ruleAllies.Where(ally => !ally.dead && !ally.statless && ally.hp > 0).ToArray())
            {
                if(!CombatResolver.CanAct(ally)) continue;
                var target = Alive().FirstOrDefault(); if (target == null) break;
                using var presentationHit=BeginPassiveHit(target);
                var result = CombatResolver.DealDamage(ally,target,0,CombatResolver.ATTACK);
                if(result.dealt>0) CombatResolver.BreakStealth(ally);
                G.Log(ally.name+"攻击"+target.name+"，造成 "+result.dealt+" 点伤害", "sys");
                if (target.hp <= 0) { target.dead = true; FireEnemyMarks(target,"death"); OnEliteDeath(target); FireStructuredTrigger("onKill",target); }
            }
            if (Alive().Count == 0) Finish(true);
        }
        private void SyncConditionalEquipment()
        {
            if (pstat == null) return;
            int attack = 0, spell = 0;
            foreach (var entry in equippedCards)
            {
                var passive = entry.card.rules?.Get("equip")?.Get("passive");
                if (passive?.Get("cond")?.Flag("hasCurse") == true && CombatResolver.HasCurse(pstat))
                { attack += passive.Get("aura")?.Number("atk") ?? 0; spell += passive.Get("aura")?.Number("spellPower") ?? 0; }
            }
            pstat.status.atkUp += attack-conditionalAttack; pstat.status.spellUp += spell-conditionalSpell;
            conditionalAttack=attack; conditionalSpell=spell;
        }
        private HeroSkillSnapshot CurrentHeroSkill()
        {
            var skill = new HeroSkillSnapshot { used = heroUsedTurn == turn, needsTarget = true };
            switch (G?.MyClass)
            {
                case "侠客": skill.name = "刺击"; skill.kind = "fixed"; skill.cost = 1; skill.dmg = 2; break;
                case "法师": skill.name = "搜刮"; skill.kind = "acquire"; skill.cost = 1; skill.needsTarget = false; break;
                case "降临者": skill.name = "火球"; skill.kind = "spell"; skill.cost = 2; skill.dmg = 4; break;
                case "牧师": skill.name = priestFlipped ? "惩戒" : "圣疗"; skill.kind = priestFlipped ? "spell" : "heal"; skill.cost = 1; skill.dmg = 3; skill.heal = 3; skill.needsTarget = priestFlipped; break;
                default: skill.name = "猛击"; skill.kind = "attack"; skill.cost = 2; break;
            }
            foreach (var entry in equippedCards)
            {
                var modifier = entry.card.rules?.Get("equip")?.Get("passive")?.Get("heroSkillCost");
                if (modifier != null && hand.Count <= modifier.Number("maxHand")) skill.cost = modifier.Number("cost");
            }
            return skill;
        }
        public CommandResult UseHeroSkill(int targetIndex = -1)
        {
            if (over || busy || RuleInputPending || selectingDeck || infusing != null) return CommandResult.No("当前不能使用职业技能");
            var skill = CurrentHeroSkill();
            if (skill.used) return CommandResult.No("本回合技能已使用");
            if (energy < skill.cost) return CommandResult.No("能量不足");
            BattleFoe target = targetIndex >= 0 && targetIndex < foes.Count ? foes[targetIndex] : null;
            if (skill.needsTarget && (target == null || target.dead)) return CommandResult.No("请选择存活敌人");
            energy -= skill.cost; heroUsedTurn = turn;
            var synthetic = new CardDef { name = skill.name, desc = "", type = "技能" };
            if (skill.kind == "heal") { if (pstat.status.healban == 0) G.Heal(skill.heal); }
            else if (skill.kind == "acquire")
            {
                var acquired = RandomRuleCard(CardLibrary.All().Where(candidate => CardLibrary.IsRandomObtainable(candidate) && (mode != "boss" || candidate.type != "道具")).ToList());
                if (acquired != null) { if (mode == "boss") AddDeckCard(acquired); else AddTempCard(acquired); }
            }
            else ApplyRuleRawHit(synthetic, target, skill.dmg, skill.kind, false);
            if (G.MyClass == "牧师") priestFlipped = !priestFlipped;
            ResolveRuleOutcome(); RequestRender(); return CommandResult.Yes();
        }
    }
}
