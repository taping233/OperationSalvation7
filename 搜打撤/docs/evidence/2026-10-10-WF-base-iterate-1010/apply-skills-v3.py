from pathlib import Path
root = Path(r'D:\素材\代号柒\搜打撤')
path = root / 'game/src/hub/hub.personnel.js'
with path.open('r', encoding='utf-8', newline='') as stream: text = stream.read()
text = text.replace("import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';", "import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';\nimport { decorateInventoryZoom } from '../ui/inventory-zoom.js';")
start = text.index('function poolReader('); end = text.index('export function personnelHTML(', start)
text = text[:start] + '''function poolHTML(pool, base, cards) {
  return `<div class="pool-controls"><div class="person-pool-toolbar"><nav class="pool-type-tabs" aria-label="招式类型">${[['', '全部'], ...[...new Set(pool.map(card => card.type).filter(Boolean))].map(type => [type, type])].map(([type, label]) => `<button class="mini-btn${browse.poolType === type ? ' ok' : ''}" data-act="personPoolType" data-type="${escAttr(type)}" aria-pressed="${browse.poolType === type}">${esc(label)}</button>`).join('')}</nav><input data-person-pool="query" value="${escAttr(browse.query)}" placeholder="搜索招式" aria-label="搜索人物卡池"><select data-person-pool="status" aria-label="筛选人物卡池归档状态"><option value="">全部归档状态</option><option value="recorded"${browse.poolStatus === 'recorded' ? ' selected' : ''}>已归档</option><option value="unrecorded"${browse.poolStatus === 'unrecorded' ? ' selected' : ''}>未归档</option><option value="excluded"${browse.poolStatus === 'excluded' ? ' selected' : ''}>不计入归档</option></select><span data-person-pool-count></span></div></div>${cardBrowserHTML(`person-pool-${browse.poolCharacter}`, '人物专属招式', pool.map(card => `<button class="person-pool-card" data-browser-key="${escAttr(card.id)}" data-id="${escAttr(card.id)}" data-search="${escAttr(card.name + ' ' + card.desc)}" data-recorded="${poolRecord(card, base).id}" data-type="${escAttr(card.type || '')}" aria-label="放大查看${escAttr(card.name)}"><span class="pool-card-art">${cards.cardHTML(card, 'sm')}</span><b>${esc(card.name)}</b><span>${poolRecord(card, base).label}</span></button>`).join(''))}<div class="pool-empty" hidden><h4>没有匹配的招式</h4><button class="mini-btn" data-act="personPoolReset">显示全部</button></div>`;
}
''' + text[end:]
start = text.index('  const sections = ')
end = text.index('  return `<div class="personnel-v2"', start)
insertion = '''  if (browse.section === 'pool') return `<div class="personnel-v2 personnel-skills" data-section="pool">${header}${sections}<div class="skills-layout"><nav class="skills-roster" aria-label="人物招式切换">${roster.map(entry => `<button class="skills-person${entry.character.id === character.id ? ' on' : ''}" data-act="hubPersonView" data-character="${entry.character.id}" aria-label="查看${escAttr(entry.character.name)}的招式">${art.classAvatarArt(entry.character.id)}<b>${esc(entry.character.name)}</b></button>`).join('')}</nav><section class="skills-content"><header class="skills-heading"><div><h3>${esc(character.name)}</h3><span>${esc(character.rulesetId)} · 专属招式</span></div><button class="mini-btn ok" data-act="hubTab" data-tab="stash" data-view="cards" data-character="${character.id}">培养 →</button></header>${content}</section></div></div>`;
'''
text = text[:end] + insertion + text[end:]
start = text.index('    if (!visible.some(button => button.dataset.id === browse.poolPick)) {')
end = text.index('    for (const button of poolRoot.querySelectorAll', start)
text = text[:start] + "    if (!visible.some(button => button.dataset.id === browse.poolPick)) browse.poolPick = visible[0]?.dataset.id || '';\n" + text[end:]
text = text.replace("    poolRoot.querySelector('.pool-reader').innerHTML = window.SDT.Icons.rich(poolReader(card, window.SDT.Base, window.SDT.Cards));\r\n", '')
text = text.replace("    poolRoot.querySelector('.pool-reader').innerHTML = window.SDT.Icons.rich(poolReader(card, window.SDT.Base, window.SDT.Cards));\n", '')
text = text.replace('    ui.showCardZoom(card, { from }); sound.tick();', '    ui.showCardZoom(card, { from }); decorateInventoryZoom(card); sound.tick();')
text = text.replace("  if (poolRoot) poolRoot.style.setProperty('--pool-controls-height', `${poolRoot.querySelector('.pool-controls').offsetHeight + 20}px`);", '')
text = text.replace("    if (changed) animateReader(poolRoot.querySelector('.pool-reader'));", '')
text = text.replace('    const changed = browse.poolPick !== card.id;', '')
with path.open('w', encoding='utf-8', newline='') as stream: stream.write(text)
