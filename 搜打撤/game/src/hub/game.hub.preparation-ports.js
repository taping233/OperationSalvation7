import { CHARACTERS } from '../core/characters.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { homeErrorMessage } from './command-errors.js';
import { homeRequestId } from './game.hub.bridge.js';
import { createHubPreparationFeature } from './game.hub.preparation.js';
import '../../css/preparation.css';
import { collectionHeaderHTML } from '../ui/collection-chrome.js';
import { linkedBackHTML } from '../ui/home-linked-interactions.js';
import { createOverlayReturn } from '../ui/overlay-return-state.js';

// The hub owns navigation and the singleton; this adapter only assembles preparation ports.
export function createHubPreparationAdapter({ SDT, UI, returnToBase, applyPicks, openDeparture }) {
  const feature = createHubPreparationFeature({
    data: {
      readBase,
      readBaseReceipt,
      commitBase,
      slotId: () => SDT.Base.slot,
      captureCurrent: () => {
        const base = SDT.Base, slot = base.slot, generation = base._selectionGeneration;
        return () => SDT.Base === base && base.slot === slot && base._selectionGeneration === generation;
      },
      cardCatalog: () => SDT.Cards.all(),
      characters: () => CHARACTERS.map(character => ({ id: character.id, name: character.name })),
      pets: () => SDT.Base.PETS || [],
      bagCapacity: () => SDT.Base.bagCap(),
      starterCount: () => SDT.MAP?.rules?.starterSha,
      starterCard: () => SDT.Cards.SHA,
    },
    view: {
      openPanel: () => {
        UI.showOverlay('', `<div class="preparation-shell camp-detail">${collectionHeaderHTML({title:'目标与预设',back:linkedBackHTML('preparationBack','返回基地出发页')})}<div id="preparationRoot"></div></div>`, 'page');
        UI.act('preparationBack', createOverlayReturn({
          revision: UI._overlayRevision, getRevision: () => UI._overlayRevision,
          isOpen: () => !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing'),
          back: commit => feature.returnToBase(commit),
          restore: () => {},
        }));
        return document.getElementById('preparationRoot');
      },
      isCurrent: panelRoot => document.getElementById('preparationRoot') === panelRoot
        && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing'),
    },
    navigation: { returnToBase, applyPicks, openDeparture },
    reportError: message => UI.log(message, 'warn'),
    formatError: homeErrorMessage,
    requestId: homeRequestId,
  });
  return feature;
}
