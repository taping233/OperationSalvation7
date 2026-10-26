// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { framesDiagnosticStatic, summarizeFrameTextures } from '../game/src/battle/view/battle.frames-diagnostic-policy.js';
describe('frame diagnostic policy and non-loading texture accounting', () => {
  it('requires DEV, both explicit probes and static query', () => {
    const query = '?perfProbe=1&flightRecord=1&framesDiagnostic=static';
    expect(framesDiagnosticStatic(true, query)).toBe(true);
    expect(framesDiagnosticStatic(false, query)).toBe(false);
    for (const q of ['', '?framesDiagnostic=static', '?perfProbe=1&framesDiagnostic=static', '?flightRecord=1&framesDiagnostic=static', '?perfProbe=1&flightRecord=1', '?perfProbe=true&flightRecord=1&framesDiagnostic=static', '?perfProbe=1&flightRecord=1&framesDiagnostic=off']) expect(framesDiagnosticStatic(true, q)).toBe(false);
  });
  it('deduplicates BaseTexture identity across texture slots and records using integer physical dimensions', () => {
    const a = { realWidth: 512, realHeight: 342 }, b = { realWidth: 768, realHeight: 512 };
    const records = [{set:new Map([['a',{baseTexture:a}],['b',{baseTexture:a}]])}, {set:new Map([['c',{baseTexture:a}],['d',{baseTexture:b}]])}];
    expect(summarizeFrameTextures(records)).toEqual({textureCount:4,baseTextures:2,basePixels:568320,rgbaEstimateBytes:2273280});
  });
  it('ignores invalid dimensions and never treats absent base textures as image pixels', () => {
    const records=[{set:new Map([['a',{}],['b',{baseTexture:{realWidth:NaN,realHeight:2}}],['c',{baseTexture:{realWidth:2.5,realHeight:3}}]])}];
    expect(summarizeFrameTextures(records)).toEqual({textureCount:3,baseTextures:2,basePixels:0,rgbaEstimateBytes:0});
    expect(summarizeFrameTextures([])).toEqual({textureCount:0,baseTextures:0,basePixels:0,rgbaEstimateBytes:0});
  });
});
