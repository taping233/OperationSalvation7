"""Two separate orchestral cues. Existing GS/FluidSynth, editable score + frozen LMMS stems."""
import pathlib,json,sys,os,hashlib,re,subprocess,copy,importlib.util
import xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
OLD=OUT.parent/'2026-10-05-WF-music-identity/round-B'
TMP=ROOT/'.tmp/music-workstation/explore-battle-v4';TMP.mkdir(exist_ok=True)
FONT=ROOT/'.tmp/music-workstation/GeneralUser-GS.sf2';SR=48000
spec=importlib.util.spec_from_file_location('existing_fluid',OUT.parent/'2026-10-05-WF-music-title-v6/fluid_engine.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
sys.stdout.reconfigure(encoding='utf-8')
CHORDS={'explore':[[50,57,62,65,76],[46,57,62,65,69],[41,53,57,60,67],[48,55,60,64,69],[43,55,58,62,69],[46,53,58,62,69],[45,57,61,64,67],[50,57,62,65,74]],
        'battle':[[40,52,55,59,66],[36,52,55,60,64],[38,50,54,57,64],[35,51,54,57,63],[33,52,57,60,64],[36,52,55,60,67],[38,50,55,59,64],[35,51,54,57,65]]}

def fp(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def save(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def rms(x):return float(np.sqrt(np.mean(x.astype(float)**2)))
def elem(p,tag,**attrs):return ET.SubElement(p,tag,{k:str(v) for k,v in attrs.items()})
def loud(path):
    r=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,check=True)
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr.decode(errors='replace'),re.S)[-1])

def stage(role,bar):
    bounds=[0,8,20,28,40,48] if role=='explore' else [0,6,18,26,30,42,48]
    return next(i for i in range(len(bounds)-1) if bounds[i]<=bar<bounds[i+1])

