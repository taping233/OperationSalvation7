import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

const src = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

describe('基地人物与收藏页的信息架构', () => {
  // 基地采用独立子页；页面职责由真实目标模块维护，旧侧栏/旧解释文案不作为契约。
  const hub = src('game/src/hub/game.hub.runtime.js');
  const pages = src('game/src/hub/game.hub.pages.js');
  const personnel = src('game/src/hub/hub.personnel.js');
  const archive = src('game/src/hub/hub.archive-v3.js');

  it('人物管理归属独立页，人物展示与招式沿用对应模块和共同卡牌翻阅', () => {
    expect(hub).toContain('data-page="${hubTab}"');
    expect(hub).toContain("hubAct('hubHome', () => { hubTab = 'deploy'; renderHub(); });");
    expect(hub).toContain(`const hubAct = (name, action) => UI.act(name, (...args) => {
      if (!currentHub()) return;
      return action(...args);
    });`.replace(/\r\n/g, '\n'));
    expect(pages).toContain('return personnelHTML(view)');
    expect(personnel).toContain('aria-label="人物切换"');
    expect(personnel).toContain('class="pv12-agent-art"');
    expect(personnel).toContain('class="pv12-agent-data"');
    expect(personnel).toContain('cardBrowserHTML(');
  });

  it('收藏主页面只展示收藏，其他内容经次级入口沿父导航打开', () => {
    const runtimeAst = node => JSON.parse(JSON.stringify(node, (key, value) =>
      ['start', 'end', 'loc', 'raw'].includes(key) ? undefined : value));
    const options = { ecmaVersion: 'latest', sourceType: 'module' };
    const actual = parse(pages, options).body.find(node =>
      node.type === 'FunctionDeclaration' && node.id.name === 'hubAchHTML');
    const expected = parse(`function hubAchHTML(hubCollectionView) {
      return archiveV3HTML({ base:SDT.Base, meta:SDT.Meta, cards:SDT.Cards, art:SDT.Art, view:hubCollectionView });
    }`, options).body[0];
    // Type-only JSDoc and parentheses may vary; the renderer, five injected
    // arguments, evaluation order and returned value must remain exact.
    expect(runtimeAst(actual)).toEqual(runtimeAst(expected));
    expect(hub).toContain("['cards', 'rewards', 'backs', 'achievements', 'classes', 'stories'].includes(d.view)");
    expect(archive).toContain('aria-label="收藏室目录"');
    expect(archive).toContain('data-act="hubCollectionView"');
    expect(archive).toContain('data-archive-view="${currentView}"');
    expect(archive).toContain('collectionCardsHTML(base, cards)');
  });
});

describe('角色卡池与收购台交互契约', () => {
  const altar = src('game/src/run/game.run.class-choice.page.js');
  const shop = src('game/src/run/game.run.shop.js');

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
  const library = src('game/src/hub/game.cardslib.page.js');
  const index = src('game/index.html');
  const css = src('game/css/photo-studio-unified.css');
  const mounts = src('game/css/photo-studio-mounts.css');
  const ui = src('game/src/ui/ui.js');

  it('标题入口与页面名称统一为照相馆（10-04 主页构图批口径：home-plate 按钮）', () => {
    expect(index).toContain('id="btnCardLib"');
    expect(index).toContain('title="照相馆"');
    expect(index).toContain('<span class="home-button-cn">照相馆</span>');
  });

  it('门头突出馆名与馆藏数，照片分类、搜索及结果计数清晰分层（studio-unified 批口径）', () => {
    expect(library).toContain('<h2>照相馆</h2>');
    expect(library).toContain('aria-label="馆藏 ${libCards.length} 张照片"');
    expect(library).toContain('馆藏 <b>${libCards.length}</b> 张照片');
    expect(library).toContain('role="tablist" aria-label="照片分类"');
    expect(library).toContain('aria-label="照片搜索与筛选"');
    expect(library).toContain('id="libResultCount"');
    expect(library).toContain("linkedBackHTML('closeCardPage', '关闭照相馆'");
    expect(library).toContain('placeholder="名称、效果或关键词"');
    expect(library).toContain("import '../../css/photo-studio-unified.css'");
    expect(library).not.toContain('photo-studio-archive.css');
    expect(index).not.toContain('css/page-cardslib.css');
    expect(index).not.toContain('css/photo-studio-craft.css');
  });

  it('影廊版照片结构：黄铜挂件保留，卡牌语言与微倾已删（09-23 拍板）', () => {
    expect(library).toContain('function photoTileHTML');
    expect(library).toContain('photo-studio-v3');
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    // 照片墙上一张照片=画+名字：费用铜币/类型小字/稀有度馆印/瓦片编号不上墙
    expect(library).not.toContain('class="studio-photo-cost"');
    expect(library).not.toContain('class="photo-type-mark"');
    expect(library).not.toContain('class="photo-rarity-mark"');
    expect(css).not.toContain('.studio-photo-cost');
    expect(css).not.toContain('.photo-rarity-mark');
    // 拟物减法：图钉/卷角/磨损退役；微倾/3D 侧倾 09-23 删除（网格不齐）
    expect(library).not.toContain('studio-photo-curl');
    expect(library).not.toContain('--photo-pin-x:');
    expect(library).not.toContain('--photo-tilt:');
    expect(library).not.toContain('--photo-lean-x:');
    expect(css).not.toContain('perspective:760px');
    // 装裱素材与夹子归 mounts，图库布局归 unified；旧房间主题不能重新接入。
    expect(mounts).toContain('.studio-mount-mark');
    expect(mounts).toContain('frame-atelier-v1.png');
    expect(css).toContain('paper-grain.png');
    expect(css).toContain('transition-photo-v2.webp');
    expect(css).not.toContain('leather-archive-v1.png');
    for (const path of ['expedition-library.css']) {
      expect(src(`game/css/${path}`)).not.toMatch(/#overlay[^{}]*\.(?:photo-studio-v3|studio-index-layout|studio-unified|studio-archive|lib-grid)\b/);
    }
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
