from pathlib import Path
import concurrent.futures
import json
import subprocess
import urllib.request
import numpy as np

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
GAME=PROJECT/'game'
TARGET=GAME/'assets/sfx/alternatives/arknights-expansion'
PARTS=['ui-bag','combat-status','exploration']


def verify(item):
    row,kind=item; variant=row[kind]; path=(GAME/variant['src'][2:]).resolve()
    assert TARGET.resolve() in path.parents
    probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels',
                                     '-of','json',str(path)],check=True,capture_output=True).stdout)['streams'][0]
    assert probe['codec_name']=='vorbis' and int(probe['sample_rate'])==48000 and probe['channels']==2
    raw=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-'],check=True,capture_output=True).stdout
    x=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    assert len(x)>0 and np.isfinite(x).all() and np.max(abs(x))<.93
    assert abs(len(x)/48000-variant['seconds'])<.05
    response=urllib.request.urlopen('http://127.0.0.1:5391/'+variant['src'][2:],timeout=5)
    served=response.read(); assert served==path.read_bytes() and response.headers.get_content_type()=='audio/ogg'
    return dict(id=row['id'],kind=kind,seconds=round(len(x)/48000,6),peak_dbfs=round(float(20*np.log10(np.max(abs(x)))),3),
                decode='pass',http='200 audio/ogg')


def main():
    new=[]
    for part in PARTS:
        rows=json.loads((ROOT/part/'cues.json').read_text(encoding='utf-8')); assert len(rows)==10
        new.extend(rows)
    old_adjusted=json.loads((GAME/'assets/sfx/alternatives/arknights-adjusted/library.json').read_text(encoding='utf-8'))
    old_base=json.loads((GAME/'assets/sfx/alternatives/arknights/library.json').read_text(encoding='utf-8'))
    old_ids={cue['id'] for cue in old_adjusted['cues']}
    assert len({row['id'] for row in new})==30 and not old_ids.intersection(row['id'] for row in new)
    assert len({row['source_url'] for row in new})==30
    assert len({row['source_sha256'] for row in new})==30
    previous=json.loads((ROOT.parent/'2026-09-30-sfx-alternatives/A-arknights/checks-and-processing.json').read_text(encoding='utf-8'))
    previous_shas={r['source_file_sha256'] for r in previous['files']}
    assert not previous_shas.intersection(row['source_sha256'] for row in new)
    groups={'ui':'界面与操作','cards':'卡牌与背包','combat':'战斗与状态','nodes':'探索与节点','rewards':'奖励与结果','exploration':'撤离与信号','growth':'角色成长'}
    for kind,filename,old,version in [('adjusted','library.json',old_adjusted,'A3'),('base','library-base.json',old_base,'A3 原质')]:
        cues=[]
        for row in new:
            cues.append(dict(id=row['id'],label=row['label'],group=row['group'],note=row['note'],loop=False,variants=[row[kind]]))
        cues.extend(old['cues'])
        assert len(cues)==40
        library=dict(name='方舟微改追加三十个',version=version,featuredLabel='新增三十个',
                     featuredTitle='本批次新增 · 已认可十个在“全部音效”中',featuredIds=[r['id'] for r in new],
                     groups=groups,cues=cues)
        TARGET.mkdir(exist_ok=True)
        (TARGET/filename).write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8')
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        checks=list(pool.map(verify,[(row,kind) for row in new for kind in ('base','adjusted')]))
    (ROOT/'parent-checks.json').write_text(json.dumps(dict(new_count=30,total_cues=40,old_ten_referenced_unchanged=True,
        unique_source_urls=30,unique_source_sha256=30,old_sources_reused=0,files=checks),ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# 新增三十个试听清单','','旧十个原样引用；本批次新增三十个不同素材，不把对照版计作新增数量。','','| 分类 | ID | 用途 | 秒 |','|---|---|---|---|']
    for row in new: lines.append(f"| {groups[row['group']]} | {row['id']} | {row['label']} | {row['adjusted']['seconds']:.2f} |")
    (ROOT/'新增三十个清单.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps(dict(new=30,total=40,checked_ogg=len(checks),source_unique=30,old_overlap=0),ensure_ascii=False))


if __name__=='__main__': main()
