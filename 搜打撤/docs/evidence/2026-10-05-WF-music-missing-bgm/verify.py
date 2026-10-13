"""Checks all scene cues, coverage, independent melodies, both piano hands and delivery."""
import pathlib,json,hashlib,subprocess,struct,sys,xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];sys.stdout.reconfigure(encoding='utf-8')
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'));coverage=json.loads((OUT/'coverage.json').read_text(encoding='utf-8'))
checks={};summaries=[];signatures={};score_structures={}
checks['source_game_font_and_originals_unchanged']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in report['source_inputs_unchanged'])
ids={r['id'] for r in report['cues']};checks['exact_11_unique_missing_cues']=len(ids)==11 and ids==set(coverage['compositionGapsFilled'])
sceneids=set(json.loads((ROOT/'game/data/scenes.json').read_text(encoding='utf-8'))['scenes'])
checks['all_current_node_scenes_covered']=sceneids==set(coverage['nodeSceneAssignments'])
checks['all_coverage_targets_exist']=all(s.startswith('existing:') or s in ids for s in list(coverage['nodeSceneAssignments'].values())+list(coverage['otherAssignments'].values()))

def midi_counts(p):
    b=p.read_bytes();assert b[:4]==b'MThd' and struct.unpack_from('>IHHH',b,4)==(6,1,3,480)
    pos=14;result=[]
    def vlq(buf,k):
        v=0
        for _ in range(4):
            q=buf[k];k+=1;v=(v<<7)|(q&127)
            if q<128:return v,k
        raise ValueError('invalid MIDI VLQ')
    for _ in range(3):
        assert b[pos:pos+4]==b'MTrk';n=struct.unpack_from('>I',b,pos+4)[0];pos+=8;buf=b[pos:pos+n];pos+=n;i=0;tick=0;notes=0;pedals=0;end=False;meter=None
        while i<len(buf):
            delta,i=vlq(buf,i);tick+=delta;st=buf[i];i+=1
            if st==255:
                typ=buf[i];i+=1;ln,i=vlq(buf,i);payload=buf[i:i+ln];i+=ln
                if typ==47:end=True;assert i==len(buf)
                if typ==88:meter=(payload[0],2**payload[1])
            elif st>>4 in [8,9,10,11,14]:
                a,c=buf[i:i+2];i+=2;assert a<128 and c<128
                if st>>4==9 and c>0:notes+=1
                if st>>4==11 and a==64:pedals+=1
            elif st>>4 in [12,13]:assert buf[i]<128;i+=1
            else:raise ValueError('bad generated MIDI event')
        assert end;result.append({'ticks':tick,'notes':notes,'pedals':pedals,'meter':meter})
    assert pos==len(b);return result

