/* dev-serve 专用静音 shim（正式构建由 vite 打包真 howler）：只实现 sound.js 用到的 API。 */
class Howl {
  constructor() {}
  play() { return 0; }
  stop() {}
  pause() {}
  volume() { return 0; }
  fade() {}
  mute() { return this; }
  loop() { return false; }
  seek() { return 0; }
  playing() { return false; }
  state() { return 'loaded'; }
  unload() {}
  on() { return this; }
  once() { return this; }
  off() {}
}
export const Howler = { mute() {}, volume() {}, unload() {}, ctx: null, masters: [] };
export { Howl };
