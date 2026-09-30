import { describe, expect, it } from 'vitest';
import { createRecoveryCommands } from '../game/src/hub/recovery.commands.js';
import { RunStorage } from '../game/src/hub/game.storage.js';

class MemoryStorage { constructor(seed={}){this.m=new Map(Object.entries(seed));} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} }
const keys = n => ({ base:`sdt-qa-r2-base-${n}`, run:`sdt-qa-r2-run-${n}`, journal:`sdt-qa-r2-tx-${n}` });
const locks = { request: async (_name, _opts, fn) => fn() };
function fixture() {
  const base = { version:2, coins:10, _m01:{revision:0,requests:{}} };
  const run = { version:2, hp:20, _r2:{runId:'run-1',revision:0} };
  const storage = new MemoryStorage({[keys(1).base]:JSON.stringify(base),[keys(1).run]:JSON.stringify(run)});
  const baseApi = { BASE_VERSION:2, SLOT_KEY:n=>keys(n).base, _readForCommit:n=>JSON.parse(storage.getItem(keys(n).base)), _refreshExternal:()=>{} };
  const runStore = { _invalidate:()=>{}, write:()=>false };
  return { storage, baseApi, runStore };
}
const context = {slotId:1,requestId:'same-request',expectedBaseRevision:0,expectedRunRevision:0};
const prepared = {command:'settlement.qa',runId:'run-1',payload:{outcome:'extract'},afterBase:{coins:12},afterRun:null,output:{closed:true}};

