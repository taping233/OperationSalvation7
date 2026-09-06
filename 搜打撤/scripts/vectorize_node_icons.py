"""Remove near-white backgrounds and trace generated node icons into real SVG paths."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


NAMES = (
    "altar", "battle", "boss", "chest", "door", "entrance",
    "event", "extract", "fire", "key", "player", "shop",
)

THEMES = {
    "altar": ("#35224f", "#7552a8", "#d5c1f0"),
    "battle": ("#4a1825", "#b63f50", "#ff9b7d"),
    "boss": ("#1d1838", "#51417f", "#aa9bd3"),
    "chest": ("#44301b", "#b47a29", "#f2cb70"),
    "door": ("#173843", "#397f91", "#a2dbe2"),
    "entrance": ("#163b34", "#31866f", "#9bd9c2"),
    "event": ("#442040", "#9e4c8a", "#e5a5d0"),
    "extract": ("#183c2a", "#3e9162", "#a7ddbb"),
    "fire": ("#491b20", "#c44b3e", "#ffb05a"),
    "key": ("#493917", "#b9922f", "#f4dc7c"),
    "player": ("#1c2945", "#4c6a9e", "#a9c4e0"),
    "shop": ("#452334", "#9d536f", "#e5a6bc"),
}


def hex_rgb(value: str) -> np.ndarray:
    return np.array([int(value[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def themed_palette(name: str, count: int) -> np.ndarray:
    shadow, middle, light = (hex_rgb(value) for value in THEMES[name])
    colours = []
    for index in range(count):
        # Palettes are ordered light-to-dark; spread the generated greys across
        # the full semantic theme so every icon remains legible at node size.
        t = 1.0 - index / max(1, count - 1)
        if t < 0.52:
            colour = shadow + (middle - shadow) * (t / 0.52)
        else:
            colour = middle + (light - middle) * ((t - 0.52) / 0.48)
        colours.append(np.clip(np.rint(colour), 0, 255).astype(np.uint8))
    return np.stack(colours)


def read_image(path: Path) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Cannot read image: {path}")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    band = max(8, min(h, w) // 40)
    border = np.concatenate((
        rgb[:band].reshape(-1, 3), rgb[-band:].reshape(-1, 3),
        rgb[:, :band].reshape(-1, 3), rgb[:, -band:].reshape(-1, 3),
    ))
    background = np.median(border, axis=0).astype(np.float32)
    pixels = rgb.astype(np.float32)
    colour_distance = np.linalg.norm(pixels - background, axis=2)
    luminance = pixels.mean(axis=2)
    saturation = pixels.max(axis=2) - pixels.min(axis=2)
    mask = ((colour_distance > 10) | (luminance < 242) | (saturation > 13)).astype(np.uint8)

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    clean = np.zeros_like(mask)
    min_area = max(40, h * w // 45000)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= min_area:
            clean[labels == label] = 1
    return clean


def fitted_icon(rgb: np.ndarray, mask: np.ndarray, size: int = 512) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.where(mask > 0)
    if not len(xs):
        raise ValueError("No foreground detected")
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = max(12, int(max(x1 - x0, y1 - y0) * 0.035))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
    crop_rgb, crop_mask = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    scale = 456 / max(crop_rgb.shape[:2])
    nw, nh = max(1, round(crop_rgb.shape[1] * scale)), max(1, round(crop_rgb.shape[0] * scale))
    resized_rgb = cv2.resize(crop_rgb, (nw, nh), interpolation=cv2.INTER_AREA)
    resized_mask = cv2.resize(crop_mask, (nw, nh), interpolation=cv2.INTER_NEAREST)
    canvas_rgb = np.full((size, size, 3), 255, np.uint8)
    canvas_mask = np.zeros((size, size), np.uint8)
    ox, oy = (size - nw) // 2, (size - nh) // 2
    canvas_rgb[oy:oy + nh, ox:ox + nw] = resized_rgb
    canvas_mask[oy:oy + nh, ox:ox + nw] = resized_mask
    return canvas_rgb, canvas_mask


def quantize(rgb: np.ndarray, mask: np.ndarray, colours: int = 12) -> tuple[np.ndarray, np.ndarray]:
    smoothed = cv2.bilateralFilter(rgb, 7, 28, 28)
    samples = smoothed[mask > 0].reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
    cv2.setRNGSeed(7)
    _, labels, palette = cv2.kmeans(samples, colours, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
    palette = np.clip(np.rint(palette), 0, 255).astype(np.uint8)
    label_map = np.full(mask.shape, -1, np.int16)
    label_map[mask > 0] = labels.ravel()
    order = np.argsort(palette.mean(axis=1))[::-1]
    return label_map, palette[order]


def contour_path(contour: np.ndarray) -> str:
    epsilon = max(0.7, cv2.arcLength(contour, True) * 0.0022)
    points = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
    if len(points) < 3:
        return ""
    return "M" + "L".join(f"{int(x)} {int(y)}" for x, y in points) + "Z"


def trace_svg(rgb: np.ndarray, mask: np.ndarray, title: str) -> str:
    _, ordered_palette = quantize(rgb, mask)
    original_pixels = rgb[mask > 0].reshape(-1, 3).astype(np.int32)
    # Remap each foreground pixel to the nearest luminance-sorted palette colour.
    distances = ((original_pixels[:, None, :] - ordered_palette[None, :, :].astype(np.int32)) ** 2).sum(axis=2)
    remapped = np.full(mask.shape, -1, np.int16)
    remapped[mask > 0] = distances.argmin(axis=1)
    output_palette = themed_palette(title, len(ordered_palette))
    paths: list[str] = []
    for index, _ in enumerate(ordered_palette):
        layer = (remapped == index).astype(np.uint8) * 255
        layer = cv2.morphologyEx(layer, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        contours, hierarchy = cv2.findContours(layer, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            continue
        hierarchy = hierarchy[0]
        for i, contour in enumerate(contours):
            if hierarchy[i][3] != -1 or cv2.contourArea(contour) < 7:
                continue
            pieces = [contour_path(contour)]
            child = hierarchy[i][2]
            while child != -1:
                pieces.append(contour_path(contours[child]))
                child = hierarchy[child][0]
            d = "".join(piece for piece in pieces if piece)
            if d:
                fill = "#{:02x}{:02x}{:02x}".format(*output_palette[index])
                paths.append(f'  <path d="{d}" fill="{fill}" fill-rule="evenodd"/>')
    return "\n".join((
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">',
        f"  <title>{title}</title>",
        *paths,
        "</svg>",
        "",
    ))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        rgb = read_image(args.source / f"{name}.png")
        mask = foreground_mask(rgb)
        fitted_rgb, fitted_mask = fitted_icon(rgb, mask)
        svg = trace_svg(fitted_rgb, fitted_mask, name)
        (args.destination / f"{name}.svg").write_text(svg, encoding="utf-8")
        print(f"{name}: {int(fitted_mask.sum())} foreground pixels")


if __name__ == "__main__":
    main()
