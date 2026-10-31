from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/SaveSystem.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('    public sealed class SaveSystem')
b=s.index('    /// <summary>\n    /// 玩家格子便签',a)
replacement='''    [Serializable] public sealed class SettlementRecord
    {
        public string identity,reason,status;
        public RunSaveData run;
        public List<StashStack> left = new List<StashStack>();
        public ExtractResult extraction;
        public DeathResult death;
        public AbandonResult abandon;
    }

    /// <summary>五档对局、基地与结算回执在同一文件中原子提交。</summary>
    public sealed class SaveSystem
    {
        public const int SlotCount=5;
        public static string Dir
        {
            get {
#if UNITY_EDITOR
                var isolated=Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA");
                if(!string.IsNullOrEmpty(isolated))return Path.GetFullPath(isolated);
#endif
                return Path.Combine(Application.persistentDataPath,"desktop-v1");
            }
        }
        public static string ProfilePath=>Path.Combine(Dir,"profile.json");
        public string LastError {get;private set;}
        public bool LastWriteSucceeded {get;private set;}
        public bool HasReadError {get;private set;}
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
        public void BeginTransaction(){RequireWritable();if(InTransaction)throw new InvalidOperationException("保存事务已经开始。");_before=(JObject)_profile.DeepClone();LastWriteSucceeded=false;}
        public bool CommitTransaction(){if(!InTransaction)throw new InvalidOperationException("没有待提交事务。");var before=_before;_before=null;if(Persist())return true;_profile=before;return false;}
        public void CancelTransaction(){if(_before==null)return;_profile=_before;_before=null;LastWriteSucceeded=false;}
        public bool HasRun(int index){EnsureLoaded();return HasReadError||_profile["runs"][index.ToString()]!=null;}
        public RunSaveData ReadSlot(int index)
        {
            EnsureLoaded();if(HasReadError)return null;
            try {
                if(index<1||index>SlotCount)throw new InvalidDataException("档位超出范围。");
                var token=_profile["runs"][index.ToString()];if(token==null)return null;
                if((string)token["format"]!="sdt-unity-desktop"||token["version"]?.Type!=JTokenType.Integer||(int)token["version"]!=1)throw new InvalidDataException("对局格式不受支持。");
                var raw=token.ToObject<RunSaveData>();
                if(raw==null||raw.slot!=index||raw.hp<0||raw.maxHp<=0||raw.hp>raw.maxHp||raw.coins<0)throw new InvalidDataException("对局状态无效。");
                if(!LayeredMapGenerator.ValidateSnapshot(raw.mapSnapshot,out var reason))throw new InvalidDataException("地图存档无效："+reason);
                if(raw.layerIdx<0||raw.layerIdx>=4||raw.trackPos<0||raw.trackPos>=raw.mapSnapshot.layers[raw.layerIdx].nodes.Count)throw new InvalidDataException("对局位置无效。");
                return raw;
            }catch(Exception e){HasReadError=true;LastError="存档读取失败，原文件已保留："+e.Message;return null;}
        }
        public bool WriteSlot(int index,RunSaveData value)
        {
            LastWriteSucceeded=false;
            try {RequireWritable();if(index<1||index>SlotCount||value==null||value.slot!=index)throw new InvalidDataException("存档档位无效。");_profile["runs"][index.ToString()]=JToken.FromObject(value);if(InTransaction){LastWriteSucceeded=true;return true;}return Persist();}
            catch(Exception e){LastError=e.Message;return false;}
        }
        public void RemoveRun(int index){RequireWritable();((JObject)_profile["runs"]).Remove(index.ToString());if(!InTransaction&&!Persist())throw new IOException(LastError);}
        public SettlementRecord GetSettlement(int slot){EnsureLoaded();return _profile["settlements"][slot.ToString()]?.ToObject<SettlementRecord>();}
        public void PutSettlement(int slot,SettlementRecord record){RequireWritable();_profile["settlements"][slot.ToString()]=JToken.FromObject(record);if(!InTransaction&&!Persist())throw new IOException(LastError);}
        public void RemoveSettlement(int slot){RequireWritable();((JObject)_profile["settlements"]).Remove(slot.ToString());if(!InTransaction&&!Persist())throw new IOException(LastError);}
        public void MigrateLegacy(){}
        public static RunSaveData MigrateRunCharacter(RunSaveData run)=>run;
        public const string CustomCardsKey="sdt-cards-v1";
        public static List<CardDef> LoadCustomCards(SaveSystem saves)=>saves.Global.GetJson(CustomCardsKey)?.ToObject<List<CardDef>>()??new List<CardDef>();
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
            public T Get<T>(string key)where T:class=>_s.GetRaw(key)?.ToObject<T>();
            public JToken GetJson(string key)=>_s.GetRaw(key);
            public void SetJson(string key,object value){_s.SetRaw(key,JToken.FromObject(value));_s.FlushGlobal();}
            public bool Delete(string key){bool ok=_s.DeleteRaw(key);if(ok)_s.FlushGlobal();return ok;}
        }
    }

'''
s=s[:a]+replacement+s[b:]
s=s.replace('// 存档 schema（契约 §5，键名与网页版完全一致，方便从网页版迁移存档）','// 桌面新档 schema；五档与基地统一存于 desktop-v1/profile.json')
p.write_text(s,encoding='utf-8')
