// Static URLs let Vite include the shipped audio files in its asset graph.
export const MUSIC_TRACKS = Object.freeze({
  title: new URL('../../assets/music-demo/01-title-frostglass.ogg', import.meta.url).href,
  board: new URL('../../assets/music-demo/02-explore-ashline.ogg', import.meta.url).href,
  battle: new URL('../../assets/music-demo/03-battle-coldfront.ogg', import.meta.url).href,
  shop: new URL('../../assets/music-demo/05-shop-lamplight-deal.ogg', import.meta.url).href,
});

const SCENE_TRACKS = Object.freeze({ title: 'title', base: 'title', success: 'title', defeat: 'title', shop: 'shop' });
export function resolveMusicScene(mode, scene) {
  if (!mode) return null;
  if (mode === 'battle') return 'battle';
  if (scene && SCENE_TRACKS[scene]) return SCENE_TRACKS[scene];
  if (mode === 'base') return 'title';
  return MUSIC_TRACKS[mode] ? mode : 'board';
}

// Page changes replace a scene. Small help/card/bag overlays keep its music.
export function overlayMusicScene(tone, metadata = {}, previous = null) {
  if (metadata.mode === 'doom') return 'defeat';
  if (tone) return tone;
  if (['bag', 'bagpage', 'chest', 'discover', 'glass', 'wide', true].includes(metadata.mode)) return previous;
  return null;
}
