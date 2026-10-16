// Materialized-page fixtures exercise the real facade hot path synchronously.
// Cold loading, cancellation and retries are covered in menu-pages-lazy-entry.test.js.
import { createGameMenuController as createFacade } from '../../game/src/ui/game.menu.js';
import { createGameMenuPages } from '../../game/src/ui/game.menu.pages.js';
export function createGameMenuController(deps) {
  return createFacade(deps, { pageFactory: createGameMenuPages });
}
