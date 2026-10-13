"""Local repairs at 45s and 75s; approved themes and other bars preserved."""
import concurrent.futures
import copy
import hashlib
import importlib.util
import json
import pathlib
import shutil
import xml.etree.ElementTree as ET

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
PREVIOUS=ROOT/'docs/evidence/2026-10-12-WF-battle-full-loop'
NAME='battle-shadowtide-full-loop-v2'

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

RENDER=module('prior_renderer',PREVIOUS/'compose.py')
MIX=module('prior_mixer',PREVIOUS/'mix.py')
RENDER.OUT=OUT
MIX.OUT=OUT
MIX.NAME=NAME

def dump(name,data):
    (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

def patch_project():
    source=PREVIOUS/'battle-shadowtide-full-loop.mmp'
    tree=ET.parse(source)
    original={t.get('name'):copy.deepcopy(t) for t in tree.findall('.//track')}
    pitch_maps={22:[62,64,65,69,70],23:[72,74,76,77],
        38:[65,67,69,67,70],39:[69,70,73,76,73]}
    allowed=[]
    for track in tree.findall('.//track'):
        name=track.get('name')
        for pattern in track.findall('pattern'):
            bar=int(pattern.get('pos'))//192
            notes=pattern.findall('note')
            if name=='Ensemble theme' and bar in pitch_maps:
                if len(notes)!=len(pitch_maps[bar]):
                    raise RuntimeError('Unexpected theme pattern')
                for note,midi in zip(notes,pitch_maps[bar]):
                    note.set('key',str(midi-12))
                allowed.append({'track':name,'bar':bar,'change':'transition pitch contour'})
            if bar in (38,39) and name in ('Ensemble theme','Synth bass pulse','Kick','Snare and ghosts','Hats'):
                boost=4 if bar==38 else 8
                for note in notes:
                    note.set('vol',str(min(95,int(note.get('vol'))+boost)))
                allowed.append({'track':name,'bar':bar,'change':'pre-return velocity ramp','velocity_add':boost})
            if bar==39 and name=='Synth bass pulse':
                ET.SubElement(pattern,'note',key='33',pos='156',len='31',vol='58',pan='0')
                allowed.append({'track':name,'bar':bar,'change':'A2 pickup support'})
            if bar==39 and name=='Kick':
                ET.SubElement(pattern,'note',key='24',pos='168',len='7',vol='59',pan='0')
                allowed.append({'track':name,'bar':bar,'change':'one kick pickup'})
            if bar==39 and name=='Hats':
                ET.SubElement(pattern,'note',key='30',pos='168',len='5',vol='29',pan='0')
                allowed.append({'track':name,'bar':bar,'change':'one hat pickup'})
    tree.find('.//projectnotes').text='Shadowtide full loop v2: localized 45s/75s connection repair. Approved main themes and other bars preserved. Same mix processing as full-loop v1.'
    project=OUT/(NAME+'.mmp')
    tree.write(project,encoding='utf-8',xml_declaration=True)
    allowed_keys={(x['track'],x['bar']) for x in allowed}
    preserved=0
    for track in tree.findall('.//track'):
        old=original[track.get('name')]
        old_patterns={int(p.get('pos')):p for p in old.findall('pattern')}
        for p in track.findall('pattern'):
            bar=int(p.get('pos'))//192
            if (track.get('name'),bar) not in allowed_keys:
                if ET.tostring(p)!=ET.tostring(old_patterns[int(p.get('pos'))]):
                    raise RuntimeError('Unapproved pattern change')
                preserved+=1
    score=json.loads((PREVIOUS/'score.json').read_text(encoding='utf-8'))
    events=[]
    for track in tree.findall('.//track'):
        for pattern in track.findall('pattern'):
            bar=int(pattern.get('pos'))//192
            section=next(x['name'] for x in score['sections'] if x['start_bar']<=bar<x['start_bar']+x['bars'])
            for note in pattern.findall('note'):
                events.append({'track':track.get('name'),'bar':bar,'section':section,
                    'start_beats':(int(pattern.get('pos'))+int(note.get('pos')))/48,
                    'midi':int(note.get('key'))+12,'length_beats':int(note.get('len'))/48,
                    'velocity':int(note.get('vol'))})
    score['events']=events
    score['source']=source.relative_to(ROOT).as_posix()
    score['source_sha256']=hashlib.sha256(source.read_bytes()).hexdigest()
    dump('score.json',score)
    dump('scope-check.json',{'allowed_changes':allowed,'unchanged_patterns_checked':preserved,
        'only_bars_22_23_38_39_changed':True,'main_theme_bars_2_3_10_11_40_41_48_49_preserved':True})
    return project

if __name__=='__main__':
    project=patch_project()
    source=PREVIOUS/'detail-loop-native.wav'
    target=OUT/source.name
    shutil.copyfile(source,target)
    if hashlib.sha256(source.read_bytes()).digest()!=hashlib.sha256(target.read_bytes()).digest():
        raise RuntimeError('Detail stem copy mismatch')
    dump('reused-stem.json',{'path':target.relative_to(ROOT).as_posix(),
        'source':source.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures={g:pool.submit(RENDER.render,g,project) for g in ('bass','kick','beat','theme')}
        for future in futures.values():
            future.result()
    MIX.run()
