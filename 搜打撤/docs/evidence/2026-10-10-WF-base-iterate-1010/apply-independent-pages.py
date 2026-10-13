from pathlib import Path
import hashlib
import sys

root = Path(r'D:\素材\代号柒\搜打撤')
def once(text, old, new):
    if text.count(old) == 0 and '\r\n' in old:
        old = old.replace('\r\n', '\n'); new = new.replace('\r\n', '\n')
    if text.count(old) != 1: raise RuntimeError(f'Expected one match: {old[:100]}')
    return text.replace(old, new)
def region(text, start, end, replacement):
    left = text.index(start); right = text.index(end, left)
    return text[:left] + replacement + text[right:]
def edit(file, transform):
    path = root / file
    with path.open('r', encoding='utf-8', newline='') as stream: text = stream.read()
    result = transform(text)
    with path.open('w', encoding='utf-8', newline='') as stream: stream.write(result)

def depart(text):
    text = once(text, "import { bindDepartureFilters, updateDepartureView } from './departure.view-updates.js';", "import { bindDepartureFilters, updateDepartureView } from './departure.view-updates.js';\nimport { baseHomeV3HTML } from './hub.home-v3.js';")
    return region(text, '  function hubDeployHTML()', '  // ---------- 出征整备', '''  function hubDeployHTML() {
    const B = SDT.Base;
    const prepared = !!(deployCharacter && deploymentSlot === B.slot);
    return baseHomeV3HTML({ base:B, meta:SDT.Meta, modes:MODES,
      mode:MODES[B.data.selMode] ? B.data.selMode : 'standard', prepared,
      character:characterFor(prepared ? deployCharacter : 'wu'),
      picks:Object.values(deployPick || {}).reduce((sum, count) => sum + count, 0) });
  }

''')

def pages(text):
    protected = text[text.index('    const footerHTML = () => {'):text.index('    const refreshZoom = () => {')]
    text = once(text, "import { materialIllustration } from './hub.visuals.js';", "import { shopV3HTML } from './hub.shop-v3.js';\nimport { archiveV3HTML } from './hub.archive-v3.js';\nimport { decorateInventoryZoom } from '../ui/inventory-zoom.js';\nimport '../../css/base-shop-v3.css';\nimport '../../css/base-archive-v3.css';")
    text = region(text, '  function hubShopHTML()', '  // 仓库看卡', '''  function hubShopHTML() { return shopV3HTML({ base:SDT.Base, cards:SDT.Cards, art:SDT.Art, goods:HUB_SHOP_GOODS }); }
  function hubStashHTML(view = 'cards') { return warehouseHTML(view === 'pocket' ? 'pocket' : 'cards'); }

''')
    text = once(text, '  function openStashCardView(i) {', '  function openStashCardView(i, { from } = {}) {')
    text = once(text, '    UI.showCardZoom(card, { footer: footerHTML() });', '    UI.showCardZoom(card, { footer: footerHTML(), from, returnFocus:from });\n    decorateInventoryZoom(card);')
    text = region(text, '  function openRawItem(kind)', '  // —— 升级页', '''  function openRawItem(kind) {
    const card = SDT.Cards.all().find(item => item.id === (kind === 'wood' ? 'tt-wood' : 'tt-rations'));
    if (!card) return;
    const label = kind === 'wood' ? '木材' : '口粮';
    const target = kind === 'wood' ? 'upgrade' : 'classes';
    const footer = `<div class="raw-material-actions"><b>${label}库存 ${SDT.Base.data[kind] || 0}</b><button class="mini-btn ok" data-act="hubTab" data-tab="${target}"${kind === 'wood' ? '' : ' data-group="pets"'}>${kind === 'wood' ? '扩建' : '伙伴培养'} →</button><button class="mini-btn" data-act="hubTab" data-tab="shop">补给 →</button></div>`;
    UI.showCardZoom(card, { footer });
    decorateInventoryZoom(card, { description:kind === 'wood' ? '用于扩建出征背包与仓库。' : '用于培养远征伙伴，提升安全格。' });
  }

''')
    text = region(text, '  function collRoomHTML()', 'export { hubShopHTML', '''  function hubAchHTML(view) { return archiveV3HTML({ base:SDT.Base, meta:SDT.Meta, cards:SDT.Cards, art:SDT.Art, view }); }

''')
    text = text.replace("import { warehouseHTML, pocketWarehouseHTML, warehouseSectionsHTML } from './hub.warehouse.js';", "import { warehouseHTML } from './hub.warehouse.js';")
    text = text.replace("import { cardBackGalleryHTML, achievementFiltersHTML, achievementProgressText, storyArchiveHTML } from './hub.archive.js';", '')
    text = text.replace("import { facilitiesHTML, logisticsTabsHTML } from './hub.facilities.js';", "import { facilitiesHTML } from './hub.facilities.js';")
    if protected not in text: raise RuntimeError('Protected warehouse footer changed')
    (root/'docs/evidence/2026-10-10-WF-base-iterate-1010/protected-footer-sha256.txt').write_text(hashlib.sha256(protected.encode()).hexdigest(), encoding='utf-8')
    return text

