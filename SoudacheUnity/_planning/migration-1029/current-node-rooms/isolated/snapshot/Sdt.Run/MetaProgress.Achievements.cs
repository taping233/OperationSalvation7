using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using UnityEngine;

namespace Sdt.Run
{
    public sealed class AchievementCatalog {public List<AchievementDef> achievements;}
    public sealed partial class MetaProgress
    {
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
