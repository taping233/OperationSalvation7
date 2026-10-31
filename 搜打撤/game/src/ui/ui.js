import { createCardZoomController } from './card-zoom-controller.js';
import { overlayMethods } from './overlay.js';
import { cinematicsMethods } from './cinematics.js';
import { hudMethods } from './hud.js';
import { invokeUiAction } from './action-dispatch.js';
import { confirmAction } from './confirm-dialog.js';
import '../../css/review-ui.css';
import { installRunTopBar } from './run-top-bar.js';
  /* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
  const SDT = window.SDT;
  const $ = (id) => document.getElementById(id);

const cardZoomController = createCardZoomController({
  readCards: () => window.SDT.Cards,
  readArt: () => window.SDT.Art,
  readScale: () => window.SDT.UiScale,
  readSound: () => window.SDT.Sound,
});

/* ui.js —— UI 壳：保留引导（init/act）、卡牌特写入口与状态字段；
 * 弹窗容器/演出过渡/HUD 三块行为拆入 overlay.js / cinematics.js / hud.js 的方法包，
 * 此处展开组装。方法包内部一律走 this，调用方仍经 SDT.UI / import { UI }，导出面不变。 */
  const UI = {
    confirmAction,
    .../** @type {import('./ui.dom.types.js').UILazyState} */ ({}),
    el: /** @type {Partial<import('./ui.dom.types.js').UIElements>} */ ({}),
    _acts: {},   // 弹窗按钮动作表：data-act → 回调
    _baseActs: {},   // 全局基础动作（页面同名动作优先）
    _roomActive: false, // 地图格子的整段结算都保持为全屏房间页

    init() {
      try { document.body.classList.toggle('reading-large', localStorage.getItem('sdt-reading-large') === '1'); } catch { /* default reading size */ }
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
      installRunTopBar(this);
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
          if (e.isComposing || e.keyCode === 229 || this.el.ovBody.querySelector('[data-key-listening="true"]')) return;
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
    showCardZoom(card, opts = /** @type {import("./ui.dom.types.js").CardZoomOptions} */ ({})) {
      return cardZoomController.show(this, card, opts);
    },

    ...overlayMethods,     // 弹窗容器：帮助/开层/关层/Esc/房间视图/焦点陷阱（实现在 overlay.js）
    ...cinematicsMethods,  // 演出与过渡：popNum/传说特写/奖励演出/屏幕进出（实现在 cinematics.js）
    .../** @type {import('./ui.dom.types.js').MountedHudMethods} */ (hudMethods),         // HUD：refresh/日志/tooltip 桩（实现在 hud.js）
  };

  SDT.UI = UI;

export { UI };
