"""Trace transparent winter UI artwork into compact, coloured SVG paths."""

from __future__ import annotations

import argparse
import html
from pathlib import Path

import cv2
import numpy as np


def read_rgba(path: Path) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"Cannot read image: {path}")
    if image.ndim != 3 or image.shape[2] != 4:
        raise ValueError(f"Expected a transparent RGBA image: {path}")
    return cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)


def foreground(alpha: np.ndarray) -> np.ndarray:
    mask = (alpha >= 18).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    clean = np.zeros_like(mask)
    minimum = max(12, mask.size // 120000)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= minimum:
            clean[labels == label] = 1
    return clean


def crop_to_subject(rgba: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.where(mask > 0)
    if not len(xs):
        raise ValueError("No foreground detected")
    pad = max(6, round(max(xs.max() - xs.min(), ys.max() - ys.min()) * 0.025))
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad + 1)
    return rgba[y0:y1, x0:x1], mask[y0:y1, x0:x1]


def contour_path(contour: np.ndarray) -> str:
    epsilon = max(0.55, cv2.arcLength(contour, True) * 0.0015)
    points = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
    if len(points) < 3:
        return ""
    return "M" + "L".join(f"{int(x)} {int(y)}" for x, y in points) + "Z"


def trace(rgba: np.ndarray, mask: np.ndarray, colours: int, title: str) -> str:
    rgb = cv2.bilateralFilter(rgba[:, :, :3], 7, 26, 26)
    samples = rgb[mask > 0].reshape(-1, 3).astype(np.float32)
    count = min(colours, max(2, len(samples) // 40))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 45, 0.35)
    cv2.setRNGSeed(17)
    _, labels, palette = cv2.kmeans(samples, count, None, criteria, 4, cv2.KMEANS_PP_CENTERS)
    palette = np.clip(np.rint(palette), 0, 255).astype(np.uint8)
    layers = np.full(mask.shape, -1, np.int16)
    layers[mask > 0] = labels.ravel()
    order = np.argsort(palette.mean(axis=1))[::-1]

    paths: list[str] = []
    for index in order:
        layer = (layers == index).astype(np.uint8) * 255
        layer = cv2.morphologyEx(layer, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        contours, hierarchy = cv2.findContours(layer, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            continue
        for i, contour in enumerate(contours):
            if hierarchy[0][i][3] != -1 or cv2.contourArea(contour) < 5:
                continue
            pieces = [contour_path(contour)]
            child = hierarchy[0][i][2]
            while child != -1:
                pieces.append(contour_path(contours[child]))
                child = hierarchy[0][child][0]
            path = "".join(piece for piece in pieces if piece)
            if path:
                colour = "#{:02x}{:02x}{:02x}".format(*palette[index])
                paths.append(f'  <path d="{path}" fill="{colour}" fill-rule="evenodd"/>')

    height, width = mask.shape
    return "\n".join((
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img">',
        f"  <title>{html.escape(title)}</title>",
        *paths,
        "</svg>",
        "",
    ))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--colours", type=int, default=12)
    args = parser.parse_args()

    rgba = read_rgba(args.source)
    mask = foreground(rgba[:, :, 3])
    rgba, mask = crop_to_subject(rgba, mask)
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_text(trace(rgba, mask, args.colours, args.title), encoding="utf-8")
    print(f"{args.destination}: {rgba.shape[1]}x{rgba.shape[0]}, {int(mask.sum())} foreground pixels")


if __name__ == "__main__":
    main()