def compose(role):
    bpm=116 if role=='explore' else 132;stem='02-explore-ashline' if role=='explore' else '03-battle-blackpulse'
    title='灰线行军 · 木管行旅' if role=='explore' else '黑脉交锋 · 铜管反击'
    src=ET.parse(OLD/(stem+'-v3.mmp')).getroot();leadname='Piano travel theme' if role=='explore' else 'Strings theme'
    t=next(t for t in src.findall('.//track') if t.get('name')==leadname)
    motifs=[]
    for p in sorted(t.findall('pattern'),key=lambda p:int(p.get('pos'))):
        if int(p.get('pos'))>=16*192:continue
        motifs.append([(int(n.get('pos'))/48,int(n.get('key'))+12,int(n.get('len'))/48) for n in p.findall('note')])
    tracks={}
    def addtrack(name,patch,target,pan,bank=0):tracks[name]={'program':patch,'bank':bank,'target_active_rms_dbfs':target,'pan':pan,'notes':[]}
    def note(name,beat,key,length,v):
        if beat<192:tracks[name]['notes'].append({'beat':round(beat,5),'midi':int(key),'length':round(min(length,191.97-beat),5),'velocity':int(np.clip(round(v),1,100))})
    if role=='explore':
        for args in [('Piano traveller',0,-25,-6),('Pizzicato steps',45,-32,34),('Clarinet replies',71,-29,-24),('Oboe clearing',68,-31,17),('Flute breeze',73,-33,-12),('Bassoon inner line',70,-35,21),('Harp turning points',46,-35,-35),('Violin horizon',40,-32,-42),('Viola moving middle',41,-35,27),('Cello road',42,-34,36),('Double bass',43,-33,0),('Soft long strings',49,-36,12),('Celeste frost',8,-42,32),('Chamber percussion',48,-36,0,128),('Triangle',48,-47,38,128)]:addtrack(*args)
    else:
        for args in [('Violin challenge',48,-24,-33),('Violin counter',40,-31,36),('Viola drive',45,-32,-43),('Cello ostinato',42,-31,28),('Double bass',43,-31,0),('Horn calls',60,-28,-20),('Trumpet counterstrike',56,-32,19),('Trombone weight',57,-34,12),('Bassoon release',70,-35,28),('Oboe warning',68,-35,-12),('Piano accents',0,-34,-5),('Harp transitions',46,-38,-31),('Long string tension',49,-35,40),('Timpani',47,-32,-6),('Orchestral drums',48,-33,0,128),('Metal punctuation',48,-43,35,128)]:addtrack(*args)
    for bar in range(0,48,2):
        beat=bar*4;s=stage(role,bar);c=CHORDS[role][(bar//2)%8];motif=motifs[(bar//2)%8]
        if role=='explore':
            # Wind-led clearing replaces piano; returning route changes phrase endings.
            if s!=2:
                for j,(q,key,length) in enumerate(motif):
                    if s==4 and j==len(motif)-1:key=c[2]+12;length*=1.35
                    if s==3 and j==len(motif)-2:key=c[3]+12
                    note('Piano traveller',beat+q,key,length+.07,([51,57,46,60,52][s])+(4 if j==0 else -2 if j==len(motif)-1 else 0))
            for offset,key in [(0,c[2]),(4,c[3])]:
                note('Soft long strings',beat+offset,key,3.85,40)
                note('Cello road',beat+offset,c[0] if offset==0 else c[1]-12,3.65,45)
            note('Double bass',beat,c[0]-12,3.4,48);note('Double bass',beat+4,c[0]-12,3.5,42)
            if s in [0,1,3,4]:
                hits=[(.5,c[1]),(2,c[3]),(4.5,c[2]),(6.25,c[1])]
                if s==3:hits.extend([(3.25,c[2]),(7.25,c[3])])
                for j,(q,key) in enumerate(hits):note('Pizzicato steps',beat+q,key,.42,52 if j%2==0 else 40)
                for q in [0,4]:note('Chamber percussion',beat+q,36,.28,40)
                if s in [1,3]:
                    for q in [2.5,6.5]:note('Chamber percussion',beat+q,45,.22,31)
            if s in [1,4]:
                note('Clarinet replies',beat+5.65,c[3]+12,.95,54);note('Clarinet replies',beat+6.85,c[2]+12,1.02,48)
                if bar%4==2:note('Flute breeze',beat+4.5,c[1]+12,1.3,47)
            if s==2:
                for q,key,d in [(0,c[3]+12,1.6),(2,c[2]+12,1.25),(4.5,c[1]+12,2.3)]:note('Oboe clearing',beat+q,key,d,49)
                note('Bassoon inner line',beat,c[1]-12,3.65,43);note('Bassoon inner line',beat+4,c[3]-12,3.3,39)
            if s in [1,3]:
                note('Violin horizon',beat,c[3]+12,3.8,49);note('Violin horizon',beat+4,c[2]+12,3.8,44)
                note('Viola moving middle',beat,c[1],5.7,42);note('Viola moving middle',beat+6,c[2],1.7,36)
            if s==3:
                note('Flute breeze',beat+5,c[3]+12,1.3,48);note('Clarinet replies',beat+6.5,c[1]+12,1.2,47)
            if bar%4==0 or s==2:
                for j,key in enumerate([c[1],c[2],c[3],c[-1]]):note('Harp turning points',beat+.25+j*.375,key,1.2,39-j*2)
            if bar in [0,8,20,28,40,46]:note('Celeste frost',beat+.5,c[-1],1.4,39);note('Triangle',beat+.1,81,.1,30)
        else:
            # Immediate low pulse, full conflict, four-bar release, independent return.
            if s!=3:
                for j,(q,key,length) in enumerate(motif):
                    if s==0 and j%2:key-=12
                    if s==4 and j==len(motif)-1:key=c[3]+12;length*=1.25
                    if s==5 and j>len(motif)-3:continue
                    note('Violin challenge',beat+q,key,length+.04,[64,70,74,42,78,66][s]+(4 if j==0 else -2))
            else:
                note('Bassoon release',beat,c[2],3.1,48);note('Bassoon release',beat+4.5,c[3],2.7,43)
                note('Piano accents',beat+.2,c[2]+12,2.1,42);note('Piano accents',beat+4.7,c[3]+12,2.0,39)
            for q in ([0,1.5,3,4,5.5,7] if s!=3 else [0,4]):
                cello_key=c[0] if q in [0,4] else c[1]-12
                note('Cello ostinato',beat+q,cello_key+12 if cello_key<36 else cello_key,.48 if s!=3 else 2.2,57 if q in [0,4] else 42)
                if s in [1,2,4]:note('Viola drive',beat+q+.5,c[2],.32,54 if q in [0,4] else 43)
            for q in [0,4]:
                bass_key=c[0]-12
                note('Double bass',beat+q,bass_key+12 if bass_key<28 else bass_key,1.6 if s!=3 else 3.4,55 if s!=3 else 42)
                if s!=3:note('Timpani',beat+q,c[0]+12 if c[0]<38 else c[0],.58,55 if s in [2,4] else 42)
            note('Long string tension',beat,c[2],7.8,47)
            if s in [1,2,4]:
                note('Horn calls',beat+4.25,c[1]+12,1.35,62);note('Horn calls',beat+6,c[3]+12,1.45,55)
                note('Violin counter',beat,c[3]+12,3.75,49);note('Violin counter',beat+4,c[2]+12,3.75,46)
            if s in [2,4]:
                for q,key,d,v in [(0,c[2]+12,.6,61),(1.5,c[3]+12,.55,54),(3,c[1]+12,.8,58)]:note('Trumpet counterstrike',beat+q,key,d,v)
                note('Trombone weight',beat,c[1]-12,1.5,52);note('Trombone weight',beat+4,c[2]-12,1.5,48)
            if s in [0,5] and bar%4==0:note('Oboe warning',beat+5,c[3]+12,2.5,43)
            if s!=3:
                for q in [0,4]:note('Orchestral drums',beat+q,36,.3,62 if s==4 else 48)
                for q in [2,6]:note('Orchestral drums',beat+q,38,.16,47 if s in [2,4] else 34)
                if bar%4==2 and s in [1,2,4]:
                    for j,q in enumerate([6.5,7,7.5,7.75]):note('Orchestral drums',beat+q,38,.12,27+6*j)
            if bar in [6,18,30,42]:note('Metal punctuation',beat,49,.4,48)
            if bar in [16,24,28,40,46]:
                for j,key in enumerate([c[2],c[3],c[1]+12,c[-1]]):note('Harp transitions',beat+6+j*.4,key,1,42-j*3)
    for tr in tracks.values():tr['notes'].sort(key=lambda n:n['beat'])
    return {'role':role,'bpm':bpm,'bars':48,'stem':stem+'-v4','title':title,'tracks':tracks,
        'sections':[{'start_bar':a,'end_bar':b,'name':name} for a,b,name in ([(0,8,'orientation'),(8,20,'woodwind exchange'),(20,28,'clearing'),(28,40,'new route'),(40,48,'changed return')] if role=='explore' else [(0,6,'immediate tension'),(6,18,'conflict'),(18,26,'escalation'),(26,30,'release'),(30,42,'counterstrike'),(42,48,'pivot to loop')])]}

def expression(score,tr,beat):
    bar=beat/4;s=stage(score['role'],min(bar,47.99));q=beat%8
    levels=([.73,.92,.63,1.0,.80] if score['role']=='explore' else [.76,.92,1.0,.48,1.06,.81])
    # CC11 controls continuous expression; note velocity remains separately authored.
    return int(np.clip(round(100*levels[s]*(.90+.10*np.sin(np.pi*q/8))),35,115))

def synth_track(score,name,tr):
    beatseconds=60/score['bpm'];period=round(192*beatseconds*SR);events=[]
    events.append((0,0,'cc',10,int(np.clip(round(64+tr['pan']*.55),0,127))))
    pedals=[]
    for cycle in [0,1]:
        shift=cycle*192
        for beat in range(192):events.append((round((shift+beat)*beatseconds*SR),0,'cc',11,expression(score,tr,beat)))
        if tr['program']==0 and tr['bank']==0:
            for bar in range(48):
                start=bar*4;span=2.55 if bar%2 else 3.25
                if stage(score['role'],bar) in ([2,4] if score['role']=='explore' else [3,5]):span-=.35
                for b,v in [(start+.025,127),(start+span,0)]:
                    events.append((round((shift+b)*beatseconds*SR),0,'cc',64,v))
                    if cycle==0:pedals.append({'beat':b,'cc64':v})
        for n in tr['notes']:
            a=round((shift+n['beat'])*beatseconds*SR);b=round((shift+n['beat']+n['length'])*beatseconds*SR)
            events.extend([(a,2,'on',n['midi'],n['velocity']),(b,1,'off',n['midi'],0)])
    raw=engine.render(events,2*period/SR,SR,bank=tr['bank'],patch=tr['program'])[period:2*period]
    # Match instrument activity, not full-track RMS: sparse replies must stay quiet.
    block=SR//4;energies=np.array([rms(raw[i:i+block])**2 for i in range(0,len(raw)-block+1,block)])
    active=energies>max(energies.max()*1e-3,1e-16);assert active.any(),name+' has no signal'
    active_rms=float(np.sqrt(energies[active].mean()));gain=10**(tr['target_active_rms_dbfs']/20)/active_rms
    audio=raw*gain
    path=TMP/(score['stem']+'-'+name.replace(' ','-')+'.wav');sf.write(path,audio,SR,subtype='FLOAT')
    return audio,{'name':name,'program':tr['program'],'bank':tr['bank'],'pan':tr['pan'],'notes':len(tr['notes']),
        'velocity_range':[min(n['velocity'] for n in tr['notes']),max(n['velocity'] for n in tr['notes'])],
        'target_active_rms_dbfs':tr['target_active_rms_dbfs'],'gain_db':float(20*np.log10(gain)),
        'cc11_expression_used':True,'piano_cc64':pedals,'frozen_stem':fp(path)}

def room(x,sr):
    x=sosfilt(butter(2,28,btype='highpass',fs=sr,output='sos'),np.concatenate([x[-sr:],x]),axis=0)[sr:];x-=x.mean(axis=0)
    y=sosfilt(butter(2,[200,5800],btype='bandpass',fs=sr,output='sos'),np.concatenate([x[-sr:],x]),axis=0)[sr:]
    for ch in [0,1]:
        ir=np.zeros(len(x))
        for delay,weight in [(.033,.18),(.071,.12),(.129,.08),(.213,.05),(.353,.035),(.571,.022),(.823,.012)]:ir[round((delay+ch*.013)*sr)]=weight
        x[:,ch]+=np.fft.irfft(np.fft.rfft(y[:,ch])*np.fft.rfft(ir),n=len(x))*.35
    m=x.mean(axis=1);s=(x[:,0]-x[:,1])/2
    s=sosfilt(butter(2,160,btype='highpass',fs=sr,output='sos'),np.concatenate([s[-sr:],s]))[sr:]
    return np.column_stack([m+s,m-s])

def project(score,rows):
    root=ET.Element('lmms-project',creator='LMMS',version='1.0',type='song',creatorversion='1.2.2')
    elem(root,'head',bpm=score['bpm'],mastervol=100,masterpitch=0,timesig_numerator=4,timesig_denominator=4)
    song=elem(root,'song');tc=elem(song,'trackcontainer',type='song',visible=1)
    for row in rows:
        t=elem(tc,'track',type=0,name=row['name'],muted=0,solo=0)
        it=elem(t,'instrumenttrack',vol=100,pan=0,pitch=0,basenote=57,usemasterpitch=1,pitchrange=1,fxch=0)
        ins=elem(it,'instrument',name='audiofileprocessor');elem(ins,'audiofileprocessor',src=(ROOT/row['frozen_stem']['path']).as_posix(),amp=100,interp=1,sframe=0,eframe=1,lframe=0,looped=0,reversed=0,stutter=0)
        elem(it,'fxchain',enabled=0,numofeffects=0)
        for cycle in [0,1]:
            p=elem(t,'pattern',type=1,pos=cycle*48*192,len=48*192,steps=48*16,name='Frozen performed stem; edit score.json then regenerate',muted=0)
            elem(p,'note',key=57,pos=0,len=48*192,vol=100,pan=0)
    elem(song,'timelinestate',lpstate=0,lp0pos=0,lp1pos=2*48*192)
    elem(song,'projectnotes').text='Frozen GS/FluidSynth stem mixing project. Notes, CC11 and CC64 in score.json/render.py. Master room/gain/seam are applied by render.py; LMMS project is pre-master and has not been separately re-rendered.'
    path=OUT/(score['stem']+'.mmp');ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True);return path

def render_score(role):
    score=compose(role);period=round(192*60/score['bpm']*SR);mix=np.zeros((period,2),dtype=np.float64);rows=[]
    print('compose '+role,flush=True)
    for name,tr in score['tracks'].items():
        print('render '+role+' / '+name,flush=True);audio,row=synth_track(score,name,tr);mix+=audio;rows.append(row)
    mmp=project(score,rows);mix=room(mix,SR);raw=TMP/(score['stem']+'-premaster.wav');sf.write(raw,mix,SR,subtype='FLOAT')
    old=loud(OLD/(score['stem'].replace('-v4','-v3')+'.wav'));before=loud(raw)
    gain=min(10**((float(old['input_i'])-float(before['input_i']))/20),.90/np.abs(mix).max())
    mix*=gain;mix[-192:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,192)))[:,None]
    wav=OUT/(score['stem']+'.wav');sf.write(wav,mix,SR,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        options=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav)]+options+['-metadata','title='+score['title'],str(wav.with_suffix('.'+ext))],check=True)
    save(role+'-score.json',score)
    report={'role':role,'title':score['title'],'stem':score['stem'],'bpm':score['bpm'],'bars':48,'seconds':period/SR,'sections':score['sections'],
        'tracks':rows,'engine':'Existing LMMS FluidSynth library + GeneralUser GS 2.0.3 BETA; stems directly mixed, frozen LMMS pre-master project included',
        'old_loudness':old,'final_loudness':loud(wav),'post_gain_db':float(20*np.log10(gain)),
        'files':[fp(p) for p in [mmp,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]],'subjective_listening':'not claimed; user audition required'}
    save(role+'-render-report.json',report);print(json.dumps({'done':role,'seconds':report['seconds'],'lufs':report['final_loudness']['input_i']},ensure_ascii=False),flush=True)
    return report

def main():
    sources=[FONT]+[OLD/(stem+ext) for stem in ['02-explore-ashline-v3','03-battle-blackpulse-v3'] for ext in ['.mmp','.wav']]
    before=[fp(p) for p in sources]
    reports=[json.loads((OUT/(role+'-render-report.json')).read_text(encoding='utf-8')) if '--battle-only' in sys.argv and role=='explore' else render_score(role) for role in ['explore','battle']]
    assert before==[fp(p) for p in sources]
    save('render-report.json',{'source_inputs_unchanged':before,'tracks':reports,'scope':'two new V4 candidates; title V8 and game untouched'})
    print('both complete',flush=True)

if __name__=='__main__':main()
