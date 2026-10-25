// @vitest-environment jsdom
// WF-xart-z1 批次1 四小修的定向回归（研究来源：docs/evidence/2026-10-03-WF-xart-z1/ 三线研究）：
//   A6-ACH-01 成就/收藏领取失败静默 → 消费端补 else 分支
//   A3-PREP-01 预设资格失败无原因提示 → 摘要追加资格行
//   A6-MENU-01 右键留言基地页签名缺 shop
//   A3-ALTAR-01 祭坛道具路径复原页落默认营火身份
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const hub = readFileSync('game/src/hub/game.hub.runtime.js', 'utf8');
const menu = readFileSync('game/src/ui/game.menu.js', 'utf8');
const altar = readFileSync('game/src/run/game.run.altar.js', 'utf8');

let buildPreparationViewModel, mountPreparationView, commands;
beforeAll(async () => {
  ({ buildPreparationViewModel, mountPreparationView } = await import('../game/src/hub/preparation.view.js'));
  commands = await import('../game/src/hub/preparation.commands.js');
});

describe('A6-ACH-01 成就与收藏领取的失败分支不再静默', () => {
  it('claimAch 消费失败 msg，claimColl 消费 save 失败', () => {
    // meta.claim 的 {ok:false,why:'full'|'save',msg} 回执（meta.js/base-economy.js）必须有消费端
    expect(hub).toMatch(/hubWrite\('claimAch',[\s\S]*?await M\.claim\(d\.id\)[\s\S]*?else if \(r && r\.msg\) UI\.log/);
    expect(hub).toMatch(/hubWrite\('claimColl',[\s\S]*?await M\.claimColl\(d\.id\)[\s\S]*?why === 'full'[\s\S]*?else if \(r && r\.msg\)/);
  });
});

describe('A6-MENU-01 右键留言识别器补齐基地商店页签名', () => {
  it('describeCurrentPage 的页签映射含 shop', () => {
    expect(menu).toContain("deploy: '出发', stash: '仓库', shop: '商店'");
  });
});

describe('A3-ALTAR-01 祭坛道具献祭路径的复原页跟祭坛身份', () => {
  it('openPocketRestore 道具路径传 opts，不落默认营火休整', () => {
    expect(altar).toMatch(/openPocketRestore\(record\.total, done, \{\s*tone:'altar'/);
    expect(altar).toContain('restoreRecord:record');
  });
});

describe('A3-PREP-01 预设摘要给出资格失败原因', () => {
  const card = { id: 'card-a', name: '北境短刀', rarity: '普通', type: '武术' };
  const characters = [{ id: 'wu', name: '无' }];
  const preset = {
    id: 'preset-1', name: '猛攻', characterId: 'wu', petId: null,
    picks: [{ card: { cardId: card.id }, count: 1 }],
  };

  function mount(baseSnapshot) {
    const model = buildPreparationViewModel({
      baseSnapshot, preparation: { tracked: [], presets: [preset] },
      cardCatalog: [card], characters, pets: [], mode: 'standard', bagCapacity: 16,
    });
    const root = document.createElement('div');
    mountPreparationView(root, { model });
    return root;
  }

  it('人物未拥有时摘要给出原因行', () => {
    const root = mount({ stash: [{ card, count: 2 }], characters: {}, pets: {} });
    const summary = root.querySelector('.prep-summary');
    expect(summary.className).toContain('blocked');
    expect(root.querySelector('.prep-qual-hint').textContent).toContain('人物尚未拥有');
  });

  it('人物已拥有时不追加资格提示', () => {
    const root = mount({ stash: [{ card, count: 2 }], characters: { wu: {} }, pets: {} });
    const summary = root.querySelector('.prep-summary');
    expect(summary.textContent).not.toContain('人物尚未拥有');
  });

  it('与 previewDeployment 的资格判定一致：未拥有 → canStart=false', () => {
    const preview = commands.previewDeployment({
      baseSnapshot: { stash: [{ card, count: 2 }], characters: {}, pets: {} },
      preset, mode: 'standard', cardCatalog: [card], characters, pets: [], bagCapacity: 16,
    });
    expect(preview.qualification.characterOwned).toBe(false);
    expect(preview.canStart).toBe(false);
  });
});
