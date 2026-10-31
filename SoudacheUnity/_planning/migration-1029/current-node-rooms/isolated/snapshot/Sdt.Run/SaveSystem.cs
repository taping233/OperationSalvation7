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
    /// has→HasRun / read→ReadSlot / write→WriteSlot / remove→RemoveRun / migrateLegacy→MigrateLegacy。
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
    public sealed class SaveSystem
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
            try {RequireWritable();LastWriteSucceeded=AtomicJsonFile.TryWrite(ProfilePath,_profile.ToString(Formatting.Indented),out var error);LastError=error;if(LastWriteSucceeded)_persisted=(JObject)_profile.DeepClone();else _profile=(JObject)_persisted.DeepClone();return LastWriteSucceeded;}
            catch(Exception e){LastError=e.Message;_profile=(JObject)_persisted.DeepClone();return false;}
        }
        public void BeginTransaction(){RequireWritable();if(InTransaction)throw new InvalidOperationException("保存事务已经开始。");_before=(JObject)_profile.DeepClone();_slotReadErrorsBefore=new Dictionary<int,string>(_slotReadErrors);LastWriteSucceeded=false;}
        void RestoreSlotReadErrors(){if(_slotReadErrorsBefore==null)return;_slotReadErrors.Clear();foreach(var pair in _slotReadErrorsBefore)_slotReadErrors[pair.Key]=pair.Value;_slotReadErrorsBefore=null;}
        public bool CommitTransaction(){if(!InTransaction)throw new InvalidOperationException("没有待提交事务。");var before=_before;_before=null;if(Persist()){_slotReadErrorsBefore=null;return true;}_profile=before;RestoreSlotReadErrors();return false;}
        public void CancelTransaction(){if(_before==null)return;_profile=_before;_before=null;RestoreSlotReadErrors();LastWriteSucceeded=false;}
        public void ReportReadError(string reason,int? slot=null){LastError=reason;if(slot.HasValue)_slotReadErrors[slot.Value]=reason;else HasReadError=true;}
        public bool HasRun(int index){EnsureLoaded();return HasReadError||_profile["runs"][index.ToString()]!=null||(string)_profile["settlements"][index.ToString()]?["status"]=="sorting";}
        public RunSaveData ReadSlot(int index)
        {
            EnsureLoaded();if(HasReadError)return null;
            try {
                if(index<1||index>SlotCount)throw new InvalidDataException("档位超出范围。");
                var token=_profile["runs"][index.ToString()];if(token==null){var settlement=_profile["settlements"][index.ToString()];if((string)settlement?["status"]=="sorting")token=settlement["run"];}if(token==null)return null;
                if((string)token["format"]!="sdt-unity-desktop"||token["version"]?.Type!=JTokenType.Integer||(int)token["version"]!=1)throw new InvalidDataException("对局格式不受支持。");
                var raw=SaveJson.Read<RunSaveData>(token);
                if(raw==null||raw.slot!=index||raw.hp<0||raw.maxHp<=0||raw.hp>raw.maxHp||raw.coins<0||raw.fragments<0)throw new InvalidDataException("对局状态无效。");
                if(!LayeredMapGenerator.ValidateSnapshot(raw.mapSnapshot,out var reason))throw new InvalidDataException("地图存档无效："+reason);
                if(raw.layerIdx<0||raw.layerIdx>=4||raw.trackPos<0||raw.trackPos>=raw.mapSnapshot.layers[raw.layerIdx].nodes.Count)throw new InvalidDataException("对局位置无效。");
                if(raw.ownedCards==null||raw.inventory==null||raw.usedPocket==null||raw.nodeRewards==null)throw new InvalidDataException("对局库存记录缺失。");
                var identities=new HashSet<string>();
                foreach(var owned in raw.ownedCards){
                    if(owned?.card==null||string.IsNullOrEmpty(owned.uid)||!identities.Add(owned.uid)||string.IsNullOrEmpty(owned.card.id)||string.IsNullOrEmpty(owned.card.name))throw new InvalidDataException("卡牌实例记录无效。");
                    if((owned.safe==true&&owned.stored)||(!owned.stored&&!string.IsNullOrEmpty(owned.pouchOf))||(!string.IsNullOrEmpty(owned.pouchOf)&&owned.pouchOf!=CardContainerCommands.PouchId))throw new InvalidDataException("卡牌所在区域无效。");
                }
                if(raw.inventory.Any(i=>i==null||string.IsNullOrEmpty(i.name)||i.count<=0)||raw.usedPocket.Any(p=>p?.card==null||p.count<=0))throw new InvalidDataException("库存数量无效。");
                if(raw.entrySupply!=null&&(raw.entrySupply.cardIds==null||raw.entrySupply.taken==null||raw.entrySupply.taken.Distinct().Count()!=raw.entrySupply.taken.Count||raw.entrySupply.taken.Any(i=>i<0||i>=raw.entrySupply.cardIds.Count)))throw new InvalidDataException("入城补给进度无效。");
                var checkpoint=raw.battleRestartCheckpoint;
                if(checkpoint!=null){
                    if(!Sdt.Core.Battle.BattleSession.ValidateCheckpoint(checkpoint.battle,out var checkpointError))throw new InvalidDataException(checkpointError);
                    if(checkpoint.run==null||checkpoint.run.battleRestartCheckpoint!=null||checkpoint.run.slot!=index||checkpoint.run.seed!=raw.seed||checkpoint.run.hp<=0||checkpoint.run.hp>checkpoint.run.maxHp||checkpoint.run.ownedCards==null||checkpoint.run.ownedCards.Any(o=>o?.card==null)||checkpoint.run.layerIdx!=raw.layerIdx||checkpoint.run.trackPos!=raw.trackPos)throw new InvalidDataException("战斗入场对局记录无效。");
                    if(!LayeredMapGenerator.ValidateSnapshot(checkpoint.run.mapSnapshot,out _)||checkpoint.run.coins<0||checkpoint.run.fragments<0||checkpoint.run.inventory==null||checkpoint.run.inventory.Any(i=>i==null||i.count<=0)||checkpoint.run.usedPocket==null||checkpoint.run.usedPocket.Any(p=>p?.card==null||p.count<=0)||checkpoint.run.ownedCards.Any(o=>string.IsNullOrEmpty(o.uid))||checkpoint.run.ownedCards.Select(o=>o.uid).Distinct().Count()!=checkpoint.run.ownedCards.Count)throw new InvalidDataException("战斗入场库存或地图无效。");
                    if(checkpoint.battle.selectedDeck!=null&&checkpoint.battle.selectedDeck.Any(uid=>!checkpoint.run.ownedCards.Any(o=>o.uid==uid)))throw new InvalidDataException("战斗编组卡牌不在入场背包中。");
                }
                return raw;
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
        public void MigrateLegacy(){}
        public static RunSaveData MigrateRunCharacter(RunSaveData run)=>run;
        public const string CustomCardsKey="sdt-cards-v1";
        public static List<CardDef> LoadCustomCards(SaveSystem saves)=>SaveJson.Read<List<CardDef>>(saves.Global.GetJson(CustomCardsKey))??new List<CardDef>();
        public static void SaveCustomCards(SaveSystem saves,IReadOnlyList<CardDef> cards)=>saves.Global.SetJson(CustomCardsKey,cards);
        public GlobalStore Global {get{EnsureLoaded();return _globalView??=new GlobalStore(this);}}
        internal JToken GetRaw(string key){EnsureLoaded();return _profile["global"][key]?.DeepClone();}
        internal void SetRaw(string key,JToken value){RequireWritable();_profile["global"][key]=value?.DeepClone();}
        internal bool DeleteRaw(string key){RequireWritable();return ((JObject)_profile["global"]).Remove(key);}
        public void FlushGlobal(){if(InTransaction)return;if(!Persist())throw new IOException("保存失败："+LastError);}
        public sealed class GlobalStore
        {
            readonly SaveSystem _s;internal GlobalStore(SaveSystem s){_s=s;}
            public string GetString(string key,string fallback=null){var v=_s.GetRaw(key);return v==null?fallback:v.Type==JTokenType.String?v.Value<string>():v.ToString(Formatting.None);}
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
