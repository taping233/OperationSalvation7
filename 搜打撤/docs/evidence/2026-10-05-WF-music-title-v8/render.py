"""V8: retain theme, arrange A/A'/B/A'', phrase-controlled piano and strings.
Existing LMMS + GeneralUser GS only. Writes solely this directory and own temp.
"""
import pathlib,json,copy,subprocess,os,sys,hashlib,re,ctypes
import xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
PREV=OUT.parent/'2026-10-05-WF-music-title-v7'
SOURCE=OUT.parent/'2026-10-05-WF-music-title-v5'
TMP=ROOT/'.tmp/music-workstation/title-v8';TMP.mkdir(exist_ok=True)
APP=ROOT/'.tmp/music-workstation/LMMS';FONT=ROOT/'.tmp/music-workstation/GeneralUser-GS.sf2'
SR=48000;BPM=84;BEAT=60/BPM;PERIOD=round(128*BEAT*SR)
sys.stdout.reconfigure(encoding='utf-8')
CA=[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]]
CB=[[48,55,60,63],[39,46,55,58],[41,48,53,56],[43,50,53,59]]

def save(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def fp(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def elem(p,tag,**attrs):return ET.SubElement(p,tag,{k:str(v) for k,v in attrs.items()})
def rms(x):return float(np.sqrt(np.mean(x.astype(float)**2)))
def chord(beat):return (CB if 64<=beat%128<96 else CA)[int((beat%32)//8)]
def loudness(p):
    r=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,check=True)
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr.decode(errors='replace'),re.S)[-1])

def piano_score():
    old=json.loads((SOURCE/'render-report.json').read_text(encoding='utf-8'))['authored_note_events']
    melody=copy.deepcopy(old['Piano melody'])
    # Keep opening eight bars' pitches, rhythm and lengths verbatim.
    # Second statement answers downward in F minor, then rises through G dominant.
    melody=[n for n in melody if not (48<=n['beat']<64 or 120<=n['beat']<128)]
    answer=[(48,68,1),(49,67,1),(50,65,1.5),(51.5,63,.5),(52,65,2),(54,68,1),(55,65,1),
            (56,67,1.5),(57.5,65,.5),(58,62,2),(60,59,1),(61,62,1),(62,67,1.7)]
    returning=[(120,67,1),(121,71,1),(122,74,2),(124,72,.75),(124.75,71,.75),
               (125.5,69,.5),(126,67,1.8)]
    for beat,key,length in answer+returning:melody.append({'beat':beat,'midi':key,'length':length-.025,'velocity':69})
    melody.sort(key=lambda n:n['beat'])
    contours=[[.93,.98,1.04,1.08,1.02,.98,.92,.86],[.96,1.02,1.08,1.12,1.15,1.10,1.01,.91],
              [1.06,1.13,1.18,1.20,1.15,1.05,.96,.88],[.98,1.04,1.10,1.07,1.03,.97,.92,.84]]
    for n in melody:
        phrase=int(n['beat']//32);bar=int(n['beat']%32//4)
        accent=3 if n['beat']%4==0 else -2 if n['beat']%4>=3 else 0
        n['velocity']=int(np.clip(round((n['velocity']*.64+4)*contours[phrase][bar]+accent),38,64))
        n['length']=min(n['length']+.10,128-n['beat']-.08)
    harmony=[]
    for base in range(0,128,8):
        c=chord(base);phrase=base//32
        # Bass now belongs to the orchestra; piano support is broken inner voicing.
        if phrase==0:pattern=[(0,c[0]+12,2.5,35),(1.5,c[1],1.8,30),(3,c[3],2.0,33),(6,c[1],1.3,28)]
        elif phrase==1:pattern=[(0,c[0]+12,2.0,36),(2,c[1],1.4,31),(3.5,c[3],1.6,35),(5.5,c[2],1.8,32)]
        elif phrase==2:pattern=[(0,c[1],2.5,37),(1,c[3],2.0,34),(4,c[0]+12,2.8,39)]
        else:pattern=[(0,c[0]+12,2.6,35),(1,c[3],2.0,32),(4.5,c[1],1.8,30),(6.5,c[3],1.2,28)]
        for offset,key,length,v in pattern:harmony.append({'beat':base+offset,'midi':key,'length':length,'velocity':v})
    # Pedal spans differ with harmonic rhythm, busier B and phrase endings.
    spans=[[3.65,3.15,3.55,2.85,3.30,3.65,2.75,2.30],
           [3.35,2.90,3.60,2.55,3.10,3.45,2.75,2.10],
           [2.70,3.40,2.80,3.55,2.65,3.15,2.35,1.90],
           [3.70,3.25,3.50,2.80,3.35,3.05,2.75,1.95]]
    pedals=[]
    for bar in range(32):
        start=bar*4;pedals.extend([{'beat':start+(0 if bar==0 else .04),'cc64':127},
                                  {'beat':start+spans[bar//8][bar%8],'cc64':0}])
    return {'Piano melody':melody,'Quiet piano harmony':harmony},pedals

def freeze_piano(label,notes,pedals):
    # Pitch-banded MIDI channels use real CC10 pan; CC64 reaches every channel.
    handle=os.add_dll_directory(str(APP));lib=ctypes.CDLL(str(APP/'libfluidsynth.dll'))
    PTR=ctypes.c_void_p;INT=ctypes.c_int;CHAR=ctypes.c_char_p;DOUBLE=ctypes.c_double
    def bind(name,result,args):
        f=getattr(lib,name);f.restype=result;f.argtypes=args;return f
    settings=bind('new_fluid_settings',PTR,[])()
    setnum=bind('fluid_settings_setnum',INT,[PTR,CHAR,DOUBLE]);setint=bind('fluid_settings_setint',INT,[PTR,CHAR,INT])
    setnum(settings,b'synth.sample-rate',SR);setnum(settings,b'synth.gain',.5)
    setint(settings,b'synth.reverb.active',0);setint(settings,b'synth.chorus.active',0)
    synth=bind('new_fluid_synth',PTR,[PTR])(settings)
    sfload=bind('fluid_synth_sfload',INT,[PTR,CHAR,INT]);program=bind('fluid_synth_program_select',INT,[PTR,INT,INT,INT,INT])
    cc=bind('fluid_synth_cc',INT,[PTR,INT,INT,INT]);on=bind('fluid_synth_noteon',INT,[PTR,INT,INT,INT]);off=bind('fluid_synth_noteoff',INT,[PTR,INT,INT])
    write=bind('fluid_synth_write_float',INT,[PTR,INT,PTR,INT,INT,PTR,INT,INT])
    previous=os.getcwd();events=[];channels=list(range(8))
    pans=[31,40,49,58,67,76,85,94] if label=='Quiet piano harmony' else [38,45,52,59,66,73,80,87]
    try:
        os.chdir(APP);font=sfload(synth,b'../GeneralUser-GS.sf2',1);assert font>=0
        for ch,pan in zip(channels,pans):assert program(synth,ch,font,0,0)==0;assert cc(synth,ch,10,pan)==0
        for cycle in [0,1]:
            shift=128*cycle
            for p in pedals:
                for ch in channels:events.append((round((shift+p['beat'])*BEAT*SR),0,'cc',ch,64,p['cc64']))
            for n in notes:
                ch=int(np.clip((n['midi']-48)//4,0,7));start=(shift+n['beat'])*BEAT*SR
                stop=(shift+min(n['beat']+n['length'],127.94))*BEAT*SR
                events.extend([(round(start),2,'on',ch,n['midi'],n['velocity']),(round(stop),1,'off',ch,n['midi'],0)])
        audio=np.zeros((2*PERIOD,2),dtype=np.float32);cursor=0
        for frame,priority,kind,ch,key,value in sorted(events):
            frame=min(frame,len(audio))
            if frame>cursor:
                ptr=audio[cursor:].ctypes.data_as(PTR);assert write(synth,frame-cursor,ptr,0,2,ptr,1,2)==0;cursor=frame
            if kind=='on':assert on(synth,ch,key,value)==0
            elif kind=='off':off(synth,ch,key)
            else:assert cc(synth,ch,key,value)==0
        if cursor<len(audio):
            ptr=audio[cursor:].ctypes.data_as(PTR);assert write(synth,len(audio)-cursor,ptr,0,2,ptr,1,2)==0
    finally:
        os.chdir(previous);bind('delete_fluid_synth',None,[PTR])(synth);bind('delete_fluid_settings',None,[PTR])(settings);handle.close()
    audio=sosfilt(butter(1,7000,fs=SR,output='sos'),audio,axis=0).astype(np.float32)
    old_path=ROOT/'.tmp/music-workstation/title-v6'/(label.replace(' ','-')+'-pedalled.wav')
    old,sr=sf.read(old_path,dtype='float32',always_2d=True);assert sr==SR
    relative=-.7 if label=='Piano melody' else -1.2
    gain=rms(old[PERIOD:2*PERIOD])*10**(relative/20)/rms(audio[PERIOD:2*PERIOD])
    audio*=gain;path=TMP/(label.replace(' ','-')+'-v8.wav');sf.write(path,audio,SR,subtype='FLOAT')
    return path,{'source_track':label,'notes_per_cycle':len(notes),'midi_channel_cc10_pans':pans,
                 'velocity_range':[min(n['velocity'] for n in notes),max(n['velocity'] for n in notes)],
                 'relative_clip_rms_db':relative,'clip':fp(path)}

def build(score,pedals):
    root=ET.parse(PREV/'01-title-frostglass-v7.mmp').getroot();tc=root.find('song/trackcontainer');reports=[]
    for label,notes in score.items():
        clip,report=freeze_piano(label,notes,pedals);reports.append(report)
        t=next(t for t in tc.findall('track') if t.get('name')==label);it=t.find('instrumenttrack');it.set('pan','0')
        it.find('instrument/audiofileprocessor').set('src',clip.as_posix())
    # Preserve track count, replace redundant harmony doubling with distinct registers.
    instruments=[('Strings left',48,43,-48),('Strings right',49,39,46),('Cello foundation',42,35,-12),
                 ('Warm orchestral bed',49,24,12),('Viola middle foundation',41,30,25),('Double bass foundation',43,31,0)]
    for t in list(tc.findall('track')):
        if t.get('type')=='5':tc.remove(t)
    orchestra={}
    for index,(label,patch,volume,pan) in enumerate(instruments):
        t=next(t for t in tc.findall('track') if t.get('name')==label);it=t.find('instrumenttrack');it.set('vol',str(volume));it.set('pan',str(pan))
        instrument=it.find('instrument/sf2player');instrument.set('patch',str(patch));instrument.set('reverbLevel','.13' if index<2 else '.05' if index==5 else '.10')
        instrument.set('reverbWidth','.90');instrument.set('chorusOn','0')
        for p in list(t.findall('pattern')):t.remove(p)
        oldvol=it.find('vol')
        if oldvol is not None:it.remove(oldvol)
        authored=[]
        for beat in range(0,128,8):
            c=chord(beat);stage=beat//32
            if index==0:
                ns=[(0,c[3]+(12 if stage==2 else 0),7.75,47)]
                if stage==1:ns=[(0,c[3],5.7,47),(6,c[2],1.85,41)]
                if stage==3:ns=[(0,c[3],3.9,45),(4,c[1]+12,3.75,42)]
            elif index==1:
                ns=[(0,c[1]+12,7.8,44)]
                if stage==1:ns=[(0,c[1]+12,3.8,43),(4,c[2]+7,3.8,47)]
                if stage==2:ns=[(0,c[1]+12,5.9,46),(6,c[3],1.8,41)]
                if stage==3:ns=[(0,c[2],7.75,42)]
            elif index==2:
                ns=[(0,c[0],7.7,43)]
                if stage==1:ns=[(0,c[0],5.8,43),(6,c[1]-12,1.8,38)]
                if stage==3:ns=[(0,c[1]-12,7.7,40)]
            elif index==3:ns=[(0,c[0]+12,7.9,34)]
            elif index==4:
                ns=[(0,c[3]-12,7.7,39)]
                if stage==1:ns=[(0,c[3]-12,5.8,42),(6,c[2]-12,1.75,36)]
                if stage==2:ns=[(0,c[3],7.7,44)]
                if stage==3:ns=[(0,c[3]-12,3.7,38),(4,c[1],3.7,34)]
            else:ns=[(0,c[0]-12,7.8,40)]
            for offset,key,length,v in ns:authored.append({'beat':beat+offset,'midi':key,'length':length,'velocity':v})
        orchestra[label]=authored
        for cycle in [0,1]:
            for beat in range(0,128,8):
                p=elem(t,'pattern',type=1,pos=(cycle*128+beat)*48,len=384,steps=32,name=['A foundation','A varied answer','B lifted register','A transformed return'][beat//32],muted=0)
                for n in authored:
                    if beat<=n['beat']<beat+8:elem(p,'note',key=n['midi']-12,pos=round((n['beat']-beat)*48),len=round(n['length']*48),vol=n['velocity'],pan=0)
        # Long phrase dynamics with smaller note-level swells and resolved endings.
        models=[830801+index];elem(it,'vol',id=models[0],value=volume*.55,scale_type='linear')
        at=elem(tc,'track',type=5,name=label+' V8 phrase expression',muted=0,solo=0);elem(at,'automationtrack')
        ap=elem(at,'automationpattern',pos=0,len=12288,prog=1,tens=1,mute=0,name='Distinct phrase and bow envelopes')
        stage_levels=([.64,.82,1.02,.72] if index<2 else [.65,.72,.86,.63] if index in [2,4] else [.64,.54,.44,.57] if index==3 else [.64,.73,.80,.65])
        for cycle in [0,1]:
            for beat in range(128):
                stage=beat//32;local=beat%32;bow=.88+.12*np.sin(np.pi*(beat%8)/8)
                phrase=.88+.17*np.sin(np.pi*local/32)
                if local>27:phrase*=1-.14*(local-27)/5
                value=volume*stage_levels[stage]*bow*phrase
                elem(ap,'time',pos=(cycle*128+beat)*48,value=round(value,4))
        elem(ap,'time',pos=12288,value=volume*stage_levels[0]*.88*.88);elem(ap,'object',id=models[0])
    root.find('song/projectnotes').text='V8: A/A-prime/B/A-double-prime. MIDI CC64 follows phrase/harmony; pitch-banded CC10 piano stage. Distinct orchestral voice-leading, expression and release. 32-bar seamless delivered cycle.'
    project=OUT/'01-title-frostglass-v8.mmp';ET.ElementTree(root).write(project,encoding='utf-8',xml_declaration=True)
    support=copy.deepcopy(root)
    for t in support.findall('.//track'):
        if t.get('name') in score:t.set('muted','1')
    probe=TMP/'backing-only-v8.mmp';ET.ElementTree(support).write(probe,encoding='utf-8',xml_declaration=True)
    save('score.json',{'bpm':BPM,'bars':32,'form':['A original theme','A-prime different answer','B upper strings and thinner bed','A-double-prime altered voicing and cadence'],
        'piano':score,'cc64_per_cycle':pedals,'orchestra':orchestra,'frozen_piano':reports})
    return project,probe,reports

def native(project,wav):
    si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW
    with wav.with_suffix('.log').open('wb') as log:
        p=subprocess.Popen([str(APP/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(project,APP),'-o',os.path.relpath(wav,APP),'-s',str(SR),'-a','-i','sincbest','-x','2'],cwd=APP,stdout=log,stderr=subprocess.STDOUT,startupinfo=si)
        print(json.dumps({'stage':'native render','pid':p.pid,'project':project.name}),flush=True)
        assert p.wait(timeout=240)==0
    x,sr=sf.read(wav,dtype='float32',always_2d=True);assert sr==SR and len(x)>=2*PERIOD and np.isfinite(x).all()
    return x[PERIOD:2*PERIOD].copy()

def room(x):
    x=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),np.concatenate([x[-SR:],x]),axis=0)[SR:];x-=x.mean(axis=0)
    source=sosfilt(butter(2,[220,5200],btype='bandpass',fs=SR,output='sos'),np.concatenate([x[-SR:],x]),axis=0)[SR:]
    for ch in [0,1]:
        ir=np.zeros(len(x))
        for delay,w in [(.041,.09),(.083,.055),(.157,.04),(.277,.028),(.433,.018),(.673,.010)]:ir[round((delay+ch*.009)*SR)]=w
        x[:,ch]+=np.fft.irfft(np.fft.rfft(source[:,ch]) * np.fft.rfft(ir),n=len(x))*.35
    # Keep sub-180Hz side energy controlled without flattening upper voices.
    m=x.mean(axis=1);s=(x[:,0]-x[:,1])/2
    s=sosfilt(butter(2,180,btype='highpass',fs=SR,output='sos'),np.concatenate([s[-SR:],s]))[SR:]
    return np.column_stack([m+s,m-s])

def main():
    sources=[PREV/'01-title-frostglass-v7.wav',PREV/'01-title-frostglass-v7.mmp',SOURCE/'render-report.json',FONT]
    before=[fp(p) for p in sources];score,pedals=piano_score();project,probe,piano=build(score,pedals)
    mix=room(native(project,TMP/'v8-full.wav'));back=room(native(probe,TMP/'v8-backing-only.wav'))
    raw=TMP/'unmatched-v8.wav';sf.write(raw,mix,SR,subtype='FLOAT')
    old=loudness(PREV/'01-title-frostglass-v7.wav');current=loudness(raw)
    gain=min(10**((float(old['input_i'])-float(current['input_i']))/20),.86/np.max(np.abs(mix)))
    mix*=gain;back*=gain
    mix[-192:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,192)))[:,None]
    wav=OUT/'01-title-frostglass-v8.wav';sf.write(wav,mix,SR,subtype='PCM_24')
    sf.write(TMP/'v8-matched-backing.wav',back,SR,subtype='FLOAT')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]+(['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6'])
        subprocess.run(args+['-metadata','title=霜窗回声 · 第八版',str(wav.with_suffix('.'+ext))],check=True)
    assert before==[fp(p) for p in sources]
    report={'title':'霜窗回声 · 第八版','seconds':PERIOD/SR,'bpm':BPM,'bars':32,'source_inputs_unchanged':before,
        'form':['A','A-prime','B','A-double-prime'],'piano_processing':piano,'native_performance_tracks':8,
        'post_gain_db':float(20*np.log10(gain)),'previous_loudness':old,'final_loudness':loudness(wav),
        'opening_backing_rms_ratio':rms(back[:2*SR])/rms(mix[:2*SR]),'opening_backing_first_200ms_rms':rms(back[:round(.2*SR)]),
        'files':[fp(p) for p in [project,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]],
        'source_delivery':'Original V7 preserved. New WAV/MP3/OGG and native MMP; piano clips own ignored temp. Existing LMMS/GS only.',
        'limits':['Objective space, phrasing and decode checks do not prove subjective quality. User audition decides.','No reference music copied; original theme retained.']}
    save('render-report.json',report)
    print(json.dumps({'seconds':report['seconds'],'lufs':report['final_loudness']['input_i'],'lra':report['final_loudness']['input_lra'],'opening_support':report['opening_backing_rms_ratio']},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
