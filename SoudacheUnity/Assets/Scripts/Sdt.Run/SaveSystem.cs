// ported from src/game.storage.js + src/notes.js + global 设置存取（localStorage → persistentDataPath/sdt/*.json）
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using UnityEngine;

namespace Sdt.Run
{
    // ============================================================
    // 桌面新档 schema；五档与基地统一存于 desktop-v1/profile.json
    // 对应原版：game.storage.js RunStorage（key sdt-save-v2-slot{1..5}）→ 文件 sdt/slot{n}.json
    // global.json 收纳原 localStorage 的全局键（设置/基地/便签/留言/卡库改动），键名不改。
    // ============================================================

    /// <summary>背包物资格（同名堆叠占一格）。对应原版 game.inventory 元素。</summary>
    public sealed class InventorySlot
    {
        [JsonProperty("name")] public string name;
        [JsonProperty("value")] public int value;
        [JsonProperty("tier")] public string tier = "C";
        [JsonProperty("count")] public int count;
    }




    /// <summary>对局存档。字段=契约 §5 顶层全集，键名不改；对应原版 saveGame() 写入对象。</summary>
    public sealed class RunSaveData
    {
        public string format = "sdt-unity-desktop";
        public int version = 1;
        public MapSnapshot mapSnapshot;
        public List<string> explored = new List<string>();
        public List<string> revealed = new List<string>();
        public List<string> settled = new List<string>();
        public List<string> closed = new List<string>();
        public bool altarActivated, bossDefeated;
        public EntrySupplyReceipt entrySupply;
        public int spellPower;
        public int fragments;
        public RunBattleCheckpoint battleRestartCheckpoint;
        public Dictionary<string, NodeVisitReceipt> nodeRewards = new Dictionary<string, NodeVisitReceipt>();
        [JsonProperty("seed")] public int seed;
        [JsonProperty("rngState")] public JToken rngState;          // 原版为 {seed, streams} 对象，透传 Rng 快照
        [JsonProperty("layerIdx")] public int layerIdx;
        [JsonProperty("trackPos")] public int trackPos;
        [JsonProperty("hp")] public int hp;
        [JsonProperty("maxHp")] public int maxHp;
        [JsonProperty("coins")] public int coins;
        [JsonProperty("turn")] public int turn;
        [JsonProperty("atk")] public int atk;
        [JsonProperty("mode")] public string mode = "standard";
        [JsonProperty("myClass")] public string myClass;
        [JsonProperty("characterId")] public string characterId;
        [JsonProperty("inventory")] public List<InventorySlot> inventory = new List<InventorySlot>();
        [JsonProperty("ownedCards")] public List<OwnedCard> ownedCards = new List<OwnedCard>();
        [JsonProperty("cardOrder")] public List<string> cardOrder = new List<string>();
        [JsonProperty("usedPocket")] public List<PocketStack> usedPocket = new List<PocketStack>();
        [JsonProperty("eventLog")] public List<EventLogEntry> eventLog = new List<EventLogEntry>();
        [JsonProperty("discovered")] public List<string> discovered = new List<string>();  // 已发现的门/祭坛 pair id
        [JsonProperty("diceHistory")] public List<int> diceHistory = new List<int>();
        [JsonProperty("elapsed")] public double elapsed;
        [JsonProperty("slot")] public int slot;
        [JsonProperty("savedAt")] public long savedAt;              // Unix 毫秒（Date.now()）
    }

    /// <summary>
    /// 5 槽位对局存档 + 全局文件读写。对应原版 game.storage.js RunStorage 全部方法：
    /// has→HasRun / read→ReadSlot / write→WriteSlot / remove→RemoveRun。
    /// </summary>
    [Serializable] public sealed class SettlementRecord
    {
        public string identity,reason,status;
        public RunSaveData run;
        public List<StashStack> left = new List<StashStack>();
        public ExtractResult extraction;
        public DeathResult death;
        public AbandonResult abandon;
        public int sourceIdentityVersion,requestSeq,totalPocketCount,lostPocketCount;
        public List<StashStack> keptPocket = new List<StashStack>();
        public RunGrowthReceipt growth; public SettlementReceipt receipt;
    }

