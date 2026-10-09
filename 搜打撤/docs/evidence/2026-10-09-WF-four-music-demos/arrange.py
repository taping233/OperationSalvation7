"""Four 30s arrangements retaining the shipped original music and melodic identity.
New counterpoint/instrumentation is original, not notes copied from reference games.
"""
import pathlib,json,hashlib,importlib.util,subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt

OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
SR=48000;N=30*SR
spec=importlib.util.spec_from_file_location('fluid',ROOT/'docs/evidence/2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid=importlib.util.module_from_spec(spec);spec.loader.exec_module(fluid)
PACKAGE=json.loads((OUT.parent/'2026-10-05-WF-music-integration/audio-package.json').read_text(encoding='utf-8'))
CHORDS={
 'title':[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]],
 'explore':[[50,57,62,65,76],[46,57,62,65,69],[41,53,57,60,67],[48,55,60,64,69],[43,55,58,62,69],[46,53,58,62,69],[45,57,61,64,67],[50,57,62,65,74]],
 'battle':[[40,52,55,59,66],[36,52,55,60,64],[38,50,54,57,64],[35,51,54,57,63],[33,52,57,60,64],[36,52,55,60,67],[38,50,55,59,64],[35,51,54,57,65]],
 'shop':[[48,51,55,58],[53,57,60,63],[46,50,53,57],[43,47,50,53]]}
TITLES={'title':'霜窗回声','explore':'灰线行军','battle':'黑脉交锋','shop':'铜灯市集'}

