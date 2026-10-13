"""A connected 60-second chamber-shop score, independent of the sample player."""
import json
from pathlib import Path

BPM = 112
BARS = 28
CHORDS = [
    ('Cm6/9', 48, (60, 63, 69)), ('Cm6/9', 48, (60, 63, 69)),
    ('Abmaj9', 44, (60, 63, 67)), ('G7sus', 43, (60, 62, 65)),
    ('Cm6/9', 48, (60, 63, 69)), ('Abmaj9', 44, (60, 63, 67)),
    ('Fm9', 41, (60, 63, 68)), ('G7sus', 43, (60, 62, 65)),
    ('Ebmaj9', 51, (62, 65, 67)), ('Bb6/9', 46, (60, 65, 67)),
    ('Cm6/9', 48, (60, 63, 69)), ('G7sus', 43, (60, 62, 65)),
    ('Abmaj9', 44, (60, 63, 67)), ('Fm9', 41, (60, 63, 68)),
    ('Bb6/9', 46, (60, 65, 67)), ('G7sus', 43, (60, 62, 65)),
    ('Cm6/9', 48, (60, 63, 69)), ('Abmaj9', 44, (60, 63, 67)),
    ('Fm9', 41, (60, 63, 68)), ('G7sus', 43, (60, 62, 65)),
    ('Ebmaj9', 51, (62, 65, 67)), ('Bb6/9', 46, (60, 65, 67)),
    ('Abmaj9', 44, (60, 63, 67)), ('G7sus', 43, (60, 62, 65)),
    ('Cm6/9', 48, (60, 63, 69)), ('Abmaj9', 44, (60, 63, 67)),
    ('Fm9', 41, (60, 63, 68)), ('G7sus', 43, (60, 62, 65)),
]

# A bar ends with a pickup into the next bar; every phrase retains the same
# three-note identity while the answer and cadence move with the harmony.
MELODY = [
    [(-.18, 67, .62), (.65, 70, .95), (1.84, 72, 1.15), (3.13, 70, .73)],
    [(.12, 67, 1.12), (1.42, 63, .82), (2.45, 67, .83), (3.36, 68, .66)],
    [(.08, 70, .79), (1.03, 72, .82), (2.04, 75, 1.02), (3.34, 72, .67)],
    [(.1, 70, 1.08), (1.45, 67, .71), (2.35, 65, .78), (3.34, 67, .72)],
    [(.12, 67, .82), (1.13, 70, .85), (2.12, 72, .98), (3.38, 75, .74)],
    [(.1, 75, 1.01), (1.33, 72, .74), (2.24, 70, .89), (3.35, 67, .68)],
    [(.1, 68, .85), (1.17, 72, .91), (2.28, 70, .83), (3.35, 68, .7)],
    [(.1, 67, 1.07), (1.45, 65, .72), (2.35, 62, .78), (3.35, 67, .71)],
    [(.1, 70, .86), (1.18, 72, .89), (2.28, 75, 1.1), (3.4, 74, .66)],
    [(.12, 72, .82), (1.14, 70, .88), (2.22, 67, .92), (3.37, 70, .68)],
    [(.08, 72, .85), (1.08, 75, .97), (2.28, 72, .96), (3.42, 70, .62)],
    [(.08, 67, 1.12), (1.47, 65, .78), (2.47, 62, .76), (3.4, 67, .69)],
    [(.1, 68, .85), (1.12, 70, .82), (2.12, 72, .98), (3.4, 75, .66)],
    [(.12, 72, .82), (1.12, 68, .89), (2.21, 65, .97), (3.42, 68, .66)],
    [(.12, 70, .87), (1.2, 72, .83), (2.22, 75, .98), (3.39, 72, .72)],
    [(.1, 70, 1.06), (1.44, 67, .81), (2.42, 65, .83), (3.42, 67, .67)],
    [(.12, 67, .83), (1.14, 70, .81), (2.15, 72, 1.01), (3.38, 75, .68)],
    [(.09, 75, .93), (1.21, 72, .81), (2.22, 70, .92), (3.41, 67, .66)],
    [(.12, 68, .82), (1.16, 72, .82), (2.17, 75, .99), (3.39, 72, .67)],
    [(.1, 70, 1.11), (1.46, 67, .8), (2.45, 65, .83), (3.41, 67, .69)],
    [(.1, 70, .85), (1.13, 72, .84), (2.17, 75, 1.02), (3.4, 79, .68)],
    [(.12, 77, .85), (1.16, 75, .78), (2.14, 72, .95), (3.4, 70, .69)],
    [(.11, 72, .84), (1.13, 75, .9), (2.24, 72, .92), (3.4, 70, .67)],
    [(.1, 67, 1.05), (1.43, 65, .75), (2.34, 62, .85), (3.37, 67, .69)],
    [(.12, 67, .84), (1.14, 70, .85), (2.17, 72, 1.07), (3.4, 75, .69)],
    [(.12, 75, .9), (1.21, 72, .78), (2.18, 70, .94), (3.39, 68, .69)],
    [(.12, 68, .86), (1.17, 72, .81), (2.19, 70, .98), (3.43, 65, .66)],
    [(.11, 67, 1.07), (1.43, 65, .8), (2.42, 62, .81), (3.4, 67, .63)],
]


def build():
    events = []
    def add(part, beat, key, length, velocity):
        if beat < 0:
            beat += BARS * 4
        events.append(dict(part=part, beat=round(beat, 4), key=int(key),
                           length=round(length, 3), velocity=int(velocity)))
    for bar, (name, root, chord) in enumerate(CHORDS):
        start = bar * 4
        next_root = CHORDS[(bar + 1) % BARS][1]
        wind_lead = 4 <= bar < 8 or 16 <= bar < 20
        for index, (off, pitch, length) in enumerate(MELODY[bar]):
            lead = 'oboe' if wind_lead else 'piano-right'
            add(lead, start + off, pitch, length, 64 - index * 2 + (bar % 3) * 2)
        # Repeated arpeggios overlap the melody's rests but leave its attacks clear.
        arp = (chord[0], chord[1], chord[2], chord[1])
        for index, off in enumerate((.38, 1.32, 2.33, 3.34)):
            add('piano-left', start + off, arp[(index + bar) % 4] - 12,
                .88 if index != 3 else .72, 35 + ((bar + index) % 4) * 2)
        add('piano-left', start + .02, root, 1.66, 43)
        add('bass', start + .04, root - 12, 1.7, 47)
        add('bass', start + 2.03, root - 5, 1.45, 39)
        if bar % 2 == 1:
            add('bass', start + 3.44, next_root - 13, .51, 32)
        # A quiet string answer gives the transition its own changing detail.
        if bar % 4 in (1, 2):
            add('strings', start + 1.71, chord[bar % 3], 1.68, 37)
            add('strings', start + 3.46, chord[(bar + 1) % 3] + 2, .65, 31)
        else:
            add('strings', start + .8, chord[(bar + 2) % 3], 2.0, 34)
        if not wind_lead:
            add('oboe', start + 3.36, MELODY[bar][-1][1] - 12, .66, 35)
        if bar % 4 == 3:
            add('bell', start + 3.65, 79 if bar < 16 else 82, .4, 24)
    return dict(title='灯下交易 V4', bpm=BPM, bars=BARS, meter='4/4',
                chords=[x[0] for x in CHORDS], events=sorted(events, key=lambda e: e['beat']))


if __name__ == '__main__':
    path = Path(__file__).absolute().with_name('score.json')
    score = build()
    path.write_text(json.dumps(score, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(path, len(score['events']))
