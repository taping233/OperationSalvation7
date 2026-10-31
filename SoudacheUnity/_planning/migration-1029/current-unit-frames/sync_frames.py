"""Export only the current five sprite-v1 catalogs and their referenced WebP pixels.

No cropping, rescaling, deduplication of timeline slots, or source writes.
The manifest keeps the source canvas and fixed neutral alpha anchor used by
battle.frames.js (quarter-size bilinear alpha sample, threshold 8).
"""
import hashlib
import json
import math
import re
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GAME = PROJECT.parent / "搜打撤" / "game"
RES = PROJECT / "Assets/Resources"
ROLES = {"wu": (278, .912281), "changwuyu": (286, .916016),
         "baita": (270, .812865), "heixiang": (252, .637427), "xingyue": (270, .783626)}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_text(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != content:
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)


def sample_box(image):
    w, h = image.size
    sw, sh = math.ceil(w / 4), math.ceil(h / 4)
    # Canvas's default low-quality downscale bilinearly samples the four source pixels
    # around each destination centre; Pillow.resize would add a wider antialias kernel.
    alpha = image.getchannel("A")
    sample = Image.new("L", (sw, sh))
    for y in range(sh):
        sy = (y + .5) * h / sh - .5
        y0 = max(0, int(math.floor(sy))); y1 = min(h - 1, y0 + 1); fy = sy - y0
        for x in range(sw):
            sx = (x + .5) * w / sw - .5
            x0 = max(0, int(math.floor(sx))); x1 = min(w - 1, x0 + 1); fx = sx - x0
            value = (alpha.getpixel((x0, y0)) * (1 - fx) + alpha.getpixel((x1, y0)) * fx) * (1 - fy)
            value += (alpha.getpixel((x0, y1)) * (1 - fx) + alpha.getpixel((x1, y1)) * fx) * fy
            sample.putpixel((x, y), 255 if math.floor(value + .5) >= 8 else 0)
    box = sample.getbbox()
    if box is None:
        raise ValueError("Empty neutral")
    return [box[0] * w / sw, box[1] * h / sh, box[2] * w / sw, box[3] * h / sh]


def main():
    receipt, roles = [], []
    timing_source = (GAME / "src/battle/view/battle.action-timing.js").read_text(encoding="utf-8")
    contacts = dict(re.findall(r"(\w+): '([^']+)'", timing_source.split("const contactFrames = Object.freeze({")[1].split("});")[0]))
    for role, (body_height, body_fill) in ROLES.items():
        source_dir = GAME / "assets/portraits/frames" / role
        catalog_path = source_dir / "sprite-v1/animations.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        actions = []
        for action, names in catalog["sequences"].items():
            timings = catalog["timings"][action]
            if len(names) != len(timings) or not all(ms > 0 for ms in timings):
                raise ValueError(f"Invalid timeline {role}/{action}")
            actions.append(dict(name=action, frames=names, milliseconds=timings,
                                loop=action == "idle", hold=action == "death"))
        names = list(dict.fromkeys(name for action in actions for name in action["frames"]))
        for name in names:
            source = source_dir / (name + ".webp")
            dest = RES / "Art/Current/portraits/frames" / role / (name + ".png")
            with Image.open(source) as image:
                image = image.convert("RGBA")
                if image.size != (catalog["width"], catalog["height"]):
                    raise ValueError(f"Canvas mismatch: {source}")
                dest.parent.mkdir(parents=True, exist_ok=True)
                same = False
                try:
                    with Image.open(dest) as prior:
                        same = prior.convert("RGBA").tobytes() == image.tobytes()
                except (FileNotFoundError, OSError):
                    pass
                if not same:
                    image.save(dest, optimize=True)
            receipt.append(dict(source=str(source.relative_to(GAME)).replace("\\", "/"),
                                output=str(dest.relative_to(PROJECT)).replace("\\", "/"),
                                sourceSha256=sha(source), outputSha256=sha(dest),
                                width=catalog["width"], height=catalog["height"], bytes=dest.stat().st_size))
        neutral = catalog["sequences"]["idle"][0]
        with Image.open(source_dir / (neutral + ".webp")) as image:
            bounds = sample_box(image.convert("RGBA"))
        roles.append(dict(id=role, width=catalog["width"], height=catalog["height"],
                          bodyHeight=body_height, bodyFill=body_fill, neutral=neutral,
                          neutralBounds=bounds, contactFrame=contacts[role], catalogSha256=sha(catalog_path), actions=actions))
    manifest = RES / "Data/CurrentUnitFrames.json"
    save_text(manifest, dict(version=1, roles=roles))
    save_text(HERE / "assets-receipt.json", dict(manifestSha256=sha(manifest), files=receipt))
    print(json.dumps(dict(roles=[dict(id=r["id"], width=r["width"], height=r["height"],
                                     neutralBounds=r["neutralBounds"],
                                     actions={a["name"]: len(a["frames"]) for a in r["actions"]}) for r in roles],
                          frames=len(receipt), largest=max(r["bytes"] for r in receipt)), ensure_ascii=False))


if __name__ == "__main__":
    main()
