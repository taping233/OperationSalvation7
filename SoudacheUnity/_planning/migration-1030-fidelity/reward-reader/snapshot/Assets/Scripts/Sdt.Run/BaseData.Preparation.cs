using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class PreparationCardRef
    {
        public string cardId;
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)] public string variantKey;
    }
    public sealed class PreparationPick { public PreparationCardRef card; public int count; }
    public sealed class PreparationPreset
    {
        public string id, name, characterId, petId;
        public List<PreparationPick> picks = new List<PreparationPick>();
    }
    public sealed class PreparationGoals
    {
        public List<string> tracked = new List<string>();
        public Dictionary<string, PreparationPreset> presets = new Dictionary<string, PreparationPreset>();
    }
    public sealed class PreparationPickPreview
    {
        public PreparationCardRef card;
        public string name, status;
        public int requestedCount, availableCount, appliedCount;
    }
    public sealed class PreparationPreview
    {
        public List<PreparationPickPreview> resolvedPicks = new List<PreparationPickPreview>();
        public Dictionary<string, int> deploymentPicks = new Dictionary<string, int>();
        public List<string> errors = new List<string>();
        public BagCapacityQuery capacity;
        public int stashCards;
        public bool characterKnown, characterOwned, petKnown, petOwned;
        public bool canStart => errors.Count == 0;
    }
    public sealed partial class BaseData
    {
        [JsonProperty("goals")] public PreparationGoals goals = new PreparationGoals();
        static readonly string[] PreparationIds = { "preset-1", "preset-2" };
        public List<string> PreparationTracked() => (goals?.tracked ?? new List<string>()).Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().Take(3).ToList();
        static string RefKey(PreparationCardRef card) => card.cardId + "::" + (card.variantKey ?? "");
        public static List<PreparationPick> NormalizePreparationPicks(IEnumerable<PreparationPick> picks)
        {
            if (picks == null) return null;
            var merged = new Dictionary<string, PreparationPick>();
            foreach (var pick in picks)
            {
                if (string.IsNullOrWhiteSpace(pick?.card?.cardId) || pick.count < 1 || pick.count > 99) return null;
                var reference = new PreparationCardRef { cardId = pick.card.cardId.Trim(), variantKey = string.IsNullOrWhiteSpace(pick.card.variantKey) ? null : pick.card.variantKey.Trim() };
                string key = RefKey(reference);
                if (!merged.TryGetValue(key, out var item)) merged[key] = item = new PreparationPick { card = reference };
                item.count += pick.count;
                if (item.count > 99) return null;
            }
            return merged.Values.ToList();
        }
        public List<PreparationPreset> PreparationPresets() => PreparationIds.Select((id, index) =>
        {
            var saved = goals?.presets != null && goals.presets.TryGetValue(id, out var preset) ? preset : null;
            return new PreparationPreset { id = id, name = string.IsNullOrEmpty(saved?.name) ? index == 0 ? "猛攻" : "跑刀" : saved.name.Substring(0, Math.Min(24, saved.name.Length)),
                characterId = saved?.characterId, petId = saved?.petId, picks = NormalizePreparationPicks(saved?.picks ?? new List<PreparationPick>()) ?? new List<PreparationPick>() };
        }).ToList();
        public bool ValidatePreparation(out string reason)
        {
            reason = null;
            if (goals == null || goals.tracked == null || goals.presets == null || goals.tracked.Count > 3 || goals.tracked.Any(string.IsNullOrWhiteSpace)
                || goals.tracked.Distinct().Count() != goals.tracked.Count || goals.presets.Any(pair => !PreparationIds.Contains(pair.Key) || pair.Value == null
                    || pair.Value.id != pair.Key || string.IsNullOrWhiteSpace(pair.Value.name) || pair.Value.name.Length > 24 || NormalizePreparationPicks(pair.Value.picks) == null))
            { reason = "整备预设或追踪目标损坏，原档已保留"; return false; }
            return true;
        }
        public bool TrySetTrackedGoals(IEnumerable<string> targets, out string reason) => GameRuntime.I.TryPersistMutation(() =>
        {
            RequireCurrentBase();
            if (targets == null || targets.Any(string.IsNullOrWhiteSpace)) throw new InvalidOperationException("请选择稳定卡牌目标");
            var tracked = targets.Select(id => id.Trim()).Distinct().ToList();
            if (tracked.Count > 3) throw new InvalidOperationException("最多追踪3项目标");
            goals ??= new PreparationGoals(); goals.tracked = tracked;
        }, out reason);
        public bool TrySavePreparationPreset(PreparationPreset input, out string reason) => GameRuntime.I.TryPersistMutation(() =>
        {
            RequireCurrentBase(); var picks = NormalizePreparationPicks(input?.picks);
            if (input == null || !PreparationIds.Contains(input.id) || string.IsNullOrWhiteSpace(input.name) || input.name.Trim().Length > 24 || picks == null)
                throw new InvalidOperationException("预设名需1～24字，数量需1～99，预设仅有两个固定位置");
            goals ??= new PreparationGoals(); goals.presets ??= new Dictionary<string, PreparationPreset>();
            goals.presets[input.id] = new PreparationPreset { id = input.id, name = input.name.Trim(), characterId = input.characterId, petId = input.petId, picks = picks };
        }, out reason);
        public PreparationPreview PreviewPreparation(PreparationPreset preset)
        {
            var preview = new PreparationPreview(); var picks = NormalizePreparationPicks(preset?.picks);
            if (preset == null || picks == null) { preview.errors.Add("预设格式无效"); return preview; }
            var runtime = GameRuntime.I;
            var stacks = stash.Where(stack => stack.card?.id != null && stack.count > 0 && runtime.FindDepartureStack(GameRuntime.DepartureStackKey(stack)) == stack).ToList();
            var remaining = stacks.ToDictionary(GameRuntime.DepartureStackKey, stack => stack.count);
            foreach (var pick in picks.OrderBy(pick => string.IsNullOrEmpty(pick.card.variantKey) ? 1 : 0))
            {
                var candidates = stacks.Where(item => item.card.id == pick.card.cardId &&
                    (string.IsNullOrEmpty(pick.card.variantKey) || (item.variantKey ?? item.card.variantKey) == pick.card.variantKey))
                    .OrderBy(item => string.IsNullOrEmpty(item.variantKey ?? item.card.variantKey) ? 0 : 1).ToList();
                var eligible = candidates.Where(item => item.card.rarity != "职业").ToList();
                var card = eligible.FirstOrDefault()?.card ?? candidates.FirstOrDefault()?.card ?? CardLibrary.FindById(pick.card.cardId);
                bool forbidden = eligible.Count == 0 && card?.rarity == "职业";
                int available = eligible.Sum(item => remaining[GameRuntime.DepartureStackKey(item)]);
                string status = forbidden ? "forbidden" : available < pick.count ? "missing" : "ready";
                preview.resolvedPicks.Add(new PreparationPickPreview { card = pick.card, name = card?.name ?? pick.card.cardId, requestedCount = pick.count,
                    availableCount = available, appliedCount = status == "ready" ? pick.count : 0, status = status });
                if (status != "ready") preview.errors.Add((card?.name ?? pick.card.cardId) + (forbidden ? "为职业牌，不能携带" : "库存不足"));
                int needed = pick.count;
                foreach (var stack in eligible)
                {
                    string key = GameRuntime.DepartureStackKey(stack); int count = Math.Min(needed, remaining[key]);
                    remaining[key] -= count; needed -= count;
                    if (status == "ready" && count > 0) { preview.deploymentPicks[key] = (preview.deploymentPicks.TryGetValue(key, out var old) ? old : 0) + count; preview.stashCards += count; }
                    if (needed == 0) break;
                }
            }
            preview.characterKnown = string.IsNullOrEmpty(preset.characterId) || CharacterTable.All.Any(c => c.id == preset.characterId);
            preview.characterOwned = string.IsNullOrEmpty(preset.characterId) || characters.ContainsKey(preset.characterId);
            preview.petKnown = string.IsNullOrEmpty(preset.petId) || PetsCatalog.Any(p => p.id == preset.petId);
            preview.petOwned = string.IsNullOrEmpty(preset.petId) || pets.ContainsKey(preset.petId);
            if (!preview.characterKnown || !preview.characterOwned) preview.errors.Add("预设人物资格无效");
            if (!preview.petKnown || !preview.petOwned) preview.errors.Add("预设伙伴资格无效");
            preview.capacity = GameRuntime.I.PreviewDeparture(preview.deploymentPicks, preset.petId ?? petSel);
            preview.resolvedPicks = picks.Select(pick => preview.resolvedPicks.First(item => RefKey(item.card) == RefKey(pick.card))).ToList();
            if (!preview.capacity.capacityOk) preview.errors.Add("背包空间不足");
            return preview;
        }
        public bool TryStartPreparation(string presetId, out string reason) => GameRuntime.I.TryPersistMutation(() =>
        {
            RequireCurrentBase(); var runtime = GameRuntime.I;
            if (runtime.State.runActive || runtime.ActiveSlot == null) throw new InvalidOperationException("当前无法从基地出征");
            var preset = PreparationPresets().FirstOrDefault(item => item.id == presetId);
            var preview = PreviewPreparation(preset);
            if (!preview.canStart) throw new InvalidOperationException(string.Join("；", preview.errors));
            if (!string.IsNullOrEmpty(preset.petId)) petSel = preset.petId;
            runtime.NewRun(runtime.ActiveSlot.Value, preset.characterId, selMode, preview.deploymentPicks);
        }, out reason);
        public static string PreparationSourceHint(CardDef card)
        {
            if (card?.type == "能力卡" && !string.IsNullOrEmpty(card.cls)) return "选择对应人物后，在职业能力候选或祭坛兑换中出现；不保证本次必得。";
            if (card?.rarity == "职业" && !string.IsNullOrEmpty(card.cls)) return "选择对应人物后，在职业搜刮点、火堆或祭坛候选中出现；不保证本次必得。";
            return card != null && CardLibrary.IsRandomObtainable(card) ? "通用随机奖励、发现或商店候选；进入候选池不表示本次必得。" : "来源未确认";
        }
    }
}
