from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1] / "prototypes" / "map-system" / "assets"
GRAPHITE = (8, 12, 16, 255)
PANEL = (21, 29, 35, 255)
STEEL = (82, 98, 106, 255)
LIGHT = (220, 227, 230, 255)
CYAN = (92, 185, 188, 255)
AMBER = (229, 180, 73, 255)
CORAL = (217, 103, 85, 255)
BLUE = (123, 167, 199, 255)
GREEN = (114, 185, 139, 255)

CLASSES = {
    "assassin": (CYAN, "daggers"), "sword": (AMBER, "blade"), "warlock": (GREEN, "orb"),
    "mage": (BLUE, "staff"), "priest": (CYAN, "medic"), "sealer": (CORAL, "seal"),
    "descend": (CORAL, "wing"), "summoner": (BLUE, "drone"), "guard": (AMBER, "shield"),
    "ranger": (GREEN, "bow"), "warrior": (CORAL, "greatblade"),
}

ENEMIES = {
    "infantry": ((143,168,184,255), "spear", "human"), "archer": (GREEN, "bow", "human"),
    "bandit": (CORAL, "knife", "human"), "cavalry": (AMBER, "lance", "cavalry"),
    "orc_jav": ((153,189,109,255), "spear", "orc"), "orc_axe": (CORAL, "axe", "orc"),
    "wolf_rider": (BLUE, "lance", "wolf"), "fire_el": (CORAL, "flame", "element"),
    "water_el": (CYAN, "wave", "element"), "grass_el": (GREEN, "leaf", "element"),
    "dragon": (AMBER, "dragon", "dragon"), "boss_general": (AMBER, "halberd", "boss"),
    "boss_orc": (CORAL, "doubleaxe", "boss_orc"), "boss_elem": (BLUE, "triad", "boss_element"),
}

CARDS = {
    "martial-melee": (CORAL, "blade"), "martial-ranged": (GREEN, "bow"), "spell": (BLUE, "orb"),
    "healing": (CYAN, "medic"), "consumable": (CYAN, "flask"), "equipment-weapon": (AMBER, "greatblade"),
    "equipment-armor": (AMBER, "shield"), "equipment-utility": (BLUE, "drone"), "resource-key": (CYAN, "key"),
    "resource-material": (GREEN, "crate"), "resource-valuables": (AMBER, "token"), "event": (CORAL, "rift"),
    "hero": (AMBER, "beacon"), "unknown": (STEEL, "scan"),
}

def backdrop(size, accent, hostile=False):
    w, h = size
    im = Image.new("RGBA", size, GRAPHITE)
    d = ImageDraw.Draw(im, "RGBA")
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(PANEL[i] * (1-t) + GRAPHITE[i] * t) for i in range(3)) + (255,)
        d.line((0, y, w, y), fill=c)
    for x in range(-h, w + h, 96):
        d.line((x, 0, x-h, h), fill=(*accent[:3], 20), width=2)
    d.rectangle((20, 20, w-21, h-21), outline=(*STEEL[:3], 150), width=3)
    d.polygon([(20,20),(138,20),(20,138)], fill=(*accent[:3], 65))
    d.polygon([(w-20,h-20),(w-138,h-20),(w-20,h-138)], fill=(*accent[:3], 65))
    d.rectangle((34, 34, w-35, 45), fill=(*accent[:3], 150 if hostile else 90))
    return im

