"""Reproduce the single-pitch attack probe. This does not measure universal latency."""
import pathlib,importlib.util,json
import numpy as np
OUT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fluid',OUT.parent/'2026-10-05-WF-music-title-v6/fluid_engine.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
rows=[]
for program in [0,40,48,49,68,71]:
    x=engine.render([(12000,2,'on',69,60),(96000,1,'off',69,0)],2.4,patch=program)
    env=np.array([np.sqrt(np.mean(x[i:i+480]**2)) for i in range(12000,96000,480)])
    sustain=float(np.median(env[50:120]));indices=np.flatnonzero(env>=sustain*.5)
    rows.append({'program':program,'note':69,'velocity':60,
        'first_10ms_block_above_half_median_sustain_ms':int(indices[0]*10) if len(indices) else None,
        'peak_to_sustain_ratio':float(env.max()/sustain)})
data={'method':'single note A4 velocity60; 10ms RMS above 50% median from 0.5-1.2s after note-on; only one pitch/velocity, not universal latency','records':rows}
(OUT/'attack-probes.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps(rows))
