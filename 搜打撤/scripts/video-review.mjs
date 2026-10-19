#!/usr/bin/env node
// Offline recording triage. Sampling produces review candidates, never a gameplay verdict.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const run = promisify(execFile);
const FORMATS = 'mov,matroska,webm,avi';
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function command(executable, args) {
  try { return await run(executable, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }); }
  catch (error) { throw new Error(`${executable} failed: ${error.code || ''} ${String(error.stderr || error.message).slice(-1800)}`, { cause: error }); }
}
export function analyzeSamples(bytes, { width = 160, height = 90, fps = 2, freezeSeconds = 3 } = {}) {
  const size = width * height;
  if (!Number.isInteger(size) || size <= 0 || !(fps > 0) || bytes.length % size) throw new Error('Invalid grayscale sample buffer');
  const samples = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    let sum = 0, dark = 0, difference = 0;
    for (let p = 0; p < size; p++) {
      const value = bytes[offset + p]; sum += value; if (value < 16) dark++;
      if (offset) difference += Math.abs(value - bytes[offset - size + p]);
    }
    samples.push({ time: samples.length / fps, luminance: sum / size, darkFraction: dark / size, difference: offset ? difference / size : null });
  }
  const candidates = [];
  function ranges(kind, predicate, minimum) {
    let start = -1;
    for (let i = 0; i <= samples.length; i++) {
      if (i < samples.length && predicate(samples[i])) { if (start < 0) start = i; }
      else if (start >= 0) {
        if ((i - start) / fps >= minimum) candidates.push({ kind, start: (kind === 'low-change' ? start - 1 : start) / fps, end: (kind === 'low-change' ? i - 1 : i) / fps });
        start = -1;
      }
    }
  }
  ranges('dark-screen', s => s.luminance < 12 && s.darkFraction > .95, 1 / fps);
  ranges('low-change', s => s.difference !== null && s.difference < .8, freezeSeconds);
  for (let i = 1; i + 1 < samples.length; i++) {
    const a = samples[i - 1].luminance, b = samples[i].luminance, c = samples[i + 1].luminance;
    if (Math.abs(b - a) > 40 && Math.abs(b - c) > 40 && Math.abs(a - c) < 12)
      candidates.push({ kind: 'brightness-flash', start: (i - 1) / fps, end: (i + 1) / fps });
  }
  return { samples, candidates: candidates.sort((a, b) => a.start - b.start) };
}
async function reviewOne(input, output, options) {
  const source = path.resolve(input);
  if (!(await stat(source)).isFile()) throw new Error('Input must be a local regular video file');
  const probe = JSON.parse((await command('ffprobe', ['-v','error','-protocol_whitelist','file,pipe','-format_whitelist',FORMATS,'-show_format','-show_streams','-of','json',source])).stdout);
  const video = probe.streams?.find(s => s.codec_type === 'video');
  if (!video) throw new Error('Input contains no video stream');
  const duration = Number(probe.format?.duration || video.duration);
  if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('A finite video duration is required');
  if (options.startSeconds >= duration) throw new Error('start-seconds must be before the end of each video');
  const seconds = Math.min(duration - options.startSeconds, options.maxSeconds, 600 / options.fps);
  const maxFrames = Math.ceil(seconds * options.fps);
  await mkdir(output);
  const frames = path.join(output, 'frame-%05d.jpg'), gray = path.join(output, 'samples.gray');
  await command('ffmpeg', ['-nostdin','-v','error','-protocol_whitelist','file,pipe','-format_whitelist',FORMATS,'-ss',String(options.startSeconds),'-i',source,
    '-filter_complex',`[0:v:0]fps=${options.fps},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,setsar=1,split[thumb][small];[small]scale=160:90,format=gray[gray]`,
    '-map','[thumb]','-an','-frames:v',String(maxFrames),'-q:v','3',frames,
    '-map','[gray]','-an','-frames:v',String(maxFrames),'-f','rawvideo',gray]);
  const analysis = analyzeSamples(await readFile(gray), { fps: options.fps });
  if (!analysis.samples.length) throw new Error('No frames decoded');
  for (const sample of analysis.samples) sample.time += options.startSeconds;
  for (const candidate of analysis.candidates) { candidate.start += options.startSeconds; candidate.end += options.startSeconds; }
  const stride = Math.max(1, Math.ceil(analysis.samples.length / 120));
  const rows = Math.ceil(Math.ceil(analysis.samples.length / stride) / 10);
  await command('ffmpeg', ['-nostdin','-v','error','-framerate',String(options.fps),'-i',frames,'-vf',`select=not(mod(n\\,${stride})),scale=160:90,tile=10x${rows}`,'-frames:v','1','-q:v','3',path.join(output,'contact.jpg')]);
  return { source: path.basename(source), durationSeconds: duration, sampledSeconds: Math.min(seconds, analysis.samples.length / options.fps),
    sampleStartSeconds: options.startSeconds, truncated: options.startSeconds > 0 || seconds < duration, sampleFps: options.fps, metadata: { width: video.width, height: video.height, codec: video.codec_name,
      reportedFrameRate: video.avg_frame_rate, reportedFrames: video.nb_frames || null }, contactStride: stride, ...analysis };
}
export function reportHTML(report) {
  const labels = { 'dark-screen':'疑似黑屏', 'brightness-flash':'亮度闪变', 'low-change':'低变化片段（可能只是静态界面）' };
  const image = (folder, index) => `${folder}/frame-${String(index+1).padStart(5,'0')}.jpg`;
  const panels = report.videos.map((v, index) => {
    const folder = index ? 'after' : 'before', start = v.sampleStartSeconds || 0;
    const counts = Object.entries(labels).map(([kind,label]) => `${label}：${v.candidates.filter(c=>c.kind===kind).length}`).join('；');
    return `<section data-review-panel data-folder="${folder}" data-fps="${v.sampleFps}" data-start="${start}" data-count="${v.samples.length}"><h2>${index ? '对比视频' : '主视频'}：${escapeHTML(v.source)}</h2><p>源时长 ${v.durationSeconds.toFixed(2)}s；分析 ${start.toFixed(2)}–${(start+v.sampledSeconds).toFixed(2)}s，采样 ${v.sampleFps}/s，共 ${v.samples.length} 帧${v.truncated ? '；只覆盖部分视频' : ''}。源文件声明帧率 ${escapeHTML(v.metadata.reportedFrameRate)}。</p><p>${counts}</p><figure class="preview"><img data-review-preview src="${image(folder,0)}" alt="${start.toFixed(2)}秒采样"><figcaption data-review-time>${start.toFixed(2)}s</figcaption></figure><img class="contact" src="${folder}/contact.jpg" alt="按时间顺序排列的接触表"><p>接触表每 ${v.contactStride / v.sampleFps}s 一格，从左至右、从上至下。时间为采样近似。</p><ul>${v.candidates.map(c => `<li><a data-candidate href="#${folder}-${Math.round((c.start-start)*v.sampleFps)}">${labels[c.kind]} ${c.start.toFixed(2)}–${c.end.toFixed(2)}s</a></li>`).join('') || '<li>未检出候选，不代表没有问题。</li>'}</ul><details><summary>逐帧时间线（${v.samples.length}帧）</summary><div class="frames">${v.samples.map((sample,i)=>`<figure id="${folder}-${i}"><img loading="lazy" src="${image(folder,i)}" alt="${sample.time.toFixed(2)}秒采样"><figcaption>${sample.time.toFixed(2)}s · 亮度${sample.luminance.toFixed(1)} · 差值${sample.difference?.toFixed(2) ?? '—'}</figcaption></figure>`).join('')}</div></details></section>`;
  }).join('');
  const start = Math.min(...report.videos.map(v=>v.sampleStartSeconds || 0));
  const end = Math.max(...report.videos.map(v=>v.samples.at(-1)?.time || 0));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>录屏分析候选报告</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#15191f;color:#eaf0f6}a{color:#9bcdff}.contact,.preview img{max-width:100%;height:auto}.preview img{width:640px;image-rendering:auto}.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,600px),1fr));gap:24px}.frames{display:flex;flex-wrap:wrap}figure{margin:8px}figure img{width:240px}figure:target{outline:3px solid #e9b96f;scroll-margin:20px}section{min-width:0}input[type=range]{width:min(100%,800px)}</style></head><body><h1>录屏分析候选报告</h1><p>${report.syntheticFixture ? '合成测试夹具，不是真实游戏录屏。' : '用户提供的本地视频；未经本工具录制。'}</p><p>只供定位复核：黑屏可能是正常转场，闪变可能是特效，低变化可能是静态界面。采样率与源视频声明帧率都不是游戏真实FPS；采样间的短暂问题可能漏检。前后视频按相同源时间并排，未做语义/场景对齐，数量差异不证明性能提升。</p><p>完整结果：<a href="report.json">report.json</a>。所有处理在本机完成，无外部请求。</p><label for="reviewTime">同步查看源时间采样（秒）</label><br><input id="reviewTime" type="range" min="${start}" max="${Math.max(start,end)}" step="0.1" value="${start}"><output id="reviewTimeLabel" for="reviewTime">${start.toFixed(2)}s</output><div class="panels">${panels}</div><script>
const slider=document.querySelector('#reviewTime');
slider.addEventListener('input',()=>{
  const time=Number(slider.value); document.querySelector('#reviewTimeLabel').textContent=time.toFixed(2)+'s';
  for(const panel of document.querySelectorAll('[data-review-panel]')) {
    const fps=Number(panel.dataset.fps),start=Number(panel.dataset.start),count=Number(panel.dataset.count);
    const last=start+(count-1)/fps,index=Math.max(0,Math.min(count-1,Math.round((time-start)*fps)));
    const actual=start+index/fps,img=panel.querySelector('[data-review-preview]');
    img.src=panel.dataset.folder+'/frame-'+String(index+1).padStart(5,'0')+'.jpg';img.alt=actual.toFixed(2)+'秒采样';
    panel.querySelector('[data-review-time]').textContent=actual.toFixed(2)+'s'+(time>last||time<start?'（目标时间超出此片段，显示边界采样）':'');
  }
});
for(const link of document.querySelectorAll('[data-candidate]')) link.addEventListener('click',()=>{
  const frame=document.getElementById(link.hash.slice(1));if(frame)frame.closest('details').open=true;
});
</script></body></html>`;
}
export async function reviewVideo({ input, compare, out, fps = 2, maxSeconds = 300, startSeconds = 0, syntheticFixture = false }) {
  if (!input || !out) throw new Error('Required: --input FILE --out NEW_DIRECTORY');
  if (!Number.isFinite(fps) || fps < .2 || fps > 10 || !Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 3600) throw new Error('sample-fps must be 0.2–10; max-seconds must be 0–3600');
  if (!Number.isFinite(startSeconds) || startSeconds < 0) throw new Error('start-seconds must be a finite nonnegative number');
  const output = path.resolve(out);
  // Never overwrite an existing report or input directory, including nonempty user folders.
  await mkdir(output);
  const videos = [await reviewOne(input, path.join(output,'before'), { fps, maxSeconds, startSeconds })];
  if (compare) videos.push(await reviewOne(compare, path.join(output,'after'), { fps, maxSeconds, startSeconds }));
  const summarize = video => ({ analyzedSeconds: video.sampledSeconds, candidates: Object.fromEntries(['dark-screen','brightness-flash','low-change'].map(k=>[k,video.candidates.filter(c=>c.kind===k).length])) });
  const report = { schemaVersion: 1, syntheticFixture, generatedAt: new Date().toISOString(), thresholds: { darkMeanBelow:12, darkPixelFractionAbove:.95, darkPixelBelow:16, lowChangeMeanAbsoluteDifferenceBelow:.8, lowChangeSeconds:3, flashDifferenceAbove:40, flashReturnDifferenceBelow:12 }, videos, comparison: videos.length === 2 ? { alignment:'same source timestamp only; scene matching not performed', before:summarize(videos[0]), after:summarize(videos[1]) } : null };
  await writeFile(path.join(output,'report.json'), JSON.stringify(report,null,2));
  await writeFile(path.join(output,'index.html'), reportHTML(report));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), values = {};
  const allowed = new Set(['input','compare','out','sample-fps','max-seconds','start-seconds']);
  try {
    if (args.length === 1 && args[0] === '--help') {
      console.log('Offline video review (requires ffmpeg and ffprobe).\nUsage: node scripts/video-review.mjs --input FILE --out NEW_DIRECTORY [--compare FILE] [--start-seconds 0] [--max-seconds 300] [--sample-fps 2] [--synthetic-fixture]\nOpen index.html in the output directory. No capture/upload. Sampling is not gameplay FPS; detections require manual review. Existing output directories are never overwritten.');
    } else {
    for(let i=0;i<args.length;i++) { const key=args[i].replace(/^--/,''); if(args[i]==='--synthetic-fixture'){values.syntheticFixture=true;continue;} if(!args[i].startsWith('--')||!allowed.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Unknown/incomplete option: ${args[i]}`);values[key]=args[++i]; }
    const result = await reviewVideo({ input:values.input, compare:values.compare, out:values.out, fps:values['sample-fps']===undefined?2:Number(values['sample-fps']), maxSeconds:values['max-seconds']===undefined?300:Number(values['max-seconds']), startSeconds:values['start-seconds']===undefined?0:Number(values['start-seconds']), syntheticFixture:!!values.syntheticFixture });
    console.log(JSON.stringify({ report:path.resolve(values.out,'index.html'), videos:result.videos.map(v=>({source:v.source,samples:v.samples.length,candidates:v.candidates.length})) }));
    }
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
