// Single-slot desktop archives; the existing profile transaction owns the atomic replacement.
using System;using System.IO;using System.Linq;using System.Text;using System.Security.Cryptography;using System.Collections.Generic;
using Newtonsoft.Json;using Newtonsoft.Json.Linq;
namespace Sdt.Run
{
    public sealed class SlotArchivePreview
    {
        public int Slot{get;internal set;}public int SourceSlot{get;internal set;}
        public long ExportedAt{get;internal set;}public long SavedAt{get;internal set;}
        public bool Overwrites{get;internal set;}public bool HasRun{get;internal set;}public bool PendingExtraction{get;internal set;}
        internal SaveSystem Owner;internal JObject Values;internal string Before,ProfileHash;internal bool Consumed;
    }
    public sealed partial class SaveSystem
    {
        const string ArchiveFormat="sdt-unity-slot-archive";
        static bool Present(JToken value)=>value!=null&&value.Type!=JTokenType.Null;
        static string Digest(string value){using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
        static void ValidArchiveSlot(int slot){if(slot<1||slot>SlotCount)throw new InvalidDataException("请选择 1～5 档位");}
        static JObject SlotValues(JObject profile,int slot)=>new JObject{
            {"base",profile["global"]?[BaseData.SlotKeyPrefix+slot]?.DeepClone()??JValue.CreateNull()},
            {"run",profile["runs"]?[slot.ToString()]?.DeepClone()??JValue.CreateNull()},
            {"settlement",profile["settlements"]?[slot.ToString()]?.DeepClone()??JValue.CreateNull()}};
        static string ProfileFingerprint()=>File.Exists(ProfilePath)?Digest(File.ReadAllText(ProfilePath)):"missing";
        void ArchiveWritable()
        {
            RequireWritable();if(InTransaction)throw new InvalidOperationException("档案正在保存，请稍后重试。");
            var disk=File.Exists(ProfilePath)?JObject.Parse(File.ReadAllText(ProfilePath)):Empty();
            if(!JToken.DeepEquals(disk,_persisted))throw new IOException("档案已被其他窗口修改，请重新打开游戏再预检；尚未覆盖任何档位。");
        }
        public string ExportSlotArchive(int slot)
        {
            ValidArchiveSlot(slot);EnsureLoaded();if(HasReadError)throw new InvalidDataException("档案文件整体无法读取，原文件已保留。请先保全 "+ProfilePath+"，不能从未知内容中导出单档。");ArchiveWritable();
            var body=new JObject{{"format",ArchiveFormat},{"version",1},{"sourceSlot",slot},{"exportedAt",DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},{"values",SlotValues(_profile,slot)}};
            body["checksum"]=Digest(body.ToString(Formatting.None));return body.ToString(Formatting.Indented);
        }
        public SlotArchivePreview PreviewSlotArchive(string text,int targetSlot)
        {
            ValidArchiveSlot(targetSlot);ArchiveWritable();if(text==null||text.Length>20_000_000)throw new InvalidDataException("存档包为空或过大。");
            var body=JObject.Parse(text);
            if((string)body["format"]!=ArchiveFormat||body["version"]?.Type!=JTokenType.Integer||(int)body["version"]!=1||body["sourceSlot"]?.Type!=JTokenType.Integer)throw new InvalidDataException("仅支持 Unity 桌面版整档备份；此存档包格式不受支持。");
            int source=(int)body["sourceSlot"];ValidArchiveSlot(source);string checksum=(string)body["checksum"];body.Remove("checksum");
            if(checksum==null||checksum.Length!=64||!string.Equals(Digest(body.ToString(Formatting.None)),checksum,StringComparison.Ordinal))throw new InvalidDataException("存档包校验不符，文件可能不完整。");
            var values=body["values"] as JObject;ValidateArchiveValues(values,source);
            // A preview never exposes its mutable snapshot. Recheck both the live target and
            // the profile file before applying, including external replacement since preview.
            var before=SlotValues(_profile,targetSlot);
            var settlement=values["settlement"] as JObject;var run=values["run"] as JObject??settlement?["run"] as JObject;
            return new SlotArchivePreview{Owner=this,Slot=targetSlot,SourceSlot=source,ExportedAt=(long?)body["exportedAt"]??0,SavedAt=(long?)run?["savedAt"]??0,
                Values=(JObject)values.DeepClone(),Before=before.ToString(Formatting.None),ProfileHash=ProfileFingerprint(),Overwrites=before.Properties().Any(p=>Present(p.Value)),HasRun=Present(values["run"]),PendingExtraction=(string)settlement?["status"]=="sorting"};
        }
        public SlotArchivePreview PreviewPreviousSlotArchive(int slot)
        {
            ArchiveWritable();ValidArchiveSlot(slot);string path=ProfilePath+".previous";
            if(!File.Exists(path))throw new InvalidDataException("没有上一份完整备档。可先导出整档保全当前档案。");
            var previous=JObject.Parse(File.ReadAllText(path));
            if((string)previous["format"]!="sdt-unity-profile"||(int?)previous["version"]!=1||!(previous["runs"] is JObject)||!(previous["global"] is JObject)||!(previous["settlements"] is JObject))throw new InvalidDataException("上一备档无法读取，原文件已保留。");
            var body=new JObject{{"format",ArchiveFormat},{"version",1},{"sourceSlot",slot},{"exportedAt",new DateTimeOffset(File.GetLastWriteTimeUtc(path)).ToUnixTimeMilliseconds()},{"values",SlotValues(previous,slot)}};
            body["checksum"]=Digest(body.ToString(Formatting.None));return PreviewSlotArchive(body.ToString(Formatting.None),slot);
        }
        public bool ImportSlotArchive(SlotArchivePreview preview,bool confirm,out string reason)
        {
            reason=null;bool transaction=false;try{
                ArchiveWritable();if(!confirm||preview==null||preview.Owner!=this||preview.Consumed)throw new InvalidOperationException("请先预检文件并明确确认导入目标档位。");
                if(preview.Before!=SlotValues(_profile,preview.Slot).ToString(Formatting.None)||preview.ProfileHash!=ProfileFingerprint())throw new InvalidOperationException("预览后档案已变化，请重新预检，尚未覆盖。");
                ValidateArchiveValues(preview.Values,preview.SourceSlot);var values=(JObject)preview.Values.DeepClone();
                RebindRun(values["run"],preview.Slot);var settlement=values["settlement"] as JObject;
                if(settlement!=null){RebindRun(settlement["run"],preview.Slot);settlement["identity"]=preview.Slot+":"+((int?)settlement["run"]["seed"]??0);}
                ValidateArchiveValues(values,preview.Slot);BeginTransaction();transaction=true;
                SetPartition((JObject)_profile["runs"],preview.Slot.ToString(),values["run"]);
                SetPartition((JObject)_profile["global"],BaseData.SlotKeyPrefix+preview.Slot,values["base"]);
                _globalRevision++;
                SetPartition((JObject)_profile["settlements"],preview.Slot.ToString(),values["settlement"]);
                _slotReadErrors.Remove(preview.Slot);
                if(!CommitTransaction())throw new IOException(LastError);
                preview.Consumed=true;return true;
            }catch(Exception error){if(transaction)CancelTransaction();reason="导入未完成，原档案已保留："+error.Message;return false;}
        }
        static void SetPartition(JObject owner,string key,JToken value){if(Present(value))owner[key]=value;else owner.Remove(key);}
        static void RebindRun(JToken token,int slot)
        {if(!(token is JObject run))return;run["slot"]=slot;if(run["battleRestartCheckpoint"] is JObject checkpoint&&checkpoint["run"] is JObject entry)entry["slot"]=slot;}
        static void ValidateArchiveValues(JObject values,int slot)
        {
            if(values==null||values.Count!=3||new[]{"base","run","settlement"}.Any(key=>values.Property(key)==null))throw new InvalidDataException("整档分区不完整。");
            if(Present(values["base"])){
                if(!(values["base"] is JObject))throw new InvalidDataException("基地主档结构无效。");
                var data=SaveJson.Read<BaseData>(values["base"]);
                if(data==null||data.wood<0||data.rations<0||data.coins<0||data.bagUp<0||data.safeUp<0||data.stashUp<0||data.stash==null||data.pocket==null||data.stash.Concat(data.pocket).Any(s=>s?.card==null||string.IsNullOrEmpty(s.card.id)||s.count<0))throw new InvalidDataException("基地库存或资源记录无效。");
                BaseData.Adopt(data);
            }
            if(Present(values["run"]))ParseValidatedRun(values["run"],slot);
            if(!Present(values["settlement"]))return;
            if(!(values["settlement"] is JObject))throw new InvalidDataException("结算记录无效。");
            var record=SaveJson.Read<SettlementRecord>(values["settlement"]);
            if(record?.run==null||!new[]{"extract","dead","abandon"}.Contains(record.reason)||!new[]{"sorting","complete"}.Contains(record.status)||record.status=="sorting"&&record.reason!="extract")throw new InvalidDataException("结算阶段无效。");
            ParseValidatedRun(values["settlement"]["run"],slot);
            if(record.identity!=slot+":"+record.run.seed||!ValidStacks(record.left)||!ValidStacks(record.keptPocket)||record.status=="sorting"&&record.extraction==null)throw new InvalidDataException("结算身份或待整理卡牌记录无效。");
            if(record.requestSeq<0||record.sourceIdentityVersion<0||record.sourceIdentityVersion>1||record.totalPocketCount<0||record.lostPocketCount<0||record.keptPocket.Sum(s=>(long)s.count)+record.lostPocketCount!=record.totalPocketCount)throw new InvalidDataException("结算概率与进度计数无效。");
            ValidateArchiveReceipt(record.receipt);
            if(record.extraction!=null){if(!ValidStacks(record.extraction.Left)||!ValidStacks(record.extraction.SavedCards)||!ValidStacks(record.extraction.KeptPocket))throw new InvalidDataException("撤离结果卡牌记录无效。");ValidateArchiveReceipt(record.extraction.Receipt);}
            if(record.death!=null){if(!ValidStacks(record.death.SavedStacks))throw new InvalidDataException("抢运结果卡牌记录无效。");ValidateArchiveReceipt(record.death.Receipt);}
            if(record.abandon!=null)ValidateArchiveReceipt(record.abandon.Receipt);
            if(record.status=="sorting"&&Present(values["run"]))throw new InvalidDataException("同档不能同时包含进行中对局与待整理结算。");
        }
        static bool ValidStacks(IEnumerable<StashStack> stacks)=>stacks!=null&&stacks.All(s=>s?.card!=null&&!string.IsNullOrWhiteSpace(s.card.id)&&!string.IsNullOrWhiteSpace(s.card.name)&&s.count>0);
        static void ValidateArchiveReceipt(SettlementReceipt receipt)
        {
            if(receipt==null)return;
            if(receipt.netTake==null||receipt.losses==null||!ValidStacks(receipt.savedCards)||receipt.losses.lostNotable==null||receipt.losses.lostNotable.Any(item=>item==null||string.IsNullOrWhiteSpace(item.name)||item.count<=0))throw new InvalidDataException("结算收据结构无效。");
            if(receipt.netTake.cardsStashed<0||receipt.netTake.pocketKept<0||receipt.netTake.wood<0||receipt.netTake.rations<0||receipt.losses.lostCount<0||receipt.losses.pocketLost<0||receipt.losses.pocketRuleLost<0)throw new InvalidDataException("结算收据数量无效。");
            var memento=receipt.memento;
            if(memento!=null&&(memento.trail==null||memento.moments==null||memento.trail.Any(t=>t==null||t.layer<1||t.layer>4||t.count<0)||memento.moments.Any(text=>text==null)||memento.representative!=null&&(string.IsNullOrWhiteSpace(memento.representative.name)||memento.representative.count<=0)))throw new InvalidDataException("本局纪念记录无效。");
            var review=receipt.battleReview;if(review!=null&&(review.foes==null||review.hits==null||review.foes.Any(foe=>foe==null)||review.hits.Any(hit=>hit==null)))throw new InvalidDataException("战斗摘要结构无效。");
        }
    }
}
