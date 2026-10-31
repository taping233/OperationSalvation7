"""Sync the Vite runtime's selected illustrations and audio into existing Resources.

Keeps source pixels, converts WebP to PNG for Unity, and records source/output hashes.
No source assets, existing Unity meta files, or obsolete resources are removed.
"""
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[3]
GAME = PROJECT.parent / "搜打撤" / "game"
ASSETS = GAME / "assets"
RESOURCES = PROJECT / "Assets" / "Resources"
REPORT = Path(__file__).with_name("assets-receipt.json")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_text(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text(encoding="utf-8") != content:
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)


def node_data():
    script = r"""
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const load = p => import(pathToFileURL(p).href);
const [characters, music, samples, narrative, story, audioPolicy] = await Promise.all([
 load('src/core/characters.js'), load('src/audio/sound.music.catalog.js'),
 load('src/audio/sound.samples.catalog.js'), load('src/home/narrative.js'),
 load('src/generated/narrative-events.js'), load('src/audio/sound.policy.js')]);
const artText = readFileSync('src/core/art.js','utf8');
const skinText = artText.match(/const SKIN_FULL_ART = Object.freeze\(([\s\S]*?)\);/)[1];
const shopText = readFileSync('src/hub/game.hub.pages.js','utf8').match(/const HUB_SHOP_GOODS = (\[[\s\S]*?\n\s*\]);/)[1];
console.log(JSON.stringify({characters:characters.CHARACTERS,music:music.MUSIC_TRACKS,
 samples:samples.SAMPLE_CUES,audioPolicy:{cooldowns:audioPolicy.SFX_COOLDOWN_MS,priorities:audioPolicy.SFX_PRIORITY},knots:narrative.KNOTS,story:story.default,
 skins:vm.runInNewContext('('+skinText+')'), goods:vm.runInNewContext('('+shopText+')'),
 milestones:JSON.parse(readFileSync('data/achievements.json','utf8')).collectionMilestones,
 baseNotes:JSON.parse(readFileSync('data/card-notes.json','utf8')).notes}));
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=GAME,
                            check=True, capture_output=True, encoding="utf-8")
    return json.loads(result.stdout)


def quote(text):
    return json.dumps(text, ensure_ascii=False)


def dictionary(name, values):
    entries = ["            { %s, %s }," % (quote(k), quote(v)) for k, v in sorted(values.items())]
    return ("        public static readonly IReadOnlyDictionary<string, string> " + name
            + " = new Dictionary<string, string>\n        {\n" + "\n".join(entries) + "\n        };\n")


def main():
    data = node_data()
    art = json.loads((GAME / "data/art-mapping.json").read_text(encoding="utf-8"))
    prior = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {}
    old = {r["source"]: r for r in prior.get("files", [])}
    bgm_receipt_path = PROJECT / "_planning/migration-1029/bgm/receipt.json"
    bgm_receipts = json.loads(bgm_receipt_path.read_text(encoding="utf-8-sig")) if bgm_receipt_path.exists() else []
    records = {}
    missing = []

    def sync(relative):
        relative = relative.split("?")[0]
        if relative.startswith("assets/"):
            relative = relative[7:]
        src = ASSETS / relative
        if not src.is_file():
            raise FileNotFoundError("Referenced source asset missing: " + relative)
        image = src.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg")
        dest_rel = (Path("Art/Current") / relative).with_suffix(".png") if image else Path("Audio/Current") / relative
        if relative == "battle/fx-atlas.webp":
            dest_rel = Path("Art/Current/BattleFxAtlas.png")
        elif relative == "scenes/ui-loop-0925/rewards-convoy-fail.webp":
            dest_rel = Path("Art/Current/Settlement/rewards-convoy-fail.png")
        dest = RESOURCES / dest_rel
        source_hash = sha(src)
        record = old.get(relative, {})
        reusable = (record.get("sourceSha256") == source_hash and dest.exists()
                    and record.get("outputSha256") == sha(dest))
        current_music = relative.startswith("music-demo/") and src.suffix.lower() == ".ogg"
        if current_music:
            verified = next((row for row in bgm_receipts if Path(row["source"]).name == src.name
                             and row["sourceSha256"].lower() == source_hash), None)
            if verified and dest.exists() and verified["sha256"].lower() == sha(dest):
                reusable = True
            if reusable and b"\x01vorbis" not in dest.read_bytes()[:128]:
                reusable = False
        if not reusable:
            dest.parent.mkdir(parents=True, exist_ok=True)
            if image:
                with Image.open(src) as im:
                    im.convert("RGBA" if "A" in im.getbands() else "RGB").save(dest, "PNG")
            elif current_music:
                ffmpeg = shutil.which("ffmpeg")
                if not ffmpeg:
                    raise RuntimeError("Current Ogg Opus music requires the existing ffmpeg for Unity Vorbis import")
                subprocess.run([ffmpeg, "-nostdin", "-y", "-i", str(src), "-c:a", "libvorbis", "-q:a", "6", str(dest)],
                               check=True, capture_output=True)
            else:
                shutil.copyfile(src, dest)
        info = {"source": relative, "destination": dest_rel.as_posix(),
                "sourceSha256": source_hash, "outputSha256": sha(dest), "bytes": dest.stat().st_size}
        if image:
            with Image.open(src) as source_image, Image.open(dest) as target_image:
                if source_image.size != target_image.size:
                    raise ValueError("Image dimensions changed: " + relative)
                info["size"] = list(target_image.size)
                info["alpha"] = "A" in target_image.getbands()
        elif current_music:
            info["conversion"] = "Current Ogg Opus to Ogg Vorbis q6; no gain or tempo change"
        records[relative] = info
        return dest_rel.with_suffix("").as_posix()

    # Precedence matches core/art.js cardIcon: overrides, dedicated families, then item/resource/hero.
    def optional_image(relative):
        if not (ASSETS / relative.split("?")[0]).is_file():
            missing.append(relative)
            return None
        return sync(relative)

    cards = {key: sync(value) for key, value in art["cardArtOverrides"].items()}
    for category, prefix in [("spellCardArt", "spell"), ("martialCardArt", "martial"),
                             ("equipCardArt", "equip"), ("creatureCardArt", "creature")]:
        for key in art[category]:
            if key not in cards:
                path = optional_image("cards/%s-%s.webp" % (prefix, key))
                if path:
                    cards[key] = path
    for category, directory in [("eventCardArt", "scenes/"), ("itemArt", "cards/items/"),
                                 ("resourceArt", "cards/resources/"), ("heroCardArt", "cards/")]:
        for key, value in art[category].items():
            if key not in cards:
                path = optional_image(directory + value + ".webp")
                if path:
                    cards[key] = path
    card_families = {key: sync("cards/" + key + ".webp") for key in art["cardFamilies"]}
    portraits, battle, avatars, aliases = {}, {}, {}, {}
    for c in data["characters"]:
        key = c["id"]
        portraits[key] = sync("portraits/full/" + key + ".webp")
        battle[key] = sync("portraits/battle/" + key + ".webp")
        avatars[key] = sync("portraits/avatars/" + key + ".webp")
        for alias in [key, c["name"], c["rulesetId"]]:
            aliases[alias] = key
    enemies = {}
    for key in art["monsterIds"]:
        relative = "portraits/cut/enemies/" + key + ".webp"
        if not (ASSETS / relative).exists():
            relative = "portraits/enemies/" + key + ".webp"
        enemies[key] = sync(relative)

    # Read the selectors used by the current node pages instead of maintaining a second scene list.
    scenes = {}
    css = (GAME / "css/scenes.css").read_text(encoding="utf-8")
    for match in re.finditer(r'data-asset-key="([^"]+)"\][^{]*\{[^}]*?background-image:url\([\'\"]\.\./assets/([^\'\")]+)', css):
        scenes[match.group(1)] = sync(match.group(2))
    far = sync("scenes/battle/platform-minimal-1016/far.webp")
    scenes["courtyard-pond-v4"] = sync("scenes/courtyard-pond-v4.webp")
    scenes["base-operations-v5"] = sync("scenes/base-operations-v5.webp")
    scenes["departure/city-reflection-v1"] = sync("scenes/departure/city-reflection-v1.webp")
    scenes["ui-loop-0925/prep-desk"] = sync("scenes/ui-loop-0925/prep-desk.webp")
    for key in ["scene-battle-bg", "battle-normal", "battle-boss-general", "battle-boss-orc", "battle-boss-element"]:
        scenes[key] = far
    layers = {key: sync("scenes/battle/platform-minimal-1016/" + key + ".webp")
              for key in ["far", "ground", "foreground"]}
    controls = {key: sync("ui/battle-controls-glass-1016/" + key + ".webp")
                for key in ["energy", "fixed", "attack", "acquire", "fireball", "heal", "spell"]}
    title = {"wallpaper-original": sync("reconstruction/wallpaper-snow-road-1016.webp"),
             "wordmark": sync("title-wordmark.png")}
    hub = {"hub-bg-rhine": sync("scenes/hub-wallpaper.webp")}
    hub["achievement-painted"] = sync("ui/achievement-styles/painted.webp")
    for folder in ["icons/base-v3", "icons/base-v12"]:
        for image in sorted((ASSETS / folder).glob("*.webp")):
            hub[image.stem] = sync(image.relative_to(ASSETS).as_posix())
            hub[folder.split("/")[-1] + "/" + image.stem] = hub[image.stem]
    node_source = (GAME / "src/core/map-node-art.js").read_text(encoding="utf-8")
    node_icons, node_bounds = {}, {}
    for match in re.finditer(r"(\w+):\s*\{\s*url:new URL\('../../assets/([^']+)'[^\n]+bounds:\[([\d,]+)\]", node_source):
        node_icons[match[1]] = sync(match[2])
        node_bounds[match[1]] = [int(value) for value in match[3].split(",")]
    map_art = {"atmosphere": sync("scenes/map-nodes/map-atmosphere-is7-1012.webp"),
               "cityGhost": sync("scenes/map-nodes/city-ghost-props-a-1012.webp")}
    for layer, environment in enumerate(["outskirts", "watchline", "ruins", "core"]):
        map_art["environment:" + str(layer)] = sync("scenes/map-environment-1021/" + environment + "-simple.webp")
    home_icons = {key: sync("ui/home-nodes-1015/" + key + "-v1.webp")
                  for key in ["achievement", "city", "credits", "exit", "guide", "photo", "settings"]}
    card_backs = {key: sync("card-backs/" + key + ".webp")
                  for key in ["classic", "wolf", "coin", "vault", "boss", "altar", "pet"]}
    frame_layout = json.loads((GAME / "data/card-frame-layout.json").read_text(encoding="utf-8"))
    card_frames = {key: sync(frame["path"]) for key, frame in frame_layout.items()}
    card_frames["interior"] = sync("ui/card-frames/paper-1015/interior.webp")
    skins, skin_rows = {}, []
    for character_id, options in data["skins"].items():
        for option in options:
            path = sync(option["file"])
            skins[character_id + "/" + option["id"]] = path
            skin_rows.append({"characterId": character_id, "id": option["id"], "name": option["name"], "resource": path})
    music = {}
    from urllib.parse import unquote, urlparse
    for key, value in data["music"].items():
        path = Path(unquote(urlparse(value).path).lstrip("/")).as_posix()
        relative = path.split("/assets/", 1)[1]
        music[key] = sync(relative)
    sync("battle/fx-atlas.webp")
    sync("scenes/ui-loop-0925/rewards-convoy-fail.webp")
    cues = {"_policy": data["audioPolicy"]}
    for key, cue in data["samples"].items():
        cues[key] = dict(cue)
        cues[key]["files"] = [sync(p) for p in cue["files"]]

    generated = "// Generated by _planning/migration-1029/ui/sync_assets.py; source: current Vite assets.\nusing System.Collections.Generic;\n\nnamespace Sdt.Res\n{\n    public static class CurrentAssets\n    {\n"
    for name, values in [("CardIllustrations", cards), ("CardFamilies", card_families),
                         ("Portraits", portraits), ("BattlePortraits", battle), ("Avatars", avatars),
                         ("CharacterIds", aliases), ("EnemyPortraits", enemies), ("Scenes", scenes),
                         ("BattleLayers", layers), ("BattleControls", controls), ("Titles", title), ("Hub", hub), ("CardBacks", card_backs),
                         ("NodeIcons", node_icons), ("MapArt", map_art), ("HomeIcons", home_icons), ("CardFrames", card_frames), ("Music", music), ("Skins", skins)]:
        generated += dictionary(name, values) + "\n"
    generated += "        public static readonly IReadOnlyDictionary<string, int[]> NodeBounds = new Dictionary<string, int[]>\n        {\n"
    for key, bounds in sorted(node_bounds.items()):
        generated += "            { " + quote(key) + ", new[] { " + ", ".join(str(v) for v in bounds) + " } },\n"
    generated += "        };\n"
    generated += "    }\n}\n"
    write_text(PROJECT / "Assets/Scripts/Sdt.Res/CurrentAssets.cs", generated)
    write_text(RESOURCES / "Data/CurrentAudioCues.json", json.dumps(cues, ensure_ascii=False, indent=2) + "\n")
    write_text(RESOURCES / "Data/CurrentAchievements.json", (GAME / "data/achievements.json").read_text(encoding="utf-8"))
    write_text(RESOURCES / "Data/CurrentPets.json", (GAME / "data/pets.json").read_text(encoding="utf-8"))
    write_text(RESOURCES / "Data/NarrativeEvents.json", json.dumps(data["story"], ensure_ascii=False, separators=(",", ":")) + "\n")
    milestones = [dict(item, need=0 if item["need"] == "all" else item["need"], all=item["need"] == "all") for item in data["milestones"]]
    write_text(RESOURCES / "Data/CurrentHubCatalog.json", json.dumps({"goods": data["goods"], "skins": skin_rows,
               "milestones": milestones, "baseNotes": data["baseNotes"]}, ensure_ascii=False, indent=2) + "\n")
    receipt = {"source": "搜打撤/game", "counts": {"cardIllustrations": len(cards), "characters": len(portraits),
               "enemies": len(enemies), "sceneAliases": len(scenes), "audioCues": len(cues)},
               "knots": data["knots"], "missingSourceImages": sorted(set(missing)),
               "files": sorted(records.values(), key=lambda r: r["source"])}
    write_text(REPORT, json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"ok": True, "counts": receipt["counts"], "files": len(records),
                      "missingSourceImages": sorted(set(missing)),
                      "bytes": sum(r["bytes"] for r in records.values())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
