"""Piano performance unchanged; orchestral foundation present from beat zero."""
import pathlib,sys,importlib.util,json,copy,xml.etree.ElementTree as ET,subprocess,re,hashlib
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
PREV=OUT.parent/'2026-10-05-WF-music-title-v6';TMP=ROOT/'.tmp/music-workstation/title-v7';TMP.mkdir(exist_ok=True)
sys.path.insert(0,str(PREV))
spec=importlib.util.spec_from_file_location('previous_render',PREV/'render.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
SR=48000;PERIOD=4388571
sys.stdout.reconfigure(encoding='utf-8')
def elem(parent,tag,**attributes):return ET.SubElement(parent,tag,{k:str(v) for k,v in attributes.items()})
def fingerprint_piano(root):return {t.get('name'):hashlib.sha256(ET.tostring(t,encoding='utf-8')).hexdigest() for t in root.findall('.//track') if t.get('name') in ['Piano melody','Quiet piano harmony']}
def loudness(path):
    p=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True);assert p.returncode==0
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',p.stderr.decode(errors='replace'),re.S)[-1])

def build():
    before=ET.parse(PREV/'01-title-frostglass-v6.mmp').getroot();root=copy.deepcopy(before);tc=root.find('song/trackcontainer')
    # Bring the already-approved harmony of bars8–16 to bars0–8 in both cycles.
    opening_counts={}
    for label in ['Strings left','Strings right','Cello foundation']:
        track=next(t for t in root.findall('.//track') if t.get('name')==label);added=0
        for cycle in [0,6144]:
            sources=[p for p in track.findall('pattern') if cycle+1536<=int(p.get('pos'))<cycle+3072]
            assert len(sources)==4
            for p in sources:
                q=copy.deepcopy(p);q.set('pos',str(int(p.get('pos'))-1536));q.set('name','Opening harmonic foundation');track.append(q);added+=1
        opening_counts[label]=added
        # The opening support must be audible, not just scheduled with nearly-zero gain.
        for auto in root.findall('.//track'):
            if not auto.get('name','').startswith(label+' '):continue
            for p in auto.findall('automationpattern'):
                for time in p.findall('time'):
                    beat=(int(time.get('pos'))/48)%128
                    if beat<=28:time.set('value',str(round(float(track.find('instrumenttrack').get('vol'))*(.55+.04*np.sin(np.pi*beat/28)),4)))
        volume_node=track.find('instrumenttrack/vol')
        if volume_node is not None:volume_node.set('value',str(float(track.find('instrumenttrack').get('vol'))*.55))
    font=next(t for t in root.findall('.//track') if t.get('name')=='Strings left').find('instrumenttrack/instrument/sf2player').get('src')
    CA=[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]]
    CB=[[48,55,60,63],[39,46,55,58],[41,48,53,56],[43,50,53,59]]
    layers=[('Warm orchestral bed',49,48,-4,42),('Viola middle foundation',41,34,23,43),('Double bass foundation',43,38,0,44)]
    new_tracks=[]
    for i,(label,patch,volume,pan,velocity) in enumerate(layers):
        track=elem(tc,'track',type=0,name=label,muted=0,solo=0)
        it=elem(track,'instrumenttrack',vol=volume,pan=pan,pitch=0,basenote=57,usemasterpitch=1,pitchrange=1,fxch=0)
        instrument=elem(it,'instrument',name='sf2player')
        elem(instrument,'sf2player',src=font,bank=0,patch=patch,gain=1,reverbOn=1,reverbRoomSize=.68,reverbDamping=.62,reverbWidth=.85,reverbLevel=.14 if i<2 else .04,chorusOn=0)
        elem(it,'fxchain',enabled=0,numofeffects=0)
        for cycle in [0,32]:
            for bar in range(0,32,2):
                chords=CB if 16<=bar<24 else CA;chord=chords[(bar%8)//2]
                if i==0:notes=[chord[0],chord[1],chord[3]-12]
                elif i==1:notes=[chord[2]]
                else:notes=[chord[0]-12]
                p=elem(track,'pattern',type=1,pos=(bar+cycle)*192,len=384,steps=32,name='Sustained tonal backing from opening',muted=0)
                for note in notes:elem(p,'note',key=note-12,pos=0,len=382 if i<2 else 378,vol=velocity,pan=0)
        model=830001+i;elem(it,'vol',id=model,value=volume*.62,scale_type='linear')
        at=elem(tc,'track',type=5,name=label+' continuous level',muted=0,solo=0);elem(at,'automationtrack')
        ap=elem(at,'automationpattern',pos=0,len=12288,prog=1,tens=1,mute=0,name=label+' restrained swell')
        points=[(0,.62),(28,.66),(32,.68),(56,.74),(64,.78),(84,.87),(96,.70),(112,.62),(124,.60),(128,.62)]
        for cycle in [0,128]:
            for beat,factor in points:elem(ap,'time',pos=(beat+cycle)*48,value=round(volume*factor,3))
        elem(ap,'object',id=model);new_tracks.append({'name':label,'program':patch,'volume':volume,'role':'sustained harmony; no independent melodic line'})
    assert fingerprint_piano(root)==fingerprint_piano(before)
    root.find('song/projectnotes').text='V7: V6 real-pedal piano preserved. Original string harmony enters from beat0; warm orchestral bed, viola and contrabass support the opening and entire piece. No new competing melody.'
    project=OUT/'01-title-frostglass-v7.mmp';ET.ElementTree(root).write(project,encoding='utf-8',xml_declaration=True)
    backing=copy.deepcopy(root)
    for t in backing.findall('.//track'):
        if t.get('name') in ['Piano melody','Quiet piano harmony']:t.set('muted','1')
    probe=TMP/'backing-only.mmp';ET.ElementTree(backing).write(probe,encoding='utf-8',xml_declaration=True)
    return project,probe,root,opening_counts,new_tracks

def chamber(pcm):
    pcm=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),np.concatenate([pcm[-SR:],pcm]),axis=0)[SR:]
    pcm-=pcm.mean(axis=0);wet=np.zeros_like(pcm);mono=pcm.mean(axis=1)
    source=sosfilt(butter(2,[180,5600],btype='bandpass',fs=SR,output='sos'),np.concatenate([mono[-SR:],mono]))[SR:]
    for ch in [0,1]:
        ir=np.zeros(len(pcm))
        for delay,w in [(.037,.12),(.079,.08),(.151,.055),(.283,.035),(.431,.020),(.691,.012),(.997,.007)]:ir[round((delay+ch*.013)*SR)]=w
        wet[:,ch]=np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(ir),n=len(pcm))
    return pcm+wet*.24