    /// <summary>五档对局、基地与结算回执在同一文件中原子提交。</summary>
    public sealed partial class SaveSystem
    {
        public const int SlotCount=5;
        public static string Dir
        {
            get {
                var isolated=Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA");
                if(!string.IsNullOrEmpty(isolated))return Path.GetFullPath(isolated);
                return Path.Combine(Application.persistentDataPath,"desktop-v1");
            }
        }
        public static string ProfilePath=>Path.Combine(Dir,"profile.json");
        public string LastError {get;private set;}
        public bool LastWriteSucceeded {get;private set;}
        public bool HasReadError {get;private set;}
        readonly Dictionary<int,string> _slotReadErrors = new Dictionary<int,string>();
        Dictionary<int,string> _slotReadErrorsBefore;
        public bool HasSlotReadError(int index) { EnsureLoaded(); return HasReadError || _slotReadErrors.ContainsKey(index); }
        public string ReadErrorForSlot(int index) { EnsureLoaded(); return HasReadError ? LastError : _slotReadErrors.TryGetValue(index,out var error) ? error : null; }
        public bool InTransaction=>_before!=null;
        JObject _profile,_persisted,_before;
        long _globalRevision;
        GlobalStore _globalView;
        static JObject Empty()=>new JObject{{"format","sdt-unity-profile"},{"version",1},{"runs",new JObject()},{"global",new JObject()},{"settlements",new JObject()}};
        void EnsureLoaded()
        {
            if(_profile!=null)return;
            try {
                var raw=File.Exists(ProfilePath)?JObject.Parse(File.ReadAllText(ProfilePath)):Empty();
                if((string)raw["format"]!="sdt-unity-profile"||raw["version"]?.Type!=JTokenType.Integer||(int)raw["version"]!=1||!(raw["runs"] is JObject)||!(raw["global"] is JObject)||!(raw["settlements"] is JObject))throw new InvalidDataException("存档格式无效，原文件已保留。");
                _profile=raw;_persisted=(JObject)raw.DeepClone();
            }catch(Exception e){LastError="存档读取失败，原文件已保留："+e.Message;HasReadError=true;_profile=Empty();_persisted=(JObject)_profile.DeepClone();}
        }
        void RequireWritable(){EnsureLoaded();if(HasReadError)throw new IOException(LastError??"存档读取失败，暂不覆盖原文件。");}
        bool Persist()
        {
            LastWriteSucceeded=false;
            try {RequireWritable();LastWriteSucceeded=AtomicJsonFile.TryWrite(ProfilePath,_profile.ToString(Formatting.Indented),out var error);LastError=error;if(LastWriteSucceeded)_persisted=(JObject)_profile.DeepClone();else {_profile=(JObject)_persisted.DeepClone();_globalRevision++;}return LastWriteSucceeded;}
            catch(Exception e){LastError=e.Message;_profile=(JObject)_persisted.DeepClone();_globalRevision++;return false;}
        }
        public void BeginTransaction(){RequireWritable();if(InTransaction)throw new InvalidOperationException("保存事务已经开始。");_before=(JObject)_profile.DeepClone();_slotReadErrorsBefore=new Dictionary<int,string>(_slotReadErrors);LastWriteSucceeded=false;}
        void RestoreSlotReadErrors(){if(_slotReadErrorsBefore==null)return;_slotReadErrors.Clear();foreach(var pair in _slotReadErrorsBefore)_slotReadErrors[pair.Key]=pair.Value;_slotReadErrorsBefore=null;}
        public bool CommitTransaction(){if(!InTransaction)throw new InvalidOperationException("没有待提交事务。");var before=_before;_before=null;if(Persist()){_slotReadErrorsBefore=null;return true;}_profile=before;_globalRevision++;RestoreSlotReadErrors();return false;}
        public void CancelTransaction(){if(_before==null)return;_profile=_before;_before=null;_globalRevision++;RestoreSlotReadErrors();LastWriteSucceeded=false;}
        public void ReportReadError(string reason,int? slot=null){LastError=reason;if(slot.HasValue)_slotReadErrors[slot.Value]=reason;else HasReadError=true;}
        public bool HasRun(int index){EnsureLoaded();return HasReadError||_profile["runs"][index.ToString()]!=null||(string)_profile["settlements"][index.ToString()]?["status"]=="sorting";}
        public RunSaveData ReadSlot(int index)
        {
            EnsureLoaded();if(HasReadError)return null;
            try {
                if(index<1||index>SlotCount)throw new InvalidDataException("档位超出范围。");
                var token=_profile["runs"][index.ToString()];if(token==null){var settlement=_profile["settlements"][index.ToString()];if((string)settlement?["status"]=="sorting")token=settlement["run"];}if(token==null)return null;
                return ParseValidatedRun(token,index);
            }catch(Exception e){ReportReadError("存档读取失败，原文件已保留："+e.Message,index);return null;}
        }
        public bool WriteSlot(int index,RunSaveData value)
        {
            LastWriteSucceeded=false;
            try {RequireWritable();if(HasSlotReadError(index))throw new IOException(ReadErrorForSlot(index));if(index<1||index>SlotCount||value==null||value.slot!=index)throw new InvalidDataException("存档档位无效。");_profile["runs"][index.ToString()]=SaveJson.Token(value);if(InTransaction){LastWriteSucceeded=true;return true;}return Persist();}
            catch(Exception e){LastError=e.Message;return false;}
        }
        public void RemoveRun(int index){RequireWritable();((JObject)_profile["runs"]).Remove(index.ToString());if(!InTransaction&&!Persist())throw new IOException(LastError);_slotReadErrors.Remove(index);}
        public SettlementRecord GetSettlement(int slot){EnsureLoaded();return _profile["settlements"][slot.ToString()] is JToken settlement ? SaveJson.Read<SettlementRecord>(settlement) : null;}
        public void PutSettlement(int slot,SettlementRecord record){RequireWritable();_profile["settlements"][slot.ToString()]=SaveJson.Token(record);if(!InTransaction&&!Persist())throw new IOException(LastError);}
        public void RemoveSettlement(int slot){RequireWritable();((JObject)_profile["settlements"]).Remove(slot.ToString());if(!InTransaction&&!Persist())throw new IOException(LastError);}
        public const string CustomCardsKey="sdt-cards-v1";
        public static List<CardDef> LoadCustomCards(SaveSystem saves)=>SaveJson.Read<List<CardDef>>(saves.Global.GetJson(CustomCardsKey))??new List<CardDef>();
        public static void SaveCustomCards(SaveSystem saves,IReadOnlyList<CardDef> cards)=>saves.Global.SetJson(CustomCardsKey,cards);
        public GlobalStore Global {get{EnsureLoaded();return _globalView??=new GlobalStore(this);}}
        internal JToken GetRaw(string key){EnsureLoaded();return _profile["global"][key]?.DeepClone();}
        internal string GetRawString(string key,string fallback){EnsureLoaded();var value=_profile["global"][key];return value==null?fallback:value.Type==JTokenType.String?value.Value<string>():value.ToString(Formatting.None);}
        internal void SetRaw(string key,JToken value){RequireWritable();_profile["global"][key]=value?.DeepClone();_globalRevision++;}
        internal bool DeleteRaw(string key){RequireWritable();bool deleted=((JObject)_profile["global"]).Remove(key);if(deleted)_globalRevision++;return deleted;}
        public void FlushGlobal(){if(InTransaction)return;if(!Persist())throw new IOException("保存失败："+LastError);}
        public sealed class GlobalStore
        {
            readonly SaveSystem _s;internal GlobalStore(SaveSystem s){_s=s;}
            public long Revision {get{_s.EnsureLoaded();return _s._globalRevision;}}
            public string GetString(string key,string fallback=null)=>_s.GetRawString(key,fallback);
            public void SetString(string key,string value){_s.SetRaw(key,value);_s.FlushGlobal();}
            public T Get<T>(string key)where T:class=>SaveJson.Read<T>(_s.GetRaw(key));
            public JToken GetJson(string key)=>_s.GetRaw(key);
            public void SetJson(string key,object value){_s.SetRaw(key,SaveJson.Token(value));_s.FlushGlobal();}
            public bool Delete(string key){bool ok=_s.DeleteRaw(key);if(ok)_s.FlushGlobal();return ok;}
        }
    }

