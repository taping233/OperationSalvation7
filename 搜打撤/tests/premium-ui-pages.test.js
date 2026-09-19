import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(path, 'utf8');

describe('基地人物与收藏页的信息架构', () => {
  const hub = src('game/src/game.hub.js');
  const css = src('game/css/expedition-hub.css');

  it('人物页使用档案墙和汇总数据，而非旧成就列表', () => {
    expect(hub).toContain('class-command-stats');
    expect(hub).toContain('class-dossier-grid');
    expect(hub).toContain('aria-label="人物熟练度档案"');
    expect(css).toContain('.class-dossier-grid');
  });

  it('收藏页以白名单二级标签切换单一内容区', () => {
    expect(hub).toContain("let hubCollectionView = 'backs'");
    expect(hub).toContain("['backs', 'achievements', 'classes'].includes(d.view)");
    expect(hub).toContain('aria-label="收藏分类"');
    expect(hub).toContain('aria-pressed=');
    expect(css).toContain('.collection-tabs');
  });
});

describe('角色卡池与收购台交互契约', () => {
  const altar = src('game/src/game.run.altar.js');
  const shop = src('game/src/game.run.shop.js');

  it('角色卡池默认提供预览，并用原生按钮支持键盘焦点', () => {
    expect(altar).toContain('poolPreviewHTML(pool[0])');
    expect(altar).toContain('<button class="lib-cardwrap pool-card-button');
    expect(altar).toContain("grid.addEventListener('focusin'");
    expect(altar).toContain('aria-label="查看 ${escAttr(c.name)} 详情"');
  });

  it('收购台把规则与可卖卡分区，并明确即时成交', () => {
    expect(shop).toContain('class="sell-ledger"');
    expect(shop).toContain('class="sell-catalog"');
    expect(shop).toContain('点击“确认卖出”后立即成交');
    expect(shop).toContain('class="sell-item-offer"');
  });
});

describe('照相馆陈列交互', () => {
  const library = src('game/src/game.cardslib.js');
  const index = src('game/index.html');
  const css = src('game/css/expedition-library.css');
  const ui = src('game/src/ui.js');

  it('标题入口与页面名称统一为照相馆', () => {
    expect(index).toContain('<span class="c-cn">照相馆</span>');
    expect(index).toContain('<span class="c-en">Photo Studio</span>');
    expect(library).toContain('<h2>[[icon:cards]] 照相馆</h2>');
  });

  it('照片墙使用轻量照片结构并保留费用球', () => {
    expect(library).toContain('function photoTileHTML');
    expect(library).toContain('class="studio-photo-cost"');
    expect(library).toContain('photo-studio-v3');
    expect(css).toContain('照相馆 3.0：轻量照片墙');
    expect(css).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(library).toContain('class="photo-type-mark"');
    expect(library).toContain('class="photo-rarity-mark"');
    expect(library).toContain('class="studio-photo-curl"');
    expect(library).toContain('--photo-pin-x:');
    expect(css).toContain('grid-template-columns:max-content minmax(0,1fr)');
    expect(css).toContain('background:linear-gradient(90deg,#c977a1,#d7b566 34%,#70afa2 66%,#748fbb)');
    expect(css).toContain('--studio-wall:#392b22');
    expect(css).toContain('background:linear-gradient(180deg,#e4e8e1,#c7d0cc)');
    expect(css).toContain('background:linear-gradient(180deg,#c7d1ce,#aebdba)');
    expect(css).toContain('perspective:720px');
    expect(css).toContain('.studio-photo-art::after');
  });

  it('照片墙分批追加，筛选不再替换整个网格节点', () => {
    expect(library).toContain('const LIB_BATCH_SIZE = 24');
    expect(library).toContain('data-act="libLoadMore"');
    expect(library).toContain('setTimeout(renderLibGrid, 120)');
    expect(library).toContain("more.insertAdjacentHTML('beforebegin', added)");
    expect(library).not.toContain('grid.outerHTML = libGridHTML()');
  });

  it('筛选横置、桌面保留选片台，并将编辑工具隔离到编辑模式', () => {
    expect(library).toContain('class="studio-filterbar"');
    expect(library).toContain('aria-label="选中卡牌详情"');
    expect(library).toContain('let libEditMode = false');
    expect(library).toContain('game.devMode && libEditMode');
    expect(library).toContain("grid.addEventListener('keydown'");
  });

  it('大图作为单一弹层接管焦点，并由 Esc 只关闭当前层', () => {
    expect(ui).toContain("el.setAttribute('role', 'dialog')");
    expect(ui).toContain("el.setAttribute('aria-modal', 'true')");
    expect(ui).toContain('class="cz-close"');
    expect(ui).toContain("e.stopPropagation()");
    expect(ui).toContain('previousFocus.focus({ preventScroll: true })');
  });
});
