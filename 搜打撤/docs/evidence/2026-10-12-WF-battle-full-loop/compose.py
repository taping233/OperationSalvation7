"""64-bar original arrangement expanded from the approved v4 score."""
import concurrent.futures
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
V4=ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v4'
LMMS=ROOT/'.tmp/music-workstation/LMMS'
FONT=ROOT/'.tmp/music-workstation/GeneralUser-GS.sf2'
SR=48000
BARS=64
SECONDS=120
NAME='battle-shadowtide-full-loop'
GROUPS={'bass':['Synth bass pulse','Cello floor'],'kick':['Kick'],
    'beat':['Snare and ghosts','Hats','Low percussion'],
    'theme':['Ensemble theme','Muted brass answer','Viola response'],
    'detail':['Pizzicato motor','Electric piano','Harp turn','Dark glass','Air pad']}
SECTIONS=[
    ('Theme',list(range(14))+[6,7]),
    ('Development',[2,3,4,5,6,7,10,11,12,13,6,7,2,3,14,7]),
    ('Breathing',[8,9,8,9,4,5,6,7]),
    ('Return',[2,3,4,5,6,7,10,11,2,3,12,13,6,7,14,7]),
    ('Turnaround',[8,9,6,7,6,7,14,7]),
]

def dump(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def make_project():
    original=ET.parse(V4/'battle-shadowtide-v4-30s.mmp')
    tree=copy.deepcopy(original)
    mapping=[(section,source) for section,sources in SECTIONS for source in sources]
    old_progression=json.loads((V4/'score.json').read_text(encoding='utf-8'))['progression']
    events=[]
    progression=[]
    for section,source in mapping:
        progression.append(old_progression[source])
    for track in tree.findall('.//track'):
        name=track.get('name')
        sources=list(track.findall('pattern'))
        for pattern in sources:
            track.remove(pattern)
        for bar,(section,source) in enumerate(mapping):
            for source_pattern in sources:
                if int(source_pattern.get('pos'))!=source*192:
                    continue
                pattern=copy.deepcopy(source_pattern)
                pattern.set('pos',str(bar*192))
                pattern.set('name',section+' / '+name)
                # Development varies register while retaining the approved contour.
                if section=='Development' and name in ('Ensemble theme','Viola response') and bar<24:
                    for note in pattern.findall('note'):
                        note.set('key',str(int(note.get('key'))-12))
                # An eight-bar respite thins the backing rather than stopping time.
                if section=='Breathing':
                    for note in list(pattern.findall('note')):
                        position=int(note.get('pos'))
                        if name=='Pizzicato motor' and position>96:
                            pattern.remove(note)
                        elif name in ('Hats','Kick') and position>120:
                            pattern.remove(note)
                        else:
                            note.set('vol',str(max(20,int(note.get('vol'))-9)))
                    if name=='Ensemble theme':
                        for note in pattern.findall('note'):
                            note.set('key',str(int(note.get('key'))-12))
                if section=='Return' and name=='Ensemble theme':
                    for note in pattern.findall('note'):
                        note.set('vol',str(min(95,int(note.get('vol'))+3)))
                # Last two bars are A7, with a light pickup into the opening Dm.
                if bar>=62 and name in ('Kick','Snare and ghosts','Hats','Low percussion'):
                    for note in list(pattern.findall('note')):
                        if int(note.get('pos'))>120:
                            pattern.remove(note)
                        else:
                            note.set('vol',str(max(20,int(note.get('vol'))-12)))
                if bar==63 and name=='Ensemble theme':
                    for note in list(pattern.findall('note')):
                        pattern.remove(note)
                    for beat,midi,length,velocity in [(0,76,1.2,60),(1.5,73,.9,56),(3.25,73,.7,53)]:
                        ET.SubElement(pattern,'note',key=str(midi-12),pos=str(round(beat*48)),
                            len=str(round(length*48)),vol=str(velocity),pan='0')
                if bar==63 and name=='Synth bass pulse':
                    ET.SubElement(pattern,'note',key='33',pos='156',len='36',vol='67',pan='0')
                if bar==63 and name=='Kick':
                    ET.SubElement(pattern,'note',key='24',pos='180',len='6',vol='57',pan='0')
                track.append(pattern)
                for note in pattern.findall('note'):
                    events.append({'track':name,'bar':bar,'section':section,
                        'start_beats':(bar*192+int(note.get('pos')))/48,
                        'midi':int(note.get('key'))+12,'length_beats':int(note.get('len'))/48,
                        'velocity':int(note.get('vol'))})
    timeline=tree.find('.//timelinestate')
    timeline.set('lp1pos',str(BARS*192))
    timeline.set('lpstate','1')
    tree.find('.//projectnotes').text='Shadowtide full loop: 64 bars, 128 BPM, 120 seconds. Original approved motif; A7 turnaround to Dm. Two-cycle native rendering and periodic post-processing in compose.py/mix.py.'
    project=OUT/(NAME+'.mmp')
    tree.write(project,encoding='utf-8',xml_declaration=True)
    section_rows=[]
    start=0
    for name,sources in SECTIONS:
        section_rows.append({'name':name,'start_bar':start,'bars':len(sources),
            'start_seconds':start*1.875,'end_seconds':(start+len(sources))*1.875})
        start+=len(sources)
    dump('score.json',{'bpm':128,'bars':BARS,'seconds':SECONDS,'progression':progression,
        'sections':section_rows,'groups':GROUPS,'events':events,
        'source':(V4/'score.json').relative_to(ROOT).as_posix(),
        'source_sha256':hashlib.sha256((V4/'score.json').read_bytes()).hexdigest()})
    return project

def render(group,project):
    tree=ET.parse(project)
    container=tree.find('.//trackcontainer')
    for track in list(container.findall('track')):
        if track.get('name') not in GROUPS[group]:
            container.remove(track)
        else:
            # The second pass contains the preceding cycle's release/reverb tails.
            for pattern in list(track.findall('pattern')):
                duplicate=copy.deepcopy(pattern)
                duplicate.set('pos',str(int(pattern.get('pos'))+BARS*192))
                track.append(duplicate)
    tree.find('.//timelinestate').set('lpstate','0')
    tree.find('.//timelinestate').set('lp1pos',str(BARS*2*192))
    stem_project=OUT/(group+'-render.mmp')
    raw=OUT/(group+'-two-cycles.wav')
    tree.write(stem_project,encoding='utf-8',xml_declaration=True)
    config=OUT/(group+'-lmms.xml')
    config.write_text('<lmms version="1.2.2"><mixer audiodev="Dummy"/><paths plugins="plugins/" laddir="plugins/ladspa/"/></lmms>',encoding='utf-8')
    startup=subprocess.STARTUPINFO()
    startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow=0
    args=[str(LMMS/'lmms.exe'),'-c',str(config),'render',os.path.relpath(stem_project,LMMS),
        '-o',os.path.relpath(raw,LMMS),'-s',str(SR),'-a','-i','sincbest','-x','2']
    with (OUT/(group+'-render.log')).open('wb') as log:
        process=subprocess.Popen(args,cwd=LMMS,stdout=log,stderr=subprocess.STDOUT,startupinfo=startup)
        dump(group+'-process.json',{'pid':process.pid,'cwd':str(LMMS),'command':args})
        print('Native full-length render '+group+', PID '+str(process.pid),flush=True)
        if process.wait(timeout=600)!=0:
            raise RuntimeError('Native render failed: '+group)
    period=SR*SECONDS
    with sf.SoundFile(raw) as handle:
        if handle.samplerate!=SR or len(handle)<period*2:
            raise RuntimeError('Native period length/rate mismatch')
        handle.seek(period)
        x=handle.read(period,dtype='float32',always_2d=True)
    if not np.isfinite(x).all() or np.max(np.abs(x))<1e-6:
        raise RuntimeError('Invalid native output: '+group)
    stem=OUT/(group+'-loop-native.wav')
    sf.write(stem,x,SR,subtype='FLOAT')
    print('Native loop stem complete: '+group,flush=True)
    return stem

if __name__=='__main__':
    project=make_project()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures={g:pool.submit(render,g,project) for g in GROUPS}
        for group,future in futures.items():
            future.result()
