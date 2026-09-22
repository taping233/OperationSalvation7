from __future__ import annotations

import base64
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT_PARENT = Path(__file__).resolve().parents[5]
NAI_DIR = ROOT_PARENT / ".tmp/nai"
sys.path.insert(0, str(NAI_DIR))

from hero_card_wu import payload, TOKEN, ENDPOINT  # noqa: E402
from style_modules.official_painterly_style import build_prompt, build_uc  # noqa: E402

HERE = Path(__file__).resolve().parent
SOURCE = ROOT_PARENT / "搜打撤/game/assets/portraits/battle/heixiang.webp"
OUT = HERE / "source/heixiang-fill-reference.png"
REQUEST = HERE / "source/heixiang-fill-reference.request.json"
SEED = 1704211437

CHARACTER = (
    "1boy, adult man, 1.15::dark brown skin::, extremely tall, huge muscular build, broad shoulders, thick arms, "
    "black short hair with shaved sides and thick slicked-back top, completely exposed forehead, amber eyes, "
    "three short stitched scar lines on his left cheek, faint cocky smirk, black tight high-collar long-sleeve combat suit, "
    "black tactical belt, black tactical pants with thigh pouches, black full-finger tactical gloves, "
    "one heavy grey metal pauldron on his left shoulder, brown-orange scarf around his neck with one long tail"
)
SUBJECT = (
    "solo, full body, three-quarter side view facing right, looking right, both arms held slightly away from the torso, "
    "arms spread gently to expose the entire chest and armpits, elbows slightly bent, relaxed gloved fists, "
    "complete chest, inner upper arms, elbow folds, glove cuffs and back of the shoulder armor clearly visible, "
    "both feet planted, no weapon in either hand"
)
SCENE = (
    "plain pure white background, complete body from head to boot soles, a little margin around the silhouette, "
    "same cold directional light and black-grey clothing as the approved battle portrait"
)
EXTRA_UC = (
    "weapon, sword, greatsword, coffee cup, saucer, cape, cloak, second pauldron, bare hands, crossed arms, arms over chest, "
    "hands touching, bangs, hair over forehead, pale skin, light skin, front view, looking at viewer, cropped feet, scenery, shadow"
)


def main():
    prompt = build_prompt(SUBJECT, SCENE)
    uc = build_uc(EXTRA_UC)
    body = payload(prompt, SEED)
    params = body["parameters"]
    params.update(width=832, height=1216, steps=28, scale=6.5, cfg_rescale=0.0,
                  sampler="k_euler_ancestral", noise_schedule="karras", variety_plus=True,
                  negative_prompt=uc)
    params["characterPrompts"] = [{"prompt": CHARACTER, "uc": "", "center": {"x": 0.5, "y": 0.5}, "enabled": True}]
    params["v4_prompt"]["caption"]["char_captions"] = [{"char_caption": CHARACTER, "centers": [{"x": 0.5, "y": 0.5}]}]
    params["v4_negative_prompt"]["caption"] = {"base_caption": uc, "char_captions": [{"char_caption": "", "centers": [{"x": 0.5, "y": 0.5}]}]}

    REQUEST.write_text(json.dumps({
        "model": body.get("model"), "action": body.get("action"), "seed": SEED,
        "width": 832, "height": 1216, "prompt": prompt, "negative_prompt": uc,
        "character_prompt": CHARACTER, "reference_source": None,
        "retry_note": "reference transfer removed after the first request returned HTTP 500",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    import requests
    response = requests.post(ENDPOINT, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
                             data=json.dumps(body).encode("utf-8"), timeout=240)
    print(f"HTTP {response.status_code}")
    if response.status_code in (403, 429):
        raise SystemExit("STOP: NovelAI refused or rate-limited the single approved draft")
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        png_name = next(name for name in archive.namelist() if name.lower().endswith(".png"))
        OUT.write_bytes(archive.read(png_name))
    with Image.open(OUT) as image:
        if image.size != (832, 1216):
            raise RuntimeError(f"unexpected output size {image.size}")
    print(f"SAVED {OUT}")


if __name__ == "__main__":
    main()