for r in report['cues']:
    id=r['id'];score=json.loads((OUT/(id+'-score.json')).read_text(encoding='utf-8'));x,sr=sf.read(OUT/(r['stem']+'.wav'),dtype='float32',always_2d=True)
    checks[id+'_frames_channels_finite_peak']=sr==48000 and x.shape==(round(r['total_beats']*60/r['bpm_quarter']*sr),2) and bool(np.isfinite(x).all() and np.abs(x).max()<.99)
    checks[id+'_hashes_and_stems']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in r['files']+[t['frozen_stem'] for t in r['tracks']])
    checks[id+'_notes_inside_cycle']=all(0<=n['beat']<n['beat']+n['length']<score['total_beats'] and 21<=n['midi']<=108 for tr in score['tracks'].values() for n in tr['notes'])
    checks[id+'_all_tracks_played']=all(t['notes']>0 for t in r['tracks'])
    lead=score['lead'][1];ns=score['tracks'][lead]['notes'];first=[n for n in ns if n['beat']<score['beats_per_bar']*2]
    anchor=first[0]['midi'];signatures[id]=[(n['beat'],n['midi']-anchor,round(n['length'],4)) for n in first]
    score_structures[id]={'meter':r['meter'],'sections':[s['start_bar'] for s in r['sections']]}
    checks[id+'_long_lead_notes']=min(n['length']*60/r['bpm_quarter'] for n in ns)>.35
    root=ET.parse(OUT/(r['stem']+'.mmp')).getroot();head=root.find('head')
    checks[id+'_meter_and_mmp_paths']=tuple(r['meter'])==(int(head.get('timesig_numerator')),int(head.get('timesig_denominator'))) and all(pathlib.Path(a.get('src')).exists() for a in root.findall('.//audiofileprocessor'))
    checks[id+'_native_clip_length']=all(int(p.get('len'))==round(r['total_beats']*48) for p in root.findall('.//pattern'))
    checks[id+'_loudness_safe']=float(r['loudness']['input_i'])<=-18.2 and float(r['loudness']['input_tp'])<=-.5
    if score['piano']:
        right=score['tracks']['Piano right hand']['notes'];left=score['tracks']['Piano left hand']['notes'];md=midi_counts(OUT/(r['stem']+'-piano.mid'))
        checks[id+'_two_hand_piano_midi']=md[0]['meter']==tuple(r['meter']) and md[1]['notes']==len(right) and md[2]['notes']==len(left) and md[1]['pedals']>0 and md[2]['pedals']>0 and md[1]['ticks']==md[2]['ticks']==round(r['total_beats']*480)
        groups={}
        for n in left:groups.setdefault(n['beat'],[]).append(n['midi'])
        checks[id+'_left_bass_chords_span']=any(n['midi']<55 for n in left) and any(len(v)>1 for v in groups.values()) and all(max(v)-min(v)<=12 for v in groups.values())
    for ext in ['mp3','ogg']:
        p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.'+ext)),'-f','null','-'],capture_output=True);checks[id+'_'+ext+'_decode']=p.returncode==0
    p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.ogg')),'-ar','48000','-ac','2','-f','f32le','-'],capture_output=True,check=True)
    z=np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2);seam=float(np.max(np.abs(z[0]-z[-1])));normal=float(np.percentile(np.abs(np.diff(z,axis=0)),99));checks[id+'_ogg_loop']=len(z)==len(x) and seam<normal
    hop=sr//4;db=np.array([20*np.log10(np.sqrt(np.mean(x[i:i+hop].astype(float)**2))+1e-12) for i in range(0,len(x)-hop+1,hop)])
    jumps=[]
    for sec in r['sections'][1:]:
        t=sec['start_bar']*score['beats_per_bar']*60/r['bpm_quarter'];i=round(t*4)
        jumps.append(float(np.median(db[i:i+8])-np.median(db[max(0,i-8):i])))
    # Diagnostic only: meters/phrase accents can change 2s windows without a hard cut.
    summaries.append({'id':id,'title':r['title'],'seconds':r['seconds'],'meter':r['meter'],'key':r['key'],'tracks':len(r['tracks']),
        'lufs':r['loudness']['input_i'],'lra':r['loudness']['input_lra'],'section_2s_changes_db':jumps,'ogg_seam':seam,'has_two_hand_piano':score['piano']})
sigstrings=[json.dumps(s) for s in signatures.values()]
checks['eleven_distinct_interval_rhythm_hooks']=len(set(sigstrings))==11
checks['multiple_meters_and_forms']=len(set(tuple(r['meter']) for r in report['cues']))>=4 and len(set(tuple(v['sections']) for v in score_structures.values()))>=6
data={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,'cues':summaries,
      'normalized_hook_signatures':signatures,'structures':score_structures,'scope':'11 generated candidates only; all current scenes assigned, game not integrated.',
      'limits':['No human audition claimed.','Hook uniqueness verifies first phrase intervals and rhythm, not aesthetic originality.','Frozen pre-master LMMS projects paths checked, not separately native-rendered.']}
(OUT/'verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':data['status'],'checks':len(checks),'failed':[k for k,v in checks.items() if not v],'cues':summaries},ensure_ascii=False));assert all(checks.values())
