"""Four controlled NovelAI 4.5 prompt/config candidates for Wu; no production edits."""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).absolute().parents[3]
ROOT = PROJECT.parent
sys.path.insert(0, str(PROJECT / "tools"))

_resolve = Path.resolve
Path.resolve = lambda self, strict=False: self.absolute()
import nai_gen  # noqa: E402
Path.resolve = _resolve
import nai_style  # noqa: E402


SEED = 1278087392
SIZE = (832, 1216)
OUT = ROOT / ".tmp" / "nai" / "output" / "wu-prompt-compare-20261013"
HERE = Path(__file__).absolute().parent
REFERENCE = PROJECT / "game" / "assets" / "portraits" / "full" / "wu.webp"

SUBJECT = (
    "1girl, solo, original character, full body, head to boots visible, "
    "front three-quarter view, relaxed standing pose, legs lightly crossed, "
    "both arms hanging naturally, a confident small fang smile, "
    "quiet off-white background, ample clear margins, no scenery, no text."
)

CHARACTER = (
    "girl, slender young adult woman, pale skin, cyan-blue eyes, "
    "silver-white long hair in a high ponytail, loose bangs framing both visible eyes, "
    "blue satin ribbon bow at ponytail root, black rose hair ornament on her left side "
    "(viewer right), matte black round goggles on top of head, small visible fang, "
    "black and charcoal off-shoulder long-sleeved dress, layered ruffled neckline "
    "and sleeve cuffs, narrow black waist tie, irregular layered skirt ending above knees, "
    "bare legs, black ankle boots, one long straight black sword fully sheathed "
    "diagonally across her back, hilt above her right shoulder, scabbard tip below "
    "the left side of the skirt."
)

SHORT_STYLE = (
    "hand-painted anime game character illustration, painterly, "
    "complete clear silhouette, large opaque brush masses, broad directional strokes, "
    "hard-edged grouped light and shadow, muted charcoal and colored grays, "
    "small concentrated blue accents, coherent large hair locks, quiet cloth planes, "
    "selective fine detail on face, eyes, goggles, rose and sword hilt, "
    "visible but economical brush texture, restrained highlights, clean anime face."
)

VARIANTS = {
    "A-current": {"artist": nai_style.ARTIST_BLOCK, "style": nai_style.STYLE_BLOCK, "scale": 6.5},
    "B-compact": {"artist": nai_style.ARTIST_BLOCK, "style": SHORT_STYLE, "scale": 6.5},
    "C-alchemaniac": {"artist": "artist:alchemaniac", "style": SHORT_STYLE, "scale": 6.5},
    "D-lower-guidance": {"artist": nai_style.ARTIST_BLOCK, "style": SHORT_STYLE, "scale": 5.0},
}


def diagnostic_curl(payload_file, zip_file, token, channel):
    args = ["curl"] + channel + [
        "-sS", "--ssl-no-revoke", "--max-time", "240",
        "-H", "Authorization: Bearer " + token,
        "-H", "Content-Type: application/json",
        "-w", "%{http_code}", "-o", str(zip_file),
        "--data-binary", "@" + str(payload_file), nai_gen.ENDPOINT,
    ]
    result = subprocess.run(args, shell=False, capture_output=True, text=True)
    if result.returncode or result.stderr:
        print("CURL_DIAGNOSTIC", result.returncode,
              result.stderr.replace(token, "[redacted]")[:500], flush=True)
    return result.stdout.strip()


def generate(name):
    variant = VARIANTS[name]
    nai_style.ARTIST_BLOCK = variant["artist"]
    nai_style.STYLE_BLOCK = variant["style"]
    nai_gen.DEFAULTS["scale"] = variant["scale"]
    prompt = nai_style.build_character_portrait_prompt(SUBJECT)
    uc = nai_style.build_uc(
        "extra people, duplicate sword, unsheathed sword, stockings, thighhighs, "
        "blue patterned underskirt, floor-length skirt, cropped head, cropped feet, "
        "hair over one eye, glowing weapon, logo"
    )
    OUT.mkdir(parents=True, exist_ok=True)
    request = nai_gen.build_payload(prompt, uc, CHARACTER, *SIZE, SEED)
    request_file = HERE / f"{name}-request.json"
    request_file.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding="utf-8")
    image_path = OUT / f"{name}.png"
    nai_gen.generate_image(prompt, uc, CHARACTER, *SIZE, SEED,
                           out=image_path, transport=diagnostic_curl)
    receipt = {
        "name": name,
        "image": str(image_path),
        "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
        "reference": str(REFERENCE),
        "reference_sha256": hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    }
    (HERE / f"{name}-receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", choices=list(VARIANTS))
    args = parser.parse_args()
    for variant_name in args.names or VARIANTS:
        generate(variant_name)
