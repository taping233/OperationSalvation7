using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using UnityEngine;

namespace Sdt.Run
{
    public sealed class AchievementCatalog {public List<AchievementDef> achievements;}
    public sealed class AchievementStatus
    {
        public readonly AchievementDef Definition;
        public readonly bool Unlocked,Claimed;
        public readonly int Value,Total;
        public readonly string Progress;
        internal AchievementStatus(AchievementDef definition,bool unlocked,bool claimed,int value,int total)
        {Definition=definition;Unlocked=unlocked;Claimed=claimed;Value=value;Total=total;Progress=total>0?Math.Min(value,total)+" / "+total:"";}
    }
    public sealed partial class MetaProgress
    {
        // One synchronous view projection; never retained across a Base mutation.
        public List<AchievementStatus> AchievementStatuses()
        {
            var data=B;var stats=data.stats;
            int classMax=0,petMax=0,legendCount=0;bool rainbow=false;
            foreach(var progress in data.characters.Values)if(progress!=null)classMax=Math.Max(classMax,progress.lv);
            foreach(var pet in data.pets.Values)if(pet!=null)petMax=Math.Max(petMax,pet.lv);
            foreach(var card in data.collection.Values)if(card?.rarity=="传说")legendCount++;
            var attributes=new HashSet<string>();
            foreach(var rune in data.runes)
            {
                var attrs=rune?["attrs"];if(attrs!=null)foreach(string attr in attrs.Values<string>())attributes.Add(attr);
                if((string)(rune?["kind"])=="rainbow"&&(attrs?.Count()??0)>=2)rainbow=true;
            }
            int hatched=Math.Max(0,data.pets.Count-1);
            var result=new List<AchievementStatus>(_achievements.Count);
            foreach(var definition in _achievements)
            {
                int value=0,total=1;
                switch(definition.id)
                {
                    case "firstExtract":value=stats.extracts;break;
                    case "extract3":value=stats.extracts;total=3;break;
                    case "kill10":value=stats.kills;total=10;break;
                    case "firstBoss":value=stats.bossKills.Count;break;
                    case "allBoss":value=stats.bossKills.Count;total=3;break;
                    case "rich30":value=stats.bestRunCoins;total=30;break;
                    case "stash20":value=stats.stashTotal;total=20;break;
                    case "bagMax":value=data.BagCap;total=GameRules.BagMax;break;
                    case "safeMax":value=data.SafeCap;total=GameRules.SafeMax;break;
                    case "class3":value=classMax;total=3;break;
                    case "collectGold":value=data.collection.ContainsKey("tt-gold")?1:0;break;
                    case "collectLegend":value=legendCount;break;
                    case "collect5":value=data.collection.Count;total=5;break;
                    case "petHatch1":value=hatched;break;
                    case "petHatch3":value=hatched;total=3;break;
                    case "petMax":value=petMax;total=5;break;
                    case "petAll":value=data.pets.Count;total=BaseData.PetsCatalog.Count;break;
                    case "unlimitedEnergy":value=stats.turnMovesMax;total=10;break;
                    case "weaponMaster":value=stats.battleEquipsMax;total=5;break;
                    case "runeFan":value=attributes.Count;total=5;break;
                    case "savior":value=stats.nestBossKills?.Count??0;total=2;break;
                    case "beautifulVase":value=rainbow?1:0;break;
                    case "excuseMe":value=stats.reviveKills;break;
                    case "labScore1":value=stats.labTotalScore;total=500;break;
                    case "labScore2":value=stats.labTotalScore;total=1500;break;
                    case "labScore3":value=stats.labTotalScore;total=4000;break;
                    default:total=0;break;
                }
                result.Add(new AchievementStatus(definition,IsUnlocked(definition,data),IsClaimed(definition.id),value,total));
            }
            return result;
        }
        static List<AchievementDef> LoadAchievements()
        {
            var definitions=JsonConvert.DeserializeObject<AchievementCatalog>(Resources.Load<TextAsset>("Data/CurrentAchievements").text).achievements;
            foreach(var item in definitions){string id=item.id;item.done=(s,d)=>AchievementDone(id,s,d);}
            return definitions;
        }
        static bool AchievementDone(string id,BaseStats s,BaseData d)
        {
            switch(id){
                case "firstExtract":return s.extracts>=1;
                case "extract3":return s.extracts>=3;
                case "kill10":return s.kills>=10;
                case "firstBoss":return s.bossKills.Count>=1;
                case "allBoss":return s.bossKills.Count>=3;
                case "rich30":return s.bestRunCoins>=30;
                case "stash20":return s.stashTotal>=20;
                case "bagMax":return GameRules.BagSize+d.bagUp>=GameRules.BagMax;
                case "safeMax":return d.SafeCap>=GameRules.SafeMax;
                case "class3":return d.characters.Values.Any(c=>c.lv>=3);
                case "collectGold":return d.collection.ContainsKey("tt-gold");
                case "collectLegend":return d.collection.Values.Any(c=>c.rarity=="传说");
                case "collect5":return d.collection.Count>=5;
                case "petHatch1":return Math.Max(0,d.pets.Count-1)>=1;
                case "petHatch3":return Math.Max(0,d.pets.Count-1)>=3;
                case "petMax":return d.pets.Values.Any(p=>p.lv>=5);
                case "petAll":return d.pets.Count>=BaseData.PetsCatalog.Count;
                case "unlimitedEnergy":return s.turnMovesMax>=10;
                case "weaponMaster":return s.battleEquipsMax>=5;
                case "runeFan":return d.runes.SelectMany(r=>r["attrs"]?.Values<string>()??Enumerable.Empty<string>()).Distinct().Count()>=5;
                case "savior":return (s.nestBossKills?.Count??0)>=2;
                case "beautifulVase":return d.runes.Any(r=>(string)r["kind"]=="rainbow"&&(r["attrs"]?.Count()??0)>=2);
                case "excuseMe":return s.reviveKills>=1;
                case "labScore1":return s.labTotalScore>=500;
                case "labScore2":return s.labTotalScore>=1500;
                case "labScore3":return s.labTotalScore>=4000;
                default:throw new InvalidOperationException("成就条件未迁移："+id);
            }
        }
    }
}
