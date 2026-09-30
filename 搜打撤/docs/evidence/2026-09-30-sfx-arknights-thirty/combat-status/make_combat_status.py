"""Ten independent Arknights status cues for paired reference/adjusted audition."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import sys
import urllib.request

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parent))
sys.dont_write_bytecode = True
from process_common import process, ff, SR

OUT = ROOT / 'game/assets/sfx/alternatives/arknights-expansion/combat-status'
BRANCH = 'global-server-voices'
REPO = 'PseudoMon/arknights-audio'
CHOICES = [
    dict(id='hurt', label='受伤', file='b_char_darkharm.wav', note='暗色短冲击与颗粒尾音', pitch=-.5, tempo=1.04, shelf=-.8, release_ms=35, peak_db=-10),
    dict(id='kill', label='击杀', file='b_char_dead.wav', note='低沉落点与短促消散', pitch=-.5, tempo=1.03, shelf=-.5, release_ms=40, peak_db=-9.5),
    dict(id='shieldUp', label='护盾增加', file='b_char_addshield.wav', note='护盾展开的亮脆包覆声', pitch=-.25, tempo=1.04, shelf=-.8, release_ms=35, peak_db=-11.5),
    dict(id='armorBreak', label='破甲', file='b_char_rockexplo.wav', note='坚硬材质崩裂与碎片落尾', pitch=-.5, tempo=1.05, shelf=-1, release_ms=40, peak_db=-10),
    dict(id='energyUp', label='能量增加', file='b_char_battery.wav', note='蓄能脉冲与明亮升起感', pitch=.25, tempo=1.03, shelf=-.5, release_ms=40, peak_db=-11.5),
    dict(id='energyDown', label='能量消耗', file='b_char_energyharm.wav', note='能量释放后的短促衰减', pitch=-.25, tempo=1.04, shelf=-.8, release_ms=35, peak_db=-12),
    dict(id='buffUp', label='增益获得', file='b_char_atkboost.wav', note='增益启动的上扬亮点', pitch=.25, tempo=1.03, shelf=-.6, release_ms=40, peak_db=-11.5),
    dict(id='buffDown', label='增益到期', file='b_char_boostclose.wav', note='状态收束的短尾音', pitch=-.25, tempo=1.04, shelf=-.8, release_ms=40, peak_db=-12),
    dict(id='curse', label='诅咒施加', file='b_char_cursedoll.wav', note='异质摩擦与暗色回落', pitch=-.5, tempo=1.02, shelf=-.9, release_ms=45, peak_db=-11),
    dict(id='curseEnd', label='诅咒解除', file='b_char_emp_2.wav', note='电磁解离的短脉冲与消散', pitch=-.25, tempo=1.04, shelf=-.8, release_ms=40, peak_db=-12),
]


def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Codex-Audio-Reference'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def retrieve(item):
    url = f'https://raw.githubusercontent.com/{REPO}/{BRANCH}/battle/b_char/{item["file"]}'
    path = HERE / 'sources' / item['file']
    path.parent.mkdir(parents=True, exist_ok=True)
    data = path.read_bytes() if path.exists() else request(url)
    assert len(data) < 5_000_000 and data[:4] == b'RIFF'
    path.write_bytes(data)
    x = np.frombuffer(ff(['-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']), dtype='<f4').reshape(-1, 2)
    assert len(x) and np.isfinite(x).all()
    return dict(id=item['id'], path=path.name, source_url=url, sha256=hashlib.sha256(data).hexdigest(),
                bytes=len(data), seconds=round(len(x)/SR, 6), peak_dbfs=round(float(20*np.log10(max(np.max(abs(x)), 1e-12))), 3))


def main():
    HERE.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        source_records = list(pool.map(retrieve, CHOICES))
    (HERE / 'source-probe.json').write_text(json.dumps(source_records, ensure_ascii=False, indent=2), encoding='utf-8')
    if '--probe-only' in sys.argv:
        print(json.dumps(source_records, ensure_ascii=False, indent=2))
        return
    assert len({x['sha256'] for x in source_records}) == 10
    cues, records = [], []
    for item, source in zip(CHOICES, source_records):
        params = {key:item[key] for key in ('pitch', 'tempo', 'shelf', 'release_ms', 'peak_db')}
        assert abs(params['pitch']) <= .5
        record = process(HERE / 'sources' / item['file'], item['id'], OUT, HERE, **params)
        record.update(source_url=source['source_url'], source_file=item['file'], original_trigger_verified=False)
        records.append(record)
        asset_prefix = './assets/sfx/alternatives/arknights-expansion/combat-status/'
        cues.append(dict(id=item['id'], label=item['label'], group='combat', note=item['note'],
                         source_url=source['source_url'], source_sha256=record['source_sha256'],
                         base=dict(src=asset_prefix+item['id']+'-base.ogg', seconds=record['checks']['base']['seconds']),
                         adjusted=dict(src=asset_prefix+item['id']+'.ogg', seconds=record['checks']['adjusted']['seconds'])))
    (HERE / 'cues.json').write_text(json.dumps(cues, ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'processing-checks.json').write_text(json.dumps(dict(repository=f'https://github.com/{REPO}', branch=BRANCH,
        count=10, unique_source_count=10, originals_unchanged=True, human_audition=False,
        rights='Repository describes educational use; no project redistribution/commercial licence verified.',
        records=records), ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps([dict(id=x['id'], crop=x['crop_seconds'], checks=x['checks']) for x in records], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
