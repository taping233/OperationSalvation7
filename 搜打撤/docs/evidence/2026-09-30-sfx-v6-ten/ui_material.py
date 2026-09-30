import numpy as np
from dsp import timeline, env, arc, noise, modes, fm, material, pan, reverb, master


def click():
    t=timeline(.23); rng=np.random.default_rng(601)
    # Soft contact followed by a tiny internal relay; no transition-style low drone.
    contact=noise(t,rng,2100,7300)*env(t,.005,.00025,.0018)*.020
    shell=modes(t,.005,[487,1171,2137],[.010,.006,.003],[.024,.010,.003])
    return_contact=noise(t,rng,1200,3300)*env(t,.018,.0005,.003)*.004
    x=pan(contact+shell+return_contact)
    return master(x,-10)


def confirm():
    t=timeline(.48); rng=np.random.default_rng(602)
    # A compact acknowledgement with two distinct states and a settled tonal end.
    lead=fm(t,.006,376,1.414,.75,decay=.025)*.020
    second=fm(t,.077,564,1.503,.35,attack=.002,decay=.056)*.023
    lock=modes(t,.078,[243,911],[.025,.014],[.009,.002])
    pin=noise(t,rng,1900,4300)*env(t,.077,.0007,.004)*.003
    x=pan(lead,-.08)+pan(second+lock+pin,.06)
    return master(reverb(x,rng,.045,.17),-10.2)


def card_play():
    t=timeline(.66); rng=np.random.default_rng(603)
    # Licensed paper is a material layer, not a complete copied cue.
    fan=material('card-fan-1.ogg',t,.004,1.19,.125,.060)
    landing=material('card-place-2.ogg',t,.127,.93,.11,.013)
    flex=noise(t,rng,1100,5400)*arc(t,.048,.085,2)*.002
    desk=modes(t,.131,[176,421,957],[.026,.012,.006],[.006,.002,.0007])
    seal=fm(t,.167,713,1.72,.22,decay=.018)*.004
    x=pan(fan,-.12)+pan(landing+desk)+pan(flex+seal,.10)
    return master(reverb(x,rng,.025,.12),-8.2)


def chest_open():
    t=timeline(1.40); rng=np.random.default_rng(609)
    # Three causal phases: locking mechanism, lid movement, acquired reward.
    latch=modes(t,.015,[512,1286,2467],[.020,.014,.006],[.016,.006,.002])
    latch+=noise(t,rng,950,4400)*env(t,.015,.0007,.005)*.006
    spring=fm(t,.082,329,2.37,1.5,attack=.007,decay=.060)*.006
    hinge=noise(t,rng,250,1450)*arc(t,.11,.27,1.7)*.003
    hinge+=fm(t,.19,189,1.19,.7,attack=.03,decay=.075)*.005
    lid=modes(t,.335,[137,298,653,1509],[.055,.040,.021,.009],[.015,.006,.002,.001])
    discovery=fm(t,.48,363,1.50,.24,attack=.014,decay=.105)*.005
    discovery+=fm(t,.54,545,1.25,.15,attack=.012,decay=.08)*.003
    x=pan(latch+spring+lid)+pan(hinge,-.10)+pan(discovery,.14)
    return master(reverb(x,rng,.075,.37),-8)
