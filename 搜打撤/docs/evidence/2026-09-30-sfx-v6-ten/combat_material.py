import numpy as np
from dsp import timeline, env, arc, noise, modes, fm, chirp, pan, reverb, master


def slash():
    t=timeline(.77); rng=np.random.default_rng(604)
    # Moving blade, brief edge scrape, then material contact: three different sources.
    air=noise(t,rng,600,4700)*arc(t,.008,.117,2)*.008
    scrape=noise(t,rng,2400,8700)*env(t,.108,.001,.011)*.006
    body=chirp(t,.110,174,102,.052,decay=.044)*.018
    contact=modes(t,.111,[261,538,1103,2071],[.034,.020,.011,.007],[.007,.005,.002,.0008])
    x=pan(air,np.clip((t-.05)*2.4,-.20,.18))+pan(scrape+body+contact)
    return master(reverb(x,rng,.04,.21),-6.2)


def parry():
    t=timeline(.86); rng=np.random.default_rng(605)
    # Inharmonic modes convey metal; upper modes die before the lower ringing body.
    steel=modes(t,.009,[397,731,1249,1957,2873,4271],
                [.14,.102,.075,.049,.030,.016],[.017,.013,.008,.004,.002,.001])
    impact=noise(t,rng,1300,6100)*env(t,.009,.00035,.0035)*.008
    second=modes(t,.018,[582,1497,3191],[.044,.022,.010],[.003,.0015,.0005])
    x=pan(steel+impact)+pan(second,.18)
    return master(reverb(x,rng,.065,.26),-8.5)


def shield_break():
    t=timeline(.98); rng=np.random.default_rng(606)
    crack=noise(t,rng,2400,10500)*env(t,.011,.00035,.005)*.010
    rupture=chirp(t,.011,610,137,.075,decay=.046)*.007
    x=pan(crack+rupture)
    # Fragments separate over time and spread laterally; a collapse, not a metallic block.
    for i in range(17):
        at=.030+(i/17)**1.55*.26+rng.uniform(0,.006)
        base=rng.uniform(1550,3800)
        fragment=modes(t,at,[base,base*1.487,base*2.07],
                       [.025,.016,.007],[.0038,.0012,.0004])*(1-i/24)
        fragment+=noise(t,rng,2600,9200)*env(t,at,.0005,.0025)*.001
        x+=pan(fragment,rng.uniform(-.37,.37))
    return master(reverb(x,rng,.085,.29),-8.5)


def heal():
    t=timeline(1.22); rng=np.random.default_rng(607)
    u=np.maximum(t-.035,0)
    # A smooth source/filter shimmer; no impact core and no bright reward arpeggio.
    phase=2*np.pi*(271*u+5.4*u*u)
    voiced=np.zeros_like(t)
    for harmonic in range(1,13):
        f=271*harmonic
        formant=.6*np.exp(-((f-850)/470)**2)+.22*np.exp(-((f-1800)/660)**2)
        voiced+=np.sin(harmonic*phase+.08*np.sin(2*np.pi*4.1*t))/harmonic**1.2*formant
    voiced*=arc(t,.035,.47,1.65)*.012
    breath=noise(t,rng,3100,8800)*arc(t,.018,.34,2.1)*.0022
    settle=fm(t,.30,406,1.500,.12,attack=.018,decay=.12)*.0035
    side=fm(t,.10,548,1.002,.06,attack=.055,decay=.145)*.0018
    x=pan(voiced+breath+settle)+pan(side,.26)
    return master(reverb(x,rng,.14,.58,.024),-10)
