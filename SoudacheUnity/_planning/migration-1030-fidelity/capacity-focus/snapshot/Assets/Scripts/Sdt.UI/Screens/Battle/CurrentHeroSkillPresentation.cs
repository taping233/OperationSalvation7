// Current battle.slam-skill.js hints; presentation only, using the live skill cost.
using Sdt.Core.Battle;

namespace Sdt.UI.Screens.Battle
{
    public static class CurrentHeroSkillPresentation
    {
        public static string Hint(HeroSkillSnapshot skill, string mode)
        {
            if (skill == null) return "";
            string effect;
            if (skill.kind == "acquire")
            {
                effect = mode == "boss" ? "随机获得一张非道具卡洗入牌库"
                    : mode == "normal" ? "随机获得一张卡牌：道具进入道具栏，其他卡牌入手牌"
                    : "随机获得一张卡牌：普通战道具进栏、其他卡牌入手，首脑战排除道具并洗入牌库";
                effect += " · 不消耗卡牌";
            }
            else if (skill.kind == "fixed") effect = "造成 2 点固定伤害";
            else if (skill.kind == "heal") effect = "基础回复 3 点生命；使用后切换为「惩戒」（基础 3 点法伤）· 不消耗卡牌";
            else if (skill.name == "惩戒") effect = "造成基础 3 点法术伤害；使用后切换为「圣疗」（基础回复 3 点生命）· 不消耗卡牌";
            // The native snapshot calls the current source fireball kind "spell".
            else if (skill.kind == "fireball" || skill.name == "火球") effect = "施放一次火球（基础 4 点法伤）· 不消耗卡牌";
            else effect = "攻击一次 · 不消耗卡牌";
            return skill.cost + " 费 · " + effect;
        }
    }
}
