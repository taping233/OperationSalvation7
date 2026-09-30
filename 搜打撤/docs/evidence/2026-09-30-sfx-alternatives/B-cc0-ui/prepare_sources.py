"""Fetch only chosen CC0 audio and provenance. Never execute upstream code."""
from pathlib import Path
import concurrent.futures
import hashlib
import io
import json
import urllib.request
import zipfile

BASE = Path(__file__).resolve().parent
SOURCES = BASE / "sources"
SOURCES.mkdir(exist_ok=True)
UI_SHA = "9950fe66f993a6660dab9c2651dcbcd899ffd83b"
SELECTED = {
    "impact-sounds": ["impactMetal_medium_002.ogg", "impactGlass_heavy_003.ogg", "impactPunch_medium_002.ogg"],
    "rpg-audio": ["knifeSlice2.ogg", "metalLatch.ogg", "handleCoins2.ogg"],
    "sci-fi-sounds": ["explosionCrunch_003.ogg", "forceField_003.ogg", "doorOpen_001.ogg", "lowFrequency_explosion_001.ogg"],
    "casino-audio": ["card-slide-4.ogg", "card-place-2.ogg"],
}


def request(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Friday-CC0-audio-review"})
    with urllib.request.urlopen(req, timeout=40) as response:
        chunks = []
        while True:
            chunk = response.read(32768)
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)


def download_pack(pack):
    inventory = json.loads((BASE / (pack + "-inventory.json")).read_text(encoding="utf-8"))
    url = inventory["url"]
    for attempt in range(3):
        try:
            payload = request(url)
            archive = zipfile.ZipFile(io.BytesIO(payload))
            records = []
            for filename in SELECTED[pack]:
                entry = "Audio/" + filename
                audio = archive.read(entry)
                local = SOURCES / (pack + "__" + filename)
                local.write_bytes(audio)
                records.append({"key": pack + "__" + filename, "pack": pack, "packPage": "https://kenney.nl/assets/" + pack,
                                "sourceUrl": url, "archiveEntry": entry, "license": "CC0-1.0",
                                "licenseFile": pack + "-License.txt", "sha256": hashlib.sha256(audio).hexdigest()})
            print("saved", pack, len(records), flush=True)
            return records
        except Exception as error:
            print("retry", pack, attempt + 1, type(error).__name__, flush=True)
            if attempt == 2:
                raise


def download_ui():
    root = "https://raw.githubusercontent.com/romainsimon/uisfx/" + UI_SHA + "/"
    license_url = root + "LICENSE-AUDIO"
    (BASE / "UI-SFX-LICENSE-AUDIO.txt").write_bytes(request(license_url))
    records = []
    for pack, cue in [("mechanical", "press"), ("studio", "check")]:
        path = "packages/uisfx/sounds/" + pack + "/" + cue + ".ogg"
        url = root + path
        audio = request(url)
        key = "uisfx__" + pack + "__" + cue + ".ogg"
        (SOURCES / key).write_bytes(audio)
        records.append({"key": key, "pack": "uisfx-" + pack, "sourceUrl": url,
                        "repositoryCommit": UI_SHA, "license": "CC0-1.0", "licenseUrl": license_url,
                        "licenseFile": "UI-SFX-LICENSE-AUDIO.txt", "sha256": hashlib.sha256(audio).hexdigest(),
                        "upstreamCreation": "Existing procedurally generated audio files; no upstream recipes or code executed here."})
    print("saved UI", len(records), flush=True)
    return records


if __name__ == "__main__":
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(download_pack, pack) for pack in SELECTED]
        futures.append(pool.submit(download_ui))
        for future in concurrent.futures.as_completed(futures):
            records.extend(future.result())
    (BASE / "source-files.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print("TOTAL", len(records), flush=True)
