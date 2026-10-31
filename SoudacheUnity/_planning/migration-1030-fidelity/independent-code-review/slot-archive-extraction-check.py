from pathlib import Path
import hashlib,json
here=Path(__file__).resolve().parent
root=here.parents[2]
current=(root/'Assets/Scripts/Sdt.Run/SaveSystem.cs').read_text(encoding='utf-8-sig')
validation=(root/'Assets/Scripts/Sdt.Run/SaveSystem.RunValidation.cs').read_text(encoding='utf-8-sig')
def normalize(text):return '\n'.join(line.strip() for line in text.splitlines() if line.strip())
def block(text):
 start=text.index('if((string)token["format"]')
 end=text.index('return raw;',start)+len('return raw;')
 return text[start:end]
def reader(text):
 start=text.index('public RunSaveData ReadSlot(int index)')
 end=text.index('public bool WriteSlot(',start)
 return text[start:end]
rows=[]
for relative in ['_planning/migration-1030-fidelity/capacity-focus/snapshot/Assets/Scripts/Sdt.Run/SaveSystem.cs','_planning/migration-1030-fidelity/recode/snapshot/Assets/Scripts/Sdt.Run/SaveSystem.cs','_planning/migration-1030-fidelity/startup/snapshot/Assets/Scripts/Sdt.Run/SaveSystem.cs']:
 path=root/relative
 old=path.read_text(encoding='utf-8-sig')
 expected=reader(old).replace(block(old),'return ParseValidatedRun(token,index);')
 rows.append({'previous':relative,'previousSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'validationEqualIgnoringIndent':normalize(block(old))==normalize(block(validation)),'readerWrapperEqualIgnoringIndent':normalize(expected)==normalize(reader(current)),'normalizedValidationSha256':hashlib.sha256(normalize(block(validation)).encode()).hexdigest()})
(here/'slot-archive-extraction-result.json').write_text(json.dumps({'readOnly':True,'noCompile':True,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(rows,ensure_ascii=False,indent=2))
assert all(row['validationEqualIgnoringIndent'] and row['readerWrapperEqualIgnoringIndent'] for row in rows)
