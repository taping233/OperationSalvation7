// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { analyzeSamples, reviewVideo, reportHTML } from '../scripts/video-review.mjs';
const available = (() => { try { execFileSync('ffmpeg',['-version'],{stdio:'ignore'});execFileSync('ffprobe',['-version'],{stdio:'ignore'});return true;}catch{return false;} })();
it('detects only candidate ranges and keeps sample times separate from source FPS', () => {
  const a=analyzeSamples(Uint8Array.from([0,0,255,0,90,90,90,90,90]),{width:1,height:1,fps:1});
  expect(a.candidates).toContainEqual({kind:'brightness-flash',start:1,end:3});
  expect(a.candidates).toContainEqual({kind:'dark-screen',start:0,end:2});
  expect(a.candidates).toContainEqual({kind:'low-change',start:4,end:8});
  expect(a.samples[3].time).toBe(3);
  expect(()=>analyzeSamples(new Uint8Array(3),{width:2,height:2})).toThrow();
});
it('rejects invalid limits before creating a destination', async () => {
  await expect(reviewVideo({input:'x',out:'x',fps:0})).rejects.toThrow('sample-fps');
  await expect(reviewVideo({input:'x',out:'x',startSeconds:-1})).rejects.toThrow('start-seconds');
});
describe.skipIf(!available)('offline ffmpeg pipeline (synthetic fixtures only)',()=>{
  it('extracts color frames, a contact sheet, candidates and an escaped comparison report', async()=>{
    const temp=await mkdtemp(path.join(os.tmpdir(),'sdt-video-review-'));
    try {
      const video=path.join(temp,'synthetic-&scene.mp4'),out=path.join(temp,'report');
      execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=1','-f','lavfi','-i','color=black:size=320x180:rate=12:duration=2','-f','lavfi','-i','color=blue:size=320x180:rate=12:duration=4','-filter_complex',"[1:v]drawbox=color=white:t=fill:enable='between(t,0.5,0.7)'[flash];[0:v][flash][2:v]concat=n=3:v=1:a=0[v]",'-map','[v]','-c:v','mpeg4','-q:v','4',video],{timeout:30000});
      const result=await reviewVideo({input:video,compare:video,out,fps:4,maxSeconds:10,syntheticFixture:true});
      expect(result.syntheticFixture).toBe(true);expect(result.videos).toHaveLength(2);
      expect(result.videos[0].samples.length).toBeGreaterThan(20);
      expect(result.videos[0].candidates.map(c=>c.kind)).toContain('dark-screen');
      expect(result.videos[0].candidates.map(c=>c.kind)).toContain('low-change');
      expect(result.videos[0].candidates.map(c=>c.kind)).toContain('brightness-flash');
      expect(result.comparison.before).toEqual(result.comparison.after);
      const html=await readFile(path.join(out,'index.html'),'utf8');
      expect(html).toContain('synthetic-&amp;scene.mp4');expect(html).toContain('不是真实游戏录屏');
      expect((await readFile(path.join(out,'before/contact.jpg'))).length).toBeGreaterThan(1000);
      expect(JSON.parse(await readFile(path.join(out,'report.json'),'utf8')).videos[0].metadata.reportedFrameRate).toBe('12/1');
      await expect(reviewVideo({input:video,out})).rejects.toThrow();
      const limited=await reviewVideo({input:video,out:path.join(temp,'limited'),fps:2,maxSeconds:1});
      expect(limited.videos[0].truncated).toBe(true);expect(limited.videos[0].samples).toHaveLength(2);
      const tail=await reviewVideo({input:video,out:path.join(temp,'tail'),fps:2,startSeconds:4,maxSeconds:2});
      expect(tail.videos[0].sampleStartSeconds).toBe(4);
      expect(tail.videos[0].samples[0].time).toBe(4);
      expect(tail.videos[0].samples).toHaveLength(4);
      expect(tail.videos[0].samples.every(s=>s.time>=4&&s.time<6)).toBe(true);
      const existing=path.join(temp,'keep');await mkdir(existing);
      await expect(reviewVideo({input:video,out:existing})).rejects.toThrow();
    } finally { await rm(temp,{recursive:true,force:true}); }
  },60000);
});


it('opens candidate timelines and synchronizes sampled previews without silently stretching shorter video', () => {
  const video = { source:'<unsafe>.mp4', durationSeconds:20, sampleStartSeconds:10, sampledSeconds:3, sampleFps:1, contactStride:1,
    metadata:{reportedFrameRate:'60/1'}, samples:[{time:10,luminance:20,difference:null},{time:11,luminance:25,difference:5},{time:12,luminance:26,difference:1}],
    candidates:[{kind:'dark-screen',start:11,end:12}] };
  const html=reportHTML({videos:[video,{...video,source:'short.mp4',sampledSeconds:1,samples:video.samples.slice(0,1),candidates:[]}],syntheticFixture:true});
  expect(html).toContain('&lt;unsafe&gt;.mp4');
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://fixture.invalid/'}),document=dom.window.document;
  const link=document.querySelector('[data-candidate]');
  expect(link.hash).toBe('#before-1');
  link.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(document.querySelector('details').open).toBe(true);
  const slider=document.querySelector('#reviewTime');slider.value='12';slider.dispatchEvent(new dom.window.Event('input'));
  const panels=document.querySelectorAll('[data-review-panel]');
  expect(panels[0].querySelector('img').getAttribute('src')).toBe('before/frame-00003.jpg');
  expect(panels[1].querySelector('img').getAttribute('src')).toBe('after/frame-00001.jpg');
  expect(panels[1].querySelector('[data-review-time]').textContent).toContain('超出此片段');
  dom.window.close();
});

it('prints a useful CLI entry without requiring input or creating a report', () => {
  const text=execFileSync(process.execPath,['scripts/video-review.mjs','--help'],{encoding:'utf8'});
  expect(text).toContain('--start-seconds');expect(text).toContain('ffmpeg and ffprobe');
});
