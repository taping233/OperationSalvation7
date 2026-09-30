"""Explicit small-source retrieval and A2 processing; no upstream code is run."""
from pathlib import Path
import concurrent.futures
import hashlib
import importlib.util
import json
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / 'game/assets/sfx/alternatives/arknights-expansion/ui-bag'
spec = importlib.util.spec_from_file_location('process_common', HERE.parent / 'process_common.py')
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)
INVENTORY = json.loads((HERE / 'upstream-inventory.json').read_text(encoding='utf8'))
BY_PATH = {item['path']: item for items in INVENTORY.values() for item in items}
CHOICES = [
    ('cardSelect', '选卡', 'cards', 'battle/b_ui/b_ui_mark.wav', '短促标记声', -.4, 1.04, -.6, 35, True),
    ('draw', '抽牌', 'cards', 'avg/d_avg_paper1.wav', '纸页抽动', -.3, 1.05, -.6, 40, True),
    ('discard', '弃牌', 'cards', 'avg/d_avg_paper2.wav', '纸页落下', -.4, 1.06, -.7, 45, True),
    ('pick', '物品拿起', 'ui', 'avg/d_avg_clothmovement.wav', '布料挪动', -.3, 1.05, -.7, 40, True),
    ('coin', '金币', 'rewards', 'avg/d_avg_coin.wav', '金币碰响', -.2, 1.04, -.5, 35, True),
    ('reveal', '奖励揭晓', 'rewards', 'battle/b_ui/b_ui_getcast.wav', '短促亮音', -.4, 1.04, -.6, 40, False),
    ('legend', '高稀有奖励', 'rewards', 'battle/b_ui/b_ui_star.wav', '星级亮音', -.3, 1.03, -.5, 45, False),
    ('victory', '战斗胜利', 'combat', 'battle/b_ui/b_ui_win.wav', '胜利提示', -.4, 1.03, -.6, 55, False),
    ('defeat', '战斗失败', 'combat', 'battle/b_ui/b_ui_lose.wav', '失败提示', -.5, 1.02, -.7, 55, False),
    ('flee', '逃离', 'combat', 'battle/b_char/b_char_escape.wav', '急促撤离提示', -.4, 1.06, -.6, 40, True),
]


def retrieve(choice):
    item = BY_PATH[choice[3]]
    assert item['type'] == 'file' and item['size'] < 2_000_000
    request = urllib.request.Request(item['download_url'], headers={'User-Agent': 'Codex-Explicit-Audio-Selection'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    assert len(data) == item['size']
    assert hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == item['sha']
    path = HERE / 'sources' / item['name']
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(data)
    return path, item


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        originals = list(pool.map(retrieve, CHOICES))
    cues, records = [], []
    for choice, (source, item) in zip(CHOICES, originals):
        cue_id, label, group, _, note, pitch, tempo, shelf, release, percussive = choice
        record = common.process(source, cue_id, OUT, HERE / 'processed', pitch=pitch,
                                tempo=tempo, shelf=shelf, release_ms=release,
                                peak_db=-11, percussive=percussive)
        record.update(source_path=item['path'], source_url=item['download_url'],
                      github_blob_sha=item['sha'], source_bytes=item['size'],
                      percussive=percussive, label=label, group=group,
                      original_game_trigger='not verified', human_audition=False)
        records.append(record)
        prefix = './assets/sfx/alternatives/arknights-expansion/ui-bag/'
        cues.append(dict(id=cue_id, label=label, group=group, note=note,
                         source_url=item['download_url'], source_sha256=record['source_sha256'],
                         base=dict(src=prefix + cue_id + '-base.ogg', seconds=record['checks']['base']['seconds']),
                         adjusted=dict(src=prefix + cue_id + '.ogg', seconds=record['checks']['adjusted']['seconds'])))
    (HERE / 'cues.json').write_text(json.dumps(cues, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    (HERE / 'sources-parameters-checks.json').write_text(json.dumps(dict(
        source_repository='https://github.com/PseudoMon/arknights-audio',
        source_branch='global-server-voices',
        scope='10 distinct existing Arknights source files; A2-derived audition alternatives only',
        rights='Game audio derivatives; no project distribution permission or original authorship claimed',
        human_audition=False, original_game_triggers_verified=False,
        original_bytes_verified_by_github_blob_sha=True, files=records), ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps([dict(id=r['id'], source=r['source_path'], source_seconds=r['source_seconds'],
                           seconds=r['checks']['adjusted']['seconds'], decode=r['checks']['adjusted']['decode'])
                      for r in records], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
