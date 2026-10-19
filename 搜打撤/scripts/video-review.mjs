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
  const seconds = Math.min(duration, options.maxSeconds, 600 / options.fps);
  const maxFrames = Math.ceil(seconds * options.fps);
  await mkdir(output);
  const frames = path.join(output, 'frame-%05d.jpg'), gray = path.join(output, 'samples.gray');
  await command('ffmpeg', ['-nostdin','-v','error','-protocol_whitelist','file,pipe','-format_whitelist',FORMATS,'-i',source,
    '-filter_complex',`[0:v:0]fps=${options.fps},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,setsar=1,split[thumb][small];[small]scale=160:90,format=gray[gray]`,
    '-map','[thumb]','-an','-frames:v',String(maxFrames),'-q:v','3',frames,
    '-map','[gray]','-an','-frames:v',String(maxFrames),'-f','rawvideo',gray]);
  const analysis = analyzeSamples(await readFile(gray), { fps: options.fps });
  if (!analysis.samples.length) throw new Error('No frames decoded');
  const stride = Math.max(1, Math.ceil(analysis.samples.length / 120));
  const rows = Math.ceil(Math.ceil(analysis.samples.length / stride) / 10);
  await command('ffmpeg', ['-nostdin','-v','error','-framerate',String(options.fps),'-i',frames,'-vf',`select=not(mod(n\\,${stride})),scale=160:90,tile=10x${rows}`,'-frames:v','1','-q:v','3',path.join(output,'contact.jpg')]);
  return { source: path.basename(source), durationSeconds: duration, sampledSeconds: Math.min(seconds, analysis.samples.length / options.fps),
    truncated: seconds < duration, sampleFps: options.fps, metadata: { width: video.width, height: video.height, codec: video.codec_name,
      reportedFrameRate: video.avg_frame_rate, reportedFrames: video.nb_frames || null }, contactStride: stride, ...analysis };
}
function reportHTML(report) {
  const labels = { 'dark-screen':'疑似黑屏', 'brightness-flash':'亮度闪变', 'low-change':'低变化片段（可能只是静态界面）' };
  const panels = report.videos.map((v, index) => {
    const folder = index ? 'after' : 'before';
    return `<section><h2>${index ? '对比视频' : '主视频'}：${escapeHTML(v.source)}</h2><p>时长 ${v.durationSeconds.toFixed(2)}s；采样 ${v.sampleFps}/s，共 ${v.samples.length} 帧${v.truncated ? '；已截断分析范围' : ''}。源文件声明帧率 ${escapeHTML(v.metadata.reportedFrameRate)}。</p><img class="contact" src="${folder}/contact.jpg" alt="按时间顺序排列的接触表"><p>接触表每 ${v.contactStride / v.sampleFps}s 一格，从左至右、从上至下。以下时间只是采样近似。</p><ul>${v.candidates.map(c => `<li><a href="#${folder}-${Math.round(c.start * v.sampleFps)}">${labels[c.kind]} ${c.start.toFixed(2)}–${c.end.toFixed(2)}s</a></li>`).join('') || '<li>未检出候选，不代表没有问题。</li>'}</ul><details><summary>逐帧时间线</summary><div class="frames">${v.samples.map((s,i)=>`<figure id="${folder}-${i}"><img loading="lazy" src="${folder}/frame-${String(i+1).padStart(5,'0')}.jpg" alt="${s.time.toFixed(2)}秒采样"><figcaption>${s.time.toFixed(2)}s · 亮度${s.luminance.toFixed(1)} · 差值${s.difference?.toFixed(2) ?? '—'}</figcaption></figure>`).join('')}</div></details></section>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>录屏分析候选报告</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#15191f;color:#eaf0f6}a{color:#9bcdff}.contact{max-width:100%;height:auto}.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,600px),1fr));gap:24px}.frames{display:flex;flex-wrap:wrap}figure{margin:8px}figure img{width:240px}section{min-width:0}</style><h1>录屏分析候选报告</h1><p>${report.syntheticFixture ? '合成测试夹具，不是真实游戏录屏。' : '用户提供的本地视频；未经本工具录制。'}</p><p>只供定位复核：黑屏可能是正常转场，闪变可能是特效，低变化可能是静态界面。采样率与源视频声明帧率都不是游戏真实FPS；采样间的短暂问题可能漏检。前后视频仅按起点并排，未做语义/场景对齐，数量差异不证明性能提升。</p><p>完整机器可读结果：<a href="report.json">report.json</a>。所有处理在本机完成，无外部请求。</p><div class="panels">${panels}</div></html>`;
}
export async function reviewVideo({ input, compare, out, fps = 2, maxSeconds = 300, syntheticFixture = false }) {
  if (!input || !out) throw new Error('Required: --input FILE --out NEW_DIRECTORY');
  if (!Number.isFinite(fps) || fps < .2 || fps > 10 || !Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 3600) throw new Error('sample-fps must be 0.2–10; max-seconds must be 0–3600');
  const output = path.resolve(out);
  // Never overwrite an existing report or input directory, including nonempty user folders.
  await mkdir(output);
  const videos = [await reviewOne(input, path.join(output,'before'), { fps, maxSeconds })];
  if (compare) videos.push(await reviewOne(compare, path.join(output,'after'), { fps, maxSeconds }));
  const summarize = video => ({ analyzedSeconds: video.sampledSeconds, candidates: Object.fromEntries(['dark-screen','brightness-flash','low-change'].map(k=>[k,video.candidates.filter(c=>c.kind===k).length])) });
  const report = { schemaVersion: 1, syntheticFixture, generatedAt: new Date().toISOString(), thresholds: { darkMeanBelow:12, darkPixelFractionAbove:.95, darkPixelBelow:16, lowChangeMeanAbsoluteDifferenceBelow:.8, lowChangeSeconds:3, flashDifferenceAbove:40, flashReturnDifferenceBelow:12 }, videos, comparison: videos.length === 2 ? { alignment:'start-time only; scene matching not performed', before:summarize(videos[0]), after:summarize(videos[1]) } : null };
  await writeFile(path.join(output,'report.json'), JSON.stringify(report,null,2));
  await writeFile(path.join(output,'index.html'), reportHTML(report));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), values = {};
  const allowed = new Set(['input','compare','out','sample-fps','max-seconds']);
  try {
    for(let i=0;i<args.length;i++) { const key=args[i].replace(/^--/,''); if(args[i]==='--synthetic-fixture'){values.syntheticFixture=true;continue;} if(!args[i].startsWith('--')||!allowed.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Unknown/incomplete option: ${args[i]}`);values[key]=args[++i]; }
    const result = await reviewVideo({ input:values.input, compare:values.compare, out:values.out, fps:values['sample-fps']===undefined?2:Number(values['sample-fps']), maxSeconds:values['max-seconds']===undefined?300:Number(values['max-seconds']), syntheticFixture:!!values.syntheticFixture });
    console.log(JSON.stringify({ report:path.resolve(values.out,'index.html'), videos:result.videos.map(v=>({source:v.source,samples:v.samples.length,candidates:v.candidates.length})) }));
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
