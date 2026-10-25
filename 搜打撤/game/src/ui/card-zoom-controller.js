import { reduceMotion } from '../core/motion.js';
import { createCardDescriptionRenderer } from '../cards/card-description-links.js';
import { completeSurfaceMotion } from './motion-completion.js';
import { motionTiming } from './motion-presets.js';
import { invokeUiAction } from './action-dispatch.js';
import { registerScreenOwner, currentScreenOwner } from './screen-owner.js';
import { claimInputIsolation } from './input-isolation.js';
import { createCardZoomContent } from './card-zoom-content.js';
import { loadPhotoSource, releasePhotoSource } from './card-zoom-photo-source.js';

/** Owns one dialog's input, focus, save and motion lifetime.
 * Readers resolve the current host services rather than freezing a game namespace.
 */
export function createCardZoomController({ readCards, readArt, readScale, readSound }) {
  return { show(host, card, opts = /** @type {import("./ui.dom.types.js").CardZoomOptions} */ ({})) {
    if (!card) return;
    const sourceBody = host.el.ovBody;
    const sourceRoot = sourceBody?.firstElementChild;
    const sourceRevision = host._overlayRevision;
    const sourceCurrent = () => (!sourceBody || (host.el.ovBody === sourceBody && sourceBody.firstElementChild === sourceRoot))
      && !(opts.from instanceof Element && !opts.from.isConnected);
    const descriptionRenderer = opts.descriptionRenderer || createCardDescriptionRenderer(readCards()?.all?.() || []);
    const referenceTrail = opts.referenceTrail || [];
    const old = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'));
    if (old) {
      if (typeof old._closeCardZoom === 'function') old._closeCardZoom(true);
      else old.remove();
    }
    const previousFocus = opts.returnFocus instanceof HTMLElement
      ? opts.returnFocus
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const inertHost = host.el.overlay;
    const releaseIsolation = claimInputIsolation(inertHost);
    const content = createCardZoomContent(card, opts, descriptionRenderer, { readCards, readArt });
    const { noteLabel, photoMode, photoFullSrc } = content;
    // The gallery opts into the approved take-photo entrance; other zooms keep their timing.
    const photoAtelierMotion = photoMode && opts.photoMotion === 'atelier';
    const photoEnterMs = photoAtelierMotion ? motionTiming.photoAtelierEnter : motionTiming.photoEnter;
    const photoCloseMs = motionTiming.photoExit;
    const el = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.createElement('div'));
    el.id = 'cardZoom';
    const restoreSource = () => {
      releaseIsolation();
      const owner = currentScreenOwner();
      const active = document.activeElement;
      if (!sourceCurrent() || host._overlayRevision !== sourceRevision || !previousFocus?.isConnected
        || previousFocus.closest('[hidden],[inert],[aria-hidden="true"]') || previousFocus.matches(':disabled')
        || owner && !owner.root.contains(previousFocus)
        || active !== document.body && active !== previousFocus && !el.contains(active)) return;
      previousFocus.focus({ preventScroll:true });
    };
    if (opts.presentation === 'expedition') el.classList.add('expedition-card-zoom');
    if (opts.presentation === 'inventory') el.classList.add('inventory-zoom');
    // 全屏特写期间暂停战斗层常驻动画（09-30 性能审计 F6，铁律①「不出画面即暂停」；
    // page-covered 机制只覆盖 #title，特写挂在 body 之外）：关闭时在 close() 入口摘除
    document.body.classList.add('zoom-open');
    const reducedMotion = photoMode && reduceMotion();   // 权威口径：媒体查询+设置开关（core/motion.js，带缓存）
    if (photoMode) {
      el.classList.add('cz-photo');
      if (photoAtelierMotion) el.classList.add('cz-photo-atelier');
      // Reserve the same artwork ratio before the full-resolution image decodes.
      // Thumbnail and original share composition; this avoids a frame jump on first open.
      const sourceImage = /** @type {HTMLImageElement} */ (opts.from?.querySelector?.('img'));
      const sourceRatio = sourceImage?.naturalHeight > 0 ? sourceImage.naturalWidth / sourceImage.naturalHeight : 1;
      el.style.setProperty('--cz-photo-ratio', String(sourceRatio > 0 ? sourceRatio : 1));
      if (!reducedMotion) el.classList.add('cz-photo-entering');
      el.style.setProperty('--cz-photo-enter-ms', `${photoEnterMs}ms`);
      el.style.setProperty('--cz-photo-close-ms', `${photoCloseMs}ms`);
      el.style.setProperty('--cz-photo-info-delay', photoAtelierMotion ? '100ms' : '0ms');
      el.style.setProperty('--cz-photo-motion-ms', `${photoEnterMs}ms`);
    }
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `${card.name || '卡牌'}大图${opts.hideNote ? '' : `与${noteLabel}`}`);
    el.tabIndex = -1;
    content.fill(el);
    if (referenceTrail.length) {
      const back = document.createElement('button'); back.type = 'button';
      back.className = 'cz-reference-back'; back.textContent = '‹ 返回上一张';
      back.setAttribute('aria-label', '返回上一张卡牌');
      back.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const parent = referenceTrail[referenceTrail.length - 1];
        host.showCardZoom(parent.card, { ...parent.options, referenceTrail: referenceTrail.slice(0, -1), returnFocus: previousFocus });
      });
      el.appendChild(back);
    }
    let closed = false;
    let releaseOwner = () => {};
    const items = opts.getItems?.() || opts.items || [];
    const itemIndex = opts.index ?? items.findIndex(item => item === card || item.id === card.id);
    const browse = direction => {
      if (photoMode || closed) return;
      const live = opts.getItems?.() || items;
      const targetIndex = itemIndex + direction;
      if (!live[targetIndex] || (opts.from instanceof Element && !opts.from.isConnected)) return;
      const target = live[targetIndex];
      // Inventory presenters rebuild their current metadata and guarded actions.
      if (opts.onBrowse) { opts.onBrowse(target, targetIndex); return; }
      const extra = opts.optionsForItem?.(target, targetIndex) || {};
      // Mutating actions belong to their current source card, never to a prior footer.
      host.showCardZoom(target, { ...opts, footer: undefined, ...extra, items:live, index:targetIndex, returnFocus:previousFocus });
    };
    if (!photoMode && items.length > 1 && itemIndex >= 0) {
      const nav = document.createElement('nav'); nav.className = 'cz-list-nav'; nav.setAttribute('aria-label', '浏览同一列表');
      nav.innerHTML = `<button type="button" data-cz-prev${itemIndex === 0 ? ' hidden' : ''} aria-label="上一张卡牌">‹</button><span>${itemIndex + 1} / ${items.length}</span><button type="button" data-cz-next${itemIndex === items.length - 1 ? ' hidden' : ''} aria-label="下一张卡牌">›</button>`;
      nav.querySelector('[data-cz-prev]').addEventListener('click', event => { event.stopPropagation(); browse(-1); });
      nav.querySelector('[data-cz-next]').addEventListener('click', event => { event.stopPropagation(); browse(1); });
      el.append(nav);
    }
    let removed = false;
    let noteSaveTimer = null;
    let negTimer = null;
    let enterTimer = null;
    let photoSourceTimer = null;
    let photoSourceRequest = null;
    let cancelCloseMotion = () => {};
    let finishClose = null;
    let photoLayoutRect = null;
    let photoViewport = null;
    const visiblePhotoSourceRect = () => {
      const source = opts.from;
      if (!source?.isConnected || !source.getClientRects?.().length) return null;
      const rect = source.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return null;
      let left = 0, top = 0, right = window.innerWidth, bottom = window.innerHeight;
      for (let node = source; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        if (node === source) continue;
        const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow);
        const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
        if (!clipsX && !clipsY) continue;
        const clip = node.getBoundingClientRect();
        if (clipsX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
        if (clipsY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
      }
      // A clipped source cannot provide a continuous whole-photo transition.
      if (rect.left < left - 1 || rect.top < top - 1 || rect.right > right + 1 || rect.bottom > bottom + 1) return null;
      return readScale().rect(source);
    };
    const noteInput = /** @type {HTMLTextAreaElement} */ (el.querySelector('.cz-note-input'));
    const noteStatus = /** @type {HTMLElement} */ (el.querySelector('.cz-note-status'));
    const saveNote = () => {
      if (!noteInput || typeof opts.onNoteSave !== 'function') return;
      const saved = opts.onNoteSave(noteInput.value);
      const result = saved && typeof saved === 'object' ? saved : null;
      const persisted = result ? result.ok === true && result.persisted === true : !!saved;
      if (noteStatus) noteStatus.textContent = result && !persisted
        ? '未存档，已暂存本次会话'
        : persisted ? (noteInput.value.trim() ? '已存档' : '尚未撰写')
          : noteInput.value.trim() ? '保存失败，请重试' : '尚未撰写';
      // 存档章跟随真实内容（批次四：写空=章摘下，写了=章盖上）
      /** @type {HTMLElement} */ (el.querySelector('.cz-note'))?.classList.toggle('has', !!(persisted && noteInput.value.trim()));
    };
    if (noteInput) {
      noteInput.addEventListener('input', () => {
        if (noteStatus) noteStatus.textContent = '保存中…';
        clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(saveNote, 240);
      });
      noteInput.addEventListener('blur', () => { clearTimeout(noteSaveTimer); saveNote(); });
    }
    const close = (immediate = false) => {
      releaseOwner();
      if (document.getElementById('cardZoom') === el) document.body.classList.remove('zoom-open');
      releasePhotoSource(photoSourceRequest);
      photoSourceRequest = null;
      if (closed) {
        if (immediate && !removed) {
          clearTimeout(enterTimer);
          clearTimeout(photoSourceTimer);
          cancelCloseMotion();
          removed = true;
          el.remove();
          restoreSource();
        }
        return;
      }
      clearTimeout(noteSaveTimer);
      clearTimeout(enterTimer);
      clearTimeout(photoSourceTimer);
      clearTimeout(negTimer);
      el.classList.remove('cz-neg');
      saveNote();
      closed = true;
      el.inert = true;
      if (photoMode && !immediate && !reducedMotion) {
        const photoPaper = /** @type {HTMLElement} */ (el.querySelector('.cz-photo-paper'));
        const viewportUnchanged = photoViewport
          && photoViewport.width === window.innerWidth
          && photoViewport.height === window.innerHeight
          && photoViewport.scale === readScale().scale();
        const sourceRect = viewportUnchanged ? visiblePhotoSourceRect() : null;
        const targetRect = photoLayoutRect || (photoPaper ? readScale().rect(photoPaper) : null);
        el.style.setProperty('--cz-photo-motion-ms', `${photoCloseMs}ms`);
        el.classList.remove('cz-photo-entering');
        el.classList.add('cz-photo-closing');
        if (photoPaper) {
          if (sourceRect && targetRect?.width > 0) {
            const scale = sourceRect.width / targetRect.width;
            const dx = sourceRect.left + sourceRect.width / 2 - (targetRect.left + targetRect.width / 2);
            const dy = sourceRect.top + sourceRect.height / 2 - (targetRect.top + targetRect.height / 2);
            el.style.setProperty('--cz-photo-to-transform', `translate(${dx}px, ${dy}px) scale(${scale})`);
            el.classList.add('cz-photo-closing-to-source');
          } else {
            el.classList.add('cz-photo-closing-fallback');
          }
        } else {
          el.classList.add('cz-photo-closing-fallback');
        }
        finishClose = () => {
          if (removed) return;
          removed = true;
          cancelCloseMotion();
          el.remove();
          restoreSource();
        };
        cancelCloseMotion = completeSurfaceMotion(photoPaper, finishClose, {
          event:'transitionend', name:'transform', duration:photoCloseMs,
        });
        return;
      }
      // cz-flip 的 animation:none 会一并压掉 czOut，收回前摘掉它恢复出场动画
      // （inline transform/opacity 一并清掉，防中途收回残留）
      const cardEl = /** @type {HTMLElement} */ (el.querySelector(photoMode ? '.cz-photo-image' : '.cz-card'));
      if (cardEl) {
        cardEl.classList.remove('cz-flip');
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
      }
      finishClose = () => {
        if (removed) return;
        removed = true;
        cancelCloseMotion();
        el.remove();
        restoreSource();
      };
      el.classList.add('cz-out');
      cancelCloseMotion = completeSurfaceMotion(cardEl || el, finishClose, {
        name:'czOut', duration:motionTiming.zoomExit, immediate:immediate || reducedMotion,
      });
    };
    el._closeCardZoom = close;
    // 特写挂在 body（overlay 之外），footer 按钮的 data-act 走不到 ovBody 的全局委托；
    // 且不用 {once:true}：点按钮会白白消费掉监听，之后（含 bagZoomRemove 的模拟 backdrop
    // 点击）再也关不掉 → 整页卡死（2026-09-07 老板实测）。故监听常驻：非按钮区域总能收回，
    // footer 按钮（如「移出背包」）在本层直接分发。
    el.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
      if (closed) return;
      const reference = /** @type {HTMLElement} */ (e.target.closest('[data-card-reference]'));
      if (reference) {
        e.preventDefault(); e.stopPropagation();
        if (closed) return;
        const target = descriptionRenderer.getCard(reference.dataset.cardReference);
        if (!target) return;
        const parentOptions = { ...opts };
        delete parentOptions.referenceTrail;
        const targetOptions = opts.createReferenceOptions?.(target) || {};
        host.showCardZoom(target, {
          presentation: opts.presentation, photoMotion: opts.photoMotion, ...targetOptions,
          descriptionRenderer, createReferenceOptions: opts.createReferenceOptions,
          referenceTrail: [...referenceTrail, { card, options: parentOptions }].slice(-16),
          returnFocus: previousFocus,
        });
        return;
      }
      if (e.target.closest('.cz-close')) { close(); return; }
      const btn = /** @type {HTMLElement} */ (e.target.closest('.cz-foot [data-act]'));
      if (btn) {
        if (!sourceCurrent()) { close(); return; }
        invokeUiAction(host, btn, { allowBase:false });
        return;
      }
      if (photoMode) {
        // Layout gaps, info-panel padding and the hint are outside the photo too.
        // Keep the photo and editable/interactive content usable.
        if (!e.target.closest('.cz-photo-paper,.cz-note,button,input,textarea,select,a,[data-term]')) close();
        return;
      }
      if (e.target.closest('.cz-note, .inventory-zoom-info, .cz-list-nav')) return;
      close();
    });
    el.addEventListener('keydown', (e) => {
      if (!e.isComposing && !e.ctrlKey && !e.altKey && !e.metaKey && items.length > 1 && e.target instanceof Element && !e.target.closest('input,textarea,[contenteditable="true"]') && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); e.stopPropagation(); browse(e.key === 'ArrowLeft' ? -1 : 1); return;
      }
      if (e.key === 'Escape') {
        if (e.isComposing || e.keyCode === 229) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [.../** @type {NodeListOf<HTMLButtonElement>} */ (el.querySelectorAll('button,textarea,[href],[tabindex]:not([tabindex="-1"])'))]
        .filter(node => !node.disabled && node.getClientRects().length);
      if (!focusable.length) { e.preventDefault(); el.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }, true);
    document.body.appendChild(el);
    releaseOwner = registerScreenOwner({ root: el, priority: 50, onBack: () => close() });
    if (photoMode) {
      const image = /** @type {HTMLImageElement} */ (el.querySelector('.cz-photo-image img'));
      const syncImageRatio = () => {
        if (el.isConnected && !closed && image?.naturalHeight > 0) {
          el.style.setProperty('--cz-photo-ratio', String(image.naturalWidth / image.naturalHeight));
        }
      };
      image?.addEventListener('load', syncImageRatio);
      syncImageRatio();
    }
    if (photoFullSrc) {
      photoSourceTimer = setTimeout(() => {
        const visibleImage = /** @type {HTMLImageElement} */ (el.querySelector('.cz-photo-image img'));
        if (!visibleImage || !el.isConnected || closed || visibleImage.src === new URL(photoFullSrc, document.baseURI).href) return;
        photoSourceRequest = loadPhotoSource(el, photoFullSrc, visibleImage);
      }, reducedMotion ? 0 : photoEnterMs);
    }
    // 大图显式解码，防 IAB 合成黑窗（同池页首屏/战斗手牌修法；2026-09-20 走查实锤特写黑窗）
    if (readArt() && readArt().decodeIn) readArt().decodeIn(el);
    // 彩蛋：长按大图 600ms「看底片」（挂 cz-neg，负片样式 scoped 在照相馆入口），松开恢复
    const zoomCard = el.querySelector(photoMode ? '.cz-photo-image' : '.cz-card');
    const clearNeg = () => { clearTimeout(negTimer); el.classList.remove('cz-neg'); };
    zoomCard?.addEventListener('pointerdown', () => {
      clearTimeout(negTimer);
      negTimer = setTimeout(() => el.classList.add('cz-neg'), 600);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      zoomCard?.addEventListener(ev, clearNeg));
    /** @type {HTMLElement} */ (el.querySelector('.cz-close'))?.focus({ preventScroll: true });
    const photoPaper = photoMode ? /** @type {HTMLElement} */ (el.querySelector('.cz-photo-paper')) : null;
    if (photoPaper) {
      // Measure the final paper box without its entrance transform; keep this natural rect
      // for reverse FLIP even when the user closes before the entrance finishes.
      const wasEntering = el.classList.contains('cz-photo-entering');
      const oldTransition = photoPaper.style.transition;
      photoPaper.style.transition = 'none';
      if (wasEntering) el.classList.remove('cz-photo-entering');
      photoLayoutRect = readScale().rect(photoPaper);
      photoViewport = { width: window.innerWidth, height: window.innerHeight, scale: readScale().scale() };
      if (wasEntering) el.classList.add('cz-photo-entering');
      void photoPaper.offsetWidth;
      photoPaper.style.transition = oldTransition;
    }
    // FLIP 起点终点都取布局口径（UiScale.rect）：dx/dy 喂 transform（布局值），zoom≠1 才不错位
    const fromR = photoMode ? visiblePhotoSourceRect()
      : opts.from && (opts.from.getBoundingClientRect ? readScale().rect(opts.from) : opts.from);
    if (photoMode) {
      if (fromR?.width > 0 && photoLayoutRect?.width > 0 && !reducedMotion) {
        // Commit the source pose without a transition before transitioning to the final pose.
        // Otherwise changing the source CSS variable starts a competing transition from .92.
        const previousTransition = photoPaper.style.transition;
        photoPaper.style.transition = 'none';
        const scale = fromR.width / photoLayoutRect.width;
        const dx = fromR.left + fromR.width / 2 - (photoLayoutRect.left + photoLayoutRect.width / 2);
        const dy = fromR.top + fromR.height / 2 - (photoLayoutRect.top + photoLayoutRect.height / 2);
        el.style.setProperty('--cz-photo-from-transform', `translate(${dx}px, ${dy}px) scale(${scale})`);
        el.classList.add('cz-photo-flipping');
        void photoPaper.offsetWidth;
        photoPaper.style.transition = previousTransition;
        el.classList.remove('cz-photo-entering');
        enterTimer = setTimeout(() => el.classList.remove('cz-photo-flipping'), photoEnterMs + 20);
      } else {
        el.classList.add(reducedMotion ? 'cz-photo-reduced' : 'cz-photo-flipping');
        void photoPaper?.offsetWidth;
        el.classList.remove('cz-photo-entering');
        if (!reducedMotion) enterTimer = setTimeout(() => el.classList.remove('cz-photo-flipping'), photoEnterMs + 20);
      }
    } else if (fromR && fromR.width > 0) {
      const cardEl = /** @type {HTMLElement} */ (el.querySelector('.cz-card'));
      const toR = readScale().rect(cardEl);
      if (toR.width > 0) {
        // FLIP：先摆到来源卡位置与等比尺寸（中心对齐），下一帧过渡到居中位。
        // 起步带低透明度 + 缓和曲线（.22,.61）：观感是"卡从原位浮现长大"，
        // 快曲线会让卡像从屏幕外冲进来（2026-09-12 老板复验反馈）。
        const s = fromR.width / toR.width;
        const dx = (fromR.left + fromR.width / 2) - (toR.left + toR.width / 2);
        const dy = (fromR.top + fromR.height / 2) - (toR.top + toR.height / 2);
        cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
        cardEl.style.opacity = '0.25';
        cardEl.classList.add('cz-flip');
        // 强制 reflow 落定初态再清空即触发过渡——不能用双 rAF：后台窗口 rAF
        // 停转会永远冻在起点（2026-09-12 实测），reflow 同步触发无此依赖。
        void cardEl.offsetWidth;
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
      }
    }
    readSound().sfx('hover');
  } };
}
