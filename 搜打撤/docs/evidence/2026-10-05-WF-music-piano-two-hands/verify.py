"""Check actual hand notes, samples and Standard MIDI files, plus audio delivery."""
import pathlib,json,hashlib,subprocess,struct,sys
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];PREV=OUT.parent/'2026-10-05-WF-music-continuity-review'
sys.stdout.reconfigure(encoding='utf-8')
def midi_read(path):
    b=path.read_bytes();assert b[:4]==b'MThd';headerlen,fmt,ntracks,ppq=struct.unpack_from('>IHHH',b,4);assert headerlen==6 and fmt==1 and ntracks==3 and ppq==480
    pos=14;tracks=[]
    def vlq(buf,k):
        n=0
        for _ in range(4):
            q=buf[k];k+=1;n=(n<<7)|(q&127)
            if q<128:return n,k
        raise ValueError('invalid MIDI VLQ')
    for _ in range(ntracks):
        assert b[pos:pos+4]==b'MTrk';length=struct.unpack_from('>I',b,pos+4)[0];pos+=8;buf=b[pos:pos+length];pos+=length
        i=0;tick=0;notes=0;cc64=0;end=False;tempo=None
        while i<len(buf):
            delta,i=vlq(buf,i);tick+=delta;status=buf[i];i+=1
            if status==255:
                typ=buf[i];i+=1;n,i=vlq(buf,i);payload=buf[i:i+n];i+=n
                if typ==47:end=True;assert i==len(buf)
                if typ==81:tempo=int.from_bytes(payload,'big')
            elif status>>4 in [8,9,10,11,14]:
                a,c=buf[i:i+2];i+=2;assert a<128 and c<128
                if status>>4==9 and c>0:notes+=1
                if status>>4==11 and a==64:cc64+=1
            elif status>>4 in [12,13]:assert buf[i]<128;i+=1
            else:raise ValueError('unsupported or invalid generated MIDI status')
        assert end;tracks.append({'ticks':tick,'notes':notes,'cc64_events':cc64,'tempo_us':tempo})
    assert pos==len(b);return tracks

report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'));checks={};details=[]
checks['previous_audio_hashes_unchanged']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in report['source_audio_unchanged'])
for r in report['cues']:
    role=r['role'];score=json.loads((OUT/(role+'-score.json')).read_text(encoding='utf-8'));oldscore=json.loads((PREV/(role+'-score.json')).read_text(encoding='utf-8'))
    rh=score['tracks']['Piano right hand'];lh=score['tracks']['Piano left hand'];rows={t['name']:t for t in r['tracks']}
    checks[role+'_right_hand_notes_preserved']=rh['notes']==oldscore['tracks'][score['source_right_hand_track']]['notes']
    checks[role+'_left_has_bass_and_chords']=any(n['midi']<=50 for n in lh['notes']) and any(sum(m['beat']==n['beat'] for m in lh['notes'])>=2 for n in lh['notes'])
    groups={}
    for n in lh['notes']:groups.setdefault(n['beat'],[]).append(n['midi'])
    checks[role+'_left_simultaneous_span_max_octave']=all(max(v)-min(v)<=12 for v in groups.values())
    checks[role+'_left_has_four_gestures_per_2bars']=all(sum(a<=t<a+8 for t in groups)<=4 for a in range(0,score['bars']*4,8))
    right=sf.read(ROOT/rows['Piano right hand']['frozen_stem']['path'],dtype='float32',always_2d=True)[0]
    left=sf.read(ROOT/rows['Piano left hand']['frozen_stem']['path'],dtype='float32',always_2d=True)[0]
    active=np.sqrt(np.mean(right**2,axis=1))>1e-6;ratio=float(20*np.log10(np.sqrt(np.mean(left[active].astype(float)**2))/np.sqrt(np.mean(right[active].astype(float)**2))))
    checks[role+'_both_hands_have_audible_signal']=np.isfinite(left).all() and np.isfinite(right).all() and -8<ratio<4
    checks[role+'_orchestra_stems_identical']=all(t.get('reused_unchanged') and hashlib.sha256((ROOT/t['frozen_stem']['path']).read_bytes()).hexdigest()==t['frozen_stem']['sha256'] for t in r['tracks'] if t.get('hand') is None)
    checks[role+'_hashes']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in r['files']+[t['frozen_stem'] for t in r['tracks']])
    mid=midi_read(OUT/(r['stem']+'-piano.mid'))
    checks[role+'_editable_two_hand_midi']=mid[1]['notes']==len(rh['notes']) and mid[2]['notes']==len(lh['notes']) and mid[1]['cc64_events']>0 and mid[2]['cc64_events']>0 and mid[1]['ticks']==mid[2]['ticks']==score['bars']*4*480
    x,sr=sf.read(OUT/(r['stem']+'.wav'),dtype='float32',always_2d=True)
    checks[role+'_audio_finite_frames_no_clip']=sr==48000 and x.shape==(round(score['bars']*4*60/score['bpm']*sr),2) and bool(np.isfinite(x).all() and np.abs(x).max()<.99)
    checks[role+'_loudness_matched']=abs(float(r['loudness']['input_i'])+18.5)<.2
    for ext in ['mp3','ogg']:
        p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.'+ext)),'-f','null','-'],capture_output=True);checks[role+'_'+ext+'_decode']=p.returncode==0
    p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.ogg')),'-ar','48000','-ac','2','-f','f32le','-'],capture_output=True,check=True)
    z=np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2);seam=float(np.max(np.abs(z[0]-z[-1])));ordinary=float(np.percentile(np.abs(np.diff(z,axis=0)),99));checks[role+'_ogg_loop']=len(z)==len(x) and seam<ordinary
    details.append({'role':role,'right_notes':len(rh['notes']),'left_notes':len(lh['notes']),'left_chord_gestures':sum(len(v)>1 for v in groups.values()),
        'left_vs_right_active_rms_db':ratio,'ogg_seam':seam,'lufs':r['loudness']['input_i'],'lra':r['loudness']['input_lra']})
data={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,'cues':details,
      'scope':'Only piano changes; original orchestral stems reused. MIDI independently parsed, frozen native projects not re-rendered. No human listening claimed.'}
(OUT/'verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':data['status'],'checks':len(checks),'failed':[k for k,v in checks.items() if not v],'cues':details},ensure_ascii=False));assert all(checks.values())