def glow(im, xy, radius, color):
    layer = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(layer, "RGBA")
    x, y = xy
    d.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(*color[:3], 120))
    layer = layer.filter(ImageFilter.GaussianBlur(radius//2))
    im.alpha_composite(layer)

def line(d, pts, fill, width=12):
    d.line(pts, fill=fill, width=width, joint="curve")

def symbol(d, kind, cx, cy, s, accent):
    ink = (5, 8, 11, 255); pale = LIGHT
    if kind in ("blade", "greatblade"):
        line(d, [(cx-s*.45,cy+s*.48),(cx+s*.34,cy-s*.45)], pale, int(s*.12))
        d.polygon([(cx+s*.34,cy-s*.45),(cx+s*.49,cy-s*.55),(cx+s*.39,cy-s*.29)], fill=accent)
        line(d, [(cx-s*.19,cy+s*.25),(cx+s*.02,cy+s*.45)], accent, int(s*.08))
    elif kind in ("daggers", "doubleaxe"):
        symbol(d, "blade", cx-s*.18, cy, s*.7, accent); symbol(d, "blade", cx+s*.18, cy, s*.7, accent)
    elif kind in ("bow",):
        d.arc((cx-s*.45,cy-s*.5,cx+s*.35,cy+s*.5), -70, 70, fill=accent, width=int(s*.08))
        line(d, [(cx+s*.04,cy-s*.45),(cx+s*.04,cy+s*.45)], pale, int(s*.035))
        line(d, [(cx-s*.34,cy),(cx+s*.48,cy)], pale, int(s*.045))
    elif kind in ("staff", "spear", "lance", "halberd"):
        line(d, [(cx-s*.22,cy+s*.52),(cx+s*.18,cy-s*.52)], pale, int(s*.055))
        d.polygon([(cx+s*.18,cy-s*.52),(cx+s*.36,cy-s*.34),(cx+s*.13,cy-s*.30)], fill=accent)
    elif kind in ("orb", "triad", "rift", "scan"):
        glow_base=(cx,cy)
        d.ellipse((cx-s*.3,cy-s*.3,cx+s*.3,cy+s*.3), outline=accent, width=int(s*.07))
        d.polygon([(cx,cy-s*.5),(cx+s*.18,cy),(cx,cy+s*.5),(cx-s*.18,cy)], fill=(*accent[:3],170))
    elif kind in ("shield",):
        d.polygon([(cx,cy-s*.48),(cx+s*.4,cy-s*.3),(cx+s*.3,cy+s*.3),(cx,cy+s*.52),(cx-s*.3,cy+s*.3),(cx-s*.4,cy-s*.3)], fill=STEEL, outline=accent)
        line(d, [(cx,cy-s*.37),(cx,cy+s*.36)], accent, int(s*.07))
    elif kind in ("medic",):
        d.rounded_rectangle((cx-s*.38,cy-s*.38,cx+s*.38,cy+s*.38), radius=int(s*.08), fill=STEEL, outline=accent, width=int(s*.05))
        d.rectangle((cx-s*.1,cy-s*.28,cx+s*.1,cy+s*.28), fill=pale); d.rectangle((cx-s*.28,cy-s*.1,cx+s*.28,cy+s*.1), fill=pale)
    elif kind in ("drone", "crate"):
        d.rounded_rectangle((cx-s*.42,cy-s*.28,cx+s*.42,cy+s*.28), radius=int(s*.06), fill=STEEL, outline=accent, width=int(s*.06))
        line(d, [(cx-s*.32,cy),(cx+s*.32,cy)], accent, int(s*.05)); line(d, [(cx,cy-s*.22),(cx,cy+s*.22)], accent, int(s*.05))
    elif kind in ("flask",):
        d.polygon([(cx-s*.14,cy-s*.5),(cx+s*.14,cy-s*.5),(cx+s*.14,cy-s*.12),(cx+s*.42,cy+s*.42),(cx-s*.42,cy+s*.42),(cx-s*.14,cy-s*.12)], fill=STEEL, outline=pale)
        d.polygon([(cx-s*.3,cy+s*.18),(cx+s*.3,cy+s*.18),(cx+s*.4,cy+s*.4),(cx-s*.4,cy+s*.4)], fill=accent)
    elif kind in ("key",):
        d.ellipse((cx-s*.4,cy-s*.35,cx,cy+s*.05), outline=accent, width=int(s*.08))
        line(d, [(cx-s*.02,cy-s*.02),(cx+s*.42,cy+s*.42)], pale, int(s*.08))
        line(d, [(cx+s*.22,cy+s*.22),(cx+s*.36,cy+s*.08)], accent, int(s*.06))
    elif kind in ("token", "beacon"):
        d.ellipse((cx-s*.35,cy-s*.35,cx+s*.35,cy+s*.35), fill=STEEL, outline=accent, width=int(s*.08))
        d.polygon([(cx,cy-s*.25),(cx+s*.22,cy+s*.18),(cx-s*.22,cy+s*.18)], fill=pale)
    elif kind in ("wing",):
        d.polygon([(cx,cy+s*.35),(cx-s*.46,cy-s*.32),(cx-s*.2,cy+s*.05)], fill=accent)
        d.polygon([(cx,cy+s*.35),(cx+s*.46,cy-s*.32),(cx+s*.2,cy+s*.05)], fill=accent)
    elif kind in ("flame",):
        d.polygon([(cx,cy-s*.55),(cx+s*.38,cy+s*.2),(cx,cy+s*.5),(cx-s*.38,cy+s*.2)], fill=accent)
        d.polygon([(cx,cy-s*.12),(cx+s*.16,cy+s*.24),(cx,cy+s*.4),(cx-s*.16,cy+s*.24)], fill=AMBER)
    elif kind in ("wave",):
        d.polygon([(cx,cy-s*.5),(cx+s*.38,cy+s*.05),(cx,cy+s*.5),(cx-s*.38,cy+s*.05)], fill=accent)
    elif kind in ("leaf",):
        d.ellipse((cx-s*.3,cy-s*.52,cx+s*.3,cy+s*.48), fill=accent)
        line(d, [(cx,cy-s*.38),(cx,cy+s*.38)], pale, int(s*.04))
    elif kind in ("axe", "knife"):
        line(d, [(cx-s*.1,cy+s*.5),(cx+s*.08,cy-s*.25)], pale, int(s*.07))
        d.polygon([(cx+s*.06,cy-s*.42),(cx+s*.46,cy-s*.28),(cx+s*.08,cy-s*.05),(cx-s*.04,cy-s*.25)], fill=accent)
    elif kind == "dragon":
        d.polygon([(cx-s*.42,cy+s*.35),(cx-s*.3,cy-s*.25),(cx,cy-s*.52),(cx+s*.42,cy-s*.15),(cx+s*.18,cy+s*.4)], fill=accent)

def portrait(path, accent, gear, species="class"):
    im = backdrop((768,1024), accent, species != "class")
    glow(im, (520,360), 220, accent)
    d = ImageDraw.Draw(im, "RGBA")
    boss = species.startswith("boss")
    if species in ("element", "dragon", "boss_element"):
        body = [(384,170),(570,365),(630,760),(510,900),(258,900),(138,760),(198,365)]
        d.polygon(body, fill=(32,40,46,245), outline=accent)
        symbol(d, gear, 384, 520, 330, accent)
        d.ellipse((300,330,350,380), fill=LIGHT); d.ellipse((418,330,468,380), fill=LIGHT)
    else:
        skin = (190,132,101,255) if "orc" not in species else (104,139,87,255)
        shoulder = 158 if not boss else 105
        d.polygon([(shoulder,910),(180,570),(285,465),(483,465),(588,570),(768-shoulder,910)], fill=(38,48,55,255), outline=STEEL)
        d.polygon([(245,505),(384,650),(523,505),(486,455),(282,455)], fill=(18,24,29,255))
        d.ellipse((270,165,498,470), fill=skin, outline=(6,9,12,255), width=8)
        d.polygon([(260,320),(268,190),(335,112),(458,150),(510,300),(458,235),(365,218),(305,272)], fill=(24,29,34,255))
        d.line((318,315,354,305), fill=(8,10,12,255), width=8); d.line((414,305,450,315), fill=(8,10,12,255), width=8)
        d.arc((344,330,424,405), 20, 160, fill=(105,52,45,255), width=5)
        d.rectangle((190,660,578,900), outline=accent, width=10)
        d.rectangle((225,700,335,820), fill=(12,17,21,255), outline=STEEL, width=5)
        symbol(d, gear, 520, 555, 250, accent)
    if boss:
        d.rectangle((40,55,728,78), fill=accent)
    im.convert("RGB").save(path, "PNG", optimize=True)

def card(path, accent, kind):
    im = backdrop((384,512), accent)
    glow(im, (192,230), 115, accent)
    d = ImageDraw.Draw(im, "RGBA")
    d.polygon([(48,96),(192,52),(336,96),(320,386),(192,454),(64,386)], fill=(14,20,25,235), outline=STEEL)
    d.rectangle((58,400,326,420), fill=accent)
    symbol(d, kind, 192, 245, 230, accent)
    for y in (444,462,480): d.rectangle((70,y,314,y+4), fill=(*STEEL[:3],110))
    im.convert("RGB").save(path, "PNG", optimize=True)

def main():
    class_dir = ROOT / "portraits" / "classes"; enemy_dir = ROOT / "portraits" / "enemies"; card_dir = ROOT / "cards"
    class_dir.mkdir(parents=True, exist_ok=True); enemy_dir.mkdir(parents=True, exist_ok=True); card_dir.mkdir(parents=True, exist_ok=True)
    for name,(accent,gear) in CLASSES.items(): portrait(class_dir/f"{name}.png", accent, gear)
    for name,(accent,gear,species) in ENEMIES.items(): portrait(enemy_dir/f"{name}.png", accent, gear, species)
    for name,(accent,kind) in CARDS.items(): card(card_dir/f"{name}.png", accent, kind)

if __name__ == "__main__":
    main()
