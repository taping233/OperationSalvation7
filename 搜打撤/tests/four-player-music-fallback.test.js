import { expect, it, vi } from 'vitest';
import { SceneMusicPlayer } from '../game/src/audio/sound.music.player.js';
it('G10 媒体解码失败只报告一次、不切换解码后端，旧回调/取消不会启动已离场音乐',()=>{
  const entries=[],onError=vi.fn();
  const factory=vi.fn((scene,callbacks,opts)=>{
    let state='unloaded';
    const entry={scene,callbacks,opts},track={load:vi.fn(()=>{state='loading';}),unload:vi.fn(),pause:vi.fn(),mute:vi.fn(),fade:vi.fn(),play:vi.fn(),volume:()=>0,state:()=>state,playing:()=>false};
    entry.track=track;entries.push(entry);return track;
  });
  const p=new SceneMusicPlayer(factory,{onError});
  p.set('board',{enabled:true,volume:.1});
  expect(entries[0].opts).toEqual({html5:true,backend:'html5'});
  entries[0].callbacks.error(null,'Decoding audio data failed.');
  expect(factory).toHaveBeenCalledTimes(1);expect(entries[0].track.unload).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledExactlyOnceWith('board','Decoding audio data failed.');
  p.set('board',{enabled:true,volume:.1});
  entries[0].callbacks.load();entries[0].callbacks.error(null,'late');
  expect(entries[0].track.play).not.toHaveBeenCalled();expect(factory).toHaveBeenCalledTimes(1);expect(onError).toHaveBeenCalledTimes(1);
  p.set('title',{enabled:true,volume:.1});
  expect(entries[1].opts).toEqual({html5:true,backend:'html5'});expect(entries[1].track.load).toHaveBeenCalledOnce();
  p.dispose();
  entries.at(-1).callbacks.error(null,'Decoding audio data failed.');entries.at(-1).callbacks.load();
  expect(factory).toHaveBeenCalledTimes(2);expect(entries.at(-1).track.play).not.toHaveBeenCalled();expect(onError).toHaveBeenCalledTimes(1);
});
