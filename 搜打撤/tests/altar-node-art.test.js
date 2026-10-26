import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getMapNodeArt, mapNodeArtHTML, mapNodeIconDataUrl } from '../game/src/core/map-node-art.js';
import { NODE_INFO } from '../game/src/core/node-info.js';

describe('祭坛原创图标接入', () => {
  it('地图与详情使用同一原创图源，首脑仍独立使用战斗图', () => {
    expect(getMapNodeArt('altar').url).toContain('altar-symbol-1017-v2.webp');
    expect(mapNodeArtHTML('altar')).toContain(getMapNodeArt('altar').url);
    expect(mapNodeIconDataUrl('altar')).toBeNull();
    expect(getMapNodeArt('boss')).toBe(getMapNodeArt('battle'));
    expect(NODE_INFO.altar[2]).toBe('altar');
  });
  it.each([24,32,48,64])('%ipx详情图保留尺寸边界', extent => {
    expect(mapNodeArtHTML('altar',extent)).toContain(`width:${extent}px;height:${extent}px`);
    expect(mapNodeArtHTML('altar',extent)).not.toContain('NaN');
  });
  it('图标注册与富文本使用同源图且保留资源水晶语义', async () => {
    vi.stubGlobal('MutationObserver', undefined);
    await import('../game/src/core/icons-bitmap.js');
    expect(window.SDT.Icons.url('altar')).toContain('altar-symbol-1017-v2.webp');
    expect(window.SDT.Icons.rich('[[icon:altar]]')).toContain('icon-altar');
    expect(window.SDT.Icons.url('crystal')).toContain('ui/semantic-icons/crystal.svg');
    expect(window.SDT.Icons.url('sparkles')).toContain('ui/semantic-icons/sparkles.svg');
    vi.unstubAllGlobals();
  });
  it('祭坛页面使用专用图标，共用撤离献祭不变', () => {
    const source=readFileSync('game/src/run/game.run.altar.js','utf8');
    expect(source).toContain("icon: '[[icon:altar]]', title: '污染祭坛'");
    expect(source).toContain("UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌'");
    expect(source).toContain("confirmLabel:emergency ? '献祭并撤离' : '确认献祭'");
    expect(readFileSync('game/src/run/game.nest.js','utf8')).toContain('[[icon:altar]] 研究所祭坛');
  });
  it('资源清单含准确字节、SHA和可用来源', () => {
    const {assets}=JSON.parse(readFileSync('game/assets/asset-manifest.json','utf8'));
    const entry=assets.find(a=>a.path==='scenes/map-nodes/altar-symbol-1017-v2.webp');
    const bytes=readFileSync(`game/assets/${entry.path}`);
    expect(entry.bytes).toBe(bytes.length);
    expect(entry.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(existsSync(entry.source)).toBe(true);
  });
});
