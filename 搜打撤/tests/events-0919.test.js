import { describe, expect, it, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import artMapping from '../game/data/art-mapping.json';
import scenes from '../game/data/scenes.json';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
});

describe('0919 都市污染事件池', () => {
  it('武装截查编译剧情同时提供迎战和无奖励逃离', async () => {
    const {eventNarrative}=await import('../game/src/home/narrative.js');
    const narrative=await eventNarrative('tt6-bandits');
    expect(narrative.choices.map(choice=>choice.effect)).toEqual(['bandits_fight','bandits_escape']);
    expect(narrative.choices[1].detail).toContain('不战斗');
  });

  it('旧档事件描述更新为现行选项，自定义描述保留', () => {
    const marker='sdt-events-0919-v3-seeded';const old=localStorage.getItem(marker);localStorage.setItem(marker,'1');
    let stored=[{id:'tt6-mystery',name:'实验室余粮',desc:'你获得员工通行证A碎片和 2 币。'},{id:'tt6-relief',desc:'我的自定义救护站'}];
    const all=vi.spyOn(C,'all').mockImplementation(()=>stored);
    const save=vi.spyOn(C,'saveAll').mockImplementation(cards=>{stored=structuredClone(cards);return true;});
    try {
      C.ensureEvents0919();expect(stored[0].desc).toContain('1~3 点');expect(stored[1].desc).toBe('我的自定义救护站');
      C.ensureEvents0919();expect(save).toHaveBeenCalledOnce();
    } finally {all.mockRestore();save.mockRestore();if(old===null)localStorage.removeItem(marker);else localStorage.setItem(marker,old);}
  });
  it('含 10 个改名旧事件与 9 个新事件，且全部进入实机事件卡池', () => {
    expect(C.EVENTS_0919).toHaveLength(19);
    const ids = new Set(C.all().filter(c => c.type === '事件').map(c => c.id));
    C.EVENTS_0919.forEach(card => expect(ids.has(card.id), `${card.id} 未进入事件池`).toBe(true));
  });

  it('9 个新事件都有独立卡面映射与整页场景映射', () => {
    const ids = C.EVENTS_0919.map(c => c.id).filter(id => id.startsWith('ev19-'));
    expect(ids).toHaveLength(9);
    ids.forEach(id => {
      expect(artMapping.eventCardArt[id], `${id} 缺卡面图映射`).toBe(`event-${id}`);
      expect(scenes.eventSceneMeta[id], `${id} 缺场景映射`).toHaveLength(3);
    });
  });

  it('九项需求的结算端口均已实装，不是卡面占位描述', () => {
    const source = readFileSync(path.join(ROOT, 'game', 'src', 'run', 'game.run.events.js'), 'utf8');
    [
      'ev19-vital', 'ev19-pearlbox', 'ev19-fireballs', 'ev19-classchest', 'ev19-recode',
      'ev19-potions', 'ev19-arrows', 'ev19-gamble', 'ev19-quartermaster',
    ].forEach(id => expect(source).toContain(`'${id}'`));
    expect(source).toContain('const guaranteed = attemptNumber >= 5;');
    expect(source).toContain("{label:'本次落空',value:false},{label:'拿走三张卡',value:true}");
    expect(source).toContain("kind: 'medium', isClass: true");
    expect(source).toContain("['武术', '法术', '装备']");
  });
});


describe('封存储备库标题', () => {
  it('定版标题与三种箱随机一个的现行规则一致', () => {
    const card = C.EVENTS_0919.find(c => c.id === 'tt6-chestdraw');
    expect(card.name).toBe('封存储备库');
    expect(card.desc).toBe('从军用保险柜、密封物资箱、小型物资箱中随机抽取 1 个开启，或领取木材与口粮各 1 张。');
    const source = readFileSync(path.join(ROOT, 'game/src/run/game.run.events.js'), 'utf8');
    expect(source).toContain("{label:'小型物资箱',value:'small'},{label:'密封物资箱',value:'medium'},{label:'军用保险柜',value:'large'}");
    expect(source).toContain("openChestsOnCell([{ kind }], '你投骰选中的物资箱')");
  });

  it.each(['false', 'throw'])('已盖旧章只改旧标题，保存 %s 后可重试且幂等', failure => {
    const marker = 'sdt-events-0919-v3-seeded';
    const prior = localStorage.getItem(marker);
    localStorage.setItem(marker, '1');
    const original = [
      { id: 'tt6-chestdraw', name: '熔断双箱', desc: '自定义规则', value: 9, custom: true },
      { id: 'other', name: '熔断双箱' },
    ];
    let stored = structuredClone(original);
    const all = vi.spyOn(C, 'all').mockImplementation(() => stored);
    const save = vi.spyOn(C, 'saveAll').mockImplementationOnce(() => {
      if (failure === 'throw') throw new Error('storage unavailable');
      return false;
    }).mockImplementation(cards => { stored = structuredClone(cards); return true; });
    try {
      C.ensureEvents0919();
      expect(stored).toEqual(original);
      C.ensureEvents0919();
      expect(stored).toEqual([{ ...original[0], name: '封存储备库' }, original[1]]);
      C.ensureEvents0919();
      expect(save).toHaveBeenCalledTimes(2);
      stored[0].name = '我的箱子';
      C.ensureEvents0919();
      expect(stored[0].name).toBe('我的箱子');
      expect(save).toHaveBeenCalledTimes(2);
    } finally {
      all.mockRestore(); save.mockRestore();
      if (prior === null) localStorage.removeItem(marker); else localStorage.setItem(marker, prior);
    }
  });
});
