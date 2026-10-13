"""One guarded full-chain NAI 4.5 probe using Python TLS in the new sandbox."""

import hashlib
import json
import sys
from pathlib import Path

import requests

PROJECT = Path(__file__).absolute().parents[3]
ROOT = PROJECT.parent
HERE = Path(__file__).absolute().parent
sys.path.insert(0, str(PROJECT / "tools"))
_resolve = Path.resolve
Path.resolve = lambda self, strict=False: self.absolute()
import nai_gen  # noqa: E402
Path.resolve = _resolve


def python_https_transport(payload_file, zip_file, token, channel):
    session = requests.Session()
    session.trust_env = False
    response = session.post(
        nai_gen.ENDPOINT,
        data=payload_file.read_bytes(),
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json"},
        timeout=120,
    )
    zip_file.write_bytes(response.content)
    return str(response.status_code)


body = json.loads((HERE / "B-compact-request.json").read_text(encoding="utf-8"))
params = body["parameters"]
use_default = "--default" in sys.argv
name = "network-default-probe.png" if use_default else "network-requests-probe.png"
out = ROOT / ".tmp" / "nai" / "output" / "wu-prompt-compare-20261013" / name
nai_gen.generate_image(
    body["input"], params["negative_prompt"],
    params["characterPrompts"][0]["prompt"],
    params["width"], params["height"], params["seed"],
    out=out, model=body["model"],
    **({} if use_default else {"transport": python_https_transport}),
)
print("sha256", hashlib.sha256(out.read_bytes()).hexdigest())
