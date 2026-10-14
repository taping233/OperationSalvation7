// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const ports = vi.hoisted(() => ({ read:vi.fn(), receipt:vi.fn(), commit:vi.fn(), apply:vi.fn() }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase:ports.read, readBaseReceipt:ports.receipt, commitBase:ports.commit }));
vi.mock('../game/src/core/art.js', () => ({ SKIN_FULL_ART:{wu:[{id:'casual'}]}, setActiveSkin:ports.apply }));
let selectSkin;
beforeEach(async () => {
  vi.resetModules(); for(const port of Object.values(ports)) port.mockReset();
  window.SDT = { Base:{slot:1, data:{appearance:{selectedSkins:{wu:'casual'}}}} };
  ports.receipt.mockReturnValue({ok:true,value:null});
  ports.read.mockReturnValue({ok:true,revision:1,value:{appearance:{characterSkins:{},selectedSkins:{}}}});
  ({selectSkin}=await import('../game/src/hub/collection.commands.js'));
});
afterEach(() => vi.restoreAllMocks());
const ctx={slotId:1,requestId:'skin-audit',expectedRevision:1};
const input={characterId:'wu',skinId:'casual'};
const result={ok:true,revision:2,value:{output:{characterId:'wu',selectedSkinId:'casual',assetFallback:false}}};
describe('外观命令结果的活动档位身份', () => {
  it('成功提交晚到换档后，不能把旧档皮肤应用到新档全局展示', async () => {
    let finish; ports.commit.mockImplementation(() => new Promise(resolve => {finish=resolve;}));
    const pending=selectSkin(ctx,input); window.SDT.Base.slot=2; finish(result); await pending;
    expect(ports.apply).not.toHaveBeenCalled();
  });
  it('旧档receipt重放也不能改变当前其他档位的全局展示', async () => {
    ports.receipt.mockReturnValue(result); window.SDT.Base.slot=2;
    const replay=await selectSkin(ctx,input); expect(replay.ok).toBe(true); expect(ports.commit).not.toHaveBeenCalled();
    expect(ports.apply).not.toHaveBeenCalled();
  });
  it('当前档合法成功选择仍应用一次且保留结果', async () => {
    ports.commit.mockResolvedValue(result); expect((await selectSkin(ctx,input)).ok).toBe(true);
    expect(ports.apply).toHaveBeenCalledExactlyOnceWith('wu','casual');
  });
});
