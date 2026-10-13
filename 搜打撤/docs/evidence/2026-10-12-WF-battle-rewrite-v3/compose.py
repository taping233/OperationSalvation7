"""Third take: change the melody only; preserve v2 rhythm and mastering."""
import hashlib
import importlib.util
import json
import pathlib
import shutil
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
PREVIOUS = ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v2'
SPEC = importlib.util.spec_from_file_location('v2_renderer', PREVIOUS/'compose.py')
ENGINE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ENGINE)
ENGINE.OUT = OUT
ENGINE.NAME = 'battle-shadowtide-v3-30s'
NAME = ENGINE.NAME

# The signature is two short stepwise pickups, a longer F, then A-G.
# A two-bar theme returns exactly in pitch, onset and duration at bars 10-11.
A = [(.25,74,.46,77),(.75,76,.46,70),(1.25,77,1.03,80),(2.5,81,.70,78),(3.25,79,.58,70)]
ANSWER = [(0,77,.71,74),(.75,76,.71,68),(1.5,74,1.45,75),(3.25,69,.38,60)]
THEMES = {
    2:A, 3:ANSWER,
    4:[(.25,74,.46,77),(.75,76,.46,70),(1.25,77,1.03,80),(2.5,79,.70,75),(3.25,77,.58,68)],
    5:[(0,77,.71,74),(.75,76,.71,68),(1.5,74,.96,73),(2.75,72,.46,63),(3.25,74,.58,68)],
    6:[(.25,77,.46,77),(.75,79,.46,71),(1.25,81,1.03,81),(2.5,79,.70,74),(3.25,77,.58,69)],
    7:[(0,76,.71,73),(.75,73,.71,67),(1.5,74,.71,69),(2.5,73,.65,65),(3.25,69,.38,60)],
    10:[(t,n,d,v+5) for t,n,d,v in A],
    11:[(t,n,d,v+5) for t,n,d,v in ANSWER],
    12:[(.25,79,.46,80),(.75,81,.46,74),(1.25,82,1.03,83),(2.5,81,.70,77),(3.25,79,.58,72)],
    13:[(0,76,.71,75),(.75,74,.71,69),(1.5,73,1.0,70),(2.75,69,.89,65)],
    14:[(.25,76,.71,72),(1,74,.71,68),(1.75,73,.96,68),(3,69,.50,63)],
    15:[(0,74,3.35,73)],
}

def dump(name, data):
    (OUT/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def make_project():
    source=PREVIOUS/'battle-shadowtide-v2-30s.mmp'
    tree=ET.parse(source)
    tracks=tree.findall('.//track')
    lead=next(t for t in tracks if t.get('name')=='Ensemble theme')
    for pattern in list(lead.findall('pattern')):
        lead.remove(pattern)
    for bar, notes in THEMES.items():
        pattern=ET.SubElement(lead,'pattern',type='1',pos=str(bar*192),len='192',steps='16',
            name='Signature theme / exact return' if bar in (2,3,10,11) else 'Motif development / cadence',muted='0')
        for beat,midi,length,velocity in notes:
            ET.SubElement(pattern,'note',key=str(midi-12),pos=str(round(beat*48)),
                len=str(round(length*48)),vol=str(velocity),pan='0')
    tree.find('.//projectnotes').text='Original Shadowtide v3, 16 bars. Melody rewritten; v2 rhythm/backing preserved. Mastering in compose.py.'
    project=OUT/(NAME+'.mmp')
    tree.write(project,encoding='utf-8',xml_declaration=True)
    previous={t.get('name'):ET.tostring(t) for t in ET.parse(source).findall('.//track')}
    unchanged={t.get('name'):ET.tostring(t)==previous[t.get('name')] for t in tracks if t is not lead}
    if not all(unchanged.values()):
        raise RuntimeError('Unexpected backing change')
    events=[]
    for track in tracks:
        for pattern in track.findall('pattern'):
            for note in pattern.findall('note'):
                events.append({'track':track.get('name'),
                    'start_beats':(int(pattern.get('pos'))+int(note.get('pos')))/48,
                    'midi':int(note.get('key'))+12,'length_beats':int(note.get('len'))/48,
                    'velocity':int(note.get('vol'))})
    prior_score=json.loads((PREVIOUS/'score.json').read_text(encoding='utf-8'))
    dump('score.json',{'bpm':128,'bars':16,'progression':prior_score['progression'],
        'groups':ENGINE.GROUPS,'events':events})
    dump('backing-preservation.json',{'previous_project':source.relative_to(ROOT).as_posix(),
        'previous_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'unchanged_tracks':unchanged,'modified_track':'Ensemble theme'})
    return project

def run():
    project=make_project()
    stems={}
    copied=[]
    for group in ('low','beat','detail'):
        source=PREVIOUS/(group+'-native.wav')
        target=OUT/source.name
        shutil.copyfile(source,target)
        source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
        if source_hash!=hashlib.sha256(target.read_bytes()).hexdigest():
            raise RuntimeError('Stem copy mismatch')
        data,sr=sf.read(target,dtype='float32',always_2d=True)
        if sr!=48000:
            raise RuntimeError('Unexpected sample rate')
        stems[group]=data[:48000*30].astype(np.float64)
        copied.append({'path':target.relative_to(ROOT).as_posix(),
            'source':source.relative_to(ROOT).as_posix(),'sha256':source_hash,'method':'Byte-identical copy of verified v2 native stem'})
    stems['theme']=ENGINE.render_stem('theme',project)
    ENGINE.master(project,stems)
    # Correct only the MP3 title tag while preserving its encoded audio stream.
    mp3=OUT/(NAME+'.mp3')
    tagged=OUT/(NAME+'-tagged.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(mp3),'-c:a','copy',
        '-metadata','title=Shadowtide v3',str(tagged)],check=True)
    tagged.replace(mp3)
    report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
    for row in report['files']:
        if row['path']==mp3.relative_to(ROOT).as_posix():
            row.update(bytes=mp3.stat().st_size,sha256=hashlib.sha256(mp3.read_bytes()).hexdigest())
    report['engine']='LMMS 1.2.2 / FluidSynth; new theme native render, three verified v2 stems reused; v2 mastering preserved'
    report['reused_stems']=copied
    dump('render-report.json',report)
    subprocess.run(['ffmpeg','-v','error','-i',str(mp3),'-f','null','-'],check=True)

if __name__=='__main__':
    run()
