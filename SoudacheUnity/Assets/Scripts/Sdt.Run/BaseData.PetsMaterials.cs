using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class PetProgress { public int lv=1;public long ts; }
    public sealed class PetEffect { public int maxHp,safeBonus,extraSha;public double classChest;public bool shopFree,shaToFireball; }
    public sealed class PetDefinition { public string id,name,icon,desc;public PetEffect effect=new PetEffect(); }
    public sealed class PetCatalog
    {
        public string eggId;public int hatchCost,levelMax;public int[] upCosts;public List<PetDefinition> list;
        static PetCatalog _current;
        public static PetCatalog Current=>_current??=JsonConvert.DeserializeObject<PetCatalog>(Resources.Load<TextAsset>("Data/CurrentPets").text);
    }
    public sealed class MaterialReceipt { public string kind,label;public int amount; }
    public sealed partial class BaseData
    {
        [JsonProperty("pets")] public Dictionary<string,PetProgress> pets=new Dictionary<string,PetProgress>{{"dog",new PetProgress()}};
        [JsonProperty("petSel")] public string petSel="dog";
        [JsonProperty("eggPity")] public int eggPity;
        [JsonProperty("eggBattles")] public int eggBattles;
        [JsonProperty("ammoTaught")] public bool ammoTaught;
        [JsonProperty("runes")] public List<Newtonsoft.Json.Linq.JObject> runes=new List<Newtonsoft.Json.Linq.JObject>();
        public static List<PetDefinition> PetsCatalog=>PetCatalog.Current.list;
        public PetDefinition CarriedPet=>PetsCatalog.FirstOrDefault(p=>p.id==petSel);
        public int PetLevel(string id)=>Math.Max(1,Math.Min(PetCatalog.Current.levelMax,pets.TryGetValue(id,out var pet)?pet.lv:1));
        public int PetUpCost(string id)=>PetLevel(id)>=PetCatalog.Current.levelMax?0:PetCatalog.Current.upCosts[PetLevel(id)-1];
        public bool CanUpgradePet(string id)=>pets.ContainsKey(id)&&PetLevel(id)<PetCatalog.Current.levelMax&&rations>=PetUpCost(id);
        public bool TrySelectPet(string id,out string reason)=>GameRuntime.I.TryPersistMutation(()=>{
            RequireCurrentBase();if(GameRuntime.I.State.runActive)throw new InvalidOperationException("出征期间无法切换随行伙伴");
            if(!pets.ContainsKey(id)||!PetsCatalog.Any(p=>p.id==id))throw new InvalidOperationException("尚未拥有该伙伴");petSel=id;Save();
        },out reason);
        public bool TryUpgradePet(string id,out string reason)=>GameRuntime.I.TryPersistMutation(()=>{
            RequireCurrentBase();if(!CanUpgradePet(id))throw new InvalidOperationException("口粮不足或伙伴已满级");rations-=PetUpCost(id);pets[id].lv=PetLevel(id)+1;Save();
        },out reason);
        public bool TryHatchPet(out PetDefinition pet,out string reason)
        {
            PetDefinition chosen=null;bool ok=GameRuntime.I.TryPersistMutation(()=>{
                RequireCurrentBase();var egg=stash.FirstOrDefault(s=>s.card.id==PetCatalog.Current.eggId&&s.count>0);
                if(egg==null)throw new InvalidOperationException("仓库中没有宠物蛋");
                if(coins<PetCatalog.Current.hatchCost)throw new InvalidOperationException("孵化需要50储备币");
                var pool=PetsCatalog.Where(p=>!pets.ContainsKey(p.id)).ToList();if(pool.Count==0)throw new InvalidOperationException("所有伙伴都已拥有，宠物蛋已保留");
                chosen=pool[(int)(GameRuntime.I.Rng.Random("pet","reward")*pool.Count)];
                egg.count--;if(egg.count<=0)stash.Remove(egg);coins-=PetCatalog.Current.hatchCost;
                pets[chosen.id]=new PetProgress{ts=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()};Save();
            },out reason);pet=ok?chosen:null;return ok;
        }
        public double PetEggDropChance=>eggPity>=149?1:.007;
        public void RecordPetEggChestResult(bool granted){eggPity=granted?0:eggPity+1;Save();}
        public static MaterialReceipt MaterialInfo(CardDef card)
        {
            if(card?.type!="资源")return null;var rule=card.rules?.Get("base")?.Get("material");
            if(rule==null)return null;string kind=rule.Text("kind");int amount=rule.Number("amount");
            if(amount<=0||(kind!="wood"&&kind!="rations"&&kind!="keys"))return null;
            return new MaterialReceipt{kind=kind,label=kind=="wood"?"木材":kind=="rations"?"口粮":"钥匙",amount=amount};
        }
        public bool TryUseStashMaterial(string name,bool all,out string reason,string stackKey)=>GameRuntime.I.TryPersistMutation(()=>{
            RequireCurrentBase();var stack=FindStoredStack(stackKey);var info=stack?.card.name==name&&stack.count>0?MaterialInfo(stack.card):null;
            if(info==null)throw new InvalidOperationException("该仓库卡牌不是可使用的材料");int qty=all?stack.count:1;int total=info.amount*qty;
            stack.count-=qty;if(stack.count<=0)stash.Remove(stack);if(info.kind=="wood")wood+=total;else if(info.kind=="rations")rations+=total;else keys+=total;Save();
        },out reason);
        public int PocketKeyCost(StashStack stack)
        {
            if(stack?.card==null)return 0;int per=stack.card.rarity=="稀有"?2:stack.card.rarity=="史诗"?3:stack.card.rarity=="传说"?4:1;return per*Math.Max(1,stack.count);
        }
    }
}
