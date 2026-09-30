import numpy as np
from dsp import SR, timeline, env, arc, noise, modes, fm, chirp, pan, reverb, master


def event_enter():
    t=timeline(1.72); rng=np.random.default_rng(608)
    # Small incoming data interrupts, followed by a spatial opening, then one landing point.
    data=np.zeros_like(t)
    for at,frequency in [(.012,1221),(.053,864),(.094,1451)]:
        data+=fm(t,at,frequency,1.371,.45,decay=.008)*.0028
    inhale=noise(t,rng,340,2250)*arc(t,.070,.255,2.6)*.005
    opening=fm(t,.273,193,1.414,1.9,attack=.036,decay=.112)*.010
    opening+=fm(t,.286,316,1.73,.7,attack=.044,decay=.081)*.003
    hollow=noise(t,rng,280,720)*env(t,.280,.045,.105)*.002
    landing=modes(t,.343,[347,913,1691],[.045,.028,.014],[.004,.001,.0004])
    far=fm(t,.365,461,1.193,.5,attack=.070,decay=.15)*.002
    x=pan(data)+pan(inhale,-.17)+pan(opening+hollow+landing)+pan(far,.25)
    return master(reverb(x,rng,.13,.65,.015),-8.7)


def boss_reveal():
    t=timeline(2.55); rng=np.random.default_rng(610)
    # Two restrained warning knocks, an unstable formant rise and one dark arrival.
    knocks=np.zeros_like(t)
    for at,amplitude in [(.021,.010),(.238,.015)]:
        knocks+=modes(t,at,[126,273,671],[.054,.024,.011],[amplitude,amplitude*.25,amplitude*.06])
        knocks+=noise(t,rng,500,1550)*env(t,at,.001,.004)*.0015
    u=np.maximum(t-.12,0); source=np.zeros_like(t)
    phase=2*np.pi*(88*u+12*u*u)
    for h in range(1,15):
        formant=np.exp(-((h*104-530)/260)**2)+.34*np.exp(-((h*104-1180)/360)**2)
        source+=np.sin(h*phase+.25*np.sin(2*np.pi*17.3*t))/h**1.35*formant
    source*=arc(t,.12,.54,2.1)*.019
    pressure=noise(t,rng,140,1400)*arc(t,.22,.55,2)*.002
    at=.650
    arrival=chirp(t,at,162,93,.13,attack=.005,decay=.095)*.017
    plate=modes(t,at,[218,401,811,1327],[.15,.091,.047,.022],[.005,.003,.001,.0004])
    abyss=fm(t,.71,147,1.118,.85,attack=.055,decay=.18)*.003
    edge=noise(t,rng,950,4200)*env(t,at,.0015,.010)*.0025
    x=pan(knocks+source+arrival+plate+edge)+pan(pressure,-.17)+pan(abyss,.18)
    return master(reverb(x,rng,.17,.89,.029),-6.8)
