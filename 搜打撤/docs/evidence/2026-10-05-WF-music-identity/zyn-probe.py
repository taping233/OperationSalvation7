import copy,gzip,pathlib,subprocess,os,xml.etree.ElementTree as ET,json
import soundfile as sf
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parent
APP=ROOT/'.tmp/music-workstation/LMMS'
TMP=ROOT/'.tmp/music-workstation/identity';TMP.mkdir(exist_ok=True)
def zyn_state(relative):
    preset=APP/'data/presets/ZynAddSubFx'/relative
    x=ET.fromstring(gzip.decompress(preset.read_bytes()))
    state=ET.Element('ZynAddSubFX-data',{'version-major':'2','version-minor':'4','version-revision':'1'})
    state.append(copy.deepcopy(x.find('BASE_PARAMETERS')))
    master=ET.SubElement(state,'MASTER')
    ET.SubElement(master,'par',{'name':'volume','value':'80'})
    part=ET.SubElement(master,'PART',{'id':'0'})
    for tag,name,value in [('par_bool','enabled','yes'),('par','volume','96'),('par','panning','64'),('par','key_shift','64'),('par','rcv_chn','0'),('par_bool','note_on','yes'),('par_bool','poly_mode','yes'),('par','key_limit','32')]:
        ET.SubElement(part,tag,{'name':name,'value':value})
    part.append(copy.deepcopy(x.find('INSTRUMENT')))
    return state
if __name__=='__main__':
    results=[]
    for index,relative in enumerate(['Rhodes/0013-Ice Rhodes2.xiz','Pads/0065-Soft Pad.xiz']):
        root=ET.parse(ROOT/'docs/evidence/2026-10-05-WF-music-daw/connection-test.mmp').getroot()
        it=root.find('.//instrumenttrack');it.set('vol','10');it.remove(it.find('instrument'))
        instrument=ET.SubElement(it,'instrument',{'name':'zynaddsubfx'})
        zyn=ET.SubElement(instrument,'zynaddsubfx',{'portamento':'0','filterfreq':'64','filterq':'64','bandwidth':'64','fmgain':'127','rescenterfreq':'64','resbandwidth':'64','forwardmidicc':'0','modifiedcontrollers':''})
        zyn.append(zyn_state(relative))
        path=TMP/f'zyn-probe-{index}.mmp';wav=TMP/f'zyn-probe-{index}.wav'
        ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
        si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW
        with (TMP/f'zyn-probe-{index}.log').open('wb') as f:
            p=subprocess.run([str(APP/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(path,APP),'-o',os.path.relpath(wav,APP),'-s','48000','-a'],cwd=APP,stdout=f,stderr=subprocess.STDOUT,startupinfo=si,timeout=60)
        if p.returncode:raise RuntimeError('Zyn native probe failed')
        a,sr=sf.read(wav);a=a[:4*sr]
        assert np.max(np.abs(a))>.0001
        results.append({'preset':relative,'track_volume':10,'peak_dbfs':float(20*np.log10(np.max(np.abs(a)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(a*a)))),'sr':sr})
    (OUT/'zyn-probe.json').write_text(json.dumps(results,indent=2),encoding='utf-8');print(json.dumps(results))
