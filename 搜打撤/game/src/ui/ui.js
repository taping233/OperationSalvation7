import { esc } from '../core/shared.js';
import { reduceMotion } from '../core/motion.js';
import { createCardDescriptionRenderer } from '../cards/card-description-links.js';
import { DRAW_EXPLANATION, hasDrawExplanation } from '../cards/card-draw-explanation.js';
import { photoMountFor } from '../hub/photo-studio-presentation.js';
import { termKeyFor } from './term-tips.js';
import { overlayMethods } from './overlay.js';
import { cinematicsMethods } from './cinematics.js';
import { hudMethods } from './hud.js';
import { completeSurfaceMotion } from './motion-completion.js';
import { motionTiming } from './motion-presets.js';
import { invokeUiAction } from './action-dispatch.js';
  /* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
  const SDT = window.SDT;
  const $ = (id) => document.getElementById(id);

function releasePhotoSource(request, cancel = false) {
  if (!request) return;
  const image = request.image;
  request.image = request.zoom = request.visibleImage = null;
  if (!image) return;
  image.onload = image.onerror = null;
  // Best effort: Image.decode itself has no abort API. Clear only the probe,
  // never the thumbnail already displayed by the dialog.
  if (cancel) image.src = '';
}

function revealPhotoSource(request) {
  const { image, zoom, visibleImage } = request;
  if (image && zoom?.isConnected && image.naturalHeight > 0) {
    zoom.style.setProperty('--cz-photo-ratio', String(image.naturalWidth / image.naturalHeight));
    visibleImage.src = image.src;
  }
  releasePhotoSource(request);
}

/* ui.js —— UI 壳（09-25 拆分）：保留引导（init/act）、卡牌放大特写 showCardZoom
 * （tests/premium-ui-pages.test.js 对本文件源文本钉死，实现不得外移）与状态字段；
 * 弹窗容器/演出过渡/HUD 三块行为拆入 overlay.js / cinematics.js / hud.js 的方法包，
 * 此处展开组装。方法包内部一律走 this，调用方仍经 SDT.UI / import { UI }，导出面不变。 */
  const UI = {
    .../** @type {import('./ui.dom.types.js').UILazyState} */ ({}),
    el: /** @type {Partial<import('./ui.dom.types.js').UIElements>} */ ({}),
    _acts: {},   // 弹窗按钮动作表：data-act → 回调
    _baseActs: {},   // 全局基础动作（页面同名动作优先）
    _roomActive: false, // 地图格子的整段结算都保持为全屏房间页

    init() {
      this.el = {
        statTurn: $('statTurn'), statValue: $('statValue'),
        hpBar: $('hpBar'), hpBarWrap: $('hpBarWrap'), hpText: $('hpText'), charCoins: $('charCoins'),
        charAtk: $('charAtk'),
        heroAva: $('heroAva'),
        log: $('log'),
        logPanel: $('logPanel'),
        overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'), ovCloseX: $('ovCloseX'),
        tooltip: $('tooltip'),
        tglIndex: /** @type {HTMLInputElement} */ ($('tglIndex')),
        btnExport: $('btnExport'), btnImport: $('btnImport'), btnClear: $('btnClear'),
        devTools: $('devTools'),
        devBattle: $('devBattle'), devBoss: $('devBoss'),
        titleDev: $('titleDev'),
        btnCardDesigner: $('btnCardDesigner'), btnCardLib: $('btnCardLib'),
        viewport: $('viewport'),
        layerZh: $('layerBannerZh'), layerEn: $('layerBannerEn'),
      };
      this.el.ovBody.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
        const btn = /** @type {HTMLElement} */ (e.target.closest('[data-act]'));
        if (!btn) return;
        invokeUiAction(this, btn);
      });
      // 面板右上角 × 与遮罩点击（09-20 老板 P1-1）：都走 closeTopOverlayByEsc 同一条链，
      // 必选流程（事件必选/BOSS 编组/战斗页）探测不到取消语义时按钮自动隐藏、遮罩点击无效。
      this.el.ovCloseX?.addEventListener('click', () => this.closeTopOverlayByEsc());
      this.el.overlay.addEventListener('click', (e) => {
        if (e.target !== this.el.overlay) return;
        if (this._canCancelOverlay()) this.closeTopOverlayByEsc();
      });
      // 帮助弹层（? 按钮）：所有页面共用的基础动作，页面可注册自己的帮助主题
      this._baseActs.openHelp = (d) => this.showHelp(d.page);
      // 设计器等表单的实时输入回调
      this.el.ovBody.addEventListener('input', (e) => {
        if (this._inputHandler) this._inputHandler(e);
      });
      // 卡牌库等页面的悬停回调（大图预览）
      this.el.ovBody.addEventListener('mouseover', (e) => {
        if (this._hoverHandler) this._hoverHandler(e);
      });
      // Overlay 是真正的模态对话框：Tab 不能穿透到背后的地图，Esc 仍遵循
      // closeTopOverlayByEsc 的战斗/必选流程规则。用捕获阶段保证输入框里的 Esc
      // 也能工作，而不会和游戏快捷键互相抢事件。
      this.el.overlay.addEventListener('keydown', (e) => {
        if (this.el.overlay.hidden) return;
        if (e.key === 'Tab') {
          this._trapOverlayFocus(e);
          return;
        }
        if (e.key === 'Escape') {
          // 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是关面板
          if (e.isComposing || e.keyCode === 229) return;
          const zoom = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'));
          // 特写收回时会把焦点还给来源卡；同一次按键的重复消息仍属于特写。
          if (zoom || e.repeat) {
            if (!e.repeat) zoom?._closeCardZoom?.();
            e.preventDefault(); e.stopImmediatePropagation(); return;
          }
          if (this.closeTopOverlayByEsc()) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);
      // 彩蛋（2026-09-07 留言）：连按两下以上头像，左右抖动一下
      let avaTaps = 0, avaTapTimer = null;
      this.el.heroAva.addEventListener('click', () => {
        avaTaps++;
        clearTimeout(avaTapTimer);
        avaTapTimer = setTimeout(() => { avaTaps = 0; }, 600);
        if (avaTaps < 2) return;
        avaTaps = 0;
        const ava = this.el.heroAva;
        ava.classList.remove('ava-shake');
        void ava.offsetWidth;
        ava.classList.add('ava-shake');
      });
    },

    act(name, fn) { this._acts[name] = fn; },

    // 卡牌放大特写（2026-09-07 留言：背包卡面点击放大查看）：
    // 背景虚化压暗，卡牌 lg 大面居中弹出，点击任意处缩回；opts.footer 可挂额外按钮。
    // 2026-09-12 留言：opts.from 传来源卡元素（或 rect）时走 FLIP——从来源卡的位置与
    // 尺寸放大到居中位，替代统一的中央淡入；未传 from 的调用点维持原 czIn 动画。
    // （本方法被 tests/premium-ui-pages.test.js 源码断言钉死在本文件，不得外移）
    showCardZoom(card, opts = /** @type {import("./ui.dom.types.js").CardZoomOptions} */ ({})) {
      if (!card) return;
      const descriptionRenderer = opts.descriptionRenderer || createCardDescriptionRenderer(SDT.Cards?.all?.() || []);
      const referenceTrail = opts.referenceTrail || [];
      const old = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'));
      if (old) {
        if (typeof old._closeCardZoom === 'function') old._closeCardZoom(true);
        else old.remove();
      }
      const previousFocus = opts.returnFocus instanceof HTMLElement
        ? opts.returnFocus
        : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const inertHost = this.el.overlay;
      const overlayWasInert = !!inertHost?.inert;
      if (inertHost) inertHost.inert = true;
      // 2026-09-19 留言 #29：特写多一个「馆方记录」区，展示老板手写的正式记录（卡牌库可编辑）
      const note = (opts.note != null ? opts.note : (card.note || '')) || '';
      const noteLabel = opts.noteLabel || '备注';
      const notePlaceholder = opts.notePlaceholder || '写备注……';
      const noteHTML = opts.hideNote ? '' : opts.noteEditable ? `
        <label class="cz-note${note && !opts.notePending ? ' has' : ''} editable">
          <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>
          <textarea class="cz-note-input" maxlength="240" rows="3" placeholder="${esc(notePlaceholder)}" aria-label="${esc(noteLabel)}">${esc(note)}</textarea>
          <span class="cz-note-status" aria-live="polite">${opts.notePending ? '未存档，已暂存本次会话' : note ? '已存档' : '尚未撰写'}</span>
        </label>` : `
        <div class="cz-note${note ? ' has' : ''}">
          <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>
          <p class="cz-note-text">${note ? esc(note) : '暂无备注'}</p>
        </div>`;
      const photoMode = opts.presentation === 'photo';
      // The gallery opts into the approved take-photo entrance; other zooms keep their timing.
      const photoAtelierMotion = photoMode && opts.photoMotion === 'atelier';
      const photoEnterMs = photoAtelierMotion ? motionTiming.photoAtelierEnter : motionTiming.photoEnter;
      const photoCloseMs = motionTiming.photoExit;
      const photoArt = photoMode && SDT.Art?.cardIcon ? SDT.Art.cardIcon(card, { low: true }) : '';
      let photoFullSrc = '';
      if (photoMode && SDT.Art?.cardIcon) {
        const fullArt = document.createElement('template');
        fullArt.innerHTML = SDT.Art.cardIcon(card);
        photoFullSrc = /** @type {HTMLImageElement} */ (fullArt.content.querySelector('img'))?.getAttribute('src') || '';
      }
      const photoRarity = photoMode ? SDT.Cards.rarityOf(card) : '';
      const photoMount = photoMode ? photoMountFor(photoRarity) : null;
      const creatureStats = photoMode && card.type === '生物'
        ? String(card.desc || '').match(/^攻击\s*(\d+)\s*\/\s*生命\s*(\d+)/)
        : null;
      const cardDamage = +(card.dmg || 0);
      const showPhotoDamage = photoMode && SDT.Cards.DMG_TYPES.includes(card.type)
        && (cardDamage > 0 || (cardDamage < 0 && card.dmgType === 'attack'));
      const photoStats = photoMode ? [
        card.type && ['类型', card.type === '能力卡' ? '能力' : card.type],
        photoRarity && ['稀有度', photoRarity],
        card.cost != null && ['费用', card.cost],
        creatureStats ? ['攻击', creatureStats[1]] : (showPhotoDamage && [`${SDT.Cards.DMG_TYPE_META?.[card.dmgType]?.name || ''}伤害`, card.dmg]),
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
          ${card.desc ? `<div class="cz-photo-rules">${descriptionRenderer.render(card.desc, card.id, opts.descriptionQuery || '')}</div>` : ''}
          ${hasDrawExplanation(card, SDT.Cards.deriveDraw?.(card)) ? `<p class="studio-draw-explanation">${esc(DRAW_EXPLANATION)}</p>` : ''}
          ${noteHTML}
        </aside>
      </div>` : '';
      const el = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.createElement('div'));
      el.id = 'cardZoom';
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
      el.innerHTML = `<div class="cz-backdrop" aria-hidden="true"></div>
        <span class="cz-flash" aria-hidden="true"></span>
        <button type="button" class="cz-close" aria-label="${photoMode ? '收回照片' : '关闭卡牌大图'}">[[icon:cross]]</button>
        ${photoMode ? photoHTML : `<div class="cz-card">${SDT.Cards.cardHTML(card, 'lg')}</div>${noteHTML}`}
        ${opts.footer ? `<div class="cz-foot">${opts.footer}</div>` : ''}`;
      if (photoMode) {
        // Keep the dismissal control beside the back-sign, within the same photo group.
        /** @type {HTMLElement} */ (el.querySelector('.cz-photo-info')).prepend(/** @type {HTMLElement} */ (el.querySelector('.cz-close')));
      }
      if (!photoMode && card.desc) {
        const description = /** @type {HTMLElement} */ (el.querySelector('.cz-card .hsc-desc'));
        if (description) description.innerHTML = '<span>' + descriptionRenderer.render(card.desc, card.id, opts.descriptionQuery || '') + '</span>';
      }
      if (referenceTrail.length) {
        const back = document.createElement('button'); back.type = 'button';
        back.className = 'cz-reference-back'; back.textContent = '‹ 返回上一张';
        back.setAttribute('aria-label', '返回上一张卡牌');
        back.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          const parent = referenceTrail[referenceTrail.length - 1];
          this.showCardZoom(parent.card, { ...parent.options, referenceTrail: referenceTrail.slice(0, -1), returnFocus: previousFocus });
        });
        el.appendChild(back);
      }
      let closed = false;
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
        return SDT.UiScale.rect(source);
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
        document.body.classList.remove('zoom-open');   // 战斗层动画恢复（见上方 zoom-open 挂载处）
        releasePhotoSource(photoSourceRequest, true);
        photoSourceRequest = null;
        if (closed) {
          if (immediate && !removed) {
            clearTimeout(enterTimer);
            clearTimeout(photoSourceTimer);
            cancelCloseMotion();
            removed = true;
            el.remove();
            if (inertHost) inertHost.inert = overlayWasInert;
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
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
            && photoViewport.scale === SDT.UiScale.scale();
          const sourceRect = viewportUnchanged ? visiblePhotoSourceRect() : null;
          const targetRect = photoLayoutRect || (photoPaper ? SDT.UiScale.rect(photoPaper) : null);
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
            if (inertHost) inertHost.inert = overlayWasInert;
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
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
          if (inertHost) inertHost.inert = overlayWasInert;
          if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
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
          this.showCardZoom(target, {
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
          invokeUiAction(this, btn, { allowBase:false });
          return;
        }
        if (photoMode) {
          // Layout gaps, info-panel padding and the hint are outside the photo too.
          // Keep the photo and editable/interactive content usable.
          if (!e.target.closest('.cz-photo-paper,.cz-note,button,input,textarea,select,a,[data-term]')) close();
          return;
        }
        if (e.target.closest('.cz-note, .inventory-zoom-info')) return;
        close();
      });
      el.addEventListener('keydown', (e) => {
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
          const fullImage = new Image();
          const request = { image: fullImage, zoom: el, visibleImage };
          photoSourceRequest = request;
          fullImage.decoding = 'async';
          fullImage.src = photoFullSrc;
          const ready = typeof fullImage.decode === 'function'
            ? fullImage.decode().catch(() => null)
            : new Promise(resolve => { fullImage.onload = resolve; fullImage.onerror = resolve; });
          // Bind only the clearable record; a slow decode must not keep a closed
          // dialog and its source/notes alive through this completion callback.
          ready.then(revealPhotoSource.bind(null, request));
        }, reducedMotion ? 0 : photoEnterMs);
      }
      // 大图显式解码，防 IAB 合成黑窗（同池页首屏/战斗手牌修法；2026-09-20 走查实锤特写黑窗）
      if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(el);
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
        photoLayoutRect = SDT.UiScale.rect(photoPaper);
        photoViewport = { width: window.innerWidth, height: window.innerHeight, scale: SDT.UiScale.scale() };
        if (wasEntering) el.classList.add('cz-photo-entering');
        void photoPaper.offsetWidth;
        photoPaper.style.transition = oldTransition;
      }
      // FLIP 起点终点都取布局口径（UiScale.rect）：dx/dy 喂 transform（布局值），zoom≠1 才不错位
      const fromR = photoMode ? visiblePhotoSourceRect()
        : opts.from && (opts.from.getBoundingClientRect ? SDT.UiScale.rect(opts.from) : opts.from);
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
        const toR = SDT.UiScale.rect(cardEl);
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
      SDT.Sound.sfx('hover');
    },

    ...overlayMethods,     // 弹窗容器：帮助/开层/关层/Esc/房间视图/焦点陷阱（实现在 overlay.js）
    ...cinematicsMethods,  // 演出与过渡：popNum/传说特写/奖励演出/屏幕进出（实现在 cinematics.js）
    .../** @type {import('./ui.dom.types.js').MountedHudMethods} */ (hudMethods),         // HUD：refresh/日志/tooltip 桩（实现在 hud.js）
  };

  SDT.UI = UI;

export { UI };
