import pathlib,xml.etree.ElementTree as ET,subprocess,os,json
import numpy as np,soundfile as sf
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
APP=ROOT/'.tmp/music-workstation/LMMS';TMP=ROOT/'.tmp/music-workstation/title-v4';TMP.mkdir(exist_ok=True)
results={}
for auto in [False,True]:
    tree=ET.parse(OUT.parent/'2026-10-05-WF-music-daw/connection-test.mmp');r=tree.getroot()
    it=r.find('.//instrumenttrack');it.set('vol','50');patch=it.find('instrument/sf2player');patch.set('patch','48');patch.set('reverbOn','0')
    pattern=r.find('.//pattern')
    for note in list(pattern):pattern.remove(note)
    ET.SubElement(pattern,'note',{'key':'55','pos':'0','len':'384','vol':'70','pan':'0'})
    if auto:
        ET.SubElement(it,'vol',{'id':'740001','value':'50','scale_type':'linear'})
        track=ET.SubElement(r.find('.//trackcontainer'),'track',{'type':'5','name':'Strings expression','muted':'0','solo':'0'});ET.SubElement(track,'automationtrack')
        p=ET.SubElement(track,'automationpattern',{'name':'Strings expression','pos':'0','len':'384','prog':'1','tens':'1','mute':'0'})
        for tick,value in [(0,5),(160,100),(310,100),(384,5)]:ET.SubElement(p,'time',{'pos':str(tick),'value':str(value)})
        ET.SubElement(p,'object',{'id':'740001'})
    name='auto' if auto else 'static';path=TMP/(name+'.mmp');wav=TMP/(name+'.wav');tree.write(path,encoding='utf-8',xml_declaration=True)
    si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW
    with (TMP/(name+'.log')).open('wb') as log:
        proc=subprocess.run([str(APP/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(path,APP),'-o',os.path.relpath(wav,APP),'-s','48000','-a'],cwd=APP,stdout=log,stderr=subprocess.STDOUT,startupinfo=si,timeout=60)
    assert proc.returncode==0
    pcm,sr=sf.read(wav,always_2d=True)
    results[name]={'early_rms':float(np.sqrt(np.mean(pcm[int(.3*sr):int(.8*sr)]**2))),'late_rms':float(np.sqrt(np.mean(pcm[int(2.4*sr):int(2.9*sr)]**2)))}
ratio=(results['auto']['late_rms']/results['auto']['early_rms'])/(results['static']['late_rms']/results['static']['early_rms'])
assert ratio>1.5,'Automation not audibly represented in rendered data'
results['automation_vs_static_swell_db']=float(20*np.log10(ratio))
(OUT/'automation-probe.json').write_text(json.dumps(results,indent=2),encoding='utf-8');print(json.dumps(results))
