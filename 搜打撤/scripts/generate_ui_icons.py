"""Generate the bitmap-only industrial UI icon set. No SVG/runtime font dependency."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "game" / "assets" / "ui" / "icons"
S = 128
INK, PALE, CYAN, AMBER, CORAL, STEEL = "#080b0e", "#dce3e6", "#5cb9bc", "#e5b449", "#d96755", "#718088"
NAMES = "heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner".split()

def canvas():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def ln(d, points, fill=PALE, width=9): d.line(points, fill=fill, width=width, joint="curve")
def poly(d, points, fill=STEEL, outline=INK, width=5): d.polygon(points, fill=fill); d.line(points+[points[0]], fill=outline, width=width, joint="curve")
def rect(d, box, fill=STEEL, outline=INK, width=5, radius=8): d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
def ell(d, box, fill=STEEL, outline=INK, width=5): d.ellipse(box, fill=fill, outline=outline, width=width)

def draw_icon(name):
    im,d=canvas()
    if name in {"heart","broken"}:
        d.polygon([(64,108),(24,70),(22,48),(34,29),(53,28),(64,42),(75,28),(94,29),(106,48),(104,70)],fill=CORAL)
        if name=="broken": ln(d,[(68,36),(54,61),(71,70),(54,96)],INK,7)
    elif name in {"coin","gem","crystal"}:
        if name=="coin": ell(d,(23,23,105,105),AMBER); ell(d,(39,39,89,89),INK,AMBER,5)
        else: poly(d,[(64,15),(103,48),(82,108),(46,108),(25,48)],CYAN); ln(d,[(25,48),(103,48),(64,108),(64,15),(46,108)],PALE,4)
    elif name in {"sword","swords"}:
        ln(d,[(29,99),(96,28)],PALE,10); ln(d,[(22,91),(38,107)],AMBER,9)
        if name=="swords": ln(d,[(99,99),(32,28)],PALE,10); ln(d,[(106,91),(90,107)],AMBER,9)
    elif name in {"bag","pouch","pocket"}:
        rect(d,(23,42,105,108),STEEL); d.arc((39,18,89,62),180,360,fill=CYAN,width=8); ln(d,[(24,70),(104,70)],INK,6)
    elif name=="dice":
        rect(d,(24,24,104,104),PALE); [ell(d,(x-6,y-6,x+6,y+6),INK,None,0) for x,y in [(43,43),(85,43),(64,64),(43,85),(85,85)]]
    elif name in {"upload","download","arrow","exit"}:
        ln(d,[(64,100),(64,30)],CYAN,10); pts=[(38,55),(64,28),(90,55)] if name!="download" else [(38,73),(64,100),(90,73)]; ln(d,pts,CYAN,10)
    elif name in {"book","cards","notes","scroll","save"}:
        rect(d,(24,20,104,108),PALE); ln(d,[(64,22),(64,106)],INK,5); ln(d,[(36,46),(56,46),(36,64),(56,64)],STEEL,5); ln(d,[(72,46),(92,46),(72,64),(92,64)],STEEL,5)
    elif name in {"home","door"}:
        poly(d,[(20,58),(64,19),(108,58),(98,58),(98,108),(30,108),(30,58)],STEEL); rect(d,(53,65,77,108),INK,INK,2,2)
    elif name=="fire": poly(d,[(64,111),(33,91),(39,63),(57,38),(64,16),(72,49),(91,69),(94,92)],CORAL); poly(d,[(64,101),(51,84),(64,60),(78,84)],AMBER)
    elif name in {"skull","demon"}:
        ell(d,(25,23,103,94),PALE); ell(d,(40,48,58,67),INK,None,0); ell(d,(70,48,88,67),INK,None,0); poly(d,[(56,72),(64,62),(72,72)],INK,INK,1); ln(d,[(45,94),(45,108),(83,94),(83,108)],PALE,7)
        if name=="demon": poly(d,[(32,38),(18,13),(48,29)],CORAL); poly(d,[(96,38),(110,13),(80,29)],CORAL)
    elif name in {"key","lock","unlock"}:
        if name=="key": ell(d,(18,27,64,73),None,CYAN,10); ln(d,[(56,65),(104,103),(87,86),(99,74)],PALE,10)
        else: rect(d,(27,53,101,108),STEEL); d.arc((40,17,88,75),180,360 if name=="lock" else 300,fill=CYAN,width=10); ell(d,(57,72,71,86),INK,None,0); ln(d,[(64,83),(64,96)],INK,6)
    elif name in {"trash","archive","folder"}:
        rect(d,(26,35,102,108),STEEL); ln(d,[(20,36),(108,36)],CYAN,8); ln(d,[(47,22),(81,22)],CYAN,8); ln(d,[(49,55),(49,91),(79,55),(79,91)],INK,6)
    elif name in {"shield","plate","helmet"}:
        poly(d,[(64,15),(105,31),(99,77),(82,99),(64,112),(46,99),(29,77),(23,31)],STEEL); ln(d,[(64,23),(64,103)],CYAN,7)
    elif name in {"tools","broom","pen"}:
        ln(d,[(26,103),(102,27)],PALE,10); poly(d,[(88,18),(111,17),(110,40)],AMBER); ell(d,(18,89,42,113),CORAL)
    elif name=="wood": rect(d,(16,42,112,75),STEEL); ell(d,(84,42,112,75),PALE); ln(d,[(28,54),(73,54)],INK,5)
    elif name=="bread": poly(d,[(21,77),(29,48),(51,34),(81,34),(103,49),(108,78),(96,98),(32,98)],AMBER); ln(d,[(45,46),(54,66),(66,43),(73,65)],INK,5)
    elif name in {"trophy","medal"}:
        ell(d,(38,43,90,95),AMBER); poly(d,[(42,46),(31,16),(53,16),(64,42),(75,16),(97,16),(86,46)],CORAL); ln(d,[(64,95),(64,110),(43,111),(85,111)],PALE,7)
    elif name=="paw":
        for box in [(25,24,49,51),(52,15,76,43),(79,24,103,51)]: ell(d,box,STEEL)
        ell(d,(33,50,95,108),STEEL)
    elif name in {"map","flag"}:
        if name=="map": poly(d,[(18,28),(49,18),(79,28),(110,18),(110,98),(79,108),(49,98),(18,108)],PALE); ln(d,[(49,19),(49,98),(79,28),(79,107)],STEEL,5)
        else: ln(d,[(31,111),(31,17)],PALE,8); poly(d,[(34,21),(103,31),(90,67),(34,56)],CORAL)
    elif name in {"blood","flask"}:
        if name=="blood": poly(d,[(64,14),(101,71),(91,101),(64,114),(37,101),(27,71)],CORAL)
        else: ln(d,[(49,18),(79,18),(75,51),(103,99),(95,111),(33,111),(25,99),(53,51)],PALE,8); poly(d,[(34,87),(94,87),(104,104),(94,112),(34,112),(24,104)],CYAN)
    elif name in {"question","check","cross","play","skip","bolt"}:
        if name=="question": d.arc((35,19,93,77),185,530,fill=PALE,width=10); ell(d,(57,94,71,108),CYAN,None,0)
        elif name=="check": ln(d,[(23,67),(51,95),(106,31)],CYAN,11)
        elif name=="cross": ln(d,[(27,27),(101,101)],CORAL,11); ln(d,[(101,27),(27,101)],CORAL,11)
        elif name in {"play","skip"}: poly(d,[(34,20),(104,64),(34,108)],CYAN); 
        else: poly(d,[(71,11),(27,72),(57,72),(48,117),(101,53),(71,53)],AMBER)
    elif name in {"sparkles","lantern"}:
        poly(d,[(64,12),(74,51),(113,64),(74,76),(64,116),(53,76),(14,64),(53,51)],AMBER)
    elif name in {"recycle","gear"}:
        ell(d,(27,27,101,101),None,CYAN,9); poly(d,[(82,21),(108,32),(91,53)],CYAN); poly(d,[(46,107),(20,95),(37,75)],CYAN)
    elif name in {"hourglass","mouse"}:
        rect(d,(35,14,93,114),PALE); ln(d,[(41,22),(87,106),(87,22),(41,106)],STEEL,6)
    elif name in {"slime","runner"}:
        if name=="slime": ell(d,(23,34,105,110),CYAN); ell(d,(43,62,55,75),INK,None,0); ell(d,(73,62,85,75),INK,None,0)
        else: ell(d,(54,13,76,35),PALE); ln(d,[(65,37),(54,67),(82,78),(103,103),(54,67),(25,91),(54,67),(73,45)],PALE,9)
    else:
        rect(d,(25,25,103,103),STEEL); ln(d,[(42,64),(86,64)],CYAN,8); ln(d,[(64,42),(64,86)],CYAN,8)
    return im

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        draw_icon(name).save(ROOT / f"{name}.png", optimize=True)
    print(f"generated {len(NAMES)} icons in {ROOT}")

if __name__ == "__main__": main()
