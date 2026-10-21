"""Acquire licensed source files and prepare short, quiet game assets."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.parse import urljoin
import array
import hashlib
import json
import math
import shutil
import subprocess
import wave
import zipfile

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SRC = BASE/'sources'
OUT = ROOT/'game/assets/sfx/selected32-1018'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 48000
pages = {key:json.loads((SRC/('lab-'+key+'.json')).read_text(encoding='utf-8')) for key in ['button','battle','anime']}
# key, provider, source page/pack, source file, maximum seconds, relative rate, lowpass Hz, category
plan = [
    ('safe-store','oto','Assorted_SE05','Assorted_SE05-01.mp3',.22,1,5800,'ui'),
    ('safe-retrieve','oto','Assorted_SE05','Assorted_SE05-02.mp3',.24,1,5800,'ui'),
    ('discard','oto','Assorted_SE05','Assorted_SE05-03.mp3',.20,1,5200,'ui'),
    ('open','oto','Cyber16','Cyber16-1.mp3',.40,1.08,6200,'ui'),
    ('close','oto','Cyber16','Cyber16-2.mp3',.34,1.08,5800,'ui'),
    ('status-up','lab','battle','magic-statusup2.mp3',.48,1.08,6500,'combat'),
    ('status-down','oto','Cyber16','Cyber16-2.mp3',.38,.86,5200,'combat'),
    ('curse-end','lab','battle','magic-status-cure1.mp3',.46,1.05,5800,'combat'),
    ('transition','lab','anime','sceneswitch2.mp3',.34,1.1,5000,'transition'),
    ('altar-enter','lab','battle','magic-circle1.mp3',.75,1.1,5800,'transition'),
    ('shop-enter','oto','Assorted_SE05','Assorted_SE05-12.mp3',.38,1,5800,'transition'),
    ('deploy-start','oto','Assorted_SE05','Assorted_SE05-18.mp3',.42,1,6000,'transition'),
    ('battle-enter','lab','anime','text-impact3.mp3',.34,1.1,4800,'transition'),
    ('parry','lab','battle','sword-clash4.mp3',.34,.95,5200,'combat'),
    ('parry-soft','lab','battle','sword-clash4.mp3',.30,.88,4600,'combat'),
    ('curse','lab','battle','magic-drain2.mp3',.72,.95,5300,'combat'),
    ('fire','lab','battle','magic-flame1.mp3',.68,1.08,6000,'combat'),
    ('ice','lab','battle','magic-ice1.mp3',.70,1.05,6500,'combat'),
    ('lightning','lab','battle','magic-electron2.mp3',.60,1.05,6200,'combat'),
    ('psychic','lab','battle','magic-gravity2.mp3',.72,.95,5000,'combat'),
    ('heal','lab','battle','magic-cure1.mp3',.74,1.05,6200,'combat'),
    ('shield','lab','battle','magic-reflection1.mp3',.42,1.08,6000,'combat'),
    ('burn','lab','battle','magic-flame1.mp3',.40,.94,4800,'combat'),
]

sources = {}
for pack in ['Assorted_SE05','Cyber16']:
    archive = SRC/(pack+'-mp3.zip')
    shutil.copyfile(Path.home()/'Downloads'/archive.name,archive)
    with zipfile.ZipFile(archive) as z:
        for key, provider, source_pack, filename, *_ in plan:
            if provider != 'oto' or source_pack != pack:
                continue
            matches = [name for name in z.namelist() if name.endswith('/'+filename)]
            if len(matches) != 1:
                raise RuntimeError('Source not unique: '+filename)
            raw = z.read(matches[0]); local = SRC/filename; local.write_bytes(raw)
            sources[('oto',pack,filename)] = {'file':local,'url':'https://otologic.jp/sounds/se/mp3-zip/'+archive.name,'page':'https://otologic.jp/free/se/'+('cyber02.html' if pack=='Cyber16' else 'assorted-se01.html'),'provider':'OtoLogic','license':'CC BY 4.0','license_url':'https://otologic.jp/free/license','archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'original_title':pack+'/'+filename}

def fetch_lab(choice):
    page, filename = choice
    linked = next((item for item in pages[page]['items'] if item['href']=='mp3/'+filename),None)
    if linked is None:
        raise RuntimeError('Not linked from official page: '+filename)
    url = urljoin(pages[page]['url'],linked['href'])
    req = Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':pages[page]['url']})
    with urlopen(req,timeout=30) as response:
        raw = response.read(5_000_001)
        if len(raw)>5_000_000 or not response.headers.get('Content-Type','').startswith(('audio/','application/octet-stream')):
            raise RuntimeError('Unexpected audio download: '+filename)
    local = SRC/filename; local.write_bytes(raw)
    return ('lab',page,filename),{'file':local,'url':url,'page':pages[page]['url'],'provider':'Sound Effect Lab','license':'Free commercial game use; modification allowed; no standalone redistribution','license_url':'https://soundeffect-lab.info/agreement/','original_title':linked['label']}

choices = sorted(set((item[2],item[3]) for item in plan if item[1]=='lab'))
with ThreadPoolExecutor(max_workers=3) as pool:
    sources.update(dict(pool.map(fetch_lab,choices)))

receipt = []
for name,provider,page,filename,limit,rate,lowpass,category in plan:
    origin = sources[(provider,page,filename)]
    # Remove encoder silence, shape only the selected onset, then cut and fade.
    filters = f'aresample={RATE},silenceremove=start_periods=1:start_duration=0.003:start_threshold=-55dB,asetrate={round(RATE*rate)},aresample={RATE},highpass=f=65,lowpass=f={lowpass},atrim=duration={limit}'
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(origin['file']),'-af',filters,'-ac','2','-f','f32le','-'])
    samples = array.array('f',raw)
    if not samples:
        raise RuntimeError('Empty processed asset: '+name)
    peak = max(map(abs,samples)); rms = math.sqrt(sum(x*x for x in samples)/len(samples))
    peak_db,rms_db = (-14,-25) if category=='ui' else (-16,-26) if category=='transition' else (-10.5,-23)
    gain = min(1,10**(peak_db/20)/max(peak,1e-9),10**(rms_db/20)/max(rms,1e-9))
    frames = len(samples)//2; fade_in = min(round(.004*RATE),frames); fade_out = min(round(.04*RATE),frames)
    pcm = array.array('h')
    for i,value in enumerate(samples):
        frame = i//2
        fade = min(1,frame/max(1,fade_in),(frames-1-frame)/max(1,fade_out))
        pcm.append(round(max(-1,min(1,value*gain*fade))*32767))
    target = OUT/(name+'.wav')
    with wave.open(str(target),'wb') as f:
        f.setparams((2,2,RATE,0,'NONE','not compressed')); f.writeframes(pcm.tobytes())
    source_raw = origin['file'].read_bytes()
    receipt.append({k:v for k,v in origin.items() if k!='file'})
    receipt[-1].update({'key':name,'local_source':str(origin['file'].relative_to(ROOT)).replace('\\','/'),'source_sha256':hashlib.sha256(source_raw).hexdigest(),'source_bytes':len(source_raw),'path':str(target.relative_to(ROOT/'game')).replace('\\','/'),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'seconds':frames/RATE,'processing':{'ffmpeg_filter':filters,'gain':gain,'fade_in_seconds':.004,'fade_out_seconds':.04,'rate':rate,'category':category}})
(BASE/'receipt.json').write_text(json.dumps({'acquisition_date':'2026-10-18','files':receipt,'method':'Official OtoLogic ZIP links via Codex in-app browser; official Sound Effect Lab download links via anonymous HTTP with current system proxy','tests_run':False,'browser_verification':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared',len(receipt),'short licensed WAV assets,',sum(item['bytes'] for item in receipt),'bytes. Game mapping not yet edited.')
