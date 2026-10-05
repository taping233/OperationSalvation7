"""Targeted source migration; does not alter audio preferences or user saves."""
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
p=ROOT/'game/src/audio/sound.js';s=p.read_text(encoding='utf-8')
start=s.index('// 原创循环 demo');end=s.index('  let ctx =',start)
s=s[:start]+"import { MUSIC_TRACKS, overlayMusicScene, resolveMusicScene } from './sound.music.catalog.js';\nimport { SceneMusicPlayer } from './sound.music.player.js';\n"+s[end:]
s=s.replace("musicSource = 'scape'","musicSource = 'original'",1)
start=s.index('  const fadeTokens =');end=s.index('  function music(mode)',start)
new="""  let sceneTone = null;
  let battleBossId = '';
  let userGestured = false;
  const musicPlayer = new SceneMusicPlayer((scene, callbacks) => new Howl({
    src: [MUSIC_TRACKS[scene]], format: ['opus'], loop: true, html5: false,
    preload: false, volume: 0, onload: callbacks.load, onloaderror: callbacks.error,
  }), { onError: (scene, error) => console.warn('[music] load failed', scene, error) });
  function currentMusicScene() { return resolveMusicScene(musicMode, sceneTone, battleBoss ? battleBossId : ''); }
  function syncBgm() {
    const visible = typeof document === 'undefined' || !document.hidden;
    const on = !!(musicMode && !muted && !musicOff && userGestured && visible);
    if (scape) {
      scape.setVolume(BASE_MUSIC * dbGain(musicVol) * 0.32 * (ducked ? 0.45 : 1));
      scape.setMode(on && musicSource === 'scape' ? (['title', 'base'].includes(musicMode) ? 'title' : musicMode === 'battle' ? 'battle' : 'board') : null);
      // Dedicated boss scores already carry tension; no synthetic layer over file music.
      scape.setBoss(musicSource === 'scape' && battleBoss);
      scape.setMuted(!on || musicSource === 'original');
    }
    musicPlayer.set(currentMusicScene(), {
      enabled: on && musicSource === 'original',
      volume: BASE_MUSIC * dbGain(musicVol) * (ducked ? 0.45 : 1),
      immediate: muted || musicOff || !visible,
    });
  }
  function scene(tone, asset = '', metadata = {}) {
    const next = overlayMusicScene(tone, { ...metadata, asset }, sceneTone);
    if (next === sceneTone) return;
    sceneTone = next;
    syncBgm();
  }
"""
s=s[:start]+new+s[end:]
s=s.replace("  function music(mode) {\n    if (mode === musicMode)","  function music(mode) {\n    sceneTone = null;\n    if (mode === musicMode)",1)
old="""function setBoss(on) {
    battleBoss = !!on;
    if (scape) scape.setBoss(on);
  }"""
assert old in s
s=s.replace(old,"""function setBoss(on, id = '') {
    battleBoss = !!on;
    battleBossId = battleBoss ? id : '';
    syncBgm();
  }""",1)
s=s.replace('activeBgm().playing()','musicPlayer.playing()')
s=s.replace('sfx, music, setMuted,','sfx, music, scene, setMuted,',1)
s=s.replace('    get musicSource() { return musicSource; },','    get musicSource() { return musicSource; },\n    get musicScene() { return currentMusicScene(); },\n    get musicPlayback() { return musicPlayer.snapshot(); },')
p.write_text(s,encoding='utf-8')
p=ROOT/'game/src/ui/overlay.js';s=p.read_text(encoding='utf-8')
old="SDT.Sound.scene?.(soundTone ? soundTone.slice(3) : null, soundScene?.dataset.assetKey || '');"
assert old in s
s=s.replace(old,"SDT.Sound.scene?.(soundScene?.dataset.musicScene || (soundTone ? soundTone.slice(3) : null), soundScene?.dataset.assetKey || '', { mode });",1)
p.write_text(s,encoding='utf-8')
p=ROOT/'game/src/run/game.run.scenes.js';s=p.read_text(encoding='utf-8')
old='class="pg node-pg sc-${o.tone}"';assert old in s
s=s.replace(old,"""class="pg node-pg sc-${o.tone}"${o.music ? ` data-music-scene="${escAttr(o.music)}"` : ''}""",1)
p.write_text(s,encoding='utf-8')
p=ROOT/'game/src/run/game.run.altar.js';s=p.read_text(encoding='utf-8')
start=s.index('function showExtractDone(');tail=s[start:];old="    tone: 'exit',";assert old in tail
p.write_text(s[:start]+tail.replace(old,old+"\n    music: 'success',",1),encoding='utf-8')
p=ROOT/'game/src/battle/core/battle.lifecycle.js';s=p.read_text(encoding='utf-8')
s=s.replace('setBoss?.(!!data.opts.isBoss)',"setBoss?.(!!data.opts.isBoss, foes[0]?.id || '')",1)
s=s.replace('setBoss?.(opts.isBoss)',"setBoss?.(opts.isBoss, defs[0]?.id || '')",1)
p.write_text(s,encoding='utf-8')
print('music source routing applied')
