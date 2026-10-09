"""Three independent compositions sharing only selected instruments/space."""
import importlib.util,pathlib,copy,xml.etree.ElementTree as ET
import numpy as np
from zyn_probe import zyn_state

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native_score',HERE.parent/'2026-10-05-WF-music-daw/compose-lmms.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.BARS=48

class Score(engine.Score):
    def __init__(self,name,bpm,role,title):
        super().__init__(name,bpm,role,title);self.groups={}
    def sf(self,label,patch,volume,group,pan=0,bank=0,verb=.12):
        self.instrument(label,patch,volume,pan,bank,verb)
        self.groups[label]=group
    def zyn(self,label,preset,volume,group,pan=0):
        track=engine.elem(self.tc,'track',type=0,name=label,muted=0,solo=0)
        it=engine.elem(track,'instrumenttrack',vol=volume,pan=pan,pitch=0,basenote=57,usemasterpitch=1,pitchrange=1,fxch=0)
        ins=engine.elem(it,'instrument',name='zynaddsubfx')
        z=engine.elem(ins,'zynaddsubfx',portamento=0,filterfreq=64,filterq=64,bandwidth=64,fmgain=127,rescenterfreq=64,resbandwidth=64,forwardmidicc=0,modifiedcontrollers='')
        z.append(zyn_state(preset));self.tracks[label]=track;self.groups[label]=group
        self.stats[label]={'preset':preset,'volume':volume,'pan':pan,'notes':0}
    def common(self):
        self.sf('Celesta detail',8,35,'signature',19,verb=.13)
        self.sf('Muted strings',49,31,'pad',-20,verb=.14)
        self.sf('Triangle detail',48,11,'detail',35,128,.05)
    def surface(self,b,chord,role):
        # Same materials, independent notes/phrasing. No shared melodic theme.
        self.phrase('Muted strings',b,[(.08,n,7.8,49) for n in chord[-3:]],2,'shared bowed-string texture')
        if b%8==0:
            self.phrase('Triangle detail',b,[(.25,81,.10,42),(.75,80,.12,31)],section='small triangle punctuation')
        if role=='title':notes=[(.4,chord[-1]+12,1.0,51),(5.25,chord[-2]+12,1.35,46)]
        elif role=='explore':notes=[(.75,chord[1]+12,.6,57),(2.75,chord[2]+12,.5,49),(6.25,chord[-1],.75,52)]
        else:notes=[(1.25,chord[2]+12,.45,48),(4.75,chord[1]+12,.65,54)]
        self.phrase('Celesta detail',b,notes,2,'independent celesta details')

def title_score():
    s=Score('01-title-frostglass-v3',112,'title','霜窗回声 · 室内乐精修')
    s.sf('Piano theme',0,103,'lead',-7,verb=.16)
    s.sf('Piano undercurrent',0,74,'accompaniment',13,verb=.12)
    s.sf('Low strings',49,42,'pad',-15,verb=.14)
    s.sf('Woodwind answer',71,45,'counter',-25,verb=.13)
    s.sf('Soft bass',43,72,'bass',0,verb=.05)
    s.sf('Brush pulse',48,18,'drums',0,128,.04)
    s.common()
    chords=[[48,55,60,63,74],[44,55,60,63,67],[41,53,56,60,67],[43,53,59,62,69],
            [48,55,60,63,69],[46,53,58,62,65],[41,53,56,60,67],[43,53,59,62,68]]
    themes=[[(.5,79,1.25),(2.25,72,.75),(3.25,75,1.2),(5,74,2),(7.1,72,.55)],
            [(0,67,1),(1.75,70,.55),(3,68,1),(4.75,67,1.4),(6.5,63,1)],
            [(.5,72,1.5),(2.5,75,.65),(3.5,77,.85),(5.25,79,1.15),(6.75,77,.8)],
            [(0,74,1.2),(2,71,.8),(3.5,67,1.4),(5.75,68,.55),(6.75,71,.65)],
            [(0,75,1),(1.5,79,.5),(2.5,81,1.1),(4.25,79,1.25),(6.25,74,1.2)],
            [(.5,77,1),(2,74,.8),(3.5,70,1.25),(5.5,72,.6),(6.5,74,.7)],
            [(0,75,1.5),(2,72,1),(3.75,68,.75),(5,67,1.7)],
            [(.5,74,.75),(1.75,72,.7),(3,71,1.35),(5.5,67,1),(7,71,.5)]]
    for b in range(0,48,2):
        block=b//8;ix=(b//2)%8;ch=chords[ix]
        s.surface(b,ch,'title')
        piano=[(q,n,d,78 if block in [1,4] else 68) for q,n,d in themes[ix]]
        if block==3:piano=[(q,n-12,d*1.18,v-7) for q,n,d,v in piano[::2]]
        if block==5:piano=piano[:-1]
        s.phrase('Piano theme',b,piano,2,'independent title statement')
        pattern=[(0,ch[1],1.8,60),(1.5,ch[2],1.4,55),(3,ch[3],1.65,59),(4.5,ch[2],1.5,53),(6.0,ch[-1]-12,1.75,57)]
        if block==3:pattern=pattern[::2]
        s.phrase('Piano undercurrent',b,pattern,2,'open-voicing undercurrent')
        if block in [1,2,4]:
            s.phrase('Low strings',b,[(.16,ch[0]+12,3.65,50),(4.12,ch[1],3.6,54)],2,'slow moving lower line')
        if block in [2,4]:
            s.phrase('Woodwind answer',b,[(4.6,ch[2]+12,1.1,61),(6.1,ch[1]+12,1.3,56)],2,'answer after piano breath')
        for j in range(2):
            bb=b+j;root=ch[0]-12
            s.phrase('Soft bass',bb,[(0,root,1.7,73),(2.5,root+7,.9,57)],section='soft low pulse')
            if block not in [0,3,5]:
                hits=[(0,36,.35,43),(2.5,45,.30,32)]
                if bb%8==7:hits += [(3.25,38,.12,20),(3.5,38,.12,27),(3.75,38,.12,21)]
                s.phrase('Brush pulse',bb,hits,section='restrained half-time rhythm')
    return s

