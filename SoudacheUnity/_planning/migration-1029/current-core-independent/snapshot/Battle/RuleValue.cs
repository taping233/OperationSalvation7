using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    // 保留现行声明式规则的完整字段；静态卡库由同一生成器输出，不在运行时解析文本 JSON。
    public sealed class RuleValue
    {
        public readonly Dictionary<string, object> Values = new Dictionary<string, object>();
        public static RuleValue Obj(params object[] pairs)
        {
            var value = new RuleValue();
            for (int i = 0; i < pairs.Length; i += 2) value.Values[(string)pairs[i]] = pairs[i + 1];
            return value;
        }
        public static object[] Arr(params object[] items) { return items; }
        public object Value(string key) { return Values.TryGetValue(key, out var value) ? value : null; }
        public bool Has(string key) { return Values.ContainsKey(key); }
        public RuleValue Get(string key) { return Value(key) as RuleValue; }
        public string Text(string key, string fallback = null) { return Value(key) as string ?? fallback; }
        public int Number(string key, int fallback = 0)
        {
            var value = Value(key);
            return value is int integer ? integer : value is double number ? (int)number : fallback;
        }
        public bool Flag(string key) { return Value(key) is bool flag && flag; }
        public object[] Items(string key) { return Value(key) as object[] ?? Array.Empty<object>(); }
        public IEnumerable<RuleValue> Operations(string key)
        {
            foreach (var value in Items(key)) if (value is RuleValue operation) yield return operation;
        }
    }
}
