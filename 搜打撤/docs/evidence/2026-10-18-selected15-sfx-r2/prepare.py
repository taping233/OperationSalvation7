"""Prepare eight new source-based assets for nine cues; six entry cues become silent."""
from pathlib import Path
from urllib.request import Request,urlopen
import array,hashlib,json,math,shutil,subprocess,wave,zipfile

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
SRC=BASE/'sources'
OUT=ROOT/'game/assets/sfx/selected15-r2-1018'
OUT.mkdir(parents=True,exist_ok=True)
RATE=48000
archives={
 'interface':ROOT/'docs/evidence/2026-10-18-free-sfx-library-search/sources/kenney_interface-sounds.zip',
 'impact':SRC/'kenney_impact-sounds.zip',
}
plan=[
 ('close','interface','Audio/close_002.ogg',.22,1,7500,'ui'),
 ('status-down','interface','Audio/minimize_003.ogg',.28,1,6500,'ui'),
 ('parry','impact','Audio/impactMetal_light_002.ogg',.20,.92,6000,'combat'),
 ('parry-muted','impact','Audio/impactWood_medium_001.ogg',.20,1.02,4800,'combat'),
 ('ice','impact','Audio/impactGlass_light_002.ogg',.38,1.08,7500,'combat'),
 ('curse','lab-battle','magic-gravity1.mp3',.52,1,5600,'combat'),
 ('heal','lab-button','gauge-recovery3.mp3',.62,1,6800,'combat'),
 ('curse-end','lab-button','gauge-recovery3.mp3',.28,1.15,6200,'ui'),
]
origins={}
for key,archive in archives.items():
 if archive.parent!=SRC: shutil.copyfile(archive,SRC/archive.name)
 with zipfile.ZipFile(archive) as z:
  for _,kind,name,*_ in plan:
   if kind!=key: continue
   raw=z.read(name); local=SRC/Path(name).name; local.write_bytes(raw)
   origins[(kind,name)]={'file':local,'provider':'Kenney','page':'https://kenney.nl/assets/'+('interface-sounds' if key=='interface' else 'impact-sounds'),'license':'CC0 1.0','license_url':'https://creativecommons.org/publicdomain/zero/1.0/','original_title':name,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
for kind,name in sorted(set((p[1],p[2]) for p in plan if p[1].startswith('lab-'))):
 page=json.loads((ROOT/'docs/evidence/2026-10-18-selected32-sfx/sources'/(kind+'.json')).read_text(encoding='utf-8'))
 item=next(i for i in page['items'] if i['href']=='mp3/'+name)
 url=page['url']+item['href']
 with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':page['url']}),timeout=30) as r:
  raw=r.read(5_000_001)
  if len(raw)>5_000_000 or not r.headers.get('Content-Type','').startswith(('audio/','application/octet-stream')): raise RuntimeError('Unexpected source response')
 local=SRC/name; local.write_bytes(raw)
 origins[(kind,name)]={'file':local,'url':url,'provider':'Sound Effect Lab','page':page['url'],'license':'Free commercial game use; modification allowed; no standalone redistribution','license_url':'https://soundeffect-lab.info/agreement/','original_title':item['label']}
receipt=[]
for key,kind,name,limit,rate,lowpass,category in plan:
 origin=origins[(kind,name)]
 filters=f'aresample={RATE},silenceremove=start_periods=1:start_duration=0.003:start_threshold=-55dB,asetrate={round(RATE*rate)},aresample={RATE},highpass=f=85,lowpass=f={lowpass},atrim=duration={limit}'
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(origin['file']),'-af',filters,'-ac','2','-f','f32le','-'])
 samples=array.array('f',raw)
 if not samples: raise RuntimeError('Empty prepared asset: '+key)
 peak=max(map(abs,samples)); rms=math.sqrt(sum(x*x for x in samples)/len(samples))
 gain=min(1,10**(-12/20)/max(peak,1e-9),10**(-24/20)/max(rms,1e-9))
 frames=len(samples)//2; fin=min(round(.003*RATE),frames); fout=min(round((.018 if category=='ui' or key.startswith('parry') else .035)*RATE),frames)
 pcm=array.array('h')
 for i,value in enumerate(samples):
  frame=i//2; fade=min(1,frame/max(1,fin),(frames-1-frame)/max(1,fout))
  pcm.append(round(max(-1,min(1,value*gain*fade))*32767))
 target=OUT/(key+'.wav')
 with wave.open(str(target),'wb') as f:
  f.setparams((2,2,RATE,0,'NONE','not compressed')); f.writeframes(pcm.tobytes())
 entry={k:v for k,v in origin.items() if k!='file'}
 entry.update({'key':key,'local_source':str(origin['file'].relative_to(ROOT)).replace('\\','/'),'source_sha256':hashlib.sha256(origin['file'].read_bytes()).hexdigest(),'path':str(target.relative_to(ROOT/'game')).replace('\\','/'),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'seconds':frames/RATE,'processing':{'filter':filters,'gain':gain,'fade_in':fin/RATE,'fade_out':fout/RATE}})
 receipt.append(entry)
(BASE/'receipt.json').write_text(json.dumps({'files':receipt,'method':'Reuse earlier official Kenney Interface archive; official Kenney Impact download link; two Sound Effect Lab audio downloads linked from retained official source lists','tests_run':False,'build_run':False,'browser_verification':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared',len(receipt),'new WAV files for nine cues; entry silence will use empty file lists.')
