"""Piano-only revision of three cues; unchanged orchestra stems reused by exact hash."""
import pathlib,json,copy,sys,importlib.util,hashlib,subprocess,struct
import xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
PREV=OUT.parent/'2026-10-05-WF-music-continuity-review'
TMP=ROOT/'.tmp/music-workstation/piano-two-hands';TMP.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('continuity',PREV/'rewrite.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.OUT=OUT;base.TMP=TMP;base.shared.OUT=OUT;base.shared.TMP=TMP
sys.stdout.reconfigure(encoding='utf-8')
def save(n,d):(OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')

def revise(role):
    score=json.loads((PREV/(role+'-score.json')).read_text(encoding='utf-8'));oldreport=json.loads((PREV/(role+'-render-report.json')).read_text(encoding='utf-8'))
    oldnames={'title':'Piano sung theme','explore':'Piano traveller','battle':'Piano release'}
    rh=copy.deepcopy(score['tracks'][oldnames[role]]);rh['pan']=8;rh['hand']='right'
    if role=='battle':rh['target_active_rms_dbfs']=-33
    lh={'program':0,'bank':0,'target_active_rms_dbfs':{'title':-28.5,'explore':-29,'battle':-35}[role],
        'pan':-17,'hand':'left','gain_points':copy.deepcopy(rh['gain_points']),'notes':[]}
    chords=([[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]] if role=='title' else base.shared.CHORDS[role])
    def note(beat,key,length,v):lh['notes'].append({'beat':beat,'midi':int(key),'length':min(length,score['bars']*4-beat-.025),'velocity':v})
    for bar in range(0,score['bars'],2):
        beat=bar*4;right=[n for n in rh['notes'] if beat<=n['beat']<beat+8]
        if not right:continue  # Keep battle piano restricted to its existing four phrases.
        c=chords[(bar//2)%len(chords)];floor=min(n['midi'] for n in right)-2
        root=c[0] if role=='title' else c[0]-12
        if root<28:root+=12
        third=c[3]-12;fifth=c[1]
        while third>floor:third-=12
        while fifth>floor:fifth-=12
        upperroot=root+12
        while upperroot>floor:upperroot-=12
        # Four left-hand gestures per two bars, including playable chord intervals.
        # No continuous eighth-note chatter: low note, chord, upper bass, soft answer.
        factor=.91 if (bar//8)%4==3 else 1
        note(beat,root,1.60,round(40*factor))
        note(beat+2,third,1.80,round(34*factor));note(beat+2,fifth,1.80,round(31*factor))
        note(beat+4,upperroot,1.60,round(36*factor))
        note(beat+6,third,1.78,round(31*factor));note(beat+6,fifth,1.78,round(29*factor))
    orchestra={name:copy.deepcopy(t) for name,t in score['tracks'].items() if not (t['program']==0 and t['bank']==0)}
    score['tracks']={'Piano right hand':rh,'Piano left hand':lh,**orchestra}
    score['stem']={'title':'01-title-frostglass-v10','explore':'02-explore-ashline-v6','battle':'03-battle-blackpulse-v6'}[role]
    score['title']={'title':'霜窗回声 · 双手钢琴','explore':'灰线行军 · 双手行旅','battle':'黑脉交锋 · 双手间奏'}[role]
    score['source_right_hand_track']=oldnames[role]
    return score,oldreport

def vlq(n):
    b=[n&127];n>>=7
    while n:b.insert(0,(n&127)|128);n>>=7
    return bytes(b)

def midi(score):
    # Format 1: explicit RH and LH channels, note-level editable and actual CC64.
    chunks=[];tempo=round(60000000/score['bpm'])
    conductor=b'\x00\xff\x51\x03'+tempo.to_bytes(3,'big')+b'\x00\xff\x58\x04\x04\x02\x18\x08\x00\xff\x2f\x00'
    chunks.append(conductor)
    for ch,name in enumerate(['Piano right hand','Piano left hand']):
        tr=score['tracks'][name];events=[];label=name.encode('ascii')
        events.append((0,0,b'\xff\x03'+vlq(len(label))+label));events.append((0,0,bytes([0xc0+ch,0])))
        events.append((0,0,bytes([0xb0+ch,10,round(64+tr['pan']*.55)])))
        for beat in range(0,score['bars']*4,4):
            span=3.25 if beat%8==0 else 2.85
            events.extend([(round((beat+.025)*480),0,bytes([0xb0+ch,64,127])),(round((beat+span)*480),0,bytes([0xb0+ch,64,0]))])
        for n in tr['notes']:
            events.extend([(round(n['beat']*480),2,bytes([0x90+ch,n['midi'],n['velocity']])),
                           (round((n['beat']+n['length'])*480),1,bytes([0x80+ch,n['midi'],0]))])
        buf=b'';previous=0
        for tick,priority,message in sorted(events):buf+=vlq(tick-previous)+message;previous=tick
        buf+=vlq(score['bars']*4*480-previous)+b'\xff\x2f\x00';chunks.append(buf)
    content=b'MThd'+struct.pack('>IHHH',6,1,len(chunks),480)+b''.join(b'MTrk'+struct.pack('>I',len(c))+c for c in chunks)
    path=OUT/(score['stem']+'-piano.mid');path.write_bytes(content);return path

def render(role):
    score,oldreport=revise(role);period=round(score['bars']*4*60/score['bpm']*48000)
    mix=np.zeros((period,2),dtype=np.float64);rows=[];oldrows={r['name']:r for r in oldreport['tracks']}
    for name,tr in score['tracks'].items():
        if tr.get('hand'):
            print('render '+role+' '+tr['hand']+' piano',flush=True);audio,row=base.synth(score,name,tr);row['hand']=tr['hand']
        else:
            row=copy.deepcopy(oldrows[name]);p=ROOT/row['frozen_stem']['path'];assert base.shared.fp(p)==row['frozen_stem']
            audio,sr=sf.read(p,dtype='float32',always_2d=True);assert sr==48000 and len(audio)==period;row['reused_unchanged']=True
        mix+=audio;rows.append(row)
    project=base.shared.project(score,rows)
    if role=='title':
        r=ET.parse(project).getroot()
        for t in r.findall('.//track'):
            for i,p in enumerate(t.findall('pattern')):
                p.set('pos',str(i*32*192));p.set('len',str(32*192));p.set('steps',str(32*16));p.find('note').set('len',str(32*192))
        r.find('song/timelinestate').set('lp1pos',str(2*32*192));ET.ElementTree(r).write(project,encoding='utf-8',xml_declaration=True)
    mid=midi(score);mix=base.shared.room(mix,48000);mix,balance=base.macro_balance(mix,48000)
    raw=TMP/(score['stem']+'-premaster.wav');sf.write(raw,mix,48000,subtype='FLOAT');l=base.shared.loud(raw)
    gain=min(10**((-18.5-float(l['input_i']))/20),.90/np.abs(mix).max());mix*=gain
    mix[-192:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,192)))[:,None]
    wav=OUT/(score['stem']+'.wav');sf.write(wav,mix,48000,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        opt=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav)]+opt+['-metadata','title='+score['title'],str(wav.with_suffix('.'+ext))],check=True)
    save(role+'-score.json',score)
    result={'role':role,'stem':score['stem'],'title':score['title'],'bpm':score['bpm'],'bars':score['bars'],'seconds':period/48000,'tracks':rows,
            'previous_stem':oldreport['stem'],'loudness':base.shared.loud(wav),'slow_balance':balance,
            'files':[base.shared.fp(p) for p in [project,mid,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]],
            'scope':'Piano hands revised. All orchestral frozen stems exactly reused. Pre-master MMP not separately native-rendered. No human audition claimed.'}
    save(role+'-render-report.json',result);print(json.dumps({'done':role,'lufs':result['loudness']['input_i']},ensure_ascii=False),flush=True);return result

def main():
    old=json.loads((PREV/'rewrite-report.json').read_text(encoding='utf-8'))
    sources=[ROOT/f['path'] for r in old['cues'] for f in r['files'] if f['path'].endswith('.wav')]
    before=[base.shared.fp(p) for p in sources];reports=[render(role) for role in ['title','explore','battle']]
    assert before==[base.shared.fp(p) for p in sources]
    save('render-report.json',{'source_audio_unchanged':before,'cues':reports})

if __name__=='__main__':main()
