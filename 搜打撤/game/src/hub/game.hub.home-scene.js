import { characterFor, characterName } from '../core/characters.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { getCollection } from './collection.commands.js';
import { createHomeCommands } from '../home/home.commands.js';
import { presentHome, homeErrorMessage } from '../home/home.presenter.js';
import { homeRequestId } from './game.hub.bridge.js';

/** Own the optional Home scene and invalidate its async work when the hub changes. */
export function createHubHomeScene({ UI, disposePreparation, renderHub, closeBase, openPanel }) {
  const SDT = window.SDT;
  const homeCommands = createHomeCommands({
    readBase, readBaseReceipt, commitBase,
    getCollection: snapshot => getCollection(snapshot, SDT.Cards),
  });
  let homeController = null;
  let homeSceneRequest = 0;
  const dispose = () => { homeSceneRequest++; homeController?.dispose(); homeController = null; };
  const leave = () => { dispose(); };

  function readHomeView(slot = SDT.Base.slot) {
    const result = readBase(slot);
    if (!result.ok) return result;
    return { ok: true, value: presentHome(result.value, { cardCatalog: SDT.Cards.all(), revision: result.revision }), revision: result.revision };
  }

  function render() {
    disposePreparation();
    dispose();
    const request = ++homeSceneRequest, base = SDT.Base, slot = base.slot;
    const read = readHomeView(slot);
    if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); renderHub(); return; }
    UI.showOverlay('', '<div id="homeSceneHost" class="home-scene-host"></div>', 'page');
    const host = document.getElementById('homeSceneHost');
    const overlay = host.closest('#overlay');
    const current = () => request === homeSceneRequest && SDT.Base === base && base.slot === slot
      && host.isConnected && document.getElementById('homeSceneHost') === host
      && !/** @type {HTMLElement} */ (overlay)?.hidden && !overlay?.classList.contains('closing') && !overlay?.hasAttribute('data-ui-closing');
    const refresh = () => {
      if (!current()) return null;
      const next = readHomeView(slot);
      if (next.ok && homeController) homeController.update(next.value);
      return next;
    };
    Promise.all([import('../home/home.scene.js'), import('../home/home.visuals.js')])
      .then(([{ mountHome }, { getM04VisualPack }]) => {
      if (!current()) return;
      const visualPack = getM04VisualPack();
      homeController = mountHome({
      host, view: read.value, assets: {
        ...visualPack,
        characterHTML: characterId => SDT.Art.classArt(characterFor(characterId)?.rulesetId || characterId),
        characterLabel: characterId => characterName(characterId),
        cardHTML: cardId => {
          const card = SDT.Cards.all().find(item => item.id === cardId);
          return card ? SDT.Cards.cardHTML(card, 'sm') : '';
        },
      },
      onIntent: async intent => {
        if (!current()) return null;
        if (intent.type === 'close') { closeBase(); return { ok: true }; }
        if (intent.type === 'openPanel') { openPanel(intent.panel); return { ok: true }; }
        if (intent.type === 'previewPlacement') return { ok: true, value: intent.placement };
        const context = { slotId: slot, requestId: homeRequestId(intent.type), expectedRevision: intent.expectedRevision };
        let result;
        if (intent.type === 'buyFurniture') result = await homeCommands.buyFurniture(context, intent);
        else if (intent.type === 'submitLayout') result = await homeCommands.saveLayout(context, intent);
        else if (intent.type === 'selectDisplay') result = await homeCommands.setDisplay(context, intent);
        else return { ok: false, code: 'INVALID_ARGUMENT', message: '未知基地操作' };
        if (result.ok) {
          if (current()) refresh();
        } else result = { ...result, message: homeErrorMessage(result) };
        return result;
      },
      });
    }).catch(error => {
      if (!current()) return;
      dispose();
      UI.log(`基地场景加载失败：${error?.message || error}；可切换页签后重试。`, 'warn');
      renderHub();
    });
  }

  return Object.freeze({ render, dispose, leave });
}
