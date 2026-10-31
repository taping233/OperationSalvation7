// Only real movement records a first visit and advances the displayed move count.
// Initial placement and restoration do not call this shared arrival bookkeeping.
export function recordMapNodeArrival(game, li, idx) {
  if (game.explored) game.explored[`${li},${idx}`] = 1;
  game.turn++;
}
