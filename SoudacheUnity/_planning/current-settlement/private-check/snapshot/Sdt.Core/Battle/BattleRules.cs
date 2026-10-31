// ported from src/battle.rules.js
// 目标规则与不可打出判定（v0.22/v0.24 设计者定版）。正则逐字照抄原版。
using System.Text.RegularExpressions;

namespace Sdt.Core.Battle
{
    public static class BattleRules
    {
        private static readonly Regex AoePattern = new Regex(@"所有敌人|群体|全体", RegexOptions.Compiled);
        private static readonly Regex SelfTargetPattern = new Regex(@"回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为", RegexOptions.Compiled);
        private static readonly Regex DeckOnlyPattern = new Regex(@"洗入|置入牌库|放入牌库|牌库底|牌库上限", RegexOptions.Compiled);

        /// <summary>群体伤害判定（设计者：群体伤害不用选目标）。</summary>
        public static bool IsAreaEffect(CardDef card)
        {
            var declared = card.rules?.Get("battle")?.Get("target");
            if (declared != null) return declared.Flag("area");
            return AoePattern.IsMatch(card.desc ?? string.Empty);
        }

        /// <summary>
        /// 指向侧判定：'enemy' = 伤害类 → 拖到敌人；'self' = 治疗/净化/护甲/护盾/格挡类 → 拖到自己；
        /// null = 群体卡与无指向效果 → 直接点击打出。
        /// </summary>
        public static string TargetSideFor(CardDef card)
        {
            var declared = card.rules?.Get("battle")?.Get("target");
            if (declared != null) return declared.Flag("area") ? null : declared.Text("side");
            if (card.rules?.Get("triggers") != null || card.rules?.Get("equip") != null) return null;
            if (IsAreaEffect(card)) return null;
            string desc = card.desc ?? string.Empty;
            bool isDmgType = System.Array.IndexOf(CardLibrary.DmgTypes, card.type) >= 0;
            if (isDmgType || card.dmgType == "attack") return "enemy";
            if ((card.heal ?? 0) > 0 || (card.armor ?? 0) > 0 || SelfTargetPattern.IsMatch(desc)) return "self";
            return null;
        }

        /// <summary>不可打出判定（v0.24：无法使用的卡在手中虚化、无法触发并提示原因）。返回 null = 可打。</summary>
        public static string UnplayableReasonFor(CardDef card, string mode)
        {
            if (card.type == "资源") return "资源卡无法在对战中打出（资源在背包中使用或出售）";
            if (card.type == "事件") return "事件卡只能在棋盘的事件格中触发，无法打出";
            if (card.type == "生物") return "生物卡是敌人图鉴，记录敌人信息，无法打出";
            if (mode == "boss" && card.type == "道具") return "道具卡只能在普通战斗中使用（BOSS 战牌库不含道具）";
            if (mode == "normal" && card.rules == null && DeckOnlyPattern.IsMatch(card.desc ?? string.Empty))
            {
                return "「牌库」词条只有对战 BOSS 时生效——普通战斗没有牌库与墓地，无法打出";
            }
            return null;
        }
    }
}
