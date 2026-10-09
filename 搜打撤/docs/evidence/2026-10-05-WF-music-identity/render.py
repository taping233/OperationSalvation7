import sys,pathlib,json,hashlib,subprocess,copy,os,concurrent.futures
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
from score import build,engine,HERE

ROOT=engine.ROOT;SR=48000
TMP=ROOT/'.tmp/music-workstation/identity'
TARGETS={'lead':-43,'counter':-49,'accompaniment':-49,'pad':-53,'bass':-46,'drums':-48,'signature':-54,'detail':-65,'percussion':-50}

def calibrate(scores):
    probes=[]
    for s in scores:
        for label,t in s.tracks.items():probes.append((s,label,t))
    folder=TMP/'calibration';folder.mkdir(parents=True,exist_ok=True)
    def render_probe(item):
        s,label,t=item
        pattern=max(t.findall('pattern'),key=lambda p:len(p.findall('note')))
        name=s.role+'-'+label.replace(' ','-');project=folder/(name+'.mmp');wav=folder/(name+'.wav')
        r=ET.Element('lmms-project',s.root.attrib);r.append(copy.deepcopy(s.root.find('head')))
        song=ET.SubElement(r,'song');tc=ET.SubElement(song,'trackcontainer',{'type':'song'});track=ET.SubElement(tc,'track',t.attrib)
        track.append(copy.deepcopy(t.find('instrumenttrack')));p=copy.deepcopy(pattern);p.set('pos','0');track.append(p)
        ET.ElementTree(r).write(project,encoding='utf-8',xml_declaration=True)
        si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW
        with (folder/(name+'.log')).open('wb') as log:
            process=subprocess.run([str(engine.LMMS/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(project,engine.LMMS),'-o',os.path.relpath(wav,engine.LMMS),'-s',str(SR),'-a'],cwd=engine.LMMS,stdout=log,stderr=subprocess.STDOUT,startupinfo=si,timeout=90)
        if process.returncode:raise RuntimeError('Probe failed: '+name)
        pcm,sr=sf.read(wav,always_2d=True);pcm=pcm[:round(int(pattern.get('len'))/48*60/s.bpm*sr)]
        rms=float(20*np.log10(np.sqrt(np.mean(pcm*pcm))+1e-12));peak=float(20*np.log10(np.max(np.abs(pcm))+1e-12));group=s.groups[label]
        adjustment=float(np.clip(TARGETS[group]-rms,-8,6))
        return {'role':s.role,'track':label,'group':group,'rms_dbfs':rms,'peak_dbfs':peak,'suggested_db':adjustment,'initial_volume':s.stats[label]['volume']}
    result=list(concurrent.futures.ThreadPoolExecutor(3).map(render_probe,probes))
    (HERE/'round-A-instruments.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result),flush=True)

def polish(scores):
    adjustments=json.loads((HERE/'round-B-adjustments.json').read_text(encoding='utf-8'))
    for s in scores:
        for label,t in s.tracks.items():
            factor=10**(adjustments['volume_db'].get(s.role,{}).get(label,0)/20)
            vol=min(180,max(1,s.stats[label]['volume']*factor))
            t.find('instrumenttrack').set('vol',str(round(vol,3)));s.stats[label]['volume']=round(vol,3)
            group=s.groups[label]
            for p in t.findall('pattern'):
                bar=int(p.get('pos'))//192;block=bar//8
                notes=list(p.findall('note'))
                for n in notes:
                    # Phrase-wide rises and falls; no new synth layers in the classical palette.
                    phrase=float(n.get('pos'))/int(p.get('len'))
                    shape=1+.09*np.sin(np.pi*phrase)-(.07 if block in [0,3,5] else 0)
                    n.set('vol',str(round(np.clip(int(n.get('vol'))*shape,1,100))))
                if group=='accompaniment' and block==3:
                    for n in notes[1::2]:p.remove(n)
                if group=='signature' and block in [1,4] and bar%4!=0:
                    for n in notes[1:]:p.remove(n)
                # Final statement opens the strings' upper register rather than repeating static chords.
                if s.role=='title' and label=='Low strings' and block==4 and len(notes)>1:
                    notes[-1].set('key',str(int(notes[-1].get('key'))+7))
                if s.role=='explore' and label=='Clarinet response' and block==4 and len(notes)>1:
                    notes[-1].set('len',str(int(notes[-1].get('len'))+18))
                if s.role=='battle' and label=='Horn answer' and block==4:
                    for n in notes:n.set('pos',str(int(n.get('pos'))+12))
                if s.role=='title' and label=='Piano theme' and bar==32:
                    ET.SubElement(p,'note',{'key':'62','pos':'96','len':'7','vol':'43','pan':'0'})
                if s.role=='explore' and label=='Piano travel theme' and bar==32:
                    ET.SubElement(p,'note',{'key':'65','pos':'34','len':'6','vol':'40','pan':'0'})
        s.stats={k:{**v,'final_note_count':sum(len(p.findall('note')) for p in s.tracks[k].findall('pattern'))} for k,v in s.stats.items()}

def hall_master(report,round_name):
    wav=ROOT/next(f['path'] for f in report['files'] if f['path'].endswith('.wav'))
    pcm,sr=sf.read(wav,dtype='float32',always_2d=True);n=len(pcm)
    # Same small hall for all pieces, with warm reflections and restrained high-frequency tails.
    wet=np.zeros_like(pcm)
    for ch in range(2):
        impulse=np.zeros(n,dtype=np.float32)
        for delay,weight in [(.037,.22),(.063,.19),(.091,.16),(.143,.13),(.211,.10),(.307,.075),(.431,.052),(.601,.038),(.823,.025), (1.071,.017)]:
            impulse[round((delay+ch*.004)*sr)]=weight
        x=sosfilt(butter(2,3200,fs=sr,output='sos'),np.concatenate([pcm[-sr:,1-ch],pcm[:,1-ch]]))[sr:]
        wet[:,ch]=np.fft.irfft(np.fft.rfft(x)*np.fft.rfft(impulse),n=n)
    mix=pcm+wet*(.075 if round_name=='A' else .045)
    peak=np.max(np.abs(mix));mix*=min(1,.87/peak)
    width=96;mix[-width:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,width)))[:,None]
    sf.write(wav,mix,sr,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        p=wav.with_suffix('.'+ext)
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args += ['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title='+report['title'],str(p)],check=True)
    report.update({'round':round_name,'bars':48,'groups':GROUPS[report['role']],'common_elements':['soft bowed strings','sparse acoustic celesta and triangle','same restrained hall'],'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix*mix)))),'subjective_listening':'not claimed; requires user listening'})
    for f in report['files']:
        p=ROOT/f['path'];f.update({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    wav.with_name(wav.stem+'-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'A'
    scores=build();GROUPS={s.role:s.groups for s in scores}
    if mode=='calibrate':calibrate(scores);sys.exit(0)
    if mode=='B':polish(scores)
    folder=HERE/('round-'+mode);folder.mkdir(exist_ok=True)
    engine.OUT=folder;engine.INTERMEDIATE=TMP/('round-'+mode);engine.INTERMEDIATE.mkdir(parents=True,exist_ok=True)
    reports=[hall_master(engine.execute(s),mode) for s in scores]
    (folder/'render-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'round':mode,'seconds':[r['seconds'] for r in reports]}),flush=True)
