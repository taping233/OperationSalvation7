using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Sdt.Core.Battle
{
    // Current parsePoolNoun + buildDiscoverPool boundaries shared by acquire/discover.
    public static class CurrentBattlePools
    {
        static bool ClassCard(CardDef c)=>c.rarity=="职业"||!string.IsNullOrEmpty(c.cls);
        static bool Move(CardDef c)=>c.type=="武术"||c.type=="法术";
        public static List<CardDef> Resolve(IEnumerable<CardDef> catalog,RuleValue pool,string myClass,RuleValue filter=null,bool namedAcquisition=false)
        {
            var cards=catalog.ToList();string kind=pool?.Text("kind","随机")??"随机";
            if(kind=="ids"){var ids=pool.Items("ids").OfType<string>().ToHashSet();return cards.Where(c=>ids.Contains(c.id)).ToList();}
            if(kind=="types"){var types=pool.Items("types").OfType<string>().ToHashSet();return cards.Where(c=>types.Contains(c.type)&&(!pool.Flag("randomEligible")||CardLibrary.IsRandomObtainable(c))).ToList();}
            var named=cards.FirstOrDefault(c=>c.name==kind);
            if(namedAcquisition&&named!=null)return new List<CardDef>{named};
            Func<CardDef,bool> predicate=null;bool allowClass=false;
            if(kind=="其它职业"||kind=="其他职业"){allowClass=true;predicate=c=>!string.IsNullOrEmpty(c.cls)&&!string.IsNullOrEmpty(myClass)&&c.cls!=myClass&&c.type!="能力卡";}
            else if(kind=="本职业"){allowClass=true;predicate=c=>!string.IsNullOrEmpty(c.cls)&&c.cls==myClass;}
            else if(kind=="classAbility"){allowClass=true;predicate=c=>c.type=="能力卡"&&c.cls==myClass;}
            else if(kind=="legendary"||kind=="传说")predicate=c=>c.rarity=="传说";
            else if(new[]{"武术","法术","装备","能力卡","道具"}.Contains(kind))predicate=c=>c.type==kind;
            else if(kind=="moves"||kind=="招式"||Regex.IsMatch(kind,@"^[0-5]费招式$")){
                int cost=pool?.Number("cost",-1)??-1;if(kind.Contains("费招式"))cost=int.Parse(kind.Substring(0,1));predicate=c=>Move(c)&&(cost<0||c.cost==cost);
            }
            else if(kind=="注能")predicate=c=>(c.infuse??0)>0||CardLibrary.DeriveInfuse(c)>0;
            else if(kind=="能施加诅咒的招式")predicate=c=>Move(c)&&Regex.IsMatch(c.desc??"","诅咒|中毒|流血|冰冻|沉默|破甲|禁疗");
            else if(kind=="形态")predicate=c=>c.name.Contains("形态");
            else if(kind=="药水")predicate=c=>c.type=="道具"&&c.name.Contains("药水");
            else if(kind=="射线")predicate=c=>c.type=="法术"&&!c.unrandom&&c.name.Contains("射线");
            else if(kind=="火球")predicate=c=>c.name=="火球";
            else if(named!=null)predicate=c=>c.name==kind;
            if(filter!=null){var previous=predicate;predicate=c=>(previous==null||previous(c))
                &&(!filter.Has("type")||c.type==filter.Text("type"))&&(!filter.Has("cost")||c.cost==filter.Number("cost"))&&(!filter.Has("costMax")||c.cost<=filter.Number("costMax"))&&!filter.Items("exceptIds").OfType<string>().Contains(c.id);}
            return cards.Where(c=>(allowClass||(!ClassCard(c)&&c.type!="能力卡"))&&(predicate!=null
                ?c.rarity!="衍生"&&c.type!="生物"&&c.type!="事件"&&c.type!="资源"&&predicate(c)
                :c.type!="道具"&&c.type!="资源"&&CardLibrary.IsRandomObtainable(c))).ToList();
        }
    }
}
