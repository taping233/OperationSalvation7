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
  const dispose = () => { homeController?.dispose(); homeController = null; };
  const leave = () => { homeSceneRequest++; dispose(); };

  function readHomeView() {
    const result = readBase(SDT.Base.slot);
    if (!result.ok) return result;
    return { ok: true, value: presentHome(result.value, { cardCatalog: SDT.Cards.all(), revision: result.revision }), revision: result.revision };
  }

  function render() {
    const request = ++homeSceneRequest;
    disposePreparation();
    dispose();
    const read = readHomeView();
    if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); renderHub(); return; }
    UI.showOverlay('', '<div id="homeSceneHost" class="home-scene-host"></div>', 'page');
    const host = document.getElementById('homeSceneHost');
    const refresh = () => {
      const next = readHomeView();
      if (next.ok && homeController) homeController.update(next.value);
      return next;
    };
    Promise.all([import('../home/home.scene.js'), import('../home/home.visuals.js')])
      .then(([{ mountHome }, { getM04VisualPack }]) => {
      if (request !== homeSceneRequest || !host.isConnected) return;
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
        if (request !== homeSceneRequest) return null;
        if (intent.type === 'close') { closeBase(); return { ok: true }; }
        if (intent.type === 'openPanel') { openPanel(intent.panel); return { ok: true }; }
        if (intent.type === 'previewPlacement') return { ok: true, value: intent.placement };
        const context = { slotId: SDT.Base.slot, requestId: homeRequestId(intent.type), expectedRevision: intent.expectedRevision };
        let result;
        if (intent.type === 'buyFurniture') result = await homeCommands.buyFurniture(context, intent);
        else if (intent.type === 'submitLayout') result = await homeCommands.saveLayout(context, intent);
        else if (intent.type === 'selectDisplay') result = await homeCommands.setDisplay(context, intent);
        else return { ok: false, code: 'INVALID_ARGUMENT', message: '未知基地操作' };
        if (result.ok) {
          if (request === homeSceneRequest) refresh();
        } else result = { ...result, message: homeErrorMessage(result) };
        return result;
      },
      });
    }).catch(error => {
      if (request !== homeSceneRequest) return;
      dispose();
      UI.log(`基地场景加载失败：${error?.message || error}；可切换页签后重试。`, 'warn');
      renderHub();
    });
  }

  return Object.freeze({ render, dispose, leave });
}
