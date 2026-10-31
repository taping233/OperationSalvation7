using System;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    /// <summary>保存和事务回滚共用序列化；规则树恢复为Core的纯数据节点。</summary>
    public static class SaveJson
    {
        static JsonSerializerSettings Settings()=>new JsonSerializerSettings{ObjectCreationHandling=ObjectCreationHandling.Replace,Converters={new RuleValueConverter()}};
        public static string Stringify(object value)=>JsonConvert.SerializeObject(value,Settings());
        public static JToken Token(object value)=>JToken.FromObject(value,JsonSerializer.Create(Settings()));
        public static T Read<T>(JToken value)=>value==null?default:value.ToObject<T>(JsonSerializer.Create(Settings()));
        public static T Read<T>(string value)=>JsonConvert.DeserializeObject<T>(value,Settings());
        public static void Populate(string value,object target)=>JsonConvert.PopulateObject(value,target,Settings());
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
