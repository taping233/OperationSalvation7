from pathlib import Path
import json
import subprocess
import concurrent.futures
import urllib.request
import numpy as np

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[2]/'game'
IDS={'click','confirm','card','attackSlash','parry','shieldBreak','heal','eventEnter','chestBurst','bossReveal'}


def check(pack):
    folder=GAME/'assets/sfx/alternatives'/pack
    library=json.loads((folder/'library.json').read_text(encoding='utf-8'))
    assert len(library['cues'])==10 and {c['id'] for c in library['cues']}==IDS
    records=[]
    for cue in library['cues']:
        assert len(cue['variants'])>=1
        for variant in cue['variants']:
            relative=variant['src']; assert relative.startswith('./assets/sfx/alternatives/'+pack+'/')
            path=(GAME/relative[2:]).resolve(); assert folder.resolve() in path.parents
            probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries',
                'stream=codec_name,sample_rate,channels','-of','json',str(path)],check=True,capture_output=True).stdout)
            stream=probe['streams'][0]
            assert stream['codec_name']=='vorbis' and int(stream['sample_rate'])==48000 and stream['channels']==2
            raw=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-'],check=True,capture_output=True).stdout
            x=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
            assert np.isfinite(x).all() and len(x)>0 and np.max(abs(x))<.95
            assert abs(len(x)/48000-variant['seconds'])<.05
            response=urllib.request.urlopen('http://127.0.0.1:5391/'+relative[2:],timeout=5)
            served=response.read(); assert served==path.read_bytes() and response.headers.get_content_type()=='audio/ogg'
            records.append(dict(id=cue['id'],seconds=round(len(x)/48000,4),peak_dbfs=round(float(20*np.log10(np.max(abs(x)))),2),
                                decode='pass',http='audio/ogg 200',bytes=len(served)))
    return dict(pack=pack,count=len(records),records=records)


if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(check,['arknights','cc0-ui','cc0-action']))
    (ROOT/'parent-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps([dict(pack=r['pack'],count=r['count'],peak_range=[min(f['peak_dbfs'] for f in r['records']),max(f['peak_dbfs'] for f in r['records'])]) for r in results]))
