"""Independent noise sources, layered envelopes and abstract spectral envelopes."""
from pathlib import Path
import json
import numpy as np
from scipy import signal

SR = 48000
DATA = json.loads((Path(__file__).parent / 'spectrum_profiles.json').read_text())
EDGES = np.array(DATA['edges_hz'])
PROFILES = {k: np.array(v) for k, v in DATA['profiles'].items()}
TILTS = {
    'touch': [.2,.3,.4,.6,1,1.3,1.6,1.4,1.3,1.1,.8,.65,.43,.16],
    'air': [.2,.3,.4,.6,.7,.9,1.1,1.1,1,.85,.7,.5,.3,.12],
    'body': [.1,.28,.75,1.15,1.4,1.75,1.7,1.35,.85,.6,.4,.25,.15,.08],
    'space': [.22,.45,.85,1.05,1.2,1.45,1.5,1.1,.7,.55,.4,.28,.15,.08],
    'power': [.1,.3,.7,1,1.2,1.45,1.5,1.4,1,.7,.5,.3,.17,.07],
}


class Synth:
    def __init__(self, row, seed, variant):
        self.row = row; self.rng = np.random.default_rng(seed)
        self.t = np.arange(round(float(row['seconds']) * SR)) / SR
        self.flavor = row['flavor']; self.variant = variant
        self.shift = 1 if variant == 0 else self.rng.uniform(.96,1.045)
        self.jitter = 1 if variant == 0 else self.rng.uniform(.95,1.04)
    def pulse(self, at, attack, release):
        u = np.maximum(self.t-at,0)
        return (self.t>=at)*(1-np.exp(-u/attack))*np.exp(-u/release)
    def bump(self, at, duration):
        return np.sin(np.pi*np.clip((self.t-at)/duration,0,1))**2
    def band(self, low, high):
        sos=signal.butter(2,[max(25,low),min(22000,high)],fs=SR,btype='bandpass',output='sos')
        x=signal.sosfilt(sos,self.rng.normal(size=len(self.t)))
        return x/max(np.std(x),1e-12)
    def texture(self, key, stretch=1, rough=.12):
        power=.70 if key in ('touch','air') else .65
        w=PROFILES[key]**power*np.array(TILTS[key]); w/=w.sum()
        x=np.zeros_like(self.t)
        for i,(lo,hi,p) in enumerate(zip(EDGES[:-1],EDGES[1:],w)):
            x+=self.band(lo*stretch*self.shift,hi*stretch*self.shift)*np.sqrt(p)*(
                1+rough*np.sin(2*np.pi*(8.3+i*2.71)*self.t+i*.71))
        return x
    def ring(self, at, f, decay, amplitude):
        u=np.maximum(self.t-at,0)
        # Fine resonant detail under the texture; no bright melody ornament.
        return np.sin(2*np.pi*f*self.shift*u+.18*np.sin(2*np.pi*f*1.67*u)*np.exp(-u/.02))*self.pulse(at,.002,decay)*amplitude
    def swipe(self):
        down=self.flavor in ('down','flee','threat')
        span=min(.23,len(self.t)/SR*.56)
        a=self.texture('air',.65 if down else .87)*self.bump(.005,span)*.025
        b=self.texture('space',1.25 if down else 1.48)*self.pulse(span*.62,.016,.042)*.024
        return a+b,.06
    def tap(self):
        low=self.flavor in ('place','select'); quiet=self.flavor=='soft'
        x=self.texture('touch',.75 if low else .87)*self.pulse(.005,.0006,.005 if quiet else .008)*.047
        x+=self.band(250,1000)*self.pulse(.01,.0016,.012)*(.004 if quiet else .010)
        if self.flavor in ('place','lift'):
            x+=self.texture('body',1.8)*self.pulse(.025,.002,.014)*.018
        return x,.025
    def feedback(self):
        negative=self.flavor in ('negative','error','foe')
        profile='body' if negative else 'touch'; stretch=1.1 if negative else .76
        x=self.texture(profile,stretch)*self.pulse(.008,.0018,.023)*.054
        at=.11 if negative else .07
        x+=self.texture('body',1.13 if negative else 1.7)*self.pulse(at,.003,.041)*.028
        if self.flavor=='error': x+=self.band(450,1600)*self.pulse(.22,.002,.032)*.018
        return x,.055
    def paper(self):
        shuffle=self.flavor in ('shuffle','search'); count=5 if shuffle else 1
        x=np.zeros_like(self.t)
        for i in range(count):
            at=.008+i*(.095 if self.flavor=='shuffle' else .13)*self.jitter
            x+=self.texture('air',.70+self.rng.uniform(-.055,.055))*self.bump(at,.052+self.rng.uniform(0,.018))*.020
        at=.058 if self.flavor in ('draw','reveal') else .085
        body=self.texture('body',1.6 if self.flavor!='discard' else 1.2)
        x+=body*self.pulse(at,.002,.025)*(.033 if shuffle else .054)
        x+=self.band(550,2100)*self.pulse(at,.0014,.01)*.014
        return x,.055
    def impact(self):
        hurt=self.flavor=='hurt'; heavy=self.flavor in ('heavy','kill')
        x=self.texture('body',1.06 if hurt else 1.35)*self.pulse(.018,.003,.04 if heavy else .029)*.21
        x+=self.band(400 if hurt else 580,2200 if hurt else 3300)*self.pulse(.015,.0009,.006)*.036
        x+=self.texture('body',1.4)*self.pulse(.065 if not heavy else .095,.004,.032)*(.052 if heavy else .031)
        x+=self.ring(.018,124 if hurt else 181,.035,.018)
        if self.flavor=='kill': x+=self.texture('space',1.1)*self.pulse(.135,.01,.05)*.025
        return x,.08
    def guard(self):
        up=self.flavor=='up'; lock=self.flavor in ('lock','unlock')
        at=.065 if up else .012
        x=self.texture('body',1.9)*self.pulse(at,.007 if up else .0012,.04)*.08
        x+=self.band(800,3000)*self.pulse(at,.001,.016)*.012
        x+=self.ring(at,736 if not lock else 482,.044,.007)
        if up: x+=self.texture('space',1.4)*self.bump(.004,.18)*.021
        if self.flavor=='unlock': x+=self.band(450,1800)*self.pulse(.067,.001,.015)*.016
        return x,.07
    def crackle(self):
        x=np.zeros_like(self.t); burning=self.flavor=='burn'
        count=8 if burning else (3 if self.flavor=='lock' else 5)
        for i in range(count):
            at=.008+i*(.030 if burning else .022)*self.jitter+self.rng.uniform(0,.004)
            x+=self.band(550 if burning else 900,3200 if burning else 4900)*self.pulse(at,.0008,.009)*(.012/(1+i*.12))
        x+=self.texture('body',1.1 if self.flavor=='armor' else 1.5)*self.pulse(.018,.002,.049)*.055
        if burning: x+=self.band(350,1900)*self.bump(.02,.34)*.016
        return x,.065
    def energy(self):
        down=self.flavor=='down'; heal=self.flavor=='heal'
        x=self.texture('power',1.04 if down else 1.45)*self.pulse(.015,.025 if heal else .014,.09 if heal else .052)*.085
        x+=self.texture('air',.70)*self.bump(.005,.22 if heal else .115)*.008
        x+=self.ring(.042,238 if down else 317,.07,.004)
        if heal: x+=self.texture('space',1.5)*self.pulse(.14,.03,.08)*.026
        return x,.10
    def curse(self):
        release=self.flavor=='release'
        x=self.texture('power',.86 if release else 1.11,.24)*self.pulse(.006,.004,.105)*.084
        x+=self.band(300,1250)*self.pulse(.028,.02,.08)*.018*np.sin(2*np.pi*18.3*self.t)
        if release: x+=self.band(1100,3800)*self.pulse(.095,.001,.018)*.017
        return x,.11
    def warning(self):
        a=self.texture('body',1.25); b=self.band(700,2100)
        x=np.zeros_like(self.t)
        for at in (.008,.20): x+=(a*.082+b*.006)*self.pulse(at,.005,.045)
        return x,.035
    def transition(self):
        boss=self.flavor=='boss'; warm=self.flavor in ('warm','safe','shop')
        threat=self.flavor in ('threat','battle','deeper')
        stretch=.96 if threat else 1.24
        base=self.texture('space',stretch,.18); inner=self.texture('power',1.37,.09)
        shape=self.bump(.01,.28)*.26+self.pulse(.19,.025,.11)*.48+self.pulse(.37,.045,.14)*.37
        if boss: shape+=self.pulse(.51,.03,.17)*.55
        x=base*shape*.15+inner*self.pulse(.33,.04,.11)*.025
        x+=self.band(350,1500 if warm else 1850)*self.bump(.10,.32)*(.021 if warm else .031)
        if self.flavor in ('gate','beacon','deploy'): x+=self.band(650,2300)*self.pulse(.045,.002,.02)*.012
        if self.flavor=='clue': x+=self.ring(.29,353,.075,.005)
        return x,.12 if warm else .145
    def ritual(self):
        activate=self.flavor=='activate'; recode=self.flavor=='recode'
        x=self.texture('space',.98,.23)*self.bump(.015,.35)*.044
        at=.30 if activate else .18
        x+=self.texture('power',1.15,.24)*self.pulse(at,.03,.18 if activate else .13)*.065
        x+=self.band(450,2100)*self.bump(.08,.33)*.010
        if activate: x+=self.texture('body',1.33)*self.pulse(.48,.02,.15)*.033
        if recode:
            for at in (.035,.105,.21): x+=self.band(900,2700)*self.pulse(at,.001,.008)*.01
        return x,.16
    def reward(self):
        rare=self.flavor in ('legend','rare','level','altar','win')
        x=self.texture('power',1.58)*self.pulse(.015,.012,.08 if rare else .042)*.06
        x+=self.texture('air',.65)*self.bump(.005,.13)*.011
        if rare:
            x+=self.texture('space',1.65)*self.pulse(.13,.035,.13)*.024
            x+=self.ring(.12,307,.13,.004)+self.ring(.16,421,.10,.003)
        return x,.14 if rare else .075
    def finish(self):
        lose=self.flavor=='lose'; clear=self.flavor in ('bosswin','clear')
        x=self.texture('body',1.1 if lose else 1.5)*self.pulse(.015,.009,.11)*.06
        x+=self.texture('space',1.0 if lose else 1.55)*self.pulse(.16,.045,.19)*.035
        if not lose:
            x+=self.ring(.15,236,.17,.007)+self.ring(.21,354,.15,.004)
        if clear: x+=self.texture('power',1.37)*self.pulse(.36,.065,.24)*.020
        return x,.17
    def coin(self):
        x=self.band(1200,4200)*self.pulse(.006,.0007,.012)*.018
        x+=self.ring(.008,1421,.026,.008)+self.ring(.012,2113,.018,.004)
        x+=self.texture('body',2.0)*self.pulse(.012,.002,.02)*.011
        if self.flavor in ('buy','sell'): x+=self.band(900,2500)*self.pulse(.071,.001,.012)*.008
        return x,.03
    def burst(self):
        x=self.texture('space',1.14)*self.bump(.005,.17)*.044
        x+=self.texture('body',1.45)*self.pulse(.12,.002,.065)*.093
        x+=self.texture('power',1.7)*self.pulse(.19,.016,.09)*.025
        return x,.13
    def shutter(self):
        x=self.band(1800,5500)*self.pulse(.006,.0005,.005)*.031
        x+=self.band(950,3200)*self.pulse(.078,.0007,.007)*.022
        x+=self.texture('body',2.0)*self.pulse(.079,.001,.013)*.012
        return x,.024
    def weapon(self):
        f=self.flavor; x=np.zeros_like(self.t)
        if f in ('slash','pierce','arrow'):
            x+=self.texture('air',.66 if f=='arrow' else .82)*self.bump(.004,.07 if f=='slash' else .035)*.016
        at=.035 if f in ('slash','arrow') else .015
        profile='power' if f in ('psychic','poison','fire') else 'body'
        stretch={'blunt':1.05,'boss':.92,'ice':1.75,'lightning':1.7,'pierce':1.9}.get(f,1.35)
        release=.085 if f in ('fire','psychic','boss') else .034
        x+=self.texture(profile,stretch,.18)*self.pulse(at,.004,release)*.09
        if f in ('ice','lightning'):
            for i in range(4): x+=self.band(1500,5800)*self.pulse(at+i*.012,.0005,.006)*.01
        elif f=='fire': x+=self.band(350,2600)*self.bump(at,.21)*.021
        elif f=='poison': x+=self.band(250,1300)*self.pulse(at,.025,.065)*.015*np.sin(2*np.pi*27*self.t)
        else: x+=self.band(580,3300)*self.pulse(at,.0009,.006)*.025
        if f=='psychic': x+=self.ring(at,221,.11,.009)+self.ring(at,257,.10,.004)
        return x,.075 if f in ('slash','blunt','pierce','arrow') else .13
    def loop(self):
        n=len(self.t); f=np.fft.rfftfreq(n,1/SR)
        config={'snow':(140,2400),'wasteland':(110,1500),'ruins':(80,1050),
                'pollution':(65,700),'fire':(400,5000),'altar':(70,800),'beacon':(180,1800)}
        lo,hi=config[self.flavor]
        def periodic():
            spectrum=np.fft.rfft(self.rng.normal(size=n)); shape=np.zeros_like(f)
            valid=(f>lo)&(f<hi); shape[valid]=np.sin(np.pi*(f[valid]-lo)/(hi-lo))**.8
            y=np.fft.irfft(spectrum*shape,n); return y/max(np.std(y),1e-12)
        duration=n/SR; phase=2*np.pi*self.t/duration
        x=periodic()*(.77+.14*np.sin(phase*2)+.09*np.sin(phase*3+.7))
        if self.flavor=='fire': x*=.75+.25*np.sin(phase*19)**6
        if self.flavor in ('altar','pollution'):
            hz=round((113 if self.flavor=='altar' else 86)*duration)/duration
            x+=np.sin(2*np.pi*hz*self.t)*.22
        if self.flavor=='beacon': x+=np.sin(2*np.pi*384*self.t)*(.5+.5*np.sin(phase*4))**12*.28
        side=periodic()*.12
        y=np.column_stack([x+side,x-side]); y*=10**(float(self.row['peak_db'])/20)/np.max(abs(y))
        return y
    def render(self):
        if self.row['recipe']=='loop': return self.loop()
        x,wet=getattr(self,self.row['recipe'])(); y=np.column_stack([x,x])
        for c,times in enumerate([(.019,.043,.071,.109),(.023,.052,.081,.117)]):
            for i,at in enumerate(times):
                d=round(at*SR); tail=signal.sosfilt(signal.butter(2,2900/(1+i*.4),fs=SR,output='sos'),x)
                if d<len(x): y[d:,c]+=tail[:-d]*wet/(i+1)*(-1 if i==1 else 1)
        y=signal.sosfilt(signal.butter(2,48,fs=SR,btype='highpass',output='sos'),y,axis=0)
        y=np.tanh(y*1.1); y*=10**(float(self.row['peak_db'])/20)/max(np.max(abs(y)),1e-12)
        lead=min(48,len(y)//4); tail=min(3840,len(y)//3)
        y[:lead]*=np.linspace(0,1,lead)[:,None]; y[-tail:]*=np.cos(np.linspace(0,np.pi/2,tail))[:,None]**2
        return y
