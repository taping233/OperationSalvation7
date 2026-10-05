// Static URLs let Vite include the shipped audio files in its asset graph.
export const MUSIC_TRACKS = Object.freeze({
  title: new URL('../../assets/music-demo/01-title-frostglass.ogg', import.meta.url).href,
  board: new URL('../../assets/music-demo/02-explore-ashline.ogg', import.meta.url).href,
  battle: new URL('../../assets/music-demo/03-battle-blackpulse.ogg', import.meta.url).href,
  base: new URL('../../assets/music-demo/04-base-morning-haven.ogg', import.meta.url).href,
  shop: new URL('../../assets/music-demo/05-shop-copper-lanterns.ogg', import.meta.url).href,
  fire: new URL('../../assets/music-demo/06-fire-embers-and-snow.ogg', import.meta.url).href,
  event: new URL('../../assets/music-demo/07-event-letter-in-ashes.ogg', import.meta.url).href,
  altar: new URL('../../assets/music-demo/08-altar-hollow-core.ogg', import.meta.url).href,
  extraction: new URL('../../assets/music-demo/09-extraction-last-ferry.ogg', import.meta.url).href,
  'boss-governor': new URL('../../assets/music-demo/10-boss-governor-iron-edict.ogg', import.meta.url).href,
  'boss-brood': new URL('../../assets/music-demo/11-boss-brood-pale-nest.ogg', import.meta.url).href,
  'boss-psionic': new URL('../../assets/music-demo/12-boss-psionic-broken-mirrors.ogg', import.meta.url).href,
  success: new URL('../../assets/music-demo/13-success-homeward-glow.ogg', import.meta.url).href,
  defeat: new URL('../../assets/music-demo/14-defeat-unextinguished-lamp.ogg', import.meta.url).href,
});

const BOSS_TRACKS = Object.freeze({ boss_general: 'boss-governor', boss_orc: 'boss-brood', boss_elem: 'boss-psionic' });
export function resolveMusicScene(mode, scene, bossId = '') {
  if (!mode) return null;
  if (mode === 'battle') return BOSS_TRACKS[bossId] || 'battle';
  if (scene === 'exit') return 'extraction';
  if (scene && MUSIC_TRACKS[scene]) return scene;
  return MUSIC_TRACKS[mode] ? mode : 'board';
}

// Page changes replace a scene. Small help/card/bag overlays keep its music.
export function overlayMusicScene(tone, metadata = {}, previous = null) {
  if (metadata.mode === 'doom') return 'defeat';
  if (tone) return tone;
  if (['bag', 'bagpage', 'chest', 'discover', 'glass', 'wide', true].includes(metadata.mode)) return previous;
  return null;
}
