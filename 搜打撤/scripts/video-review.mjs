#!/usr/bin/env node
// Offline recording triage. Sampling produces review candidates, never a gameplay verdict.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { alignRuntimeTrace } from './runtime-trace-alignment.mjs';
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
// Coverage is a sampling window, not proof that every source frame was reviewed.
export function sampleCoverage({ durationSeconds, startSeconds = 0, maxSeconds = 300, fps = 2, sampleCount }) {
  const frameLimit = 600, frameBudgetSeconds = frameLimit / fps;
  const requestedSeconds = Math.min(durationSeconds - startSeconds, maxSeconds);
  const plannedSeconds = Math.min(requestedSeconds, frameBudgetSeconds);
  const sampledSeconds = Math.min(plannedSeconds, sampleCount / fps);
  const endSeconds = startSeconds + sampledSeconds;
  const reasons = [];
  if (startSeconds > 0) reasons.push('start-offset');
  if (maxSeconds < durationSeconds - startSeconds) reasons.push('max-seconds');
  if (frameBudgetSeconds < requestedSeconds) reasons.push('frame-limit');
  if (sampleCount < Math.ceil(plannedSeconds * fps)) reasons.push('decoded-shortfall');
  const uncoveredRanges = [];
  if (startSeconds > 0) uncoveredRanges.push({ start: 0, end: startSeconds });
  if (endSeconds < durationSeconds) uncoveredRanges.push({ start: endSeconds, end: durationSeconds });
  return { startSeconds, endSeconds, plannedSeconds, sampledSeconds, frameLimit,
    frameBudgetSeconds, reasons, uncoveredRanges, complete: uncoveredRanges.length === 0,
    nextStartSeconds: endSeconds < durationSeconds ? endSeconds : null };
}
export function coverageSummary(video) {
  const start = video.sampleStartSeconds || 0, end = start + video.sampledSeconds;
  const ranges = video.coverage?.uncoveredRanges || [];
  const rangeText = ranges.map(r => `${r.start.toFixed(2)}–${r.end.toFixed(2)}s`).join('、');
  return `采样覆盖 ${start.toFixed(2)}–${end.toFixed(2)}s / 源时长 ${Number.isFinite(video.durationSeconds) ? video.durationSeconds.toFixed(2) + 's' : '未知'}` +
    (video.truncated || ranges.length ? `；警告：仅覆盖部分视频${rangeText ? '，未分析 ' + rangeText : ''}。请用 --start-seconds 和新 --out 目录分段继续；分段边界建议重叠至少 2 秒并回看原片。` : '。');
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
  const coverage = sampleCoverage({ durationSeconds: duration, ...options, sampleCount: analysis.samples.length });
  for (const sample of analysis.samples) sample.time += options.startSeconds;
  // The final sampled interval can extend past a fractional source/selection end.
  // Keep raw JSON candidates within the same bounds as the review checklist.
  for (const candidate of analysis.candidates) {
    candidate.start = Math.max(coverage.startSeconds, candidate.start + options.startSeconds);
    candidate.end = Math.min(coverage.endSeconds, candidate.end + options.startSeconds);
  }
  const stride = Math.max(1, Math.ceil(analysis.samples.length / 120));
  const rows = Math.ceil(Math.ceil(analysis.samples.length / stride) / 10);
  await command('ffmpeg', ['-nostdin','-v','error','-framerate',String(options.fps),'-i',frames,'-vf',`select=not(mod(n\\,${stride})),scale=160:90,tile=10x${rows}`,'-frames:v','1','-q:v','3',path.join(output,'contact.jpg')]);
  return { source: path.basename(source), durationSeconds: duration, sampledSeconds: coverage.sampledSeconds, coverage,
    sampleStartSeconds: options.startSeconds, truncated: !coverage.complete, sampleFps: options.fps, metadata: { width: video.width, height: video.height, codec: video.codec_name,
      reportedFrameRate: video.avg_frame_rate, reportedFrames: video.nb_frames || null }, contactStride: stride, ...analysis };
}
const reviewGuidance = {
  'dark-screen': { title: '画面遮挡或转场等待', check: '确认是否为正常转场；记录恢复时间、操作入口与是否影响继续操作。' },
  'brightness-flash': { title: '亮度突变或特效反馈', check: '确认是否为预期受击/技能特效；复核原片是否出现非预期闪白或画面跳变。' },
  'low-change': { title: '静态画面或响应等待', check: '先确认当时是否有输入或预期动画；菜单阅读、暂停和等待不记为卡死。仅在输入无响应等额外证据成立后记录体验问题。' },
};
export function reviewChecklist(video, folder = 'before') {
  const start = video.sampleStartSeconds || 0, end = start + video.sampledSeconds;
  return video.candidates.map((candidate, index) => ({
    id: `${folder}-${index + 1}`, status: 'needs-review', kind: candidate.kind,
    ...reviewGuidance[candidate.kind],
    start: Math.max(start, candidate.start), end: Math.min(end, candidate.end),
    contextStart: Math.max(start, candidate.start - 2), contextEnd: Math.min(end, candidate.end + 2),
    frameIndex: Math.max(0, Math.min(video.samples.length - 1, Math.round((candidate.start - start) * video.sampleFps))),
  }));
}
export function checklistMarkdown(report) {
  const lines = ['# 录屏体验复核清单', '', report.syntheticFixture ? '合成测试夹具，不是真实游戏录屏。' : '本地录屏采样候选，尚未经人工确认。',
    '候选不是已确认缺陷。时间为源视频秒数；上下文仅覆盖本次分析区间。请回看原片并补充操作、预期、实际表现和复现结果。', ''];
  report.videos.forEach((video, index) => {
    const folder = index ? 'after' : 'before';
    // Keep filenames as plain text even if they contain Markdown syntax/newlines.
    lines.push(`## ${index ? '对比视频' : '主视频'}`, '', `源文件：${escapeHTML(video.source.replace(/[\r\n]/g, ' ')).replace(/[\\`*_{}[\]()#!|]/g, '\\$&')}`, '');
    lines.push(coverageSummary(video), '');
    const items = reviewChecklist(video, folder);
    if (!items.length) lines.push('未检出候选，不代表没有问题。', '');
    for (const item of items) lines.push(`- [ ] ${item.id} · ${item.title} · ${item.start.toFixed(2)}–${item.end.toFixed(2)}s`,
      `  - 回看片段：${item.contextStart.toFixed(2)}–${item.contextEnd.toFixed(2)}s；[定位采样](index.html#${folder}-${item.frameIndex})`,
      `  - 复核：${item.check}`, '  - 操作 / 预期 / 实际：待补充', '  - 结论：待复核（正常 / 已确认问题 / 证据不足）；复现结果：待补充', '');
  });
  return lines.join('\n');
}
export function reportHTML(report) {
  const traceHTML = report.runtimeTrace ? `<section><h2>本地交互时间轴（仅主视频）</h2><p>人工对时标记 ${report.runtimeTrace.marker} = 主视频 ${report.runtimeTrace.videoSeconds}s。长任务API：${escapeHTML(report.runtimeTrace.longTaskSupport)}；已丢弃旧记录：${report.runtimeTrace.dropped ?? '未知'}。DOM更新/双rAF仅表示相关时段，不证明操作成功、实际呈现、FPS或卡顿根因。负时间与采样区外记录仍保留，请核对原片。</p><pre>${escapeHTML(report.runtimeTrace.records.map(row => `${row.videoSeconds.toFixed(3)}s ${row.kind} ${row.action || row.page || ''} interaction=${row.interaction ?? '-'} durationMs=${row.durationMs ?? '-'}`).join('\n'))}</pre></section>` : '';
  const labels = { 'dark-screen':'疑似黑屏', 'brightness-flash':'亮度闪变', 'low-change':'低变化片段（可能只是静态界面）' };
  const image = (folder, index) => `${folder}/frame-${String(index+1).padStart(5,'0')}.jpg`;
  const panels = report.videos.map((v, index) => {
    const folder = index ? 'after' : 'before', start = v.sampleStartSeconds || 0;
    const checklist = reviewChecklist(v, folder);
    const counts = Object.entries(labels).map(([kind,label]) => `${label}：${v.candidates.filter(c=>c.kind===kind).length}`).join('；');
    return `<section data-review-panel data-folder="${folder}" data-fps="${v.sampleFps}" data-start="${start}" data-count="${v.samples.length}"><h2>${index ? '对比视频' : '主视频'}：${escapeHTML(v.source)}</h2><p>源时长 ${v.durationSeconds.toFixed(2)}s；分析 ${start.toFixed(2)}–${(start+v.sampledSeconds).toFixed(2)}s，采样 ${v.sampleFps}/s，共 ${v.samples.length} 帧${v.truncated ? '；只覆盖部分视频' : ''}。源文件声明帧率 ${escapeHTML(v.metadata.reportedFrameRate)}。</p><p class="coverage">${escapeHTML(coverageSummary(v))}</p><p>${counts}</p><figure class="preview"><img data-review-preview src="${image(folder,0)}" alt="${start.toFixed(2)}秒采样"><figcaption data-review-time>${start.toFixed(2)}s</figcaption></figure><img class="contact" src="${folder}/contact.jpg" alt="按时间顺序排列的接触表"><p>接触表每 ${v.contactStride / v.sampleFps}s 一格，从左至右、从上至下。时间为采样近似。</p><ul>${checklist.map(c => `<li><a data-candidate data-time="${c.start}" href="#${folder}-${c.frameIndex}">${c.id} · ${labels[c.kind]} ${c.start.toFixed(2)}–${c.end.toFixed(2)}s</a><br>待复核：${c.title}；回看 ${c.contextStart.toFixed(2)}–${c.contextEnd.toFixed(2)}s。${c.check}</li>`).join('') || '<li>未检出候选，不代表没有问题。</li>'}</ul><details><summary>逐帧时间线（${v.samples.length}帧）</summary><div class="frames">${v.samples.map((sample,i)=>`<figure id="${folder}-${i}"><img loading="lazy" src="${image(folder,i)}" alt="${sample.time.toFixed(2)}秒采样"><figcaption>${sample.time.toFixed(2)}s · 亮度${sample.luminance.toFixed(1)} · 差值${sample.difference?.toFixed(2) ?? '—'}</figcaption></figure>`).join('')}</div></details></section>`;
  }).join('');
  const start = Math.min(...report.videos.map(v=>v.sampleStartSeconds || 0));
  const end = Math.max(...report.videos.map(v=>v.samples.at(-1)?.time || 0));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>录屏分析候选报告</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#15191f;color:#eaf0f6}a{color:#9bcdff}.contact,.preview img{max-width:100%;height:auto}.preview img{width:640px;image-rendering:auto}.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,600px),1fr));gap:24px}.frames{display:flex;flex-wrap:wrap}figure{margin:8px}figure img{width:240px}figure:target{outline:3px solid #e9b96f;scroll-margin:20px}section{min-width:0}input[type=range]{width:min(100%,800px)}</style></head><body><h1>录屏分析候选报告</h1><p>${report.syntheticFixture ? '合成测试夹具，不是真实游戏录屏。' : '用户提供的本地视频；未经本工具录制。'}</p><p>只供定位复核：黑屏可能是正常转场，闪变可能是特效，低变化可能是静态界面。采样率与源视频声明帧率都不是游戏真实FPS；采样间的短暂问题可能漏检。前后视频按相同源时间并排，未做语义/场景对齐，数量差异不证明性能提升。</p><p>完整结果：<a href="report.json">report.json</a>；可填写交接的<a href="review-checklist.md">体验复核清单</a>。所有处理在本机完成，无外部请求。</p><label for="reviewTime">同步查看源时间采样（秒）</label><br><input id="reviewTime" type="range" min="${start}" max="${Math.max(start,end)}" step="0.1" value="${start}"><output id="reviewTimeLabel" for="reviewTime">${start.toFixed(2)}s</output><div class="panels">${panels}</div>${traceHTML}<script>
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
  slider.value=link.dataset.time;slider.dispatchEvent(new Event('input'));
  const frame=document.getElementById(link.hash.slice(1));if(frame)frame.closest('details').open=true;
});
const initialFrame=document.getElementById(location.hash.slice(1));if(initialFrame)initialFrame.closest('details').open=true;
</script></body></html>`;
}
export async function reviewVideo({ input, compare, out, fps = 2, maxSeconds = 300, startSeconds = 0, syntheticFixture = false, trace, traceMarker, traceVideoSeconds }) {
  if (!input || !out) throw new Error('Required: --input FILE --out NEW_DIRECTORY');
  if (!Number.isFinite(fps) || fps < .2 || fps > 10 || !Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 3600) throw new Error('sample-fps must be 0.2–10; max-seconds must be 0–3600');
  if (!Number.isFinite(startSeconds) || startSeconds < 0) throw new Error('start-seconds must be a finite nonnegative number');
  let runtimeTrace = null;
  if (trace) {
    if (!(await stat(trace)).isFile() || (await stat(trace)).size > 1024 * 1024) throw new Error('Trace must be a local JSON file under 1 MiB');
    runtimeTrace = alignRuntimeTrace(JSON.parse(await readFile(trace, 'utf8')), { marker: traceMarker, videoSeconds: traceVideoSeconds });
  } else if (traceMarker !== undefined || traceVideoSeconds !== undefined) throw new Error('Trace alignment options require --trace');
  const output = path.resolve(out);
  // Never overwrite an existing report or input directory, including nonempty user folders.
  await mkdir(output);
  const videos = [await reviewOne(input, path.join(output,'before'), { fps, maxSeconds, startSeconds })];
  if (compare) videos.push(await reviewOne(compare, path.join(output,'after'), { fps, maxSeconds, startSeconds }));
  const summarize = video => ({ analyzedSeconds: video.sampledSeconds, candidates: Object.fromEntries(['dark-screen','brightness-flash','low-change'].map(k=>[k,video.candidates.filter(c=>c.kind===k).length])) });
  for (const [index, video] of videos.entries()) video.reviewChecklist = reviewChecklist(video, index ? 'after' : 'before');
  const report = { schemaVersion: 2, runtimeTrace, syntheticFixture, generatedAt: new Date().toISOString(), thresholds: { darkMeanBelow:12, darkPixelFractionAbove:.95, darkPixelBelow:16, lowChangeMeanAbsoluteDifferenceBelow:.8, lowChangeSeconds:3, flashDifferenceAbove:40, flashReturnDifferenceBelow:12 }, videos, comparison: videos.length === 2 ? { alignment:'same source timestamp only; scene matching not performed', before:summarize(videos[0]), after:summarize(videos[1]) } : null };
  await writeFile(path.join(output,'report.json'), JSON.stringify(report,null,2));
  await writeFile(path.join(output,'index.html'), reportHTML(report));
  await writeFile(path.join(output,'review-checklist.md'), checklistMarkdown(report));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), values = {};
  const allowed = new Set(['input','compare','out','sample-fps','max-seconds','start-seconds','trace','trace-marker','trace-video-seconds']);
  try {
    if (args.length === 1 && args[0] === '--help') {
      console.log('Offline video review (requires ffmpeg and ffprobe).\nUsage: node scripts/video-review.mjs --input FILE --out NEW_DIRECTORY [--compare FILE] [--start-seconds 0] [--max-seconds 300] [--sample-fps 2] [--synthetic-fixture] [--trace LOCAL_JSON --trace-marker 1 --trace-video-seconds 4.2]\nTrace alignment requires a manually observed marker time in the primary video; no automatic offset or before/after mapping.\nOpen index.html in the output directory; fill review-checklist.md after reviewing candidates. No capture/upload. Sampling is not gameplay FPS; detections require manual review. Existing output directories are never overwritten.\nCoverage: at most min(max-seconds, 600/sample-fps) seconds per video (default: 300s). A larger --max-seconds does not bypass the 600-frame cap. Partial coverage is reported in CLI/JSON/HTML/checklist.\nLong recordings: use --start-seconds 298 --max-seconds 300 --out NEW_SEGMENT_DIRECTORY after the default first segment; overlap boundaries by at least 2s and review the original video. Repeat until the source end, checking uncovered ranges for each video separately.');
    } else {
    for(let i=0;i<args.length;i++) { const key=args[i].replace(/^--/,''); if(args[i]==='--synthetic-fixture'){values.syntheticFixture=true;continue;} if(!args[i].startsWith('--')||!allowed.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Unknown/incomplete option: ${args[i]}`);values[key]=args[++i]; }
    const result = await reviewVideo({ input:values.input, compare:values.compare, out:values.out, fps:values['sample-fps']===undefined?2:Number(values['sample-fps']), maxSeconds:values['max-seconds']===undefined?300:Number(values['max-seconds']), startSeconds:values['start-seconds']===undefined?0:Number(values['start-seconds']), syntheticFixture:!!values.syntheticFixture, trace:values.trace, traceMarker:values['trace-marker']===undefined?undefined:Number(values['trace-marker']), traceVideoSeconds:values['trace-video-seconds']===undefined?undefined:Number(values['trace-video-seconds']) });
    for (const video of result.videos) if (video.truncated) console.error(`WARNING ${JSON.stringify(video.source)}: ${coverageSummary(video)}`);
    console.log(JSON.stringify({ report:path.resolve(values.out,'index.html'), videos:result.videos.map(v=>({source:v.source,samples:v.samples.length,candidates:v.candidates.length,truncated:v.truncated,coverage:v.coverage})) }));
    }
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