def explore_score():
    s=Score('02-explore-ashline-v3',128,'explore','灰线行军 · 室内乐精修')
    s.sf('Piano travel theme',0,102,'lead',-9,verb=.12)
    s.sf('Pizzicato rhythm',45,85,'accompaniment',24,verb=.09)
    s.sf('Clarinet response',71,47,'counter',-22,verb=.14)
    s.sf('String horizon',48,52,'pad',10,verb=.13)
    s.sf('Moving bass',43,73,'bass',0,verb=.03)
    s.sf('Chamber drums',48,22,'drums',0,128,.04)
    s.common()
    chords=[[50,57,62,65,76],[46,57,62,65,69],[41,53,57,60,67],[48,55,60,64,69],
            [43,55,58,62,69],[46,53,58,62,69],[45,57,61,64,67],[50,57,62,65,74]]
    themes=[[(0,77,.55),(.875,76,.35),(1.75,74,.85),(3,69,.6),(4.25,72,.5),(5.25,74,1.45),(7.1,77,.45)],
            [(.25,81,.9),(1.75,77,.5),(2.75,74,.8),(4.25,72,1.1),(6,69,1.25)],
            [(0,76,.65),(1.25,77,.65),(2.5,81,1),(4.5,79,.7),(5.75,77,.8),(7,76,.4)],
            [(.5,79,1),(2,76,.65),(3.25,72,1),(5,69,.85),(6.25,67,.7)],
            [(0,79,.75),(1.5,77,.65),(2.75,74,.9),(4.25,70,.6),(5.25,69,1.7)],
            [(0,77,.7),(1.25,74,.65),(2.5,72,1.25),(4.5,69,.8),(6,74,1.2)],
            [(.25,76,.5),(1,73,.6),(2,69,1),(4,67,.75),(5.5,73,.7),(6.75,76,.6)],
            [(0,77,.75),(1.5,76,.45),(2.5,74,1.65),(5,69,1.2),(7,72,.6)]]
    for b in range(0,48,2):
        block=b//8;ix=(b//2)%8;ch=chords[ix];s.surface(b,ch,'explore')
        theme=[(q,n,d,77 if block in [1,4] else 69) for q,n,d in themes[ix]]
        if block==3:theme=[(q,n-12,d*1.2,v-7) for q,n,d,v in theme[::2]]
        s.phrase('Piano travel theme',b,theme,2,'independent exploration tune')
        if block in [2,4]:s.phrase('Clarinet response',b,[(4.5,ch[3]+12,.75,57),(6,ch[2]+12,1.2,62)],2,'woodwind in the gaps')
        if block in [1,2,4]:s.phrase('String horizon',b,[(.1,ch[2]+12,3.6,48),(4.1,ch[3]+12,3.6,52)],2,'slow horizon line')
        for j in range(2):
            bb=b+j;root=ch[0]-12
            bass=[(0,root,.55,82),(.75,root,.4,66),(1.5,root+7,.55,72),(2.75,root,.55,76),(3.5,root+12,.35,53)]
            if block in [0,3,5]:bass=bass[::2]
            s.phrase('Moving bass',bb,bass,section='syncopated bass')
            guitar=[(.5,ch[1]+12,.45,52),(1.75,ch[2]+12,.4,58),(2.5,ch[3]+12,.55,50),(3.5,ch[2]+12,.35,55)]
            if block==3:guitar=guitar[::2]
            s.phrase('Pizzicato rhythm',bb,guitar,section='pizzicato rhythm with rests')
            drum=[(0,36,.30,59),(1.5,45,.23,43),(2.75,47,.22,47),(3.5,38,.12,32)]
            if block in [0,3,5]:drum=[(0,36,.30,44),(2.75,45,.22,33)]
            if block==4 and bb%4==3:drum.extend([(3.25,38,.12,28),(3.75,38,.12,36)])
            s.phrase('Chamber drums',bb,drum,section='acoustic low-drum movement')
    return s

