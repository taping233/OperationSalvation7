// ported from src/battle.rules.js
// 目标规则与不可打出判定（v0.22/v0.24 设计者定版）。正则逐字照抄原版。
using System.Text.RegularExpressions;
using System.Linq;

namespace Sdt.Core.Battle
{
    public static class BattleRules
    {
        private static readonly Regex AoePattern = new Regex(@"所有敌人|群体|全体", RegexOptions.Compiled);
        private static readonly Regex SelfTargetPattern = new Regex(@"回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为", RegexOptions.Compiled);
        private static readonly Regex DeckOnlyPattern = new Regex(@"洗入|置入牌库|放入牌库|牌库底|牌库上限", RegexOptions.Compiled);
        private static readonly Regex EnemyEffectPattern = new Regex(@"造成\s*\d+(?:\s*[-–~至]\s*\d+)?\s*点|\d+\s*[′']|攻\s*[（(]?\s*[+＋\-−]?\s*\d|攻击\s*\d|所有敌人|全体敌人|敌方全体|目标为敌方全体|附加\s*(?:\d+\s*层?)?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱)|(?:施加|叠加)\s*\d*\s*层?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|诅咒)|消灭|降低\s*\d+\s*点?攻击力|偷取[^。]{0,12}攻击力|夺取[^。]{0,12}攻击力|无法(?:行动|使用|打出)|沉默|冰冻|火球|迫使|对方|使[^。]{0,12}(?:中毒|流血|冰冻|沉默)层数|触发\s*\d*\s*次?毒伤",RegexOptions.Compiled);

        /// <summary>群体伤害判定（设计者：群体伤害不用选目标）。</summary>
        public static bool IsAreaEffect(CardDef card)
        {
            var declared = card.rules?.Get("battle")?.Get("target");
            if (declared?.Has("area") == true) return declared.Flag("area");
            if (BuiltinCardIdentities.OwnsExecution(card)) return card.rules.Get("triggers")?.Operations("onPlay").Any(op=>op.Text("target")=="allEnemies") == true;
            if (card.id=="cc-rot-seed") return false;
            return AoePattern.IsMatch(card.desc ?? string.Empty);
        }
        public static bool IsRandomEnemyEffect(CardDef card)
        {
            var operations=card?.rules?.Get("triggers")?.Value("onPlay") as object[];
            if(operations!=null){var ops=operations.OfType<RuleValue>().ToArray();return ops.Any(op=>op.Text("target")=="randomEnemy")&&!ops.Any(op=>op.Text("target")=="chosenEnemy");}
            string text=card?.desc??"";
            return Regex.IsMatch(text,@"随机(?:的)?(?:\s*\d+\s*名)?敌人|随机敌方")&&!Regex.IsMatch(text,@"对\s*(?:1|一)\s*名敌人|对目标");
        }

        /// <summary>
        /// 指向侧判定：'enemy' = 伤害类 → 拖到敌人；'self' = 治疗/净化/护甲/护盾/格挡类 → 拖到自己；
        /// null = 群体卡与无指向效果 → 直接点击打出。
        /// </summary>
        public static string TargetSideFor(CardDef card)
        {
            var declared = card.rules?.Get("battle")?.Get("target");
            if (declared?.Has("side") == true) return declared.Text("side");
            if (BuiltinCardIdentities.OwnsExecution(card)) {
                if(card.type=="装备")return "self";
                var ops=(card.rules.Get("triggers")?.Operations("onPlay")??System.Array.Empty<RuleValue>()).ToArray();
                if(ops.Any(op=>new[]{"damage","stealAtk","execute","foeFight","recruitEnemy","markEnemy"}.Contains(op.Text("op"))||op.Text("op")=="curse"&&op.Text("target")!="self"))return "enemy";
                if(ops.Any(op=>new[]{"heal","armor","cleanse"}.Contains(op.Text("op"))))return "self";
                return null;
            }
            if(card.id=="cc-rot-seed")return "enemy";
            if(card.type=="装备")return "self";
            string desc = card.desc ?? string.Empty;
            bool isDmgType = System.Array.IndexOf(CardLibrary.DmgTypes, card.type) >= 0;
            bool pureArea=IsAreaEffect(card)&&!(card.dmg>0)&&card.dmgType!="attack";
            if (!pureArea && (isDmgType ? card.dmg>0||card.dmgType=="attack"||EnemyEffectPattern.IsMatch(desc) : card.dmgType=="attack"||IsAreaEffect(card))) return "enemy";
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
            var battle=card.rules?.Get("battle");
            if(battle?.Get("handTransform")!=null||(!BuiltinCardIdentities.OwnsExecution(card)&&card.id=="tt7-imitate")||battle?.Items("hosted").Contains("imitate")==true)return "先打出一张武术牌，使本牌变形";
            var requirements=battle?.Value("requirements") as object[];
            bool sealedCard=requirements!=null?requirements.OfType<RuleValue>().Any(rule=>rule.Text("kind")=="unplayable"):!BuiltinCardIdentities.OwnsExecution(card)&&Regex.IsMatch(card.desc??"","无法打出");
            if(sealedCard)return "封印之牌：抽到时无效果，集齐 5 张封印之牌后破除封印";
            return null;
        }
    }
}
