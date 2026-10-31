import { eventOptionState } from '../../game/src/ui/event-option-state.js';
import { patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML,
  rewardSceneHTML, restoreRewardActionFocus } from '../../game/src/ui/reward-scene-view.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../../game/src/ui/overlay-return-state.js';

// Direct factory fixtures use the same concrete presentation functions as the
// runtime composition, without initializing its game/session dependencies.
export const eventPresentationPorts = Object.freeze({
  eventOptionState, richHTML:String,
  patchRewardScene, rewardCardUnitHTML, rewardClaimHTML, rewardExitHTML,
  rewardSceneHTML, restoreRewardActionFocus, captureOverlayReturnState, restoreOverlayReturnState,
});
