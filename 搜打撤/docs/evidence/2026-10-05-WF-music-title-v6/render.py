"""Preserve v5 strings verbatim. Re-record only piano with real MIDI sustain pedal.
The installed LMMS FluidSynth library records piano; native LMMS mixes all parts.
"""
import pathlib,json,xml.etree.ElementTree as ET,copy,subprocess,os,hashlib,sys
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
from fluid_engine import render,version,APP
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
PREV=OUT.parent/'2026-10-05-WF-music-title-v5';TMP=ROOT/'.tmp/music-workstation/title-v6';TMP.mkdir(exist_ok=True)
SR=48000;BPM=84;BEAT=60/BPM;PERIOD=round(128*BEAT*SR)
sys.stdout.reconfigure(encoding='utf-8')

def native(project,wav):
    si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW
    with wav.with_suffix('.log').open('wb') as log:
        p=subprocess.Popen([str(APP/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(project,APP),'-o',os.path.relpath(wav,APP),'-s',str(SR),'-a','-i','sincbest','-x','2'],cwd=APP,stdout=log,stderr=subprocess.STDOUT,startupinfo=si)
        print(json.dumps({'stage':'native-render','pid':p.pid,'project':project.name}),flush=True)
        assert p.wait(timeout=180)==0
    pcm,sr=sf.read(wav,dtype='float32',always_2d=True);assert sr==SR and np.isfinite(pcm).all();return pcm

def strings_fingerprint(root):
    names=['Strings left','Strings right','Cello foundation']
    tracks=[t for t in root.findall('.//track') if t.get('name') in names or any(t.get('name','').startswith(n+' ') for n in names)]
    return {t.get('name'):hashlib.sha256(ET.tostring(t,encoding='utf-8')).hexdigest() for t in tracks}

def piano(label,source_tree,notes):
    # Isolated native v5 track is the loudness reference, not a guessed global gain.
    probe=ET.Element('lmms-project',source_tree.attrib);probe.append(copy.deepcopy(source_tree.find('head')))
    song=ET.SubElement(probe,'song');tc=ET.SubElement(song,'trackcontainer',{'type':'song'})
    original=next(t for t in source_tree.findall('.//track') if t.get('name')==label)
    tc.append(copy.deepcopy(original));path=TMP/(label.replace(' ','-')+'-reference.mmp')
    previous_bytes=path.read_bytes() if path.exists() else None
    ET.ElementTree(probe).write(path,encoding='utf-8',xml_declaration=True)
    wav_path=path.with_suffix('.wav')
    if previous_bytes==path.read_bytes() and wav_path.exists():
        previous_pcm,previous_sr=sf.read(wav_path,dtype='float32',always_2d=True)
        assert previous_sr==SR and len(previous_pcm)>=2*PERIOD
        reference=previous_pcm[PERIOD:2*PERIOD]
    else:reference=native(path,wav_path)[PERIOD:2*PERIOD]
    events=[];pedal_events=[]
    for cycle in [0,1]:
        shift=cycle*128
        for beat in np.arange(0,128,2):
            down=shift+beat+(0 if beat==0 else .025)
            up=shift+beat+1.92
            pedal_events.extend([{'beat':float(down),'cc64':127},{'beat':float(up),'cc64':0}])
            events.extend([(round(down*BEAT*SR),0,'cc',64,127),(round(up*BEAT*SR),0,'cc',64,0)])
        for note in notes:
            start=shift+note['beat']
            if label=='Piano melody':
                release=shift+note['beat']+note['length']+.14
                next_pedal_lift=shift+np.ceil((note['beat']+note['length']+.015)/2)*2-.08
                release=min(release,next_pedal_lift-.01)
                velocity=round(np.clip(note['velocity']*.70+1,35,58))
            else:
                release=shift+min(note['beat']+7.88,128)
                velocity=round(np.clip(note['velocity']*.8,25,45))
            release=min(release,shift+127.94)
            events.extend([(round(start*BEAT*SR),2,'on',note['midi'],velocity),(round(release*BEAT*SR),1,'off',note['midi'],0)])
    pcm=render(events,2*PERIOD/SR)
    # A gentle hammer touch and controlled pedal tail, without obscuring the approved strings.
    pcm=sosfilt(butter(1,6500,fs=SR,output='sos'),pcm,axis=0).astype(np.float32)
    old_rms=float(np.sqrt(np.mean(reference**2)));new_rms=float(np.sqrt(np.mean(pcm[PERIOD:2*PERIOD]**2)))
    gain=old_rms/new_rms*10**((-3 if label=='Piano melody' else -4)/20)
    pcm*=gain
    clip=TMP/(label.replace(' ','-')+'-pedalled.wav')
    # Recorded clip is imported before LMMS's 70% master, so compensate that fixed master once.
    sf.write(clip,pcm/.7,SR,subtype='FLOAT')
    return clip,{'source_track':label,'old_native_rms':old_rms,'pedalled_rms_before_gain':new_rms,'gain':gain,'relative_to_previous_rms_db':-3 if label=='Piano melody' else -4,'pedal_events_first_cycle':[e for e in pedal_events if e['beat']<128],'piano_clip_path':str(clip.relative_to(ROOT)).replace('\\','/'),'piano_clip_bytes':clip.stat().st_size,'piano_clip_sha256':hashlib.sha256(clip.read_bytes()).hexdigest()}

if __name__=='__main__':
    before=ET.parse(PREV/'01-title-frostglass-v5.mmp').getroot();root=copy.deepcopy(before)
    old_report=json.loads((PREV/'render-report.json').read_text(encoding='utf-8'))
    piano_reports=[]
    for label in ['Piano melody','Quiet piano harmony']:
        clip,report=piano(label,before,old_report['authored_note_events'][label]);piano_reports.append(report)
        track=next(t for t in root.findall('.//track') if t.get('name')==label)
        it=track.find('instrumenttrack')
        it.set('vol','100');it.set('pan','3' if label=='Piano melody' else '-18');it.set('basenote','57')
        it.remove(it.find('instrument'));ins=ET.SubElement(it,'instrument',{'name':'audiofileprocessor'})
        ET.SubElement(ins,'audiofileprocessor',{'src':clip.as_posix(),'amp':'100','interp':'1','sframe':'0','eframe':'1','lframe':'0','looped':'0','reversed':'0','stutter':'0'})
        for p in list(track.findall('pattern')):track.remove(p)
        p=ET.SubElement(track,'pattern',{'type':'1','pos':'0','len':'12288','steps':'1024','name':'Real pedalled piano performance','muted':'0'})
        ET.SubElement(p,'note',{'key':'57','pos':'0','len':'12288','vol':'100','pan':'0'})
    assert strings_fingerprint(root)==strings_fingerprint(before)
    root.find('song/projectnotes').text='V6: strings and their automation preserved from V5. Piano re-recorded through installed FluidSynth with real CC64 pedal, softer velocity and key overlap; audio clips retained in task temp folder.'
    project=OUT/'01-title-frostglass-v6.mmp';ET.ElementTree(root).write(project,encoding='utf-8',xml_declaration=True)
    raw=native(project,TMP/'v6-native-full.wav');assert len(raw)>=2*PERIOD
    mix=raw[PERIOD:2*PERIOD].copy()
    # Same gain and room as V5 keep the approved string part at its previous reference level.
    mix=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),np.concatenate([mix[-SR:],mix]),axis=0)[SR:]
    mix-=mix.mean(axis=0);mix*=10**(old_report['post_master_gain_db']/20)
    wet=np.zeros_like(mix);mono=mix.mean(axis=1)
    source=sosfilt(butter(2,[180,5600],btype='bandpass',fs=SR,output='sos'),np.concatenate([mono[-SR:],mono]))[SR:]
    for ch in [0,1]:
        ir=np.zeros(len(mix))
        for delay,w in [(.037,.12),(.079,.08),(.151,.055),(.283,.035),(.431,.020),(.691,.012),(.997,.007)]:ir[round((delay+ch*.013)*SR)]=w
        wet[:,ch]=np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(ir),n=len(mix))
    mix+=wet*.24;mix-=mix.mean(axis=0)
    safety=min(1,.86/np.max(np.abs(mix)));mix*=safety
    mix[-96:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,96)))[:,None]
    wav=OUT/'01-title-frostglass-v6.wav';sf.write(wav,mix,SR,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args+=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title=霜窗回声 · 第六版',str(wav.with_suffix('.'+ext))],check=True)
    files=[project,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]
    report={'title':'霜窗回声 · 第六版','seconds':len(mix)/SR,'bpm':84,'engine':'Installed LMMS + FluidSynth '+version().decode(),'strings_score_and_automation_exactly_preserved':strings_fingerprint(root),'piano_processing':piano_reports,'old_master_gain_db':old_report['post_master_gain_db'],'extra_safety_gain_db':float(20*np.log10(safety)),'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix*mix)))),'files':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],'limitations':['No new string notes, dynamics or soundfont','Piano clips are editable by regenerating MIDI-event rendering; native LMMS project contains frozen piano audio','Sustain pedal measurement does not prove the piano is subjectively better','User has not yet authorised removing piano; this candidate retains it']}
    (OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'seconds':report['seconds'],'strings_preserved':True,'real_cc64_pedal':True,'piano_rms_change_db':[-3,-4],'peak_dbfs':report['peak_dbfs'],'rms_dbfs':report['rms_dbfs']},ensure_ascii=True),flush=True)
