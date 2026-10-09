"""Title V9, exploration/battle V5: continuous carriers, long themes, smooth handoffs."""
import pathlib,json,copy,sys,importlib.util,subprocess,hashlib
import numpy as np,soundfile as sf
from scipy.ndimage import gaussian_filter1d
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
spec=importlib.util.spec_from_file_location('existing_render',OUT.parent/'2026-10-05-WF-music-explore-battle-v4/render.py')
shared=importlib.util.module_from_spec(spec);spec.loader.exec_module(shared)
TMP=ROOT/'.tmp/music-workstation/continuity-rewrite';TMP.mkdir(exist_ok=True)
shared.OUT=OUT;shared.TMP=TMP
sys.stdout.reconfigure(encoding='utf-8')

def save(n,d):(OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def lerp_cycle(points,beats,total):
    points=sorted(points);return np.interp(np.mod(beats,total),[p[0] for p in points],[p[1] for p in points])

def compose(role):
    bpm={'title':84,'explore':112,'battle':124}[role];bars=32 if role=='title' else 48;total=bars*4
    stems={'title':'01-title-frostglass-v9','explore':'02-explore-ashline-v5','battle':'03-battle-blackpulse-v5'}
    titles={'title':'霜窗回声 · 连贯乐句','explore':'灰线行军 · 连续行旅','battle':'黑脉交锋 · 连贯反击'}
    tracks={}
    def tr(name,patch,target,pan,points=None,bank=0):
        tracks[name]={'program':patch,'bank':bank,'target_active_rms_dbfs':target,'pan':pan,'notes':[],
            'gain_points':points or [(0,1),(total,1)]}
    def note(name,beat,key,length,v):
        if beat>=total:return
        tracks[name]['notes'].append({'beat':round(beat,5),'midi':int(key),'length':round(min(length,total-beat-.025),5),'velocity':int(v)})
    if role=='title':
        for args in [('Piano sung theme',0,-25,-5),('Piano open harmony',0,-34,12),('Continuous strings',49,-34,-32),
                     ('Viola gentle reply',41,-37,24),('Cello bridge',42,-36,29),('Stable bass',43,-35,0),
                     ('Harp glimmer',46,-41,-23),('Clarinet breath',71,-31,17)]:tr(*args)
        chords=[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]]
        aa=[(0,67,2),(2,63,2),(4,65,2),(6,67,2),(8,72,3),(11,70,1),(12,67,3.8),
            (16,68,2),(18,67,2),(20,63,3.8),(24,65,2),(26,67,2),(28,72,3.8)]
        bb=[(0,72,3),(3,70,1),(4,67,3.8),(8,70,2),(10,68,2),(12,67,3.8),
            (16,68,2),(18,65,2),(20,63,3.8),(24,62,2),(26,65,2),(28,67,3.8)]
        for section in range(4):
            theme=copy.deepcopy(bb if section==2 else aa)
            if section==1:theme[-1]=(28,71,2.1);theme.append((30,67,1.8))
            if section==3:theme[-2]=(26,62,2);theme[-1]=(28,67,3.8)
            for j,(q,key,length) in enumerate(theme):
                velocity=51+(2 if j%4==0 else 0)+(2 if section==2 else 0)-(2 if q>=28 else 0)
                if section in [1,3] and j==0:velocity=45
                note('Piano sung theme',section*32+q,key,length+.06,velocity)
        for beat in range(0,128,8):
            c=chords[(beat//8)%4]
            note('Piano open harmony',beat+.5,c[1],3.6,30);note('Piano open harmony',beat+3.5,c[3],3.8,27)
            note('Continuous strings',beat,c[2],7.98,43);note('Cello bridge',beat,c[0],7.98,43)
            note('Stable bass',beat,c[0]-12,7.85,44)
            if 24<=beat<64 or beat>=104:note('Viola gentle reply',beat+4.2,c[3]-12,3.6,39)
            if beat in [24,56,88,120]:note('Clarinet breath',beat+4.5,c[1]+12,5.2,42)
            if beat in [0,32,64,96]:note('Harp glimmer',beat+1.0,c[3],2.2,32)
        sections=[(0,8,'long A'),(8,16,'connected answer'),(16,24,'soft B'),(24,32,'resolved return')]
    else:
        original=shared.compose(role);motifname='Piano traveller' if role=='explore' else 'Violin challenge'
        src=original['tracks'][motifname]['notes']
        chords=shared.CHORDS[role]
        if role=='explore':
            # Foreground piano remains audible through clearing; woodwinds crossfade.
            ppoints=[(0,1),(72,1),(80,.76),(88,.60),(100,.60),(112,.85),(120,1),(192,1)]
            opoints=[(0,0),(72,0),(80,.24),(88,.55),(100,.55),(112,.18),(120,0),(192,0)]
            for args in [('Piano traveller',0,-25,-7,ppoints),('Pizzicato steps',45,-35,30),('Clarinet replies',71,-34,-24),
                         ('Oboe clearing',68,-29,18,opoints),('Flute breeze',73,-39,-12),('Harp turning points',46,-39,-33),
                         ('Continuous string bridge',49,-33,-35),('Cello road',42,-36,29),('Stable bass',43,-34,0),
                         ('Celeste frost',8,-45,31),('Quiet drum pulse',48,-40,0,None,128)]:tr(*args)
            sections=[(0,8,'orientation'),(8,20,'exchange'),(20,28,'connected clearing'),(28,40,'new route'),(40,48,'smooth return')]
        else:
            for args in [('Violin sung challenge',40,-24,-24),('Pizzicato motor',45,-35,-37),('Cello steady pulse',42,-34,28),
                         ('Stable bass',43,-33,0),('Horn answer',60,-33,-14),('Trumpet peak',56,-38,20),
                         ('Trombone support',57,-39,10),('Bassoon release',70,-35,19),('Piano release',0,-38,-4),
                         ('Harp transitions',46,-42,-29),('Continuous string bridge',49,-32,35),
                         ('Timpani anchors',47,-36,-6),('Restrained drums',48,-37,0,None,128)]:tr(*args)
            sections=[(0,6,'immediate connected pulse'),(6,18,'conflict'),(18,26,'gradual escalation'),(26,30,'continuous release'),(30,42,'gradual counterstrike'),(42,48,'connected pivot')]
        for bar in range(0,48,2):
            beat=bar*4;c=chords[(bar//2)%8];stage=shared.stage(role,bar)
            candidate=[n for n in src if beat<=n['beat']<beat+8]
            if not candidate:
                oldbeat=(bar%16)*4;candidate=[n for n in src if oldbeat<=n['beat']<oldbeat+8]
            pitches=[n['midi'] for n in candidate]
            if not pitches:pitches=[c[3]+12,c[2]+12,c[1]+12,c[3]+12]
            selected=[pitches[i] for i in np.linspace(0,len(pitches)-1,4).round().astype(int)]
            selected=[p-12 if p>=72 else p for p in selected]
            # Source motif tendency retained, but large jumps resolve through nearby register.
            for i in range(1,4):
                while selected[i]-selected[i-1]>7:selected[i]-=12
                while selected[i-1]-selected[i]>7:selected[i]+=12
            selected=[min(79,max(55,p)) for p in selected]
            lead='Piano traveller' if role=='explore' else 'Violin sung challenge'
            for i,key in enumerate(selected):
                # Main line continues across every former hard section boundary.
                note(lead,beat+i*2,key,2.10 if role=='battle' else 1.96,54+(3 if i==0 else -2 if i==3 else 0))
            note('Continuous string bridge',beat,c[2],7.99,44)
            basskey=c[0]-12;basskey=basskey+12 if basskey<28 else basskey
            for q in [0,4]:note('Stable bass',beat+q,basskey,3.92,45 if q==0 else 40)
            if role=='explore':
                note('Cello road',beat+.1,c[0],7.85,40)
                for j,q in enumerate([1,3.5,6]):note('Pizzicato steps',beat+q,c[[1,2,3][j]],.55,40 if j==0 else 32)
                if 18<=bar<=28:
                    for j,key in enumerate(selected):note('Oboe clearing',beat+j*2,key+12,2.02,45 if j==0 else 42)
                if bar in [10,18,32,38,44]:
                    note('Clarinet replies',beat+5.3,c[3]+12,2.45,43)
                if bar in [14,34]:note('Flute breeze',beat+5.7,c[1]+12,2.1,40)
                if bar%8==0:
                    note('Harp turning points',beat+1,c[2],2.3,32);note('Celeste frost',beat+5,c[3]+12,1.5,30)
                for q in [0,4]:note('Quiet drum pulse',beat+q,36,.25,33)
            else:
                cello=c[0]+12 if c[0]<36 else c[0]
                for j,q in enumerate([0,2,4,6]):
                    note('Cello steady pulse',beat+q,cello if j%2==0 else c[1]-12,1.02,48 if j%2==0 else 36)
                    note('Pizzicato motor',beat+q+1,c[2],.45,39 if stage!=3 else 31)
                if 4<=bar<=42:
                    # Calls start before section changes and taper, rather than switch on en masse.
                    if bar%4==2:note('Horn answer',beat+4.5,c[1]+12,3.25,50);note('Horn answer',beat+4.65,c[3],3.10,41)
                if bar in [20,24,32,36,40]:note('Trumpet peak',beat+5,c[3]+12,2.4,46)
                if bar in [18,22,30,34,38]:note('Trombone support',beat+2,c[1]-12,3.2,40)
                if 24<=bar<=30:
                    note('Bassoon release',beat+2,c[2],5.6,44);note('Piano release',beat+1,c[3]+12,3,35)
                if bar in [4,16,24,28,40,46]:note('Harp transitions',beat+5.5,c[2]+12,2.2,34)
                for q in [0,4]:
                    note('Timpani anchors',beat+q,c[0]+12 if c[0]<38 else c[0],.65,40 if stage!=3 else 32)
                    note('Restrained drums',beat+q,36,.25,40 if stage!=3 else 31)
                if stage!=3:
                    for q in [2,6]:note('Restrained drums',beat+q,38,.15,30)
    for name,t in tracks.items():
        t['notes'].sort(key=lambda n:n['beat'])
        if name.startswith('Continuous') or name in ['Oboe clearing','Violin sung challenge']:
            # Tie common tones. Repeated overlapping same-key note-offs otherwise
            # release the freshly started voice in a MIDI synth, creating a choke.
            merged=[]
            for n in t['notes']:
                if merged and merged[-1]['midi']==n['midi'] and merged[-1]['beat']+merged[-1]['length']>=n['beat']-.04:
                    merged[-1]['length']=round(n['beat']+n['length']-merged[-1]['beat'],5)
                else:merged.append(copy.deepcopy(n))
            t['notes']=merged
    return {'role':role,'stem':stems[role],'title':titles[role],'bpm':bpm,'bars':bars,'tracks':tracks,
            'sections':[{'start_bar':a,'end_bar':b,'name':s} for a,b,s in sections],
            'principles':['continuous bass/string carrier','long main phrases','sparse supporting pulse','2-bar interpolated handoffs','no beatwise CC11 stage jumps']}

def synth(score,name,tr):
    total=score['bars']*4;bs=60/score['bpm'];period=round(total*bs*48000);events=[]
    events.append((0,0,'cc',10,int(np.clip(round(64+tr['pan']*.55),0,127))))
    for cycle in [0,1]:
        shift=cycle*total
        # Stable actual MIDI expression; continuous phrase gain is performed in audio.
        events.append((round(shift*bs*48000),0,'cc',11,100))
        if tr['program']==0 and tr['bank']==0:
            for beat in range(0,total,4):
                span=3.25 if beat%8==0 else 2.85
                events.extend([(round((shift+beat+.025)*bs*48000),0,'cc',64,127),(round((shift+beat+span)*bs*48000),0,'cc',64,0)])
        for n in tr['notes']:
            anticipation=.04 if tr['program'] in [40,41,42] else 0
            start=max(0,(shift+n['beat'])*bs-anticipation);stop=(shift+n['beat']+n['length'])*bs
            events.extend([(round(start*48000),2,'on',n['midi'],n['velocity']),(round(stop*48000),1,'off',n['midi'],0)])
    raw=shared.engine.render(events,2*period/48000,48000,bank=tr['bank'],patch=tr['program'])[period:2*period]
    block=12000;energy=np.array([shared.rms(raw[i:i+block])**2 for i in range(0,len(raw)-block+1,block)])
    active=energy>max(energy.max()*1e-3,1e-16);assert active.any(),name
    gain=10**(tr['target_active_rms_dbfs']/20)/np.sqrt(energy[active].mean());audio=raw*gain
    time=np.arange(period)/48000/bs
    # Subtle continuous 8-bar breath; only 8% amplitude movement, no renewed attack per beat.
    breath=.96+.04*np.sin(2*np.pi*time/32-np.pi/2)
    curve=lerp_cycle(tr['gain_points'],time,total)*breath
    audio*=curve[:,None]
    path=TMP/(score['stem']+'-'+name.replace(' ','-')+'.wav');sf.write(path,audio,48000,subtype='FLOAT')
    return audio,{'name':name,'program':tr['program'],'bank':tr['bank'],'notes':len(tr['notes']),'frozen_stem':shared.fp(path),
                 'pan':tr['pan'],'target_active_rms_dbfs':tr['target_active_rms_dbfs'],'continuous_gain_points':tr['gain_points'],
                 'note_anticipation_seconds':.04 if tr['program'] in [40,41,42] else 0,'cc64_used':tr['program']==0 and tr['bank']==0}

def macro_balance(x,sr):
    # Gentle slow balance, capped at +/-2.5dB; no transient limiting or compression.
    hop=sr//4;db=np.array([20*np.log10(shared.rms(x[i:i+hop])+1e-12) for i in range(0,len(x),hop)])
    smooth=gaussian_filter1d(db,6,mode='wrap');target=np.median(smooth)
    correction=np.clip((target-smooth)*.40,-2.5,2.5);correction=gaussian_filter1d(correction,4,mode='wrap')
    gain=10**(np.interp(np.arange(len(x))/hop,np.arange(len(correction)),correction)/20)
    return x*gain[:,None],{'slow_balance_gain_db_range':[float(correction.min()),float(correction.max())],'time_scale_seconds':1.5,'maximum_allowed_db':2.5}

def render(role):
    score=compose(role);period=round(score['bars']*4*60/score['bpm']*48000);mix=np.zeros((period,2),dtype=np.float64);rows=[]
    print('compose '+role,flush=True)
    for name,tr in score['tracks'].items():
        print('render '+role+' / '+name,flush=True);audio,row=synth(score,name,tr);mix+=audio;rows.append(row)
    # Existing project builder has a 48-bar clip wrapper; make title wrapper its true 32 bars.
    project=shared.project(score,rows)
    if role=='title':
        import xml.etree.ElementTree as ET
        r=ET.parse(project).getroot()
        for t in r.findall('.//track'):
            for i,p in enumerate(t.findall('pattern')):
                p.set('pos',str(i*32*192));p.set('len',str(32*192));p.set('steps',str(32*16));p.find('note').set('len',str(32*192))
        timeline=r.find('song/timelinestate');timeline.set('lp1pos',str(2*32*192));ET.ElementTree(r).write(project,encoding='utf-8',xml_declaration=True)
    mix=shared.room(mix,48000);mix,balance=macro_balance(mix,48000)
    raw=TMP/(score['stem']+'-premaster.wav');sf.write(raw,mix,48000,subtype='FLOAT');l=shared.loud(raw)
    gain=min(10**((-18.5-float(l['input_i']))/20),.90/np.abs(mix).max());mix*=gain
    mix[-192:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,192)))[:,None]
    wav=OUT/(score['stem']+'.wav');sf.write(wav,mix,48000,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        options=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav)]+options+['-metadata','title='+score['title'],str(wav.with_suffix('.'+ext))],check=True)
    save(role+'-score.json',score)
    report={'role':role,'title':score['title'],'stem':score['stem'],'bars':score['bars'],'bpm':score['bpm'],'seconds':period/48000,
            'sections':score['sections'],'tracks':rows,'slow_balance':balance,'loudness':shared.loud(wav),
            'files':[shared.fp(p) for p in [project,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]],
            'native_project':'frozen pre-master stems, paths checked; not separately native-rendered','subjective_listening':'not claimed; user audition required'}
    save(role+'-render-report.json',report);print(json.dumps({'done':role,'lufs':report['loudness']['input_i'],'lra':report['loudness']['input_lra']},ensure_ascii=False),flush=True)
    return report

def main():
    sources=[OUT.parent/'2026-10-05-WF-music-title-v8/01-title-frostglass-v8.wav',shared.OLD/'02-explore-ashline-v3.mmp',shared.OLD/'03-battle-blackpulse-v3.mmp',shared.FONT]
    before=[shared.fp(p) for p in sources]
    reports=[json.loads((OUT/(role+'-render-report.json')).read_text(encoding='utf-8')) if '--title-only' in sys.argv and role!='title' else render(role) for role in ['title','explore','battle']]
    assert before==[shared.fp(p) for p in sources]
    save('rewrite-report.json',{'source_inputs_unchanged':before,'cues':reports,'scope':'one new version each of title/explore/battle; no game/config edits'})
    print('three rewrites complete',flush=True)

if __name__=='__main__':main()
