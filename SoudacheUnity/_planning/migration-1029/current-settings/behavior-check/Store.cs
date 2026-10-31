using System;using Newtonsoft.Json.Linq;using Sdt.Run;namespace Sdt.UI.Screens.Menu {
    public static class CurrentFeedbackStore
    {
        public const string Key="sdt-suggestions-v1";
        public static bool TryAppend(JObject entry,out string error)
        {
            try
            {
                var saved=GameRuntime.I.Saves.Global.GetJson(Key);
                if(saved!=null&&!(saved is JArray))throw new InvalidOperationException("留言信箱格式损坏，原数据已保留");
                var list=saved==null?new JArray():(JArray)saved.DeepClone();list.Add(entry.DeepClone());
                GameRuntime.I.Saves.Global.SetJson(Key,list);error=null;return true;
            }
            catch(Exception e){error="写入失败，输入已保留，请重试。"+e.Message;return false;}
        }
    }
}