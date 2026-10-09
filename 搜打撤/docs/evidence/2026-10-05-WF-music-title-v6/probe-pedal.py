import pathlib,json
import numpy as np
from fluid_engine import render,version
OUT=pathlib.Path(__file__).resolve().parent
results={}
for pedal in [False,True]:
    events=[(0,0,'cc',64,127 if pedal else 0),(0,1,'on',60,52),(48000,0,'off',60,0),(round(2.5*48000),0,'cc',64,0)]
    pcm=render(events,3.5)
    level=lambda a,b:float(np.sqrt(np.mean(pcm[round(a*48000):round(b*48000)]**2)))
    results['pedal' if pedal else 'plain']={'held':level(.4,.9),'after_key_release':level(1.3,1.8)}
ratio=results['pedal']['after_key_release']/max(results['plain']['after_key_release'],1e-12)
assert ratio>2,'Real sustain pedal did not affect rendered piano tail'
results['pedal_tail_gain_db']=float(20*np.log10(ratio));results['engine_version']=version().decode()
(OUT/'pedal-probe.json').write_text(json.dumps(results,indent=2),encoding='utf-8');print(json.dumps(results))
