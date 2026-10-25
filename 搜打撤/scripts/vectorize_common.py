"""Shared contour tracing for the node and winter artwork converters."""

import cv2
import numpy as np


def contour_path(contour, minimum, relative):
    epsilon = max(minimum, cv2.arcLength(contour, True) * relative)
    points = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
    if len(points) < 3:
        return ""
    return "M" + "L".join(f"{int(x)} {int(y)}" for x, y in points) + "Z"


def layer_paths(mask, colour, minimum_area, trace_contour):
    layer = mask.astype(np.uint8) * 255
    layer = cv2.morphologyEx(layer, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, hierarchy = cv2.findContours(layer, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    if hierarchy is None:
        return paths
    hierarchy = hierarchy[0]
    fill = "#{:02x}{:02x}{:02x}".format(*colour)
    for i, contour in enumerate(contours):
        if hierarchy[i][3] != -1 or cv2.contourArea(contour) < minimum_area:
            continue
        pieces = [trace_contour(contour)]
        child = hierarchy[i][2]
        while child != -1:
            pieces.append(trace_contour(contours[child]))
            child = hierarchy[child][0]
        path = "".join(piece for piece in pieces if piece)
        if path:
            paths.append(f'  <path d="{path}" fill="{fill}" fill-rule="evenodd"/>')
    return paths
