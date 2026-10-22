#!/usr/bin/env python3
"""Check tracked Markdown's local file links and documentation SVGs (stdlib only).

Remote URLs and heading anchors are intentionally not validated. No network access
is required. Generated/untracked trees such as node_modules are not scanned.
"""
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+\"[^\"]*\")?\)")


def main():
    paths = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "*.md", "*.svg"], cwd=ROOT
    ).decode().split("\0")
    # Include new project docs before they have been added to Git.
    paths += subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard", "-z", "--", "*.md", "*.svg"], cwd=ROOT
    ).decode().split("\0")
    errors = []
    checked = 0
    for name in sorted(set(filter(None, paths))):
        path = ROOT / name
        if not path.is_file():
            continue  # Locally deleted tracked file.
        if path.suffix == ".svg":
            try:
                tree = ET.parse(path)
                ns = "{http://www.w3.org/2000/svg}"
                if tree.getroot().tag != ns + "svg":
                    errors.append(f"{name}: expected an SVG root")
                if not tree.findtext(ns + "title") or not tree.findtext(ns + "desc"):
                    errors.append(f"{name}: SVG needs a title and description")
            except ET.ParseError as exc:
                errors.append(f"{name}: invalid SVG: {exc}")
            continue
        # Ignore fenced examples, which may intentionally show illustrative links.
        text = re.sub(r"^(`{3,}|~{3,}).*?^\1[^\n]*$", "", path.read_text(), flags=re.M | re.S)
        for match in LINK.finditer(text):
            href = match.group(1)
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href) or href.startswith(("#", "//")):
                continue
            target = unquote(href.split("#", 1)[0].split("?", 1)[0])
            if not target:
                continue
            checked += 1
            if not (path.parent / target).exists():
                errors.append(f"{name}: missing local target: {href}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Documentation OK: {checked} local file links checked; SVG metadata valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