def rms(x):return float(np.sqrt(np.mean(x.astype(np.float64)**2)))
def db(x):return float(20*np.log10(max(x,1e-12)))
def fp(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def room(x,amount=.7):
    y=x.copy()
    for delay,gain in [(.041,.15),(.079,.12),(.137,.10),(.229,.08),(.373,.055),(.587,.035),(.911,.023)]:
        k=round(delay*SR);wet=sosfilt(butter(2,4800,fs=SR,output='sos'),x[:-k,::-1],axis=0)
        y[k:]+=wet*gain*amount
    return y

def render(role):
    item=next(x for x in PACKAGE['tracks'] if x['id']==role)
    path=ROOT/item['source']['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==item['source']['sha256']
    original,sr=sf.read(path,dtype='float32',always_2d=True,frames=N)
    assert sr==SR and len(original)==N
    folder='2026-10-05-WF-music-anime-v2' if role=='shop' else '2026-10-05-WF-music-piano-two-hands'
    score=json.loads((OUT.parent/folder/(role+'-score.json')).read_text(encoding='utf-8'))
    bpm=score['bpm'];beatsec=60/bpm;maxbeat=30/beatsec
    span=10 if role=='shop' else 8
    tracks={};settings={};written=[]
    def track(name,patch,target,pan=0,bank=0):
        tracks[name]=[];settings[name]={'patch':patch,'target_dbfs':target,'pan':pan,'bank':bank}
    def note(name,beat,key,length,velocity):
        if beat>=maxbeat-.1:return
        length=min(length,maxbeat+.6-beat)
        tracks[name]+=[(round(beat*beatsec*SR),2,'on',int(key),int(velocity)),(round((beat+length)*beatsec*SR),1,'off',int(key),0)]
        written.append({'track':name,'beat':round(beat,4),'midi':int(key),'length':round(length,4),'velocity':int(velocity)})
    if role=='title':
        track('Inner viola tide',41,-39,-.32)
        track('Warm electric harmony',4,-37,.27)
        track('Bassoon undertow',70,-41,.18)
        track('Glass answers',8,-44,.42)
        track('Muted guitar breath',27,-42,-.45)
    elif role=='explore':
        track('Nylon path',24,-34,-.38)
        track('Oboe distant answer',68,-36,.28)
        track('Viola crosscurrent',41,-38,.42)
        track('Vibraphone frost',11,-40,-.22)
        track('Acoustic footsteps',0,-43,.12,128)
    elif role=='battle':
        track('Viola crossrhythm',45,-33,-.40)
        track('Horn counterstrike',60,-32,.30)
        track('Guitar low weight',30,-34,-.16)
        track('Timpani moving accents',47,-33,.08)
        track('Combat drums',0,-34,0,128)
    else:
        track('Marimba bargaining',12,-33,-.35)
        track('Jazz guitar chords',26,-35,.36)
        track('Acoustic bass walk',32,-34,0)
        track('Flute merchant response',73,-36,.18)
        track('Soft brushed taps',0,-43,-.1,128)
    for block,b in enumerate(np.arange(0,maxbeat,span)):
        c=CHORDS[role][block%len(CHORDS[role])]
        if role=='title':
            # Calm foreground; small contrary motion under the piano, with rests.
            inner=[c[3]-12,c[2]-12,c[1]-12,c[2]-12]
            for j,key in enumerate(inner):note('Inner viola tide',b+j*2+.15,key,2.3,38+j%2*3)
            for off in [0.35,4.35]:
                for j,key in enumerate([c[1],c[3],c[2]+12]):note('Warm electric harmony',b+off+j*.035,key,3.65,32+j*2)
            if block>=1:
                note('Bassoon undertow',b+.65,c[1]-12,3.0,37)
                note('Bassoon undertow',b+4.5,c[3]-12,3.3,35)
            # Minor-major friction is reserved for the dominant chord, then resolves.
            if block%4==3:
                note('Inner viola tide',b+5.6,58,.65,28)
                note('Inner viola tide',b+6.3,59,1.3,32)
            if block%2:
                note('Glass answers',b+3.25,c[1]+12,2.0,29)
                note('Glass answers',b+6.15,c[3]+12,1.7,26)
            note('Muted guitar breath',b+1.6,c[3],3.0,30)
            note('Muted guitar breath',b+5.75,c[1],2.3,28)
        elif role=='explore':
            pattern=[(.2,c[1]),(1.4,c[3]),(3.1,c[2]),(4.4,c[1]),(5.6,c[3]),(7.2,c[2])]
            if block%3==2:pattern=pattern[::2]
            for j,(off,key) in enumerate(pattern):note('Nylon path',b+off,key,1.9,47 if j%2==0 else 38)
            for off,key,length in [(1.5,c[1],2.8),(5.1,c[3],2.5)]:note('Viola crosscurrent',b+off,key,length,39)
            if block>=1:
                for off,key,d in [(2.7,c[3]+12,1.3),(4.25,c[2]+12,1.7),(6.7,c[1]+12,1.0)]:note('Oboe distant answer',b+off,key,d,40)
            if block%2==0:
                note('Vibraphone frost',b+3.35,c[-1],1.6,37)
                note('Vibraphone frost',b+7.1,c[3]+12,1.5,31)
            for off,key in [(0,76),(2.6,75),(4.25,76),(6.75,75)]:note('Acoustic footsteps',b+off,key,.2,32)
        elif role=='battle':
            # 3+3+2 articulation under the original longer violin line.
            for bar in [0,4]:
                for j,off in enumerate([0,.75,1.5,2,2.75,3.5]):
                    key=[c[1],c[2],c[3],c[2],c[1],c[3]][j]
                    note('Viola crossrhythm',b+bar+off,key,.35,55 if j in [0,3] else 39)
                for off in [0,2.5]:
                    for key in [c[0],c[0]+7]:note('Guitar low weight',b+bar+off,key,.72,55)
                for off,key,v in [(0,36,62),(1.75,36,40),(2,38,53),(3.5,42,30)]:note('Combat drums',b+bar+off,key,.24,v)
                for off in [0,1.5,3.25]:note('Timpani moving accents',b+bar+off,c[0],.7,48 if off==0 else 31)
            if block>=1:
                for off,key,d,v in [(1.25,c[3],1.1,56),(3,c[2],.65,47),(5,c[1]+12,1.1,54),(6.5,c[3],1.3,50)]:note('Horn counterstrike',b+off,key,d,v)
            if block in [2,4,6]:
                for j,off in enumerate([6.75,7,7.25,7.5,7.75]):note('Combat drums',b+off,45 if j%2==0 else 38,.16,30+j*4)
        else:
            # Keep the original 5/4 (3+2); different density across two-bar phrases.
            for bar in [0,5]:
                for j,off in enumerate([.5,1.75,3.25,4.5]):
                    key=[c[1],c[3],c[2],c[1]+12][j]
                    note('Marimba bargaining',b+bar+off,key,.62,46 if j%2==0 else 35)
                for off in [1.25,3.5]:
                    for j,key in enumerate([c[1],c[2],c[3]]):note('Jazz guitar chords',b+bar+off+j*.025,key,1.25,39)
                root=c[0]-12
                for off,key,v in [(0,root,57),(2,root+7,42),(3.25,root+12,45),(4.25,root+7,37)]:note('Acoustic bass walk',b+bar+off,key,.9,v)
                for off,key in [(0,37),(2.75,75),(3.75,37)]:note('Soft brushed taps',b+bar+off,key,.18,27)
            if block%2==1:
                for off,key,d in [(2.5,c[3]+12,.8),(3.6,c[2]+12,1.3),(7.2,c[1]+12,1.4),(8.8,c[2]+12,.95)]:note('Flute merchant response',b+off,key,d,42)
    added=np.zeros_like(original,dtype=np.float64);stats=[]
    for name,ev in tracks.items():
        opts=settings[name];pcm=fluid.render(ev,32,bank=opts['bank'],patch=opts['patch'])[:N]
        pcm=room(pcm,.3 if opts['bank']==128 else .65)
        pcm*=np.array([np.sqrt(1-opts['pan']),np.sqrt(1+opts['pan'])])[None,:]
        active=np.max(np.abs(pcm),axis=1)>.0001
        gain=10**(opts['target_dbfs']/20)/(rms(pcm[active]) if active.any() else 1)
        pcm*=gain
        # The texture develops over the excerpt; no hard drops or gain pulsing.
        timeline=np.arange(N)/SR
        rise=np.interp(timeline,[0,8,16,24,30],[.65,.85,1,1.1,.95])
        pcm*=rise[:,None];added+=pcm
        stats.append(dict(name=name,notes=sum(x['track']==name for x in written),**opts,rms_dbfs=db(rms(pcm))))
    before_ratio=rms(added)/rms(original)
    # Added details must be audible, while the existing tune remains the anchor.
    intended={'title':.42,'explore':.50,'battle':.68,'shop':.60}[role]
    added*=intended/max(before_ratio,1e-9)
    revised=original+added
    target=min(rms(original),10**({'title':-21,'explore':-20,'battle':-18,'shop':-20}[role]/20))
    pair=[]
    for mode,pcm in [('original',original.copy()),('revised',revised)]:
        pcm*=target/max(rms(pcm),1e-9)
        safety=min(1,.84/max(np.max(np.abs(pcm)),1e-9));pcm*=safety
        pcm[:round(SR*.08)]*=np.linspace(0,1,round(SR*.08))[:,None]
        pcm[-round(SR*.9):]*=np.cos(np.linspace(0,np.pi/2,round(SR*.9)))[:,None]
        assert np.isfinite(pcm).all() and len(pcm)==N
        wav=OUT/(role+'-'+mode+'-30s.wav');sf.write(wav,pcm,SR,subtype='PCM_24')
        mp3=wav.with_suffix('.mp3')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title='+TITLES[role]+(' · 原版对照' if mode=='original' else ' · 编曲30秒demo'),str(mp3)],check=True)
        pair.append({'mode':mode,'seconds':len(pcm)/SR,'peak_dbfs':db(np.max(np.abs(pcm))),'rms_dbfs':db(rms(pcm)),'one_second_rms_dbfs':[db(rms(pcm[i*SR:(i+1)*SR])) for i in range(30)],'files':[fp(wav),fp(mp3)]})
    (OUT/(role+'-score.json')).write_text(json.dumps({'role':role,'bpm':bpm,'retained_source':item['source'],'basis':'same original 0-30s foreground; additive original supporting arrangement','new_tracks':settings,'new_events':written,'harmony_blocks':CHORDS[role],'harmony_block_beats':span},ensure_ascii=False,indent=2),encoding='utf-8')
    return {'role':role,'title':TITLES[role],'bpm':bpm,'source':fp(path),'source_verified':True,'added_layer_rms_ratio':intended,'new_track_stats':stats,'versions':pair,'comparison_rms_difference_db':pair[1]['rms_dbfs']-pair[0]['rms_dbfs']}

if __name__=='__main__':
    results=[]
    for role in ['title','explore','battle','shop']:
        r=render(role);results.append(r)
        print(json.dumps({'role':role,'seconds':30,'new_parts':len(r['new_track_stats']),'added_ratio':r['added_layer_rms_ratio'],'loudness_delta_db':r['comparison_rms_difference_db']},ensure_ascii=True),flush=True)
    (OUT/'render-report.json').write_text(json.dumps({'status':'passed','sample_rate':SR,'tracks':results,'limits':['Counterparts match RMS, not perceptual loudness.','30-second sketches use short ending fades, not game-ready seamless loops.','Reference transcriptions used for arranging ideas, not copied notes or original audio.']},ensure_ascii=False,indent=2),encoding='utf-8')
