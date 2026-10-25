import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleOnlyPlayer } from '../game/src/audio/sound.samples.player.js';
import { SAMPLE_CUES } from '../game/src/audio/sound.samples.catalog.js';
import { SFX_PRIORITY } from '../game/src/audio/sound.policy.js';
import { decodeSampleWithDeadline } from '../game/src/audio/sound.decode.js';
import { SceneMusicPlayer } from '../game/src/audio/sound.music.player.js';
import { bindSettingsAudio } from '../game/src/ui/settings-audio.js';

function samples() {
  const sources=[];
  const node=()=>({connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},playbackRate:{value:1},frequency:{value:0}});
  const ctx={state:'running',currentTime:0,createGain:node,createBiquadFilter:node,createBufferSource(){const value=node();sources.push(value);return value;}};
  const player=new SampleOnlyPlayer(ctx,{});return {player,ctx,sources};
}
afterEach(()=>{vi.useRealTimers();document.body.innerHTML='';});

describe('音频第三方意见行为回归',()=>{
  it('A01 结果声在九个普通声部占满时仍有专用位置',async()=>{
    const {player,sources}=samples();await player.load(async()=>({duration:2}));
    for(let i=0;i<12;i++)player.play('hit');expect(player.voices.size).toBe(9);
    player.play('victory');expect(player.voices.size).toBe(10);expect([...player.voices].filter(v=>v.isResult)).toHaveLength(1);
    expect(SFX_PRIORITY.victory).toBeGreaterThan(SFX_PRIORITY.danger);expect(sources.at(-1).playbackRate.value).toBe(SAMPLE_CUES.victory.rate);
    player.dispose();
  });
  it('A02 优先淘汰最低优先级，同级淘汰最早声部',async()=>{
    const {player,sources}=samples();await player.load(async()=>({duration:2}));
    player.play('hit');player.play('burn');for(let i=0;i<7;i++)player.play('hit');player.play('danger');
    expect(sources[1].stop).toHaveBeenCalledOnce();expect(sources[0].stop).not.toHaveBeenCalled();
    player.play('bossReveal');expect(sources[0].stop).toHaveBeenCalledOnce();player.dispose();
  });
  it('A03 单轮有限尝试，失败可手动恢复，成功后不补播旧请求',async()=>{
    const {player,sources}=samples();const total=new Set(Object.values(SAMPLE_CUES).flatMap(cue=>cue.files)).size;let online=false;const decode=vi.fn(async()=>{if(!online)throw Error('offline');return {duration:1};});
    await player.load(decode);expect(player.snapshot()).toMatchObject({loading:false,failed:total,canRetry:true});
    expect(decode).toHaveBeenCalledTimes(total*2);online=true;expect(player.retryFailed()).toBe(true);expect(player.retryFailed()).toBe(false);await player.loadPromise;
    expect(player.snapshot()).toMatchObject({failed:0,canRetry:false,loaded:total});expect(sources).toHaveLength(0);expect(player.play('hit')).toBe(true);player.dispose();
  });
  it.each(['download','decode'])('A03 %s 卡住时超时释放并拒绝迟到结果',async stage=>{
    vi.useFakeTimers();let release;const hanging=new Promise(resolve=>{release=resolve;});const signal=new AbortController();
    const fetchAudio=vi.fn(()=>stage==='download'?hanging:Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}));
    const context={state:'running',decodeAudioData:()=>hanging};
    const request=decodeSampleWithDeadline({url:'sample.wav',context,signal:signal.signal,timeoutMs:30,fetchAudio});
    const assertion=expect(request).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(30);await assertion;
    expect(fetchAudio.mock.calls[0][1].signal.aborted).toBe(true);release({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)});await Promise.resolve();expect(vi.getTimerCount()).toBe(0);
  });
  it('A04 首批解码优先确认、错误、命中、危险及战斗结果样本',async()=>{
    const {player}=samples();const order=[];await player.load(async file=>{order.push(file);return {duration:1};});
    expect(order[0]).toBe(SAMPLE_CUES.confirm.files[0]);expect(order.indexOf(SAMPLE_CUES.victory.files[0])).toBeLessThan(order.indexOf(SAMPLE_CUES.hover.files[0]));player.dispose();
  });
  it('A05 隐藏策略立即停止现有声部，返回仅响应新事件',async()=>{
    const {player,sources}=samples();await player.load(async()=>({duration:1}));player.play('hit');player.setEnabled(false);
    expect(player.voices.size).toBe(0);expect(sources[0].stop).toHaveBeenCalledOnce();expect(player.play('danger')).toBe(false);
    player.setEnabled(true);expect(sources).toHaveLength(1);expect(player.play('danger')).toBe(true);player.dispose();
  });
  it('A06 短暂切窗按位置续播，超过两分钟从头开始',()=>{
    vi.useFakeTimers();const tracks=[];
    const player=new SceneMusicPlayer((_scene,callbacks)=>{let position=0,playing=false;const track={state:()=> 'loaded',volume:()=>0,mute(){},fade(){},seek(value){if(value!==undefined)position=value;return position;},play(){playing=true;callbacks.play();},playing:()=>playing,pause(){playing=false;},unload:vi.fn()};tracks.push(track);return track;});
    const set=options=>player.set('battle',{enabled:true,volume:.1,...options});set();tracks[0].seek(41.25);
    set({enabled:false,immediate:true,preservePosition:true});expect(tracks[0].unload).toHaveBeenCalledOnce();vi.advanceTimersByTime(10000);set();expect(tracks[1].seek()).toBe(41.25);
    set({enabled:false,immediate:true,preservePosition:true});vi.advanceTimersByTime(120001);set();expect(tracks[2].seek()).toBe(0);player.dispose();
  });
  it('A07 操作、普通胜利、首脑、通关与撤离使用不同的受控音型',()=>{
    const events=['gain','tradeBuy','victory','bossVictory','runClear','extractionSuccess'];
    expect(new Set(events.map(name=>JSON.stringify([SAMPLE_CUES[name].rate,SAMPLE_CUES[name].gainScale]))).size).toBe(events.length);
    for(const name of events){expect(SAMPLE_CUES[name].files[0]).toContain('original-ui-1018/reward.wav');expect(SAMPLE_CUES[name].gainScale).toBeLessThanOrEqual(1);}
  });
  it('A03 设置页显示失败数并提供只重试失败样本的按钮',()=>{
    document.body.innerHTML='<div id="overlay"><div id="settings"><p id="setMusicStatus"></p><button id="setMusicRetry"></button><p id="setSfxStatus"></p><button id="setSfxRetry"></button></div></div>';
    const root=document.getElementById('settings'),overlay=document.getElementById('overlay');
    const sound={musicPlayback:{},sfxPlayback:{failed:2,loaded:34,canRetry:true},retrySamples:vi.fn(()=>{sound.sfxPlayback={failed:0,loaded:34,canRetry:false,loading:true};document.dispatchEvent(new Event('sdt-sfx-state'));})};
    const stop=bindSettingsAudio(root,overlay,sound);const retry=root.querySelector('#setSfxRetry');expect(root.querySelector('#setSfxStatus').textContent).toContain('2 项音效加载失败');retry.click();retry.click();expect(sound.retrySamples).toHaveBeenCalledOnce();expect(retry.hidden).toBe(true);stop();
  });
});