if __name__=='__main__':
    project,probe,root,opening,new_tracks=build()
    full=helper.native(project,TMP/'v7-full.wav');backing=helper.native(probe,TMP/'v7-backing-only.wav')
    assert len(full)>=2*PERIOD and len(backing)>=2*PERIOD
    mix=chamber(full[PERIOD:2*PERIOD].copy());support=chamber(backing[PERIOD:2*PERIOD].copy())
    wav=OUT/'01-title-frostglass-v7.wav';sf.write(TMP/'unmatched.wav',mix,SR,subtype='FLOAT')
    old=loudness(PREV/'01-title-frostglass-v6.wav');current=loudness(TMP/'unmatched.wav')
    gain=min(10**((float(old['input_i'])-float(current['input_i']))/20),.86/np.max(np.abs(mix)))
    mix*=gain;support*=gain
    mix[-96:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,96)))[:,None]
    sf.write(wav,mix,SR,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args+=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title=霜窗回声 · 第七版',str(wav.with_suffix('.'+ext))],check=True)
    rms=lambda pcm:float(np.sqrt(np.mean(pcm*pcm)))
    opening_ratio=rms(support[:2*SR])/rms(mix[:2*SR]);assert opening_ratio>.12,'Opening backing exists on paper but too quiet in render'
    assert rms(support[:round(.2*SR)])>.0005
    files=[project,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]
    report={'title':'霜窗回声 · 第七版','seconds':PERIOD/SR,'bpm':84,'opening_harmony_patterns_added':opening,'new_layers':new_tracks,'native_instrument_tracks':8,'piano_tracks_preserved':fingerprint_piano(root),'opening_support_first_2s_rms_ratio':opening_ratio,'opening_support_rms_dbfs':float(20*np.log10(rms(support[:2*SR]))),'opening_first_200ms_backing_rms':rms(support[:round(.2*SR)]),'final_loudness':loudness(wav),'previous_loudness':old,'common_gain_db':float(20*np.log10(gain)),'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(rms(mix))),'files':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],'limits':['Backing ratio is not a subjective quality score','Piano frozen recordings and soft pedal remain V6; only sustained accompaniment changed','User listening decides whether backing level and clarity are appropriate']}
    (OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'seconds':report['seconds'],'instrument_tracks':8,'opening_support_ratio':opening_ratio,'opening_support_dbfs':report['opening_support_rms_dbfs'],'lufs':report['final_loudness']['input_i'],'piano_unchanged':True},ensure_ascii=True),flush=True)