describe('R2-a production facade contract with isolated adapter', () => {
  it('真实 Base 适配旧 v1/v2 缺 _m01 时按 revision 0 首次提交并跨重启恢复，坏 metadata 不被正常化', async () => {
    const Base=window.SDT.Base, slot=5;
    const realKeys=n=>({base:Base.SLOT_KEY(n),run:RunStorage.key(n),journal:`sdt-tx-v1-slot${n}`});
    const runStore={_invalidate:()=>{},write:()=>false};
    for (const version of [1,2]) {
      const k=realKeys(slot), requestId=`legacy-${version}`;
      localStorage.setItem(k.base,JSON.stringify({version,coins:10}));
      localStorage.setItem(k.run,JSON.stringify({version:2,hp:20,_r2:{runId:'legacy-run',revision:0}}));
      localStorage.removeItem(k.journal);
      const afterBase=JSON.parse(JSON.stringify(Base._readForCommit(slot)));
      afterBase.coins=12;
      const legacyContext={slotId:slot,requestId,expectedBaseRevision:0,expectedRunRevision:0};
      const legacyPrepared={command:'settlement.legacy',runId:'legacy-run',payload:{version},afterBase,afterRun:null,output:{closed:true}};
      let once=true;
      const interrupted=createRecoveryCommands({storage:localStorage,lockManager:locks,failpoint:p=>{if(once&&p==='after-base'){once=false;throw Error('reboot');}},baseApi:Base,runStore,keyFactory:realKeys});
      expect((await interrupted.commitBaseAndRun(legacyContext,legacyPrepared)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
      const expectedReceipt=JSON.parse(localStorage.getItem(k.journal)).receipt;
      const rebooted=createRecoveryCommands({storage:localStorage,lockManager:locks,baseApi:Base,runStore,keyFactory:realKeys});
      expect(await rebooted.recoverSlot(slot)).toEqual(expectedReceipt);
      expect(await rebooted.commitBaseAndRun(legacyContext,legacyPrepared)).toEqual(expectedReceipt);
      localStorage.removeItem(k.base); localStorage.removeItem(k.run); localStorage.removeItem(k.journal);
    }
    const k=realKeys(slot);
    localStorage.setItem(k.base,JSON.stringify({version:2,coins:10,_m01:{}}));
    localStorage.setItem(k.run,JSON.stringify({version:2,_r2:{runId:'bad-meta-run',revision:0}}));
    const afterBase=JSON.parse(JSON.stringify(Base._readForCommit(slot)));
    const result=await createRecoveryCommands({storage:localStorage,lockManager:locks,baseApi:Base,runStore,keyFactory:realKeys}).commitBaseAndRun(
      {slotId:slot,requestId:'bad-meta',expectedBaseRevision:0,expectedRunRevision:0},
      {command:'settlement.legacy',runId:'bad-meta-run',afterBase,afterRun:null});
    expect(result.code).toBe('INVALID_ARGUMENT');
    expect(JSON.parse(localStorage.getItem(k.base))._m01).toEqual({});
    localStorage.removeItem(k.base); localStorage.removeItem(k.run); localStorage.removeItem(k.journal);
  });

  it('合法外壳内的非法 after、未来版本、空基地和错配收据均阻塞并保留现场', async () => {
    const mutations = [
      j => { j.after.baseRaw = 'bad'; },
      j => { const b=JSON.parse(j.after.baseRaw); b.version=99; j.after.baseRaw=JSON.stringify(b); },
      j => { j.after.baseRaw = null; },
      j => { j.receipt.value.runId = 'other-run'; },
    ];
    for (const mutate of mutations) {
      const f=fixture(); let once=true;
      const interrupted=createRecoveryCommands({...f,lockManager:locks,keyFactory:keys,failpoint:p=>{if(once&&p==='after-journal'){once=false;throw Error('stop');}}});
      expect((await interrupted.commitBaseAndRun(context,prepared)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
      const beforeBase=f.storage.getItem(keys(1).base), beforeRun=f.storage.getItem(keys(1).run);
      const j=JSON.parse(f.storage.getItem(keys(1).journal)); mutate(j); f.storage.setItem(keys(1).journal,JSON.stringify(j));
      const result=await createRecoveryCommands({...f,lockManager:locks,keyFactory:keys}).recoverSlot(1);
      expect(result.code).toBe('RECOVERY_BLOCKED');
      expect(f.storage.getItem(keys(1).base)).toBe(beforeBase);
      expect(f.storage.getItem(keys(1).run)).toBe(beforeRun);
      expect(f.storage.getItem(keys(1).journal)).not.toBeNull();
    }
  });

  it('锁与存储读取异常均返回失败 Result', async () => {
    const f=fixture();
    const badLock={request:async()=>{throw Error('lock')}};
    expect((await createRecoveryCommands({...f,lockManager:badLock,keyFactory:keys}).recoverSlot(1)).code).toBe('LOCK_FAILED');
    f.storage.getItem=()=>{throw Error('read')};
    expect((await createRecoveryCommands({...f,lockManager:locks,keyFactory:keys}).recoverSlot(1)).code).toBe('STORAGE_READ_FAILED');
  });

  it('RunStorage.remove 的真实删除异常返回 false，空串 pending 也阻止旧同步写删', () => {
    const slot=4, runKey=RunStorage.key(slot), txKey=`sdt-tx-v1-slot${slot}`;
    localStorage.setItem(runKey,'{}'); localStorage.setItem(txKey,'');
    expect(RunStorage.write(slot,{hp:1})).toBe(false);
    expect(RunStorage.remove(slot)).toBe(false);
    localStorage.removeItem(txKey);
    const original=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(key){if(key===runKey) throw Error('remove'); return original.call(this,key);};
    try { expect(RunStorage.remove(slot)).toBe(false); } finally { Storage.prototype.removeItem=original; localStorage.removeItem(runKey); }
  });

  it('Base.reset 与旧迁移在空串 pending 下先拒绝且不切档或搬移旧数据', () => {
    const Base=window.SDT.Base, slot=3, txKey=`sdt-tx-v1-slot${slot}`, legacy=Base.LEGACY_KEY;
    const oldSlot=Base.slot, oldData=Base.data;
    localStorage.setItem(txKey,''); localStorage.setItem(legacy,'{"legacy":true}'); localStorage.removeItem(Base.SLOT_KEY(slot));
    expect(Base.reset(slot)).toBe(false);
    expect(Base.slot).toBe(oldSlot); expect(Base.data).toBe(oldData);
    expect(Base.migrateLegacy([slot])).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBeNull(); expect(localStorage.getItem(legacy)).not.toBeNull();
    localStorage.removeItem(txKey); localStorage.removeItem(legacy);
  });
  it('完成收据跨模块重建优先于旧revision返回，同ID异参冲突', async () => {
    const f=fixture();
    const one=createRecoveryCommands({...f,lockManager:locks,keyFactory:keys});
    const first=await one.commitBaseAndRun(context,prepared);
    expect(first.ok).toBe(true);
    const rebooted=createRecoveryCommands({...f,lockManager:locks,keyFactory:keys});
    const replay=await rebooted.commitBaseAndRun(context,prepared);
    expect(replay).toEqual(first);
    const conflict=await rebooted.commitBaseAndRun(context,{...prepared,payload:{outcome:'death'}});
    expect(conflict.code).toBe('REQUEST_ID_CONFLICT');
  });

  it('旧同步存储保留稳定runId/递增revision，pending时拒写与拒删', () => {
    const slot=5, runKey=RunStorage.key(slot), txKey=`sdt-tx-v1-slot${slot}`;
    localStorage.removeItem(runKey); localStorage.removeItem(txKey);
    expect(RunStorage.write(slot,{hp:10})).toBe(true);
    const first=JSON.parse(localStorage.getItem(runKey));
    expect(first._r2.revision).toBe(0);
    expect(RunStorage.write(slot,{hp:9})).toBe(true);
    const second=JSON.parse(localStorage.getItem(runKey));
    expect(second._r2).toEqual({runId:first._r2.runId,revision:1});
    localStorage.setItem(txKey,'{}');
    expect(RunStorage.write(slot,{hp:8})).toBe(false);
    expect(RunStorage.remove(slot)).toBe(false);
    expect(localStorage.getItem(runKey)).toBe(JSON.stringify(second));
    localStorage.removeItem(txKey); RunStorage.remove(slot);
  });

  it('缺Web Locks明确拒绝，不写日志或玩家键', async () => {
    const f=fixture(), before=f.storage.getItem(keys(1).base);
    const api=createRecoveryCommands({...f,lockManager:null,keyFactory:keys});
    expect((await api.commitBaseAndRun(context,prepared)).code).toBe('CAPABILITY_UNAVAILABLE');
    expect(f.storage.getItem(keys(1).base)).toBe(before);
    expect(f.storage.getItem(keys(1).journal)).toBeNull();
  });

  it('坏档与未来版本拒绝覆盖', async () => {
    for (const raw of ['{bad', JSON.stringify({version:99,_m01:{revision:0,requests:{}}})]) {
      const f=fixture(); f.storage.setItem(keys(1).base,raw);
      const api=createRecoveryCommands({...f,lockManager:locks,keyFactory:keys});
      expect((await api.commitBaseAndRun(context,prepared)).code).toBe('RECOVERY_BLOCKED');
      expect(f.storage.getItem(keys(1).base)).toBe(raw);
    }
  });
});
