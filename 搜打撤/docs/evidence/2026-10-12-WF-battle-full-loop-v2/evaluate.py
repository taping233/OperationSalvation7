"""Verify the two localized transitions and the preserved song/rhythm."""
import hashlib
import json
import pathlib
import subprocess
import numpy as np

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
PREVIOUS=ROOT/'docs/evidence/2026-10-12-WF-battle-full-loop'
NAME='battle-shadowtide-full-loop-v2'

def read_events(folder):
    return json.loads((folder/'score.json').read_text(encoding='utf-8'))['events']

def transition(events,bar):
    lead=sorted([e for e in events if e['track']=='Ensemble theme'],key=lambda e:e['start_beats'])
    before=[e for e in lead if e['bar']==bar-1][-1]
    after=[e for e in lead if e['bar']==bar][0]
    return {'before_midi':before['midi'],'after_midi':after['midi'],
        'leap_semitones':after['midi']-before['midi'],
        'before_seconds':before['start_beats']*60/128,'after_seconds':after['start_beats']*60/128}

def levels(path):
    data=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','22050',
        '-f','f32le','-'],capture_output=True,check=True).stdout
    x=np.frombuffer(data,dtype=np.float32)
    def db(a,b):
        y=x[round(a*22050):round(b*22050)].astype(np.float64)
        return float(20*np.log10(np.sqrt(np.mean(y*y))+1e-12))
    return {str(t):{'before_halfsecond_dbfs':db(t-.5,t),'after_halfsecond_dbfs':db(t,t+.5),
        'increase_db':db(t,t+.5)-db(t-.5,t)} for t in (45,75)}

def run():
    old,new=read_events(PREVIOUS),read_events(OUT)
    old_levels=levels(PREVIOUS/'battle-shadowtide-full-loop.ogg')
    new_levels=levels(OUT/(NAME+'.ogg'))
    key=lambda e:(e['track'],e['start_beats'],e['midi'],e['length_beats'])
    core={'Kick','Snare and ghosts','Hats'}
    old_drums={key(e) for e in old if e['track'] in core}
    new_drums={key(e) for e in new if e['track'] in core}
    scoped={22,23,38,39}
    old_outside=[e for e in old if e['bar'] not in scoped]
    new_outside=[e for e in new if e['bar'] not in scoped]
    report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
    transitions={str(t):{'before':transition(old,bar),'after':transition(new,bar)} for t,bar in [(45,24),(75,40)]}
    checks={'all_events_outside_four_transition_bars_preserved':old_outside==new_outside,
        'all_original_drum_onsets_and_durations_preserved':old_drums<=new_drums,
        'only_two_added_core_drum_events':len(new_drums-old_drums)==2,
        '45s_transition_at_most_two_semitones':abs(transitions['45']['after']['leap_semitones'])<=2,
        '75s_transition_at_most_two_semitones':abs(transitions['75']['after']['leap_semitones'])<=2,
        '75s_energy_jump_reduced':abs(new_levels['75']['increase_db'])<abs(old_levels['75']['increase_db']),
        **report['checks']}
    result={'transitions':transitions,'old_boundary_levels':old_levels,'new_boundary_levels':new_levels,
        'old_core_drum_events':len(old_drums),'new_core_drum_events':len(new_drums),
        'original_events_as_share_of_new_drum_events':len(old_drums)/len(new_drums),
        'checks':checks,'scope':'Score comparison and matched decoded OGG half-second RMS windows. Not actual listening or an aesthetic score.'}
    (OUT/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
    if not all(checks.values()):
        raise RuntimeError('Transition verification failed')

if __name__=='__main__':
    run()
