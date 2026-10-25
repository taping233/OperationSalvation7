import { playOutcomeFeedback } from './outcome-feedback.js';

// Presents effects already settled by the caller; never heals, grants or saves.
export function playFireRestFeedback(root, { kind, hpBefore = 0, hpAfter = 0, maxHp = 1,
  cards = [], cardHTML, isCurrent = () => true }) {
  return playOutcomeFeedback(root,{kind,hpBefore,hpAfter,maxHp,cards,cardHTML,isCurrent,
    surface:root?.querySelector('.sc-fire'),compact:false,blocking:true});
}