def hub(text):
    text = once(text, "import { selectWarehouseMaterial } from './hub.materials.js';", "import { resourceStripHTML } from './hub.materials.js';\nimport { bindArchiveV3 } from './hub.archive-v3.js';\nimport { courtyardV3HTML, mountCourtyardV3 } from './hub.courtyard-v3.js';\nimport { decorateInventoryZoom } from '../ui/inventory-zoom.js';\nimport '../../css/base-courtyard-v3.css';")
    text = once(text, "let hubPersonView = 'wu';", "let hubPersonView = 'wu';\nlet courtyardView = 'rain';\nlet disposeCourtyard = () => {};")
    text = once(text, '    const currentFocus = focused ? { ...focused.dataset } : null;', '    const currentFocus = focused ? { ...focused.dataset } : null;\n    disposeCourtyard(); disposeCourtyard = () => {};')
    text = once(text, '      : hubAchHTML(hubCollectionView);', "      : hubTab === 'courtyard' ? courtyardV3HTML(courtyardView)\n      : hubAchHTML(hubCollectionView);")
    text = once(text, '<div class="pg hub hub-${hubTab} base-camp" id="hubMain">', '<div class="pg hub hub-${hubTab} base-camp ${hubTab === \'deploy\' ? \'base-home\' : \'base-subpage\'}" id="hubMain" data-page="${hubTab}">')
    text = once(text, "${linkedBackHTML('closeBase', '返回选档', 'hub-back')}", "${linkedBackHTML(hubTab === 'deploy' ? 'closeBase' : 'hubHome', hubTab === 'deploy' ? '返回选档' : '返回基地', 'hub-back')}")
    text = region(text, '          <span class="hub-res">', '        </header>', '          <span class="hub-res">${hubTab === \'deploy\' ? resourceStripHTML(B) : \'\'}</span>\n')
    text = region(text, '          <nav class="hub-tabs"', '          <main class="hub-page', '')
    text = once(text, "      if (!TABS.some(t => t.id === next) && next !== 'upgrade') return;", "      if (!TABS.some(t => t.id === next) && !['upgrade', 'courtyard'].includes(next)) return;\n      document.getElementById('cardZoom')?._closeCardZoom?.(true);\n      if (next === 'courtyard' && ['rain', 'koi'].includes(d.view)) courtyardView = d.view;")
    text = once(text, "      if (d.material && next === 'stash') selectWarehouseMaterial(d.material);", '')
    text = text.replace("['cards', 'materials', 'pocket'].includes(d.view)", "['cards', 'pocket'].includes(d.view)")
    text = once(text, "    UI.act('hubRetryView', () => renderHub());", "    UI.act('hubHome', () => { hubTab = 'deploy'; renderHub(); });\n    UI.act('hubRetryView', () => renderHub());")
    text = once(text, "      if (card) UI.showCardZoom(card, { from });", "      if (card) { UI.showCardZoom(card, { from }); decorateInventoryZoom(card); }")
    text = once(text, 'refresh: renderHub, notify: notice });', 'refresh: renderHub, notify: notice, openCard:openStashCardView });')
    text = once(text, '    bindArchive(UI, renderHub);', '    bindArchive(UI, renderHub);\n    bindArchiveV3({ ui:UI, base:B, meta:M, cards:SDT.Cards, refresh:renderHub });\n    if (hubTab === \'courtyard\') disposeCourtyard = mountCourtyardV3(document.querySelector(\'.courtyard-v3\'), courtyardView);')
    text = once(text, '  function closeBase() {', '  function closeBase() {\n    disposeCourtyard(); disposeCourtyard = () => {};')
    return text

if len(sys.argv) == 1:
    edit('game/src/hub/game.hub.depart.js', depart)
    edit('game/src/hub/game.hub.pages.js', pages)
edit('game/src/hub/game.hub.js', hub)
