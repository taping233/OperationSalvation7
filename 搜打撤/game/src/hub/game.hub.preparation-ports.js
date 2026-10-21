import { CHARACTERS } from '../core/characters.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { homeErrorMessage } from './command-errors.js';
import { homeRequestId } from './game.hub.bridge.js';
import { createHubPreparationFeature } from './game.hub.preparation.js';
import '../../css/preparation.css';

// The hub owns navigation and the singleton; this adapter only assembles preparation ports.
export function createHubPreparationAdapter({ SDT, UI, returnToBase, applyPicks, openDeparture }) {
  const feature = createHubPreparationFeature({
    data: {
      readBase,
      readBaseReceipt,
      commitBase,
      slotId: () => SDT.Base.slot,
      cardCatalog: () => SDT.Cards.all(),
      characters: () => CHARACTERS.map(character => ({ id: character.id, name: character.name })),
      pets: () => SDT.Base.PETS || [],
      bagCapacity: () => SDT.Base.bagCap(),
      starterCount: () => SDT.MAP?.rules?.starterSha,
      starterCard: () => SDT.Cards.SHA,
    },
    view: {
      openPanel: () => {
        UI.showOverlay('', '<div class="preparation-shell camp-detail"><button class="ov-btn" data-act="preparationBack">← 返回基地出发页</button><div id="preparationRoot"></div></div>', 'page');
        UI.act('preparationBack', () => feature.returnToBase());
        return document.getElementById('preparationRoot');
      },
    },
    navigation: { returnToBase, applyPicks, openDeparture },
    reportError: message => UI.log(message, 'warn'),
    formatError: homeErrorMessage,
    requestId: homeRequestId,
  });
  return feature;
}
