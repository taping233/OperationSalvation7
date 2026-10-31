"""Apply only the three assigned classes and new settings/input/feedback components after the coordinator opens the write window."""
from pathlib import Path
import hashlib,json,re,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MENU=ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu';KIT=ROOT/'Assets/Scripts/Sdt.UI/Kit'

def span(text,name):
    start=text.index('    '+('sealed' if name=='VolSlider' else 'public sealed')+' class '+name)
    brace=text.index('{',start);depth=0;mode='code';i=brace
    while i<len(text):
        c=text[i];n=text[i+1] if i+1<len(text) else ''
        if mode=='line':
            if c=='\n':mode='code'
        elif mode=='block':
            if c=='*' and n=='/':mode='code';i+=1
        elif mode in ('string','char'):
            if c=='\\':i+=1
            elif c==('"' if mode=='string' else "'"):mode='code'
        elif mode=='verbatim':
            if c=='"':
                if n=='"':i+=1
                else:mode='code'
        else:
            if c=='/' and n=='/':mode='line';i+=1
            elif c=='/' and n=='*':mode='block';i+=1
            elif c=='@' and n=='"':mode='verbatim';i+=1
            elif c=='"':mode='string'
            elif c=="'":mode='char'
            elif c=='{':depth+=1
            elif c=='}':
                depth-=1
                if depth==0:return start,i+1
        i+=1
    raise RuntimeError('Unclosed '+name)

def mask(text):
    for name in ['SuggestionBox','VolSlider','SettingsScreen']:
        start,end=span(text,name);text=text[:start]+'<'+name+'>'+text[end:]
    return text

file=MENU/'MenuDialogs.cs';before=file.read_text(encoding='utf-8-sig');after=before
segments=(HERE/'settings-menu-segments.cs.txt').read_text(encoding='utf-8')
for name in ['SuggestionBox','VolSlider','SettingsScreen']:
    start,end=span(after,name);a,b=span(segments,name);after=after[:start]+segments[a:b]+after[end:]
assert mask(before)==mask(after),'Unowned content changed'
with file.open('w',encoding='utf-8',newline='') as stream:stream.write(after)
applied=[file]
for name in ['CurrentUiPreferences.cs','CurrentInputBindings.cs','CurrentSettingsPage.cs','CurrentSettingsDialogs.cs','CurrentFeedbackComposer.cs','CurrentAudioSourcesText.cs']:
    dest=(KIT if name in ['CurrentUiPreferences.cs','CurrentInputBindings.cs'] else MENU)/name
    assert not dest.exists(),'New file already exists: '+str(dest)
    dest.write_bytes((HERE/name).read_bytes());applied.append(dest)
    meta=dest.with_name(dest.name+'.meta')
    if not meta.exists():meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\n',encoding='utf-8')
(HERE/'applied-sha256.json').write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in applied},ensure_ascii=False,indent=2),encoding='utf-8')
print('Applied 3 owned MenuDialogs classes + 6 new sources; unowned class text preserved.')
