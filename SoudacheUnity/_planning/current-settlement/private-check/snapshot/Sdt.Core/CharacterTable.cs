// ported from src/characters.js（CLASSES 取自 src/cards.js 的职业表）
// 远征队名单。纯内容：无渲染/DOM/存储依赖。
using System.Collections.Generic;

namespace Sdt.Core
{
    public sealed class CharacterDef
    {
        public string id, name, rulesetId, visualId, color, tag, bg, task, role;
        public string skin, hair, outfit;   // 立绘配色（#RRGGBB）
        public float scale;
    }

    public static class CharacterTable
    {
        // 5 职业表（2026-09-05 设计者定版职业整合：原 11 职业 → 5 职业）
        public static readonly string[] CLASSES = { "侠客", "战士", "牧师", "法师", "降临者" };

        // 旧职业名 → 新职业名迁移映射
        public static readonly IReadOnlyDictionary<string, string> LEGACY = new Dictionary<string, string>
        {
            { "刺客", "侠客" }, { "剑客", "侠客" }, { "游侠", "侠客" }, { "守卫", "战士" },
            { "术士", "牧师" }, { "授印者", "牧师" }, { "召唤师", "法师" },
        };

        public static readonly IReadOnlyList<CharacterDef> CHARACTERS = new CharacterDef[]
        {
            new CharacterDef { id="wu", name="无", rulesetId="侠客", color="#ed9b53", skin="#edc3ac", hair="#e7edf0", outfit="#26333d", scale=1f, visualId="wu", tag="", bg="", task="", role="侠客" },
            new CharacterDef { id="changwuyu", name="常无欲", rulesetId="降临者", color="#ad9ddd", skin="#dec0af", hair="#29313d", outfit="#e8e5dc", scale=1.12f, visualId="changwuyu", tag="自云上而来", bg="从没人见过他落地的那一刻——他只是某天出现在坍塌的神殿里，衣角还带着云上的风。他自己也不记得来处。", task="循着本能的指引收拢散落的\"天界残片\"，在身体被这个世界同化之前离开。", role="降临者" },
            new CharacterDef { id="baita", name="白塔", rulesetId="法师", color="#e9bd69", skin="#e1b191", hair="#78533b", outfit="#71604a", scale=0.74f, visualId="baita", tag="星图测绘员", bg="皇家学院的首席测绘师，毕生绘制\"活动地脉\"的星图。她相信宝藏的位置写在星星的偏移里。", task="在遗迹深处架设三座测星仪，校准星图并回收古代魔导核心，天亮前撤离。", role="法师" },
            new CharacterDef { id="heixiang", name="黑像", rulesetId="战士", color="#d0805a", skin="#69463d", hair="#ecedf0", outfit="#303b42", scale=1.25f, visualId="heixiang", tag="佣兵团老团长", bg="解散前的\"铁砧佣兵团\"团长，打过所有能叫上名字的仗。如今兵团只剩他一个人和一面团旗。", task="接下悬赏最高的委托，正面击破盘踞遗迹的匪帮，把团旗插在宝藏堆上再撤离。", role="战士" },
            new CharacterDef { id="xingyue", name="星月", rulesetId="牧师", color="#81bcb0", skin="#dcb397", hair="#285a59", outfit="#dedbd0", scale=1f, visualId="xingyue", tag="灰袍巡回者", bg="不属于任何教团的灰袍修士，为战乱之地的伤者包扎，也为亡者祷告。他背囊里永远有一格留给别人的药。", task="护送遇险商队余部穿过战区，在圣祠取得愈合金像，全员撤离。", role="牧师" },
        };

        // 按 id / name / 职业名（含旧名）查角色；找不到返回 null
        public static CharacterDef CharacterFor(string value)
        {
            if (value == null) return null;
            foreach (var c in CHARACTERS)
            {
                if (c.id == value || c.name == value) return c;
                string mapped = LEGACY.TryGetValue(value, out var legacy) ? legacy : value;
                if (c.rulesetId == mapped) return c;
            }
            return null;
        }

        public static IReadOnlyList<CharacterDef> All => CHARACTERS;        // UI 侧别名
        public static CharacterDef For(string id) => CharacterFor(id);      // UI 侧别名
        public static string Name(string value) => CharacterName(value);    // UI 侧别名
        public static string CharacterName(string value)
        {
            var c = CharacterFor(value);
            if (c != null) return c.name;
            return value ?? "未选择人物";
        }

        // —— 进度迁移（角色进度按 id 存，旧档按职业名存）——
        public sealed class CharProgress { public int lv = 1; public int xp; }

        /// <summary>把 data.classes（旧职业名 → {lv,xp}）迁移进 data.characters（角色 id）。对齐 migrateCharacterProgress。</summary>
        public static Dictionary<string, CharProgress> MigrateCharacterProgress(
            Dictionary<string, CharProgress> characters, Dictionary<string, CharProgress> oldClasses)
        {
            characters = characters ?? new Dictionary<string, CharProgress>();
            oldClasses = oldClasses ?? new Dictionary<string, CharProgress>();
            foreach (var c in CHARACTERS)
            {
                if (characters.ContainsKey(c.id)) continue;
                CharProgress best = null;
                if (oldClasses.TryGetValue(c.rulesetId, out var direct) && direct != null) best = direct;
                foreach (var kv in LEGACY)
                {
                    if (kv.Value != c.rulesetId) continue;
                    if (!oldClasses.TryGetValue(kv.Key, out var cand) || cand == null) continue;
                    if (best == null || cand.lv > best.lv || (cand.lv == best.lv && cand.xp > best.xp)) best = cand;
                }
                characters[c.id] = new CharProgress { lv = best?.lv ?? 1, xp = best?.xp ?? 0 };
            }
            return characters;
        }

        /// <summary>对局存档的角色字段迁移：characterId 缺失时按 myClass 推导。对齐 migrateRunCharacter。</summary>
        public static void MigrateRunCharacter(RunState run)
        {
            if (run == null) return;
            if (string.IsNullOrEmpty(run.characterId))
            {
                var c = CharacterFor(run.myClass);
                run.characterId = c?.id;
            }
            var character = CharacterFor(run.characterId);
            if (character != null) run.myClass = character.rulesetId;
        }
    }
}