def battle_score():
    s=Score('03-battle-blackpulse-v3',124,'battle','黑脉交锋 · 管弦乐精修')
    s.sf('Strings theme',48,112,'lead',8,verb=.13)
    s.sf('Horn answer',60,52,'counter',-23,verb=.12)
    s.sf('Pizzicato drive',45,43,'accompaniment',-16,verb=.09)
    s.sf('Low strings',49,39,'pad',17,verb=.11)
    s.sf('Dark bass',43,80,'bass',0,verb=.03)
    s.sf('Timpani gestures',47,42,'percussion',-8,verb=.09)
    s.sf('Battle groove',48,21,'drums',0,128,.04)
    s.common()
    chords=[[40,52,55,59,66],[36,52,55,60,64],[38,50,54,57,64],[35,51,54,57,63],
            [33,52,57,60,64],[36,52,55,60,67],[38,50,55,59,64],[35,51,54,57,65]]
    themes=[[(0,76,.75),(1.25,71,.5),(2.25,74,.7),(3.5,76,.45),(4.25,79,1.15),(6,78,.65),(7,76,.65)],
            [(.25,79,.7),(1.5,76,.65),(2.75,72,1.1),(4.25,71,.75),(5.5,67,.65),(6.75,72,.7)],
            [(0,78,.65),(1,76,.5),(2,74,1),(3.5,69,.5),(4.5,74,.7),(5.75,78,.65),(7,76,.55)],
            [(.25,75,.65),(1.5,71,.7),(3,69,.6),(4.25,66,.75),(5.75,63,.55),(6.75,71,.75)],
            [(0,76,1),(1.5,72,.5),(2.5,69,1),(4.25,72,.7),(5.5,76,1.5)],
            [(.25,79,.85),(1.75,76,.55),(3,72,1),(4.5,71,.6),(5.75,72,.6),(7,76,.55)],
            [(0,78,.6),(1,76,.6),(2,74,1.4),(4.25,71,.65),(5.5,69,.6),(6.75,74,.75)],
            [(.25,75,.75),(1.75,71,.75),(3.25,66,1),(5,65,.55),(6,63,.55),(7,71,.55)]]
    for b in range(0,48,2):
        block=b//8;ix=(b//2)%8;ch=chords[ix];s.surface(b,ch,'battle')
        tune=[(q,n,d,80 if block in [1,4] else 70) for q,n,d in themes[ix]]
        if block==3:tune=[(q,n-12,d*1.25,v-9) for q,n,d,v in tune[::2]]
        s.phrase('Strings theme',b,tune,2,'independent battle theme')
        s.phrase('Low strings',b,[(.1,ch[1],7.8,50),(.18,ch[2],7.7,43)],2,'low orchestral foundation')
        if block in [1,2,4]:s.phrase('Horn answer',b,[(4.25,ch[2]+12,1.2,61),(6,ch[3]+12,1.45,64)],2,'brass response after strings')
        for j in range(2):
            bb=b+j;root=ch[0]-12
            indices=[1,3,2,3,1,4,2,3]
            plucks=[(k*.5,ch[ix]+12,.30,61 if k%2==0 else 42) for k,ix in enumerate(indices)]
            if block in [0,3,5]:plucks=plucks[::2]
            s.phrase('Pizzicato drive',bb,plucks,section='articulated string ostinato')
            low=[(q,root+(12 if q==3.5 else 0),.43,77 if q%1==0 else 57) for q in [0,.75,1.5,2,2.75,3.5]]
            if block==3:low=low[::2]
            s.phrase('Dark bass',bb,low,section='battle low pulse')
            drums=[(0,36,.32,74),(1.5,38,.13,48),(2,36,.30,63),(3,45,.26,43),(3.5,38,.13,37)]
            if block in [0,3,5]:drums=[(0,36,.32,57),(2.5,45,.26,42)]
            if bb%8==7 and block in [1,4]:drums += [(3.25,38,.13,38),(3.5,38,.13,47),(3.75,38,.13,54)]
            s.phrase('Battle groove',bb,drums,section='concert drum accents and soft rolls')
            if block in [1,2,4]:s.phrase('Timpani gestures',bb,[(.5,ch[0]+12,.8,54),(2.75,ch[0]+7,.85,62)],section='tuned timpani punctuation')
    return s

def build():
    engine.RNG=np.random.default_rng(5102026)
    return [title_score(),explore_score(),battle_score()]
