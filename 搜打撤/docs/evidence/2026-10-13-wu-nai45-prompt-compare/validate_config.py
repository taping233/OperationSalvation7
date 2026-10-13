"""Validate the minimal scoped Codex network config change without rewriting TOML."""

import sys
from pathlib import Path

import tomli

TARGET = Path(r"D:\素材\代号柒\.codex\config.toml")
ADDITION = (
    "\r\n[sandbox_workspace_write]\r\n"
    "network_access = true\r\n"
    "\r\n[features.network_proxy]\r\n"
    "enabled = true\r\n"
    'domains = { "image.novelai.net" = "allow" }\r\n'
)


def validate(original, candidate):
    before = tomli.loads(original)
    after = tomli.loads(candidate)
    assert "sandbox_workspace_write" not in before
    assert "features" not in before
    assert after.pop("sandbox_workspace_write") == {"network_access": True}
    assert after.pop("features") == {
        "network_proxy": {
            "enabled": True,
            "domains": {"image.novelai.net": "allow"},
        }
    }
    assert after == before
    assert candidate == original + ADDITION


if __name__ == "__main__":
    if len(sys.argv) == 1:
        content = TARGET.read_bytes().decode("utf-8")
        validate(content, content + ADDITION)
        print("Candidate TOML parsed; only intended network keys added")
    else:
        original = Path(sys.argv[1]).read_bytes().decode("utf-8")
        candidate = TARGET.read_bytes().decode("utf-8")
        validate(original, candidate)
        print("Applied TOML parsed; non-target structure and text unchanged")
