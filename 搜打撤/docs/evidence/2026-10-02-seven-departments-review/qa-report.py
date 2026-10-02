from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
import pdfplumber
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
pdf=ROOT/'output/pdf/七部门调研汇报-2026-10-02.pdf'
pages=sorted((HERE/'tmp').glob('page-*.png'))
reader=PdfReader(pdf)
text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert len(reader.pages)==20 and len(pages)==20
for s in ['6.3','7.0','火山的女儿','风格一致','排版层级','105','1162','12.4%']:
    assert s in text,s
with pdfplumber.open(pdf) as p:
    overflow=[(i+1,c['text']) for i,page in enumerate(p.pages) for c in page.chars if c['x0'] < -1 or c['x1']>961 or c['top'] < -1 or c['bottom']>541]
assert not overflow,overflow[:10]
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',21)
for batch in range(4):
    sheet=Image.new('RGB',(2268,3*674),(219,225,222))
    for k,file in enumerate(pages[batch*6:min((batch+1)*6,20)]):
        im=Image.open(file).convert('RGB'); x=(k%2)*1134; y=(k//2)*674
        sheet.paste(im,(x,y+28)); ImageDraw.Draw(sheet).text((x+12,y+3),file.stem,font=font,fill=(23,50,63))
    sheet.save(HERE/'tmp'/f'contact-{batch+1}.png')
report={'pages':len(reader.pages),'renderedPages':len(pages),'characters':len(text),'outsidePage':overflow,'links':sum(len(p.get('/Annots',[])) for p in reader.pages),'pdfBytes':pdf.stat().st_size,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'visualInspection':'pending'}
(HERE/'pdf-text.txt').write_text(text,encoding='utf-8')
(HERE/'pdf-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))
