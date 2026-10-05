// Read only the game feedback key from Edge Default's existing LevelDB files.
const fs = require('fs'), path = require('path');
const root = path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/User Data/Default/Local Storage/leveldb');
function vi(b, p) {
  let n = 0, s = 0;
  while (p < b.length) { const c = b[p++]; n += (c & 127) * 2 ** s; if (!(c & 128)) return [n, p]; s += 7; if (s > 49) throw Error('varint'); }
  throw Error('short varint');
}
function sn(b) {
  let [size, p] = vi(b, 0), o = Buffer.alloc(size), q = 0;
  while (p < b.length) {
    const t = b[p++], k = t & 3; let n, d;
    if (!k) {
      n = t >> 2;
      if (n < 60) n++; else { const z = n - 59; n = 0; for (let i = 0; i < z; i++) n += b[p++] * 2 ** (8 * i); n++; }
      if (p + n > b.length || q + n > size) throw Error('literal bounds');
      b.copy(o, q, p, p + n); p += n; q += n;
    } else {
      if (k === 1) { n = 4 + ((t >> 2) & 7); d = ((t & 224) << 3) + b[p++]; }
      else if (k === 2) { n = 1 + (t >> 2); d = b.readUInt16LE(p); p += 2; }
      else { n = 1 + (t >> 2); d = b.readUInt32LE(p); p += 4; }
      if (d < 1 || d > q || q + n > size) throw Error('snappy bounds');
      for (let i = 0; i < n; i++) o[q + i] = o[q + i - d]; q += n;
    }
  }
  if (q !== size) throw Error('snappy size'); return o;
}
function bl(f, p, n) { const b = f.subarray(p, p + n), t = f[p + n]; if (t === 0) return b; if (t === 1) return sn(b); throw Error('compression'); }
function en(b) {
  const z = b.readUInt32LE(b.length - 4), end = b.length - 4 - z * 4; let p = 0, key = Buffer.alloc(0); const out = [];
  while (p < end) {
    let s, n, l; [s, p] = vi(b, p); [n, p] = vi(b, p); [l, p] = vi(b, p);
    if (s > key.length || p + n + l > end) throw Error('entry bounds');
    key = Buffer.concat([key.subarray(0, s), b.subarray(p, p + n)]); p += n;
    out.push([key, b.subarray(p, p + l)]); p += l;
  }
  return out;
}
const matches = [], errors = [];
function match(key, value, sequence, kind, file) {
  const split = key.indexOf(0); if (split < 0) return;
  const origin = key.subarray(0, split).toString('utf8');
  if (!['_http://127.0.0.1:5200', '_http://localhost:5200'].includes(origin)) return;
  const kb = key.subarray(split + 1), name = kb[0] === 0 ? kb.subarray(1).toString('utf16le') : kb.subarray(1).toString('latin1');
  if (name !== 'sdt-suggestions-v1') return;
  const entry = { origin: origin.slice(1), sequence: String(sequence), kind, file };
  if (kind === 1) {
    const text = value[0] === 0 ? value.subarray(1).toString('utf16le') : value.subarray(1).toString('latin1');
    try { entry.messages = JSON.parse(text); } catch { entry.parseError = true; }
  }
  matches.push(entry);
}
for (const file of fs.readdirSync(root)) {
  try {
    if (file.endsWith('.ldb')) {
      const f = fs.readFileSync(path.join(root, file));
      if (f.subarray(-8).toString('hex') !== '57fb808b247547db') throw Error('magic');
      let p = f.length - 48, mo, ml, io, il;
      [mo, p] = vi(f, p); [ml, p] = vi(f, p); [io, p] = vi(f, p); [il, p] = vi(f, p);
      for (const [, h] of en(bl(f, io, il))) {
        let off, len, v; [off, v] = vi(h, 0); [len, v] = vi(h, v);
        for (const [k, val] of en(bl(f, off, len))) {
          if (k.length < 8) continue; const tag = k.readBigUInt64LE(k.length - 8);
          match(k.subarray(0, -8), val, tag >> 8n, Number(tag & 255n), file);
        }
      }
    } else if (/^\d+\.log$/.test(file)) {
      const f = fs.readFileSync(path.join(root, file)); let fragments = [];
      function batch(b) {
        if (b.length < 12) return; const seq = b.readBigUInt64LE(0), count = b.readUInt32LE(8); let p = 12;
        for (let j = 0; j < count; j++) {
          const kind = b[p++]; let n, k, val = Buffer.alloc(0); [n, p] = vi(b, p); k = b.subarray(p, p + n); p += n;
          if (kind === 1) { [n, p] = vi(b, p); val = b.subarray(p, p + n); p += n; }
          match(k, val, seq + BigInt(j), kind, file);
        }
      }
      for (let p = 0; p + 7 <= f.length;) {
        const remaining = 32768 - (p % 32768); if (remaining < 7) { p += remaining; continue; }
        const n = f.readUInt16LE(p + 4), t = f[p + 6]; if (n === 0 && t === 0) { p += remaining; continue; }
        const b = f.subarray(p + 7, p + 7 + n); p += 7 + n;
        if (t === 1) batch(b); else if (t === 2) fragments = [b]; else if (t === 3) fragments.push(b);
        else if (t === 4) { fragments.push(b); batch(Buffer.concat(fragments)); fragments = []; }
      }
    }
  } catch (e) { errors.push({ file, error: e.message }); }
}
matches.sort((a, b) => BigInt(a.sequence) > BigInt(b.sequence) ? -1 : 1);
const latest = []; for (const entry of matches) if (!latest.some(x => x.origin === entry.origin)) latest.push(entry);
console.log(JSON.stringify({ source: 'Edge Default; only 5200 feedback', latest, matchingVersions: matches.length, errors }, null, 2));