    /// <summary>
    /// 玩家格子便签。ported from src/notes.js：all/get/set/clearAll，键 sdt-cell-notes-v1，
    /// 条目键 "floorId|x,y" → 文本。
    /// </summary>
    public static class NotesStore
    {
        public const string Key = "sdt-cell-notes-v1";

        static Dictionary<string, string> All(SaveSystem saves)
        {
            var raw = saves.Global.GetJson(Key);
            try { return raw?.ToObject<Dictionary<string, string>>() ?? new Dictionary<string, string>(); }
            catch { return new Dictionary<string, string>(); }
        }

        public static string Get(SaveSystem saves, string floorId, int x, int y)
        {
            var all = All(saves);
            return all.TryGetValue(floorId + "|" + x + "," + y, out var v) ? v : "";
        }

        /// <summary>notes.js set：空文本删除条目；写入自动 trim。</summary>
        public static Dictionary<string, string> Set(SaveSystem saves, string floorId, int x, int y, string text)
        {
            var all = All(saves);
            var k = floorId + "|" + x + "," + y;
            var t = text == null ? "" : text.Trim();
            if (t.Length > 0) all[k] = t; else all.Remove(k);
            saves.Global.SetJson(Key, all);
            return all;
        }

        public static void ClearAll(SaveSystem saves) { saves.Global.Delete(Key); }
    }

    /// <summary>
    /// 玩家留言（写给 Friday 的建议）。ported from src/game.menu.js saveSuggestion，键 sdt-suggestions-v1。
    /// </summary>
    public static class SuggestionsStore
    {
        public const string Key = "sdt-suggestions-v1";

        public sealed class Entry
        {
            [JsonProperty("ts")] public string ts;         // ISO 时间
            [JsonProperty("target")] public TargetInfo target;
            [JsonProperty("at")] public AtPoint at;
            [JsonProperty("text")] public string text;
        }
        public sealed class TargetInfo { [JsonProperty("name")] public string name; [JsonProperty("selector")] public string selector; }
        public sealed class AtPoint { [JsonProperty("x")] public int x; [JsonProperty("y")] public int y; }

        public static List<Entry> All(SaveSystem saves)
        {
            try { return saves.Global.GetJson(Key)?.ToObject<List<Entry>>() ?? new List<Entry>(); }
            catch { return new List<Entry>(); }
        }

        /// <summary>game.menu.js saveSuggestion（浏览器版路径）：追加一条并落盘。</summary>
        public static bool Append(SaveSystem saves, Entry e)
        {
            try
            {
                var list = All(saves);
                list.Add(e);
                saves.Global.SetJson(Key, list);
                return true;
            }
            catch { return false; }
        }
    }
}
