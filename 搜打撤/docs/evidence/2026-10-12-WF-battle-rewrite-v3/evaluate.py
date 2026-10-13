"""Verify scope preservation and descriptive melody/rhythm metrics, not taste."""
import hashlib
import json
import pathlib
import numpy as np

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]

def metrics(path):
    events=json.loads(path.read_text(encoding='utf-8'))['events']
    melody=sorted([e for e in events if e['track']=='Ensemble theme'],key=lambda e:e['start_beats'])
    drum=[e for e in events if e['track'] in ('Kick','Snare and ghosts','Hats')]
    grid=np.zeros((16,16),bool)
    for event in drum:
        tick=round(event['start_beats']*4)
        if tick<256:
            grid[tick//16,tick%16]=True
    intervals=np.abs(np.diff([e['midi'] for e in melody]))
    lengths=np.array([e['length_beats']*60/128 for e in melody])
    def phrase(bar):
        return [(round((e['start_beats']-bar*4)*4),e['midi'],round(e['length_beats']*4))
            for e in melody if bar*4<=e['start_beats']<(bar+2)*4]
    first,returned=phrase(2),phrase(10)
    matched=sum(a==b for a,b in zip(first,returned))
    return {'drum_notes':len(drum),'drum_groove_consistency_16_steps':float(1-np.logical_xor(grid[:-1],grid[1:]).mean()),
        'melody_notes':len(melody),'melody_range_semitones':max(e['midi'] for e in melody)-min(e['midi'] for e in melody),
        'interval_at_most_two_semitones_ratio':float((intervals<=2).mean()),'mean_interval_semitones':float(intervals.mean()),
        'median_note_seconds':float(np.median(lengths)),'notes_below_250ms':int((lengths<.25).sum()),
        'theme_return_same_pitch_rhythm_duration_ratio':matched/max(len(first),len(returned)),
        'theme_return_first':first,'theme_return_second':returned}

def run():
    previous=ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v2/score.json'
    baseline,current=metrics(previous),metrics(OUT/'score.json')
    report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
    backing=json.loads((OUT/'backing-preservation.json').read_text(encoding='utf-8'))
    checks={'all_13_backing_tracks_unchanged':all(backing['unchanged_tracks'].values()),
        'drum_notes_unchanged':baseline['drum_notes']==current['drum_notes'],
        'drum_consistency_unchanged':baseline['drum_groove_consistency_16_steps']==current['drum_groove_consistency_16_steps'],
        'exact_theme_return_at_16th_grid':current['theme_return_same_pitch_rhythm_duration_ratio']==1,
        'all_output_fingerprints_match':all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in report['files']),
        **report['checks']}
    result={'v2':baseline,'v3':current,'checks':checks,
        'method':'Groove: 1 - mean adjacent-bar onset-vector Hamming fraction, 16 cells/bar, core drum tracks. Theme-return match is a project-specific descriptive test, not a validated memorability score.',
        'source':'https://muspy.readthedocs.io/en/latest/doc/metrics.html',
        'listening':'No human listening; no claim of perceptual melody superiority.'}
    (OUT/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
    if not all(checks.values()):
        raise RuntimeError('Verification failed')

if __name__=='__main__':
    run()
