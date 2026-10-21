import { createCardPlayDomain } from './battle.card-play.domain.js';

// Compatibility exports bind the default battle at the call boundary.
export const createBattleCardPlay = ports => createCardPlayDomain({ normalizeCard: ports.normalizeCard || (card => card) }).createBattleCardPlay(ports);
