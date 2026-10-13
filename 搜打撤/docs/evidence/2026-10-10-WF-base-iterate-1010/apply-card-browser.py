from pathlib import Path

root = Path(r'D:\素材\代号柒\搜打撤')

def change(file, transform):
    path = root / file
    with path.open('r', encoding='utf-8', newline='') as stream:
        original = stream.read().replace('\r\n', '\n').replace('\n', '\r\n')
    result = transform(original)
    with path.open('w', encoding='utf-8', newline='') as stream:
        stream.write(result)

def once(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError(f'Expected one match: {before[:90]}')
    return text.replace(before, after)

def warehouse(text):
    text = once(text, "import { linkedCostsHTML } from '../ui/home-linked-interactions.js';", "import { linkedCostsHTML } from '../ui/home-linked-interactions.js';\r\nimport { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';")
    start = text.index('function itemArt(')
    end = text.index('function purposeHTML()', start)
    text = text[:start] + '''function warehouseItemsHTML(base, cards) {
  return base.data.stash.map(stack => `<button type="button" class="stash-cell${stack.card.name === state.name ? ' selected' : ''}${base.isCollected(stack.card) ? ' collected' : ''}" data-browser-key="${escAttr(stack.card.name)}" data-name="${escAttr(stack.card.name)}" data-browse-filtered="${!matches(stack)}" aria-label="放大查看${escAttr(stack.card.name)}，持有${stack.count}张" aria-pressed="${stack.card.name === state.name}"><span class="warehouse-card-art">${cards.cardHTML(stack.card, 'sm')}</span><span class="stash-card-caption"><b>${esc(stack.card.name)}</b><small>${esc(stack.card.type)} · ${esc(stack.card.rarity)}</small></span><b class="stack-count">×${stack.count}</b>${base.isCollected(stack.card) ? '<span class="cell-mark">[[icon:check]]</span>' : ''}</button>`).join('');
}
''' .replace('\n','\r\n') + text[end:]
    start = text.index('    <div class="warehouse-layout${rows.length')
    marker = '<div class="warehouse-no-results"'
    end = text.index(marker, start)
    text = text[:start] + '    <div class="warehouse-layout${rows.length ? \'\' : \' no-selection\'}"><section class="warehouse-browser" aria-label="卡牌陈列">${cardBrowserHTML(\'warehouse\', \'战利品卡牌\', warehouseItemsHTML(base, cards))}' + text[end:]
    text = once(text, "  bindCardNavigation(root.querySelector('.stash-cardgrid'), '.stash-cell');", "  const browser = root.querySelector('[data-card-browser]');")
    text = once(text, '      button.hidden = !stack || !matches(stack);', "      button.dataset.browseFiltered = String(!stack || !matches(stack));")
    text = once(text, "    root.querySelector('[data-warehouse-count]').textContent", "    refreshCardBrowser(browser);\r\n    root.querySelector('[data-warehouse-count]').textContent")
    text = once(text, "  for (const input of root.querySelectorAll('[data-warehouse-filter]')) {", '''  bindCardBrowser(browser, { onPage: () => sound.tick(), onOpen: (name, from) => {
    state.name = name; state.confirm = ''; update(); sound.tick();
    const stack = base.data.stash.find(item => item.card.name === name);
    if (stack) ui.showCardZoom(stack.card, { from });
  } });
  bindCardNavigation(browser.querySelector('.card-browser-track'), '.stash-cell', { activate: false });
  for (const input of root.querySelectorAll('[data-warehouse-filter]')) {'''.replace('\n','\r\n'))
    text = once(text, "      state.confirm = '';\r\n      update();", "      state.confirm = '';\r\n      refreshCardBrowser(browser, { reset: true }); update();")
    text = once(text, "state.confirm = ''; update(); sound.tick(); });\r\n  ui.act('warehouseReset'", "state.confirm = ''; refreshCardBrowser(browser, { reset: true }); update(); sound.tick(); });\r\n  ui.act('warehouseReset'")
    text = once(text, "    update();\r\n  });\r\n  ui.act('warehouseZoom'", "    refreshCardBrowser(browser, { reset: true }); update();\r\n  });\r\n  ui.act('warehouseZoom'")
    return text

def personnel(text):
    text = once(text, "import { animateReader, bindCardNavigation } from './hub.presentation.js';", "import { animateReader, bindCardNavigation } from './hub.presentation.js';\r\nimport { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';")
    text = once(text, '<div class="person-pool">${pool.map(card =>', "${cardBrowserHTML('person-pool', '人物专属招式', pool.map(card =>")
    text = once(text, 'data-act="personPoolPick" data-id="${escAttr(card.id)}"', 'data-browser-key="${escAttr(card.id)}" data-id="${escAttr(card.id)}"')
    text = once(text, "</button>`).join('')}</div><div class=\"pool-empty\"", "</button>`).join(''))}<div class=\"pool-empty\"")
    text = once(text, "  const applyPoolFilter = () => {", "  const browser = poolRoot?.querySelector('[data-card-browser]');\r\n  const applyPoolFilter = () => {")
    text = once(text, '      card.hidden = !!', '      const filtered = !!')
    text = once(text, '      if (!card.hidden) count++;', "      card.dataset.browseFiltered = String(filtered);\r\n      if (!filtered) count++;")
    text = once(text, ".filter(button => !button.hidden);\r\n    if (!visible.some", ".filter(button => button.dataset.browseFiltered !== 'true');\r\n    refreshCardBrowser(browser, { reset: true });\r\n    if (!visible.some")
    text = once(text, "  applyPoolFilter();", '''  bindCardBrowser(browser, { onPage: () => sound.tick(), onOpen: (id, from) => {
    const card = window.SDT.Cards.classPool(characterFor(browse.poolCharacter)?.rulesetId).find(item => item.id === id);
    if (!card) return;
    browse.poolPick = card.id;
    for (const button of poolRoot.querySelectorAll('.person-pool-card')) { button.classList.toggle('on', button.dataset.id === id); button.setAttribute('aria-pressed', String(button.dataset.id === id)); }
    poolRoot.querySelector('.pool-reader').innerHTML = window.SDT.Icons.rich(poolReader(card, window.SDT.Base, window.SDT.Cards));
    ui.showCardZoom(card, { from }); sound.tick();
  } });
  applyPoolFilter();'''.replace('\n','\r\n'))
    text = once(text, "  bindCardNavigation(poolRoot?.querySelector('.person-pool'), '.person-pool-card');", "  bindCardNavigation(browser?.querySelector('.card-browser-track'), '.person-pool-card', { activate: false });")
    return text

change('game/src/hub/hub.warehouse.js', warehouse)
change('game/src/hub/hub.personnel.js', personnel)
