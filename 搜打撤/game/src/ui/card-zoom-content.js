import { esc } from '../core/shared.js';
import { DRAW_EXPLANATION, hasDrawExplanation } from '../cards/card-draw-explanation.js';
import { photoMountFor } from '../hub/photo-studio-presentation.js';
import { termKeyFor } from './term-tips.js';

/** Render-only content. Service readers stay live across opens and host reconfiguration. */
export function createCardZoomContent(card, opts, descriptionRenderer, { readCards, readArt }) {
  // 2026-09-19 留言 #29：特写多一个「馆方记录」区，展示老板手写的正式记录（卡牌库可编辑）
  const note = (opts.note != null ? opts.note : (card.note || '')) || '';
  const noteLabel = opts.noteLabel || '备注';
  const notePlaceholder = opts.notePlaceholder || '写备注……';
  const noteHTML = opts.hideNote ? '' : opts.noteEditable ? `
    <label class="cz-note${note && !opts.notePending ? ' has' : ''} editable">
      <span class="cz-note-tag">${esc(noteLabel)}</span>
      <textarea class="cz-note-input" maxlength="240" rows="3" placeholder="${esc(notePlaceholder)}" aria-label="${esc(noteLabel)}">${esc(note)}</textarea>
      <span class="cz-note-status" aria-live="polite">${opts.notePending ? '未存档，已暂存本次会话' : note ? '已存档' : '尚未撰写'}</span>
    </label>` : `
    <div class="cz-note${note ? ' has' : ''}">
      <span class="cz-note-tag">${esc(noteLabel)}</span>
      <p class="cz-note-text">${note ? esc(note) : '暂无备注'}</p>
    </div>`;
  const photoMode = opts.presentation === 'photo';
  const descriptionHTML = descriptionRenderer.render(card.desc || '', card.id, opts.descriptionQuery || '', card);
  const photoArt = photoMode && readArt()?.cardIcon ? readArt().cardIcon(card, { low: true }) : '';
  let photoFullSrc = '';
  if (photoMode && readArt()?.cardIcon) {
    const fullArt = document.createElement('template');
    fullArt.innerHTML = readArt().cardIcon(card);
    photoFullSrc = /** @type {HTMLImageElement} */ (fullArt.content.querySelector('img'))?.getAttribute('src') || '';
  }
  const photoRarity = photoMode ? readCards().rarityOf(card) : '';
  const photoMount = photoMode ? photoMountFor(photoRarity) : null;
  const creatureStats = photoMode && card.type === '生物'
    ? String(card.desc || '').match(/^攻击\s*(\d+)\s*\/\s*生命\s*(\d+)/)
    : null;
  const cardDamage = +(card.dmg || 0);
  const showPhotoDamage = photoMode && readCards().DMG_TYPES.includes(card.type)
    && (cardDamage > 0 || (cardDamage < 0 && card.dmgType === 'attack'));
  const photoStats = photoMode ? [
    card.type && ['类型', card.type === '能力卡' ? '能力' : card.type],
    photoRarity && ['稀有度', photoRarity],
    card.cost != null && ['费用', card.cost],
    creatureStats ? ['攻击', creatureStats[1]] : (showPhotoDamage && [`${readCards().DMG_TYPE_META?.[card.dmgType]?.name || ''}伤害`, card.dmg]),
    creatureStats ? ['生命', creatureStats[2]] : (card.hp != null && ['生命', card.hp]),
  ].filter(Boolean) : [];
  const photoDetails = photoStats.map(([label, value]) => `<div class="cz-photo-detail"><span${termKeyFor(label) ? ` data-term="${termKeyFor(label)}"` : ''}>${esc(label)}</span><b${label === '稀有度' ? ` data-studio-rarity="${esc(photoRarity)}"` : ''}>${esc(value)}</b></div>`).join('');
  const photoIndex = photoMode && opts.photoNumber != null
    ? `<div class="cz-photo-index">藏品编号 № ${esc(opts.photoNumber)}</div>`
    : '';
  const photoHTML = photoMode ? `<div class="cz-photo-layout">
    <div class="cz-photo-main"><div class="cz-photo-paper" data-photo-mount="${photoMount.kind}">
      <span class="studio-mount-mark" aria-hidden="true"></span>
      <div class="cz-photo-image">${photoArt}</div>
      <span class="studio-photo-ornament" aria-hidden="true"><i class="studio-photo-corner corner-tl"></i><i class="studio-photo-corner corner-tr"></i><i class="studio-photo-corner corner-br"></i><i class="studio-photo-corner corner-bl"></i></span>
      <div class="cz-photo-caption">${esc(card.name || '未命名卡牌')}</div>
    </div></div>
    <aside class="cz-photo-info" aria-label="照片背签与卡牌信息">
      <h2 class="cz-photo-title"><span>${esc(card.name || '未命名卡牌')}</span></h2>
      ${photoIndex}
      <div class="cz-photo-details">${photoDetails}</div>
      ${descriptionHTML ? `<div class="cz-photo-rules">${descriptionHTML}</div>` : ''}
      ${hasDrawExplanation(card, readCards().deriveDraw?.(card)) ? `<p class="studio-draw-explanation">${esc(DRAW_EXPLANATION)}</p>` : ''}
      ${noteHTML}
    </aside>
  </div>` : '';
  const fill = el => {
    el.innerHTML = `<div class="cz-backdrop" aria-hidden="true"></div>
      <span class="cz-flash" aria-hidden="true"></span>
      <button type="button" class="cz-close" aria-label="${photoMode ? '收回照片' : '关闭卡牌大图'}">[[icon:cross]]</button>
      ${photoMode ? photoHTML : `<div class="cz-reading-layout"><div class="cz-card">${readCards().cardHTML(card, 'lg')}</div></div>${noteHTML}`}
      ${opts.footer ? `<div class="cz-foot">${opts.footer}</div>` : ''}`;
    if (photoMode) {
      // Keep the dismissal control beside the back-sign, within the same photo group.
      /** @type {HTMLElement} */ (el.querySelector('.cz-photo-info')).prepend(/** @type {HTMLElement} */ (el.querySelector('.cz-close')));
    }
    if (!photoMode && descriptionHTML) {
      const description = /** @type {HTMLElement} */ (el.querySelector('.cz-card .hsc-desc'));
      if (description) description.innerHTML = '<span>' + descriptionHTML + '</span>';
    }
  };
  return { noteLabel, photoMode, photoFullSrc, fill };
}
