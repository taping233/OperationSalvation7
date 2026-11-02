using System;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    /// <summary>保存和事务回滚共用序列化；规则树恢复为Core的纯数据节点。</summary>
    public static class SaveJson
    {
        static JsonSerializerSettings Settings(bool upgradeCards=true)
        {
            var settings=new JsonSerializerSettings{ObjectCreationHandling=ObjectCreationHandling.Replace,Converters={new RuleValueConverter()}};
            if(upgradeCards)settings.Converters.Add(new StandardCardConverter());return settings;
        }
        static bool DefinitionRead(Type type)=>type==typeof(CardDef)||type==typeof(List<CardDef>);
        public static string Stringify(object value)=>JsonConvert.SerializeObject(value,Settings(false));
        public static JToken Token(object value)=>JToken.FromObject(value,JsonSerializer.Create(Settings(false)));
        public static T Read<T>(JToken value)=>value==null?default:value.ToObject<T>(JsonSerializer.Create(Settings(!DefinitionRead(typeof(T)))));
        public static T Read<T>(string value)=>JsonConvert.DeserializeObject<T>(value,Settings(!DefinitionRead(typeof(T))));
        public static void Populate(string value,object target)=>JsonConvert.PopulateObject(value,target,Settings(target==null||!DefinitionRead(target.GetType())));
        // Only the eight exact pre-balance built-ins qualify. Definition-library reads stay literal;
        // nested saved entities upgrade while preserving their art, notes and instance identity.
        // A nested custom copy with the identical old payload has no distinguishable provenance.
        sealed class StandardCardConverter : JsonConverter
        {
            public override bool CanConvert(Type type)=>type==typeof(CardDef);
            public override bool CanWrite=>false;
            public override void WriteJson(JsonWriter writer,object value,JsonSerializer serializer)=>throw new NotSupportedException();
            public override object ReadJson(JsonReader reader,Type type,object existing,JsonSerializer serializer)
            {
                var token=JToken.Load(reader);if(token.Type==JTokenType.Null)return null;
                if(!(token is JObject document))throw new JsonSerializationException("卡牌定义必须是对象。");
                var card=new CardDef();using(var input=document.CreateReader())serializer.Populate(input,card);
                UpgradeStandardCard(card,document);return card;
            }
        }
        sealed class StandardCardUpdate
        {
            public CardDef Old;
            public string[] Fields;
            public JToken Rules;
        }
        static readonly FieldInfo[] CardFields=typeof(CardDef).GetFields(BindingFlags.Instance|BindingFlags.Public).Where(field=>!field.IsNotSerialized).ToArray();
        static readonly HashSet<string> CardFieldNames=new HashSet<string>(CardFields.Select(field=>field.Name),StringComparer.Ordinal);
        static readonly FieldInfo[] StandardFields=CardFields.Where(field=>field.Name!="rules"&&field.Name!="variantKey"&&field.Name!="art"&&field.Name!="note").ToArray();
        static readonly Dictionary<string,StandardCardUpdate> StandardUpdates=BuildStandardUpdates();
        static Dictionary<string,StandardCardUpdate> BuildStandardUpdates()
        {
            var updates=new Dictionary<string,StandardCardUpdate>(StringComparer.Ordinal);
            void Add(CardDef old,params string[] fields)=>updates.Add(old.id,new StandardCardUpdate{Old=old,Fields=fields,Rules=Token(old.rules)});
            // Exact old definitions from project-backups/20261101-soudache-before-2022.
            Add(new CardDef { id="tt3-holy-water", name="治愈", cost=1, rarity="古朴", type="法术", dmg=0, heal=5, desc="回复 5 点生命，净化自身", value=2, rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "self", "area", false)), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "heal", "amountField", "heal"), RuleValue.Obj("op", "cleanse", "target", "self")))) }, "heal", "desc");
            Add(new CardDef { id="tt12-felguard", name="邪能护体", cost=2, rarity="史诗", type="法术", draw=3, infuse=2, desc="注能（2）：抽3张牌，本回合免疫所有伤害和诅咒效果", rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "self", "area", false), "requirements", RuleValue.Arr(RuleValue.Obj("kind", "infused"))), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "draw", "amount", 3, "when", RuleValue.Obj("infused", true)), RuleValue.Obj("op", "blessing", "key", "immune", "duration", 1, "when", RuleValue.Obj("infused", true)), RuleValue.Obj("op", "registerRule", "rule", "playerCurseImmune", "duration", 1, "when", RuleValue.Obj("infused", true))))) }, "rarity", "cls", "unrandom", "sellable", "value", "desc");
            Add(new CardDef { id="tt12-backupcell", name="后备能源", cost=6, rarity="史诗", type="法术", draw=2, desc="抽2张牌并回复所有费用，消耗区中每有一张法术牌，本牌费用-1", rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", null, "area", false), "costModifiers", RuleValue.Arr(RuleValue.Obj("kind", "consumedSpellDiscount", "amount", 1))), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "draw", "amountField", "draw"), RuleValue.Obj("op", "refillEnergy")))) }, "cost", "desc");
            Add(new CardDef { id="cmtn28jv33wx", name="搜索军用保险柜", cost=0, rarity="衍生", type="法术", dmg=0, desc="随机获取3张卡牌", value=3, sellable=false, rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "self", "area", false)), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "acquire", "n", 3, "pool", RuleValue.Obj("kind", "随机"), "dest", "hand")))) }, "desc");
            Add(new CardDef { id="tt3-flame-storm", name="风暴火球", cost=2, rarity="职业", type="法术", dmg=4, dmgType="spell", desc="对全体敌人每人释放1次火球。", value=3, sellable=false, unrandom=true, cls="降临者", rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "enemy", "area", true)), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "damage", "amount", 4, "target", "allEnemies")))) }, "desc", "rules");
            Add(new CardDef { id="cmtn1lbhbqi4", name="充能火球", cost=1, rarity="职业", type="法术", dmg=4, dmgType="spell", desc="4‘，回合开始时，本牌伤害+1", value=3, sellable=false, unrandom=true, cls="降临者", rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "enemy", "area", false)), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "damage", "amountField", "dmg", "target", "chosenEnemy"), RuleValue.Obj("op", "registerRule", "rule", "growth")))) }, "dmg", "desc", "rules");
            Add(new CardDef { id="cmtn1r10xnl1", name="黑暗形态", cost=1, rarity="职业", type="法术", dmg=0, desc="本局对战中，每当你发现卡牌时，增加1个可选项", value=2, sellable=false, unrandom=true, cls="降临者", rules=RuleValue.Obj("version", 1, "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "registerRule", "rule", "discoverPlus")))) }, "cost", "desc", "rules");
            Add(new CardDef { id="tt7-meteorstrong", name="星陨之力", cost=2, rarity="职业", type="法术", dmg=0, infuse=2, desc="注能(2)：施放 3 次火球。", value=3, unrandom=true, cls="降临者", rules=RuleValue.Obj("version", 1, "battle", RuleValue.Obj("target", RuleValue.Obj("side", "enemy", "area", false), "requirements", RuleValue.Arr(RuleValue.Obj("kind", "infused"))), "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "execute", "what", "fireball", "count", 3, "when", RuleValue.Obj("infused", true))))) }, "desc", "rules");
            return updates;
        }
        static void UpgradeStandardCard(CardDef card,JObject document)
        {
            if(card.id==null||!string.IsNullOrEmpty(card.variantKey)||!StandardUpdates.TryGetValue(card.id,out var update)
                ||document.Properties().Any(property=>!CardFieldNames.Contains(property.Name)))return;
            foreach(var field in StandardFields)if(!Equals(field.GetValue(card),field.GetValue(update.Old)))return;
            if(!JToken.DeepEquals(Token(card.rules),update.Rules))return;
            var current=Array.Find(CardDatabase.All,definition=>definition.id==card.id);if(current==null)return;
            foreach(string name in update.Fields)
            {
                var field=CardFields.First(value=>value.Name==name);
                field.SetValue(card,name=="rules"?Read<RuleValue>(Token(current.rules)):field.GetValue(current));
            }
        }
        sealed class RuleValueConverter : JsonConverter
        {
            public override bool CanConvert(Type type)=>type==typeof(RuleValue);
            public override void WriteJson(JsonWriter writer,object value,JsonSerializer serializer)
            {
                writer.WriteStartObject();foreach(var field in ((RuleValue)value).Values){writer.WritePropertyName(field.Key);serializer.Serialize(writer,field.Value);}writer.WriteEndObject();
            }
            public override object ReadJson(JsonReader reader,Type type,object existing,JsonSerializer serializer)
            {
                var token=JToken.Load(reader);if(token.Type==JTokenType.Null)return null;
                if(!(token is JObject document))throw new JsonSerializationException("规则树必须是对象。");
                if(document.Count==1&&document["Values"] is JObject wrapped)document=wrapped;
                return Object(document);
            }
            static RuleValue Object(JObject document){var value=RuleValue.Obj();foreach(var field in document.Properties())value.Values[field.Name]=Value(field.Value);return value;}
            static object Value(JToken token)
            {
                if(token is JObject obj)return Object(obj);
                if(token is JArray array)return array.Select(Value).ToArray();
                if(token.Type==JTokenType.Integer){long number=token.Value<long>();return number>=int.MinValue&&number<=int.MaxValue?(object)(int)number:(double)number;}
                if(token.Type==JTokenType.Float)return token.Value<double>();
                if(token.Type==JTokenType.Boolean)return token.Value<bool>();
                if(token.Type==JTokenType.Null)return null;
                return token.Value<string>();
            }
        }
    }
}
