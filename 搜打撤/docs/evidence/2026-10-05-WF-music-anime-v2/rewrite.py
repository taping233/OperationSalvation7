"""More active game cues: short motifs, four-bar orchestral changes, melodic replies."""
import pathlib,json,copy,sys,importlib.util
import numpy as np
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];PREV=OUT.parent/'2026-10-05-WF-music-missing-bgm'
sys.path.insert(0,str(PREV))
spec=importlib.util.spec_from_file_location('first_album',PREV/'render.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
old.OUT=OUT;old.TMP=ROOT/'.tmp/music-workstation/anime-v2';old.TMP.mkdir(exist_ok=True)
original_compose=old.compose
sys.stdout.reconfigure(encoding='utf-8')
SETTINGS={
 'base':(100,[0,.5,1.5,2.5,3.5,5]),'shop':(112,[0,1,2.25,3.75,5.25,6,7.25,8.5]),
 'fire':(90,[0,.5,1.5,3,4,5]),'event':(96,[0,1,2.5,4,5,6.5,7.25]),
 'altar':(82,[0,1.5,2.5,4,5.5,6.5]),'extraction':(128,[0,1,2,3.5,4.5,5.5]),
 'boss-governor':(144,[0,.75,1.5,2.5,4,5,6,7]),'boss-brood':(112,[0,.5,1,2,3,4,4.5,5.5]),
 'boss-psionic':(120,[0,.5,1.5,2,3,3.5,4.5,5]),'success':(112,[0,.75,1.5,3,4,5]),
 'defeat':(84,[0,1.5,3,4.5,6,7])}
TONICS={'base':5,'shop':0,'fire':7,'event':9,'altar':6,'extraction':2,'boss-governor':2,'boss-brood':11,'boss-psionic':3,'success':9,'defeat':7}
SCALES={'base':[0,2,4,5,7,9,11],'shop':[0,2,3,5,7,9,10],'fire':[0,2,4,5,7,9,11],'event':[0,2,3,5,7,8,11],
        'altar':[0,2,3,5,7,8,11],'extraction':[0,2,4,5,7,9,10],'boss-governor':[0,2,3,5,7,8,11],
        'boss-brood':[0,2,3,5,7,8,11],'boss-psionic':[0,2,3,5,7,8,11],'success':[0,2,4,5,7,9,11],'defeat':[0,2,3,5,7,8,11]}

def passing(id,a,b):
    pcs={(TONICS[id]+v)%12 for v in SCALES[id]};direction=1 if b>=a else -1
    candidates=[a+direction*d for d in range(1,4) if (a+direction*d)%12 in pcs]
    return candidates[0] if candidates else a

def game_compose(cue):
    c=copy.deepcopy(cue);id=c['id'];c['bpm'],rhythm=SETTINGS[id];c['stem']+='-v2';c['rhythm']=rhythm
    phrases=[]
    for a,b,d,e in c['phrases']:
        if len(rhythm)==6:p=[a,passing(id,a,b),b,d,passing(id,d,e),e]
        elif len(rhythm)==7:p=[a,passing(id,a,b),b,passing(id,b,d),d,passing(id,d,e),e]
        else:p=[a,passing(id,a,b),b,passing(id,b,d),d,passing(id,d,e),e,passing(id,e,a)]
        phrases.append(p)
    c['phrases']=phrases;c['idea']+=' V2：更快短动机、每4小节一次编配变化与主副声部交接。'
    score=original_compose(c);bpb=score['beats_per_bar'];pair=2*bpb;total=score['total_beats'];lead=score['lead'][1];tracks=score['tracks']
    counter=next((name for name,tr in tracks.items() if name!=lead and tr['program'] in [40,42,68,70,71,73,8,11,12] and tr['bank']==0),None)
    if counter:
        tracks[counter]['notes']=[];tracks[counter]['target_active_rms_dbfs']=-29
    def note(name,beat,key,length,v):
        if beat<total:tracks[name]['notes'].append({'beat':round(beat,5),'midi':int(key),'length':round(min(length,total-beat-.025),5),'velocity':int(v)})
    # More decisive four-bar phrases: statements, replies, changed registers, returns.
    source=tracks[lead]['notes'];main=[]
    for bar in range(0,score['bars'],2):
        at=bar*bpb;block=bar//2;events=[copy.deepcopy(n) for n in source if at<=n['beat']<at+pair]
        if counter and block%4 in [1,3]:
            for n in events[-2:]:
                key=n['midi'];pg=tracks[counter]['program']
                if pg==42 and key>72:key-=12
                if pg==70 and key>72:key-=12
                note(counter,n['beat'],key,n['length']+.035,n['velocity']-4)
            events=events[:-2]
        if block%4==2:
            for n in events[-2:]:n['velocity']=min(76,n['velocity']+6)
        main.extend(events)
    tracks[lead]['notes']=main
    # Existing continuous bed stays; complementary rhythm and answers change frequently.
    for name,tr in tracks.items():
        mode=tr['mode'];pg=tr['program']
        if name==counter or name==lead:mode='foreground'
        if mode=='body':levels=[.92,.96,.95,.91,1,.96,.97,.90]
        elif mode=='foreground':levels=[.84,1,.95,.90,1.05,.93,1.02,.86]
        elif mode=='pulse':levels=[.68,.90,.78,.95,.92,.72,1,.78]
        else:levels=[.65,.90,.74,.84,.96,.67,.91,.74]
        points=[(0,levels[0])]
        for index,bar in enumerate(range(4,score['bars'],4)):
            value=levels[(index+1)%len(levels)];prior=levels[index%len(levels)]
            points.extend([(max(0,(bar-1)*bpb),prior),((bar+1)*bpb,value)])
        points.extend([(total-bpb,levels[(score['bars']//4-1)%len(levels)]),(total,levels[0])]);tr['gain_points']=points
        if mode=='pulse' or pg in [6,12,24,45,46]:
            # Answers and fills at every second four-bar phrase rather than unchanged loops.
            for bar in range(2,score['bars'],4):
                at=bar*bpb;ch=c['chords'][(bar//2)%4]
                for j,q in enumerate([pair*.60,pair*.78,pair*.90]):
                    note(name,at+q,ch[1+j%2],.30 if pg!=24 else .45,36+j*3)
    if id in ['boss-governor','extraction']:
        name='Muted guitar drive';tracks[name]={'program':28,'bank':0,'target_active_rms_dbfs':-38,'pan':-26,'mode':'pulse','gain_points':tracks[lead]['gain_points'],'notes':[]}
        for bar in range(score['bars']):
            ch=c['chords'][(bar//2)%4]
            for j,q in enumerate([.5,1.5,2.5]):
                if q<bpb:note(name,bar*bpb+q,ch[2],.25,42 if j==0 else 33)
    if id in ['base','shop','event','success','boss-psionic','boss-brood']:
        name='Light acoustic motion';tracks[name]={'program':48,'bank':128,'target_active_rms_dbfs':-42 if id not in ['boss-brood','boss-psionic'] else -39,'pan':10,'mode':'pulse','gain_points':tracks[lead]['gain_points'],'notes':[]}
        for bar in range(score['bars']):
            keys=[76,77] if id in ['base','shop','event'] else [36,38]
            for j,q in enumerate([0,bpb*.55]):note(name,bar*bpb+q,keys[j],.15,39 if j==0 else 31)
    # Avoid same-key overlaps from short embellishments; sustain belongs to backgrounds.
    for tr in tracks.values():
        tr['notes'].sort(key=lambda n:n['beat']);bykey={}
        for n in tr['notes']:bykey.setdefault(n['midi'],[]).append(n)
        for ns in bykey.values():
            for a,b in zip(ns,ns[1:]):a['length']=min(a['length'],max(.065,b['beat']-a['beat']-.02))
    score['sections']=[{'start_bar':bar,'name':['statement','answer','lift','refrain'][(bar//4)%4]} for bar in range(0,score['bars'],4)]
    score['creative_revision']={'reason':'User found first eleven cues changed too slowly for an anime-style game.','primary_response_voice':counter,
        'changes':['short memorable motifs','foreground replies every 2 bars','orchestration or rhythmic fills every 4 bars','clearer pulse','gentle 1-bar transitions'],'not_a_gain_only_revision':True}
    return score

old.compose=game_compose
def fix_report(r):
    score=json.loads((OUT/(r['id']+'-score.json')).read_text(encoding='utf-8'))
    r.update({'stem':score['stem'],'bpm_quarter':score['bpm'],'idea':score['idea'],
              'creative_revision':score['creative_revision']})
    old.save(r['id']+'-report.json',r)
    return r
def main():
    previous=json.loads((PREV/'render-report.json').read_text(encoding='utf-8'));inputs=[old.fp(ROOT/f['path']) for r in previous['cues'] for f in r['files'] if f['path'].endswith('.wav')]
    cues=[]
    for cue in old.CUES:
        path=OUT/(cue['id']+'-report.json')
        if '--resume' in sys.argv and path.exists():r=json.loads(path.read_text(encoding='utf-8'));assert all(old.fp(ROOT/f['path'])==f for f in r['files']);cues.append(r)
        else:cues.append(fix_report(old.render(cue)))
    assert inputs==[old.fp(ROOT/f['path']) for r in previous['cues'] for f in r['files'] if f['path'].endswith('.wav')]
    old.save('render-report.json',{'source_inputs_unchanged':inputs,'cues':cues,'scope':'11 more active replacements; approved title/explore/battle unchanged'})
    print('anime-style v2 album complete',flush=True)
if __name__=='__main__':main()
