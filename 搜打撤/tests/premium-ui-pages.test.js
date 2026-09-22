import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(path, 'utf8');

describe('基地人物与收藏页的信息架构', () => {
  // 2026-09-22 hub 拆分：断言串分布在壳与两个切片，三文件拼接后仍断言「基地源码含 X」
  const hub = ['game.hub.js', 'game.hub.depart.js', 'game.hub.pages.js']
    .map((f) => src(`game/src/${f}`)).join('\n');
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

  it('影廊版照片结构：黄铜挂件与费用铭牌，拟物减法到位', () => {
    expect(library).toContain('function photoTileHTML');
    expect(library).toContain('class="studio-photo-cost"');
    expect(library).toContain('photo-studio-v3');
    expect(css).toContain('照相馆 4.0：深夜影廊');
    expect(css).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(library).toContain('class="photo-type-mark"');
    expect(library).toContain('class="photo-rarity-mark"');
    // 拟物减法：图钉/卷角/磨损退役；实体感=纸厚阴影+收窄微倾+轻 3D 侧倾+黄铜相片夹
    expect(library).not.toContain('studio-photo-curl');
    expect(library).not.toContain('--photo-pin-x:');
    expect(library).toContain('--photo-tilt:');
    expect(library).toContain('--photo-lean-x:');
    expect(css).toContain('.studio-photo-paper::before');
    expect(css).toContain('perspective:760px');
    expect(css).toContain('--studio-wall:#170f0d');
    expect(css).toContain('linear-gradient(145deg,#f3ecdd,#ddd2ba)');
    // 稀有度=白边右下角 gem 色馆印圆章（双圈套印）；棱彩=幻彩全息贴标
    expect(css).toContain('inset 0 0 0 2px rgba(255,250,236,.4)');
    expect(css).toContain('rgba(215,181,102,.9)');
    // 影廊生图资产挂载：墙纸/牌匾/台面/空态/背签
    expect(css).toContain('assets/ui/photo-studio/wall.webp');
    expect(css).toContain('assets/ui/photo-studio/sign.webp');
    expect(css).toContain('assets/ui/photo-studio/desk.webp');
    expect(css).toContain('assets/ui/photo-studio/empty.webp');
    expect(css).toContain('assets/ui/photo-studio/back.webp');
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
