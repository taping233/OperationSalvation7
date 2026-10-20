"""Read official ZIP indexes and extract selected audio using HTTP byte ranges.

No executables from archives are run. This avoids downloading unrelated GBs.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
import hashlib
import json
import struct
import sys
import zlib

BASE = Path(__file__).resolve().parent
SRC = BASE / 'sources'
SRC.mkdir(parents=True, exist_ok=True)
PREFIX = 'https://downloads.sonniss.com/Sonniss.com-GDC2026-GameAudioBundle'

def read_range(url, header, limit):
    req = Request(url, headers={'Range': header, 'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=60) as response:
        if response.status != 206:
            raise RuntimeError(f'Range unavailable ({response.status}); full archive not downloaded')
        data = response.read(limit + 1)
        if len(data) > limit:
            raise RuntimeError('Range body exceeds requested bound')
        return data, response.headers.get('Content-Range', '')

def index(part):
    url = f'{PREFIX}{part}of5.zip'
    data, content_range = read_range(url, 'bytes=-131072', 131072)
    total = int(content_range.rsplit('/',1)[1])
    at = data.rfind(b'PK\x05\x06')
    if at < 0:
        raise RuntimeError('ZIP directory footer not found')
    end = struct.unpack_from('<4s4H2LH',data,at)
    size, offset = end[5:7]
    if size == 0xffffffff or offset == 0xffffffff:
        raise RuntimeError('ZIP64 needs a separate directory reader')
    start = total - len(data)
    if offset >= start:
        directory = data[offset-start:offset-start+size]
    else:
        directory, _ = read_range(url,f'bytes={offset}-{offset+size-1}',size)
    records = []
    pos = 0
    while directory[pos:pos+4] == b'PK\x01\x02':
        entry = struct.unpack_from('<4s6H3L5H2L',directory,pos)
        name_len, extra_len, comment_len = entry[10:13]
        raw = directory[pos+46:pos+46+name_len]
        name = raw.decode('utf-8' if entry[3] & 0x800 else 'cp437')
        records.append({'part':part,'url':url,'name':name,'method':entry[4],
                        'crc32':entry[7],'compressed':entry[8],'bytes':entry[9],
                        'offset':entry[16]})
        pos += 46 + name_len + extra_len + comment_len
    return {'part':part,'archive_bytes':total,'records':records}

def extract(record, filename):
    url, offset = record['url'], record['offset']
    # Read header and a bounded allowance for pathname/extra fields in one request.
    count = record['compressed'] + 8192
    data, _ = read_range(url,f'bytes={offset}-{offset+count-1}',count)
    head = struct.unpack_from('<4s5H3L2H',data)
    if head[0] != b'PK\x03\x04':
        raise RuntimeError('Wrong local header')
    start = 30 + head[9] + head[10]
    compressed = data[start:start+record['compressed']]
    if record['method'] == 0:
        raw = compressed
    elif record['method'] == 8:
        raw = zlib.decompress(compressed,-15)
    else:
        raise RuntimeError('Unsupported compression method')
    if len(raw) != record['bytes'] or zlib.crc32(raw) != record['crc32']:
        raise RuntimeError('Incomplete source transfer; not writing audio')
    file = SRC / filename
    file.write_bytes(raw)
    return {**record,'local_file':str(file.relative_to(BASE)).replace('\\','/'),
            'sha256':hashlib.sha256(raw).hexdigest()}

if __name__ == '__main__':
    if len(sys.argv) == 1:
        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(index,range(1,6)))
        (BASE/'archive-indexes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        for group in results:
            print(f"part{group['part']}: {len(group['records'])} files")
            for record in group['records']:
                if any(word in record['name'].lower() for word in ['anime game','board game','system & ui','ui interaction','interface &','melee weapons','tower defense','casino cards']):
                    print(record['name'].encode('ascii','backslashreplace').decode())
    else:
        plan = json.loads((BASE/'selection.json').read_text(encoding='utf-8'))
        indexed = json.loads((BASE/'archive-indexes.json').read_text(encoding='utf-8'))
        records = [item for group in indexed for item in group['records']]
        receipt = []
        for choice in plan:
            matches = [r for r in records if r['name'].endswith(choice['source_filename'])]
            if len(matches) != 1:
                raise RuntimeError(f"Source not unique: {choice['source_filename']}")
            receipt.append({**extract(matches[0],choice['filename']),**choice})
        (BASE/'receipt.json').write_text(json.dumps({'source':'Sonniss GDC 2026 official bundle',
            'license':'https://sonniss.com/gdc-bundle-license/','files':receipt,
            'game_installed':False,'tests_run':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'Downloaded {len(receipt)} source samples; game untouched.')
