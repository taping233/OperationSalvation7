"""Complete the accepted timbre family without regenerating its two approved samples."""
from pathlib import Path
import importlib.util
import json
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('texture', OUT / 'rebuild_texture.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
s.RNG = np.random.default_rng(9301944)


def weights(reference, transform, power=.70):
    w = s.profile(reference) ** power * np.array(transform)
    return w / w.sum()


def click():
    t = np.arange(int(.25 * s.SR)) / s.SR
    w = weights('d_avg_button.wav', [.2,.3,.4,.6,1,1.3,1.6,1.4,1.3,1.1,.8,.65,.43,.16])
    x = s.texture(t, w, .87, .04) * s.pulse(t, .005, .0006, .0047) * .057
    # A soft body settles the bright tick; it is not a musical note cue.
    x += s.band(t, 250, 1000) * s.pulse(t, .008, .0016, .010) * .007
    x += s.band(t, 750, 2100) * s.pulse(t, .023, .001, .004) * .006
    return s.master(s.delay_room(x, .04, .035), -10.5)


def card_play():
    t = np.arange(int(.59 * s.SR)) / s.SR
    w = weights('b_ui_getcast.wav', [.2,.3,.4,.6,.7,.9,1.1,1.1,1,.85,.7,.5,.3,.12])
    dust = s.texture(t, w, .78, .13)
    sweep = dust * s.bump(t, .007, .082, .020)
    seam = s.band(t, 550, 2300) * s.pulse(t, .082, .0013, .012) * .021
    body_weights = weights('b_ui_mark.wav', [.12,.30,.7,1.1,1.3,1.4,1.35,1.1,.7,.5,.25,.18,.12,.04], .65)
    body = s.texture(t, body_weights, 1.61, .07)
    body *= s.pulse(t, .084, .0021, .024) * .055
    after = s.band(t, 650, 1700) * s.pulse(t, .119, .003, .028) * .007
    return s.master(s.delay_room(sweep + seam + body + after, .12, .065), -7.8)


def boss():
    t = np.arange(int(1.98 * s.SR)) / s.SR
    w = weights('b_char_atkboost.wav', [.1,.3,.7,1,1.2,1.45,1.5,1.4,1,.7,.5,.3,.17,.07], .68)
    first = s.texture(t, w, 1.11, .16)
    second = s.texture(t, w, 1.28, .11)
    # Same dense texture as accepted event, but a slower, heavier challenge phrase.
    env = s.bump(t, .008, .28, .24)
    env += s.pulse(t, .19, .012, .071) * .40
    env += s.pulse(t, .38, .025, .135) * .65
    x = first * env * .16 + second * s.pulse(t, .435, .045, .17) * .028
    x += s.band(t, 600, 2500) * s.bump(t, .17, .34, .014)
    x += s.band(t, 300, 1050) * s.pulse(t, .46, .065, .19) * .009
    return s.master(s.delay_room(x, .20, .17), -6.3)


def encode(wav, mp3):
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-q:a','2',str(mp3)],
                   check=True,capture_output=True)


def main():
    records = []
    for name, label, generate in [('03-ui-click','点击',click), ('04-card-play','出牌',card_play),
                                  ('05-boss-reveal','首脑登场',boss)]:
        x = generate()
        path = OUT / (name + '.wav')
        sf.write(str(path), x, s.SR, subtype='PCM_24')
        x, rate = sf.read(str(path), always_2d=True)
        true_peak = np.max(np.abs(signal.resample_poly(x,4,1,axis=0)))
        assert rate == s.SR and x.shape[1] == 2 and np.isfinite(x).all()
        assert true_peak < .9 and np.max(abs(x[-720:])) < .001 and abs(np.mean(x)) < .001
        encode(path, OUT/(name+'.mp3'))
        subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(name+'.mp3')),'-f','null','-'],check=True,capture_output=True)
        records.append(dict(file=name+'.wav',label=label,seconds=round(len(x)/s.SR,3),
                            true_peak_dbfs=round(float(20*np.log10(true_peak)),2)))
    sequence = [('03-ui-click','点击',3),('04-card-play','出牌',3),('02-attack-impact','命中',3),
                ('01-event-enter','进入事件',2),('05-boss-reveal','首脑登场',2)]
    pieces, markers, cursor = [np.zeros((24000,2))], [], .5
    for name,label,repeats in sequence:
        x, rate = sf.read(str(OUT/(name+'.wav')),always_2d=True)
        assert rate == s.SR
        markers.append(dict(label=label,start_s=round(cursor,3),repeats=repeats))
        for _ in range(repeats):
            pieces.extend([x,np.zeros((19200,2))])
            cursor += len(x)/s.SR + .4
        pieces.append(np.zeros((36000,2)))
        cursor += .75
    montage = np.concatenate(pieces).astype('<f4')
    mp3 = OUT/'00-complete-five.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(s.SR),'-ac','2','-i','-',
                    '-codec:a','libmp3lame','-q:a','2',str(mp3)],input=montage.tobytes(),check=True,capture_output=True)
    subprocess.run(['ffmpeg','-v','error','-i',str(mp3),'-f','null','-'],check=True,capture_output=True)
    report=dict(new_sounds=records,accepted_sounds_reused=['01-event-enter.wav','02-attack-impact.wav'],
                montage_seconds=round(cursor,3),markers=markers)
    (OUT/'checks-complete.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    main()
