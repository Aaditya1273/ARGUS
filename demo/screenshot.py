"""Capture ARGUS dashboard screenshots for the README.

Usage:
    python demo/screenshot.py --url http://localhost:3301

Requires playwright: pip install playwright && playwright install chromium
"""

import argparse
import os
import sys
from pathlib import Path

PAGES = [
    ("mission-control", "Mission Control"),
    ("cost-firewall", "Cost Firewall"),
    ("agent-dna", "Agent DNA"),
    ("governance", "Governance"),
    ("prompt-replay", "Prompt Replay"),
]

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("pip install playwright && playwright install chromium")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Capture ARGUS screenshots")
    parser.add_argument("--url", default="http://localhost:3301", help="Base URL")
    parser.add_argument("--out", default="docs/screenshots", help="Output directory")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        for slug, title in PAGES:
            url = f"{args.url}/{slug}"
            path = out / f"{slug}.png"
            print(f"  Capturing {title} at {url}...")
            try:
                page.goto(url, wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(2000)
                page.screenshot(path=str(path), full_page=True)
                print(f"    -> {path}")
            except Exception as e:
                print(f"    FAILED: {e}")

        browser.close()

    print("Done. To embed in README: docs/screenshots/<page>.png")


if __name__ == "__main__":
    main()
