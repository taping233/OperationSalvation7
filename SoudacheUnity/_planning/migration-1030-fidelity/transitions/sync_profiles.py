from pathlib import Path
import hashlib, json, re
from PIL import Image

here=Path(__file__).resolve().parent
unity=here.parents[2]
workspace=unity.parent
game=workspace/'\u641c\u6253\u64a4'/'game'
profile_file=game/'src/ui/cinematic-profiles.js'
layer_file=game/'src/ui/layer-passage-profiles.js'
source=profile_file.read_text(encoding='utf-8-sig')
art=dict(re.findall(r"(\w+):new URL\('../../assets/([^']+)'",source))
profiles=[];profile_sources={}
for kind,art_id,renderer,duration,label,background,motion,exit_name,exit_duration in re.findall(r"(\w+):\{art:art\.(\w+),renderer:'([^']+)',duration:(\d+),label:'([^']+)',background:(\w+),motion:'([^']+)',exit:'([^']+)',exitDuration:(\d+)\}",source):
    profile_sources[kind]=art[art_id]
    profiles.append(dict(kind=kind,art='Art/Current/'+str(Path(art[art_id]).with_suffix('')).replace('\\','/'),
        renderer=renderer,duration=int(duration),label=label,background='#e8e5dd' if background=='light' else '#090b0d',
        motion=motion,exit=exit_name,exitDuration=int(exit_duration)))
assert len(profiles)==17
profiles_by_kind={p['kind']:p for p in profiles}
# The archive painting is already imported and used by CurrentArchiveAssets.
# Reuse its existing resource key instead of shipping another copy.
profiles_by_kind['achievement']['art']='Art/CurrentArchive/archive-leaves-v1'
layers=[]
for relative,motion in re.findall(r"art:new URL\('../../assets/([^']+)'[^\n]+motion:'([^']+)'",layer_file.read_text(encoding='utf-8-sig')):
    layers.append(dict(art='Art/Current/'+str(Path(relative).with_suffix('')).replace('\\','/'),motion=motion))
assert len(layers)==4
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=[]
images={(profile_sources[p['kind']],p['art']) for p in profiles if p['renderer']=='image'}
images|={(p['art'][len('Art/Current/'):]+'.webp',p['art']) for p in layers}
for relative,key in sorted(images):
    original=game/'assets'/relative
    output=unity/'Assets/Resources'/(key+'.png')
    im=Image.open(original).convert('RGBA')
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():
        assert Image.open(output).convert('RGBA').tobytes()==im.tobytes(),str(output)
    else:im.save(output,compress_level=9)
    files.append(dict(source=str(original.relative_to(workspace)),sourceSha256=sha(original),output=str(output.relative_to(unity)),outputSha256=sha(output),width=im.width,height=im.height))
encounter_file=game/'src/ui/encounter-presentation.js'
encounters=[]
for quoted,plain,kind,title,line in re.findall(r"(?:'([^']+)'|(\w+)): \{ kind:'([^']+)', title:'([^']+)', line:'([^']+)' \}",encounter_file.read_text(encoding='utf-8-sig')):
    encounters.append(dict(id=quoted or plain,kind=kind,title=title,line=line))
assert len(encounters)==5
payload=dict(profiles=profiles,layers=layers,encounters=encounters)
target=unity/'Assets/Resources/Data/CurrentCinematicProfiles.json'
target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
receipt=dict(sourceFiles={str(p.relative_to(workspace)):sha(p) for p in [profile_file,layer_file,encounter_file,game/'src/ui/silent-node-film.js',game/'css/silent-node-film.css',game/'css/map-passage.css']},
    profiles=len(profiles),layers=len(layers),generated=str(target.relative_to(unity)),generatedSha256=sha(target),files=files)
(here/'assets-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(profiles=len(profiles),layers=len(layers),images=len(files))))
