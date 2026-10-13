"""Guarded invalid-body NAI probe: verifies authenticated HTTPS, never generates an image."""

import sys
from pathlib import Path

import requests

PROJECT = Path(__file__).absolute().parents[3]
ROOT = PROJECT.parent
sys.path.insert(0, str(PROJECT / "tools"))
from nai_guard import RequestGuard  # noqa: E402

token_file = ROOT / ".tmp" / "nai" / "token.txt"
token = next(line.strip() for line in token_file.read_text(encoding="utf-8").splitlines()
             if line.strip() and not line.lstrip().startswith("#"))
guard = RequestGuard(ROOT / ".tmp" / "nai")


def send():
    session = requests.Session()
    session.trust_env = "--direct" not in sys.argv
    response = session.post(
        "https://image.novelai.net/ai/generate-image",
        headers={"Authorization": "Bearer " + token}, json={}, timeout=15,
    )
    print("transport_http", response.status_code, "server", response.headers.get("server", ""))
    return response.status_code


guard.perform(832, 1216, send)
