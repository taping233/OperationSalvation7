/** Bound both download and decode so two stalled requests cannot occupy the queue forever. */
export async function decodeSampleWithDeadline({ url, context, signal, timeoutMs = 12000, fetchAudio = fetch }) {
  const request = new AbortController();
  let timer;
  let rejectDeadline;
  const cancelled = () => { request.abort(); rejectDeadline?.(new Error('Sound request cancelled')); };
  const deadline = new Promise((_resolve, reject) => {
    rejectDeadline = reject;
    timer = setTimeout(() => { request.abort(); reject(new Error('Sound sample request timed out')); }, timeoutMs);
  });
  signal?.addEventListener('abort', cancelled, { once: true });
  if (signal?.aborted) cancelled();
  const read = async () => {
    if (request.signal.aborted) throw new Error('Sound request cancelled');
    const response = await fetchAudio(url, { signal: request.signal });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.arrayBuffer();
    if (request.signal.aborted || context.state === 'closed') throw new Error('Sound request cancelled');
    const decoded = await context.decodeAudioData(data);
    if (request.signal.aborted) throw new Error('Sound request cancelled');
    return decoded;
  };
  try { return await Promise.race([read(), deadline]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancelled); }
}
